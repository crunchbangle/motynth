// The sound library: every wave and instrument the user has. All changes go
// through the functions here, which return a new library and leave the old
// one untouched.

import { createInstrument, type Instrument } from './instrument.ts';
import { createWave, type Wave } from './wave.ts';

export interface SoundLibrary {
  waves: Wave[];
  instruments: Instrument[];
}

/** The sounds a new user starts with, which the lessons and examples use. */
export function starterLibrary(): SoundLibrary {
  return {
    waves: [
      createWave('w-pulse', 'Pulse 25%', 'pulse', { duty: 0.25 }),
      createWave('w-square', 'Square', 'pulse', { duty: 0.5 }),
      createWave('w-tri', 'Triangle', 'tri'),
      createWave('w-saw', 'Saw', 'saw'),
      createWave('w-sine', 'Sine', 'sine'),
      createWave('w-organ', 'Organ', 'organ'),
      createWave('w-noise', 'White noise', 'sine', { kind: 'noise', noiseRateHz: 16000 }),
      createWave('w-metal', 'Metal noise', 'sine', {
        kind: 'noise',
        noiseRateHz: 7000,
        metallic: true,
      }),
    ],
    instruments: [
      createInstrument('pulse', {
        waveA: 'w-pulse',
        volume: 0.6,
        volumeEnvelope: { attack: 0.004, decay: 0.07, sustain: 0.65, release: 0.07 },
      }),
      createInstrument('square', { waveA: 'w-square', volume: 0.5 }),
      createInstrument('tri', {
        waveA: 'w-tri',
        volume: 0.95,
        volumeEnvelope: { attack: 0.005, decay: 0.04, sustain: 0.9, release: 0.1 },
      }),
      createInstrument('saw', {
        waveA: 'w-saw',
        volume: 0.5,
        volumeEnvelope: { attack: 0.006, decay: 0.12, sustain: 0.6, release: 0.1 },
      }),
      createInstrument('bass', {
        waveA: 'w-organ',
        volume: 0.95,
        volumeEnvelope: { attack: 0.003, decay: 0.2, sustain: 0.5, release: 0.06 },
      }),
      createInstrument('pluck', {
        kind: 'morph',
        waveA: 'w-tri',
        waveB: 'w-pulse',
        volume: 0.8,
        volumeEnvelope: { attack: 0.002, decay: 0.4, sustain: 0.1, release: 0.12 },
        morphEnvelope: { attack: 0.002, decay: 0.28, sustain: 0, release: 0.05, depth: 1 },
      }),
      createInstrument('keys', {
        kind: 'pitchPair',
        waveA: 'w-tri',
        waveB: 'w-pulse',
        referenceA: 130.8,
        referenceB: 1046.5,
        volume: 0.8,
        volumeEnvelope: { attack: 0.004, decay: 0.25, sustain: 0.35, release: 0.2 },
      }),
      createInstrument('kick', {
        waveA: 'w-sine',
        followsPitch: false,
        referenceA: 50,
        volume: 1.5,
        volumeEnvelope: { attack: 0.001, decay: 0.24, sustain: 0, release: 0.02 },
        pitchEnvelope: { startCents: 3600, glideSeconds: 0.1 },
      }),
      createInstrument('snare', {
        waveA: 'w-noise',
        followsPitch: false,
        volume: 0.8,
        volumeEnvelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.03 },
      }),
      createInstrument('hat', {
        waveA: 'w-metal',
        followsPitch: false,
        volume: 0.55,
        volumeEnvelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
      }),
      createInstrument('tom', {
        waveA: 'w-sine',
        followsPitch: true,
        volume: 1.2,
        volumeEnvelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.04 },
        pitchEnvelope: { startCents: 900, glideSeconds: 0.09 },
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Lookups

export const findWave = (library: SoundLibrary, id: string | null): Wave | undefined =>
  library.waves.find((wave) => wave.id === id);

export const findInstrument = (
  library: SoundLibrary,
  name: string | null,
): Instrument | undefined => library.instruments.find((instrument) => instrument.name === name);

export const instrumentNames = (library: SoundLibrary): Set<string> =>
  new Set(library.instruments.map((instrument) => instrument.name));

/** The instrument for notes written without one: `pulse` if it exists, else the first. */
export function defaultInstrumentName(library: SoundLibrary): string | null {
  if (findInstrument(library, 'pulse')) return 'pulse';
  return library.instruments[0]?.name ?? null;
}

/** `base`, or `base_2`, `base_3`, ... whichever is free. */
export function uniqueName(base: string, taken: ReadonlySet<string>): string {
  let name = base;
  for (let k = 2; taken.has(name); k++) name = `${base}_${k}`;
  return name;
}

// ---------------------------------------------------------------------------
// Instrument changes

export function updateInstrument(
  library: SoundLibrary,
  name: string,
  change: Partial<Instrument>,
): SoundLibrary {
  return {
    ...library,
    instruments: library.instruments.map((instrument) =>
      instrument.name === name ? withWaveB(library, { ...instrument, ...change }) : instrument,
    ),
  };
}

/** Pitch pairs and morphs need a second wave; give them one if they have none. */
function withWaveB(library: SoundLibrary, instrument: Instrument): Instrument {
  if (instrument.kind === 'single' || findWave(library, instrument.waveB)) return instrument;
  const other = library.waves.find((wave) => wave.id !== instrument.waveA) ?? library.waves[0];
  return { ...instrument, waveB: other?.id ?? null };
}

/** Adds a copy of `source` under a new name based on `baseName`. Returns the new name too. */
export function copyInstrument(
  library: SoundLibrary,
  source: Instrument,
  baseName: string,
): { library: SoundLibrary; name: string } {
  const name = uniqueName(baseName, instrumentNames(library));
  return {
    library: {
      ...library,
      instruments: [...library.instruments, { ...structuredClone(source), name }],
    },
    name,
  };
}

export function renameInstrument(library: SoundLibrary, from: string, to: string): SoundLibrary {
  return updateInstrument(library, from, { name: to });
}

/** Removes an instrument. The last one can't be removed. */
export function deleteInstrument(library: SoundLibrary, name: string): SoundLibrary {
  if (library.instruments.length < 2) return library;
  return {
    ...library,
    instruments: library.instruments.filter((instrument) => instrument.name !== name),
  };
}

// ---------------------------------------------------------------------------
// Wave changes

export function updateWave(library: SoundLibrary, id: string, change: Partial<Wave>): SoundLibrary {
  return {
    ...library,
    waves: library.waves.map((wave) => (wave.id === id ? { ...wave, ...change } : wave)),
  };
}

/** Adds a sine wave with a fresh id. Returns the new id too. */
export function addWave(
  library: SoundLibrary,
  newId: () => string = randomWaveId,
): { library: SoundLibrary; id: string } {
  const id = newId();
  const wave = createWave(id, `Wave ${library.waves.length + 1}`, 'sine');
  return { library: { ...library, waves: [...library.waves, wave] }, id };
}

/**
 * Removes a wave; instruments that used it switch to the first other wave.
 * The last wave can't be removed.
 */
export function deleteWave(library: SoundLibrary, id: string): SoundLibrary {
  const replacement = library.waves.find((wave) => wave.id !== id);
  if (!replacement) return library;
  const swap = (waveId: string | null) => (waveId === id ? replacement.id : waveId);
  return {
    waves: library.waves.filter((wave) => wave.id !== id),
    instruments: library.instruments.map((instrument) => ({
      ...instrument,
      waveA: swap(instrument.waveA) as string,
      waveB: swap(instrument.waveB),
    })),
  };
}

function randomWaveId(): string {
  return `w-${Math.random().toString(36).slice(2, 9)}`;
}
