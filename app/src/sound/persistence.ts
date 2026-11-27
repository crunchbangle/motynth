// Saving the sound library in the browser, and reading it back.
//
// Saved data comes from older versions of the app and from people's
// browsers, so it is read defensively: anything missing or malformed falls
// back to a default, and a library that can't be used at all is replaced by
// the starter sounds.

import {
  DEFAULT_MORPH_ENVELOPE,
  DEFAULT_PITCH_ENVELOPE,
  DEFAULT_VOLUME_ENVELOPE,
  createInstrument,
  type Envelope,
  type Instrument,
  type InstrumentKind,
  type MorphEnvelope,
} from './instrument.ts';
import { starterLibrary, type SoundLibrary } from './library.ts';
import { type Wave, type WaveKind } from './wave.ts';

/** The part of `localStorage` this needs; tests pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const LIBRARY_KEY = 'motynth.library.v2';
/** Where the original prototype saved, in an older format. Read once, never written. */
export const PROTOTYPE_LIBRARY_KEY = 'motynth.lib.v1';

export function saveLibrary(store: KeyValueStore, library: SoundLibrary): void {
  store.setItem(LIBRARY_KEY, JSON.stringify(library));
}

/** The saved library, else the prototype's saved library converted, else the starter sounds. */
export function loadLibrary(store: KeyValueStore): SoundLibrary {
  return (
    readLibrary(store.getItem(LIBRARY_KEY), readWave, readInstrument) ??
    readLibrary(
      store.getItem(PROTOTYPE_LIBRARY_KEY),
      readPrototypeWave,
      readPrototypeInstrument,
      'insts',
    ) ??
    starterLibrary()
  );
}

type Json = Record<string, unknown>;

function readLibrary(
  text: string | null,
  toWave: (raw: Json) => Wave | null,
  toInstrument: (raw: Json) => Instrument,
  instrumentsKey = 'instruments',
): SoundLibrary | null {
  const raw = parseObject(text);
  if (!raw) return null;
  const waves = objects(raw.waves)
    .map(toWave)
    .filter((wave): wave is Wave => wave !== null);
  const instruments = objects(raw[instrumentsKey]).map(toInstrument);
  if (waves.length === 0 || instruments.length === 0) return null;
  return { waves, instruments: instruments.map((i) => withValidWaves(i, waves)) };
}

/** Points instruments at waves that exist. */
function withValidWaves(instrument: Instrument, waves: readonly Wave[]): Instrument {
  const exists = (id: string | null) => waves.some((wave) => wave.id === id);
  return {
    ...instrument,
    waveA: exists(instrument.waveA) ? instrument.waveA : (waves[0] as Wave).id,
    waveB: exists(instrument.waveB) ? instrument.waveB : null,
  };
}

// ---------------------------------------------------------------------------
// The current format

function readWave(raw: Json): Wave | null {
  const columns = numberArray(raw.columns);
  if (typeof raw.id !== 'string' || columns.length === 0) return null;
  return {
    id: raw.id,
    name: text(raw.name, raw.id),
    kind: waveKind(raw.kind),
    columns,
    levels: number(raw.levels, 16),
    smooth: raw.smooth === true,
    shotMs: number(raw.shotMs, 90),
    noiseRateHz: number(raw.noiseRateHz, 11025),
    metallic: raw.metallic === true,
  };
}

function readInstrument(raw: Json): Instrument {
  const defaults = createInstrument(text(raw.name, 'inst'));
  return {
    name: defaults.name,
    kind: instrumentKind(raw.kind),
    waveA: text(raw.waveA, defaults.waveA),
    waveB: typeof raw.waveB === 'string' ? raw.waveB : null,
    referenceA: number(raw.referenceA, defaults.referenceA),
    referenceB: number(raw.referenceB, defaults.referenceB),
    followsPitch: raw.followsPitch !== false,
    volume: number(raw.volume, defaults.volume),
    volumeEnvelope: envelope(object(raw.volumeEnvelope), DEFAULT_VOLUME_ENVELOPE),
    morphEnvelope: morphEnvelope(object(raw.morphEnvelope)),
    pitchEnvelope: {
      startCents: number(object(raw.pitchEnvelope)?.startCents, DEFAULT_PITCH_ENVELOPE.startCents),
      glideSeconds: number(
        object(raw.pitchEnvelope)?.glideSeconds,
        DEFAULT_PITCH_ENVELOPE.glideSeconds,
      ),
    },
  };
}

function envelope(raw: Json | null, defaults: Envelope): Envelope {
  return {
    attack: number(raw?.attack, defaults.attack),
    decay: number(raw?.decay, defaults.decay),
    sustain: number(raw?.sustain, defaults.sustain),
    release: number(raw?.release, defaults.release),
  };
}

function morphEnvelope(raw: Json | null): MorphEnvelope {
  return {
    ...envelope(raw, DEFAULT_MORPH_ENVELOPE),
    depth: number(raw?.depth, DEFAULT_MORPH_ENVELOPE.depth),
  };
}

// ---------------------------------------------------------------------------
// The prototype's format, which used short names: a wave's `type`, `d`,
// `data`, `hz` and `metal`; an instrument's `mode` ('pair' for pitch pair),
// `refA`, `follow`, `gain`, and envelopes `amp` and `morph` with keys
// `a`, `d`, `s`, `r`, and `pitch` with `cents` and `time`.

function readPrototypeWave(raw: Json): Wave | null {
  return readWave({
    id: raw.id,
    name: raw.name,
    kind: raw.type,
    columns: raw.data,
    levels: raw.d,
    smooth: raw.smooth,
    shotMs: raw.shotMs,
    noiseRateHz: raw.hz,
    metallic: raw.metal,
  });
}

function readPrototypeInstrument(raw: Json): Instrument {
  const shortEnvelope = (value: unknown): Json | null => {
    const e = object(value);
    return e && { attack: e.a, decay: e.d, sustain: e.s, release: e.r, depth: e.depth };
  };
  const pitch = object(raw.pitch);
  return readInstrument({
    name: raw.name,
    kind: raw.mode === 'pair' ? 'pitchPair' : raw.mode,
    waveA: raw.waveA,
    waveB: raw.waveB,
    referenceA: raw.refA,
    referenceB: raw.refB,
    followsPitch: raw.follow,
    volume: raw.gain,
    volumeEnvelope: shortEnvelope(raw.amp),
    morphEnvelope: shortEnvelope(raw.morph),
    pitchEnvelope: pitch && { startCents: pitch.cents, glideSeconds: pitch.time },
  });
}

// ---------------------------------------------------------------------------
// Defensive readers

function parseObject(value: string | null): Json | null {
  if (value === null) return null;
  try {
    return object(JSON.parse(value));
  } catch {
    return null;
  }
}

function object(value: unknown): Json | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function objects(value: unknown): Json[] {
  return Array.isArray(value) ? value.map(object).filter((o): o is Json => o !== null) : [];
}

function number(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function numberArray(value: unknown): number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number')
    ? (value as number[])
    : [];
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== '' ? value : fallback;
}

function waveKind(value: unknown): WaveKind {
  return value === 'shot' || value === 'noise' ? value : 'cycle';
}

function instrumentKind(value: unknown): InstrumentKind {
  return value === 'pitchPair' || value === 'morph' ? value : 'single';
}
