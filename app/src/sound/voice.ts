// Playing one note: a few Web Audio nodes with scheduled envelopes.

import type { WaveBufferCache } from './buffers.ts';
import { envelopeShape } from './envelope.ts';
import type { Instrument } from './instrument.ts';
import type { Wave, WaveKind } from './wave.ts';

/** Where a voice plays, and what it shares with other voices. */
export interface VoiceOutput {
  context: BaseAudioContext;
  destination: AudioNode;
  /** Sources still sounding, so playback can stop them and limit how many play at once. */
  sources: Set<AudioBufferSourceNode>;
  buffers: WaveBufferCache;
}

/** Beyond this many sounding sources, new notes are skipped to protect the audio thread. */
const MAX_SOURCES = 180;
/** Level of one voice at volume 1, leaving headroom for chords and layers. */
const VOICE_LEVEL = 0.28;
const MIN_NOTE_SECONDS = 0.02;
/** Sources stop a moment after the release ends. */
const STOP_DELAY = 0.03;
/** Noise follows pitch relative to middle C. */
const NOISE_REFERENCE_HZ = 261.63;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** How fast to play a wave's buffer so it sounds at `frequency`. */
export function playbackRate(
  kind: WaveKind,
  bufferLength: number,
  sampleRate: number,
  followsPitch: boolean,
  frequency: number,
  referenceHz: number,
): number {
  let rate: number;
  if (kind === 'cycle') {
    // The buffer is one period, so it must repeat `frequency` times a second.
    rate = ((followsPitch ? frequency : referenceHz) * bufferLength) / sampleRate;
  } else if (kind === 'shot') {
    rate = followsPitch ? frequency / referenceHz : 1;
  } else {
    rate = followsPitch ? frequency / NOISE_REFERENCE_HZ : 1;
  }
  return clamp(rate, 0.001, 256);
}

/**
 * How much of wave B a pitch pair uses at `frequency`: 0 at or below
 * reference A, 1 at or above reference B, blended in between by pitch.
 */
export function pitchPairBlend(instrument: Instrument, frequency: number): number {
  const { followsPitch, referenceA, referenceB } = instrument;
  if (!followsPitch || !(referenceA > 0) || !(referenceB > 0) || referenceA === referenceB)
    return 0;
  return clamp(Math.log2(frequency / referenceA) / Math.log2(referenceB / referenceA), 0, 1);
}

/** Schedules one note. Does nothing if its waves are missing or too much is playing. */
export function playVoice(
  output: VoiceOutput,
  instrument: Instrument,
  waveFor: (id: string) => Wave | undefined,
  frequency: number,
  startTime: number,
  durationSeconds: number,
): void {
  const { context } = output;
  if (output.sources.size > MAX_SOURCES) return;
  const waveA = waveFor(instrument.waveA);
  if (!waveA) return;
  const waveB =
    instrument.kind !== 'single' && instrument.waveB ? waveFor(instrument.waveB) : undefined;
  const duration = Math.max(durationSeconds, MIN_NOTE_SECONDS);

  // Volume envelope.
  const amp = context.createGain();
  amp.gain.value = 0;
  amp.connect(output.destination);
  const volume = envelopeShape(instrument.volumeEnvelope, duration, 1);
  const level = VOICE_LEVEL * instrument.volume;
  amp.gain.setValueAtTime(0, startTime);
  for (const [time, value] of volume.points.slice(1)) {
    amp.gain.linearRampToValueAtTime(value * level, startTime + time);
  }
  const stopTime = startTime + volume.end + STOP_DELAY;

  const playWave = (wave: Wave, referenceHz: number, destination: AudioNode) => {
    const { buffer, kind } = output.buffers.get(context, wave);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = kind !== 'shot';
    source.playbackRate.value = playbackRate(
      kind,
      buffer.length,
      context.sampleRate,
      instrument.followsPitch,
      frequency,
      referenceHz,
    );
    const { startCents, glideSeconds } = instrument.pitchEnvelope;
    if (startCents) {
      source.detune.setValueAtTime(startCents, startTime);
      source.detune.setTargetAtTime(0, startTime, Math.max(0.002, glideSeconds / 4));
    }
    source.connect(destination);
    source.start(startTime);
    source.stop(stopTime);
    output.sources.add(source);
    source.onended = () => {
      output.sources.delete(source);
      source.disconnect();
    };
  };

  const gain = (value: number) => {
    const node = context.createGain();
    node.gain.value = value;
    node.connect(amp);
    return node;
  };

  if (!waveB) {
    playWave(waveA, instrument.referenceA, amp);
  } else if (instrument.kind === 'pitchPair') {
    // Waves that would be nearly silent are skipped.
    const blend = pitchPairBlend(instrument, frequency);
    if (blend < 0.99) playWave(waveA, instrument.referenceA, gain(1 - blend));
    if (blend > 0.01) playWave(waveB, instrument.referenceB, gain(blend));
  } else {
    // Morph: crossfade from A to B following the morph envelope, which ends
    // with the volume envelope at the latest.
    const morph = envelopeShape(
      instrument.morphEnvelope,
      duration,
      clamp(instrument.morphEnvelope.depth, 0, 1),
    );
    const gainA = gain(1);
    const gainB = gain(0);
    gainA.gain.setValueAtTime(1, startTime);
    gainB.gain.setValueAtTime(0, startTime);
    for (const [time, value] of morph.points.slice(1)) {
      const at = startTime + Math.min(time, volume.end);
      gainA.gain.linearRampToValueAtTime(1 - value, at);
      gainB.gain.linearRampToValueAtTime(value, at);
    }
    playWave(waveA, instrument.referenceA, gainA);
    playWave(waveB, instrument.referenceB, gainB);
  }
}
