// Turning waves into Web Audio sample buffers.

import type { Wave, WaveKind } from './wave.ts';

export interface WaveBuffer {
  buffer: AudioBuffer;
  kind: WaveKind;
}

/** The part of an audio context needed to make buffers; tests pass a fake. */
export type BufferFactory = Pick<BaseAudioContext, 'sampleRate' | 'createBuffer'>;

/** A cycle buffer has at least this many samples, so short grids still loop smoothly. */
const MIN_CYCLE_SAMPLES = 512;
/** The repeating noise pattern is 127 steps of a 7-bit shift register. */
const METALLIC_PATTERN_STEPS = 127;
/** One-shots fade out over their last few milliseconds to avoid a click. */
const SHOT_FADE_SECONDS = 0.004;

/**
 * Builds the samples for a wave.
 * - cycle: one period, centred on zero and scaled to full volume; played
 *   looped, at a rate that gives the note's pitch.
 * - shot: the grid played once over `shotMs`.
 * - noise: one second of random steps held for one grain each, or the
 *   metallic repeating pattern.
 */
export function buildWaveBuffer(
  context: BufferFactory,
  wave: Wave,
  random: () => number = Math.random,
): WaveBuffer {
  if (wave.kind === 'noise') return { buffer: noiseBuffer(context, wave, random), kind: 'noise' };
  if (wave.kind === 'shot') return { buffer: shotBuffer(context, wave), kind: 'shot' };
  return { buffer: cycleBuffer(context, wave), kind: 'cycle' };
}

/** A column's level as a sample from -1 to 1. */
function sampleOf(wave: Wave, column: number): number {
  return ((wave.columns[column] as number) / (wave.levels - 1)) * 2 - 1;
}

/** The sample at a fractional column position, held or smoothed. */
function sampleAt(wave: Wave, position: number, nextColumn: (column: number) => number): number {
  const column = Math.floor(position);
  const value = sampleOf(wave, column);
  if (!wave.smooth) return value;
  const fraction = position - column;
  return value + (sampleOf(wave, nextColumn(column)) - value) * fraction;
}

function cycleBuffer(context: BufferFactory, wave: Wave): AudioBuffer {
  const width = wave.columns.length;
  const samplesPerColumn = Math.ceil(MIN_CYCLE_SAMPLES / width);
  const length = width * samplesPerColumn;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);

  let sum = 0;
  for (let i = 0; i < length; i++) {
    data[i] = sampleAt(wave, i / samplesPerColumn, (column) => (column + 1) % width);
    sum += data[i] as number;
  }

  // Centre on zero (a wave drawn above or below the middle would otherwise
  // be offset), then scale to full volume.
  const mean = sum / length;
  let peak = 0;
  for (let i = 0; i < length; i++) {
    data[i] = (data[i] as number) - mean;
    peak = Math.max(peak, Math.abs(data[i] as number));
  }
  if (peak > 0) {
    for (let i = 0; i < length; i++) data[i] = (data[i] as number) / peak;
  }
  return buffer;
}

function shotBuffer(context: BufferFactory, wave: Wave): AudioBuffer {
  const sampleRate = context.sampleRate;
  const width = wave.columns.length;
  const length = Math.max(16, Math.round((wave.shotMs / 1000) * sampleRate));
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    data[i] = sampleAt(wave, (i / length) * width, (column) => Math.min(width - 1, column + 1));
  }

  const fade = Math.min(length >> 2, Math.round(sampleRate * SHOT_FADE_SECONDS));
  for (let k = 0; k < fade; k++)
    data[length - 1 - k] = (data[length - 1 - k] as number) * (k / fade);
  return buffer;
}

function noiseBuffer(context: BufferFactory, wave: Wave, random: () => number): AudioBuffer {
  const sampleRate = context.sampleRate;
  const grain = Math.max(1, Math.round(sampleRate / Math.max(200, wave.noiseRateHz)));

  if (wave.metallic) {
    const buffer = context.createBuffer(1, METALLIC_PATTERN_STEPS * grain, sampleRate);
    const data = buffer.getChannelData(0);
    let register = 0x7f;
    for (let step = 0; step < METALLIC_PATTERN_STEPS; step++) {
      const bit = (register ^ (register >> 1)) & 1;
      register = (register >> 1) | (bit << 6);
      data.fill(register & 1 ? 1 : -1, step * grain, (step + 1) * grain);
    }
    return buffer;
  }

  const length = Math.floor(sampleRate / grain) * grain;
  const buffer = context.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let start = 0; start < length; start += grain) {
    data.fill(random() * 2 - 1, start, Math.min(start + grain, length));
  }
  return buffer;
}

/**
 * Remembers built buffers, so a wave is only built again after it changes.
 * Keeps the most recent `capacity` buffers.
 */
export class WaveBufferCache {
  private readonly buffers = new Map<string, WaveBuffer>();
  private readonly capacity: number;

  constructor(capacity = 240) {
    this.capacity = capacity;
  }

  get(context: BufferFactory, wave: Wave): WaveBuffer {
    const key = [
      wave.kind,
      wave.levels,
      wave.smooth ? 1 : 0,
      wave.shotMs,
      wave.noiseRateHz,
      wave.metallic ? 1 : 0,
      wave.columns.join(','),
    ].join('|');
    let built = this.buffers.get(key);
    if (!built) {
      built = buildWaveBuffer(context, wave);
      this.buffers.set(key, built);
      if (this.buffers.size > this.capacity) {
        const oldest = this.buffers.keys().next().value as string;
        this.buffers.delete(oldest);
      }
    }
    return built;
  }
}
