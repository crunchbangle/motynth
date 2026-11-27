// Instruments: how waves become the sounds that code plays by name.

import { KEYWORDS } from '../engine/index.ts';

export type InstrumentKind =
  /** One wave. */
  | 'single'
  /** Two waves crossfaded by pitch: low notes use A, high notes B. */
  | 'pitchPair'
  /** Each note starts on wave A and blends toward B, following the morph envelope. */
  | 'morph';

/** Attack, decay and release in seconds; sustain is a level from 0 to 1. */
export interface Envelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface MorphEnvelope extends Envelope {
  /** How far toward wave B the morph goes at its peak, from 0 to 1. */
  depth: number;
}

/** Each note starts `startCents` off its pitch and glides to it. */
export interface PitchEnvelope {
  startCents: number;
  glideSeconds: number;
}

export interface Instrument {
  /** The name used in code, as in `pluck: [1 3 5]`. */
  name: string;
  kind: InstrumentKind;
  /** Id of wave A. */
  waveA: string;
  /** Id of wave B, used by pitch pairs and morphs. */
  waveB: string | null;
  /**
   * Reference pitches in Hz. A pitch pair is all A at referenceA and all B at
   * referenceB; one-shots and instruments that don't follow pitch play at them.
   */
  referenceA: number;
  referenceB: number;
  /** Off for drums: every note plays at the reference pitch. */
  followsPitch: boolean;
  /** 1 is normal, up to 2. */
  volume: number;
  volumeEnvelope: Envelope;
  morphEnvelope: MorphEnvelope;
  pitchEnvelope: PitchEnvelope;
}

export const INSTRUMENT_KINDS: readonly {
  kind: InstrumentKind;
  label: string;
  description: string;
}[] = [
  {
    kind: 'single',
    label: 'Single',
    description: 'One waveform, played at the pitch of each note.',
  },
  {
    kind: 'pitchPair',
    label: 'Pitch pair',
    description:
      'Two waveforms that crossfade by pitch. Low notes use A, high notes use B, and in between they blend. The reference pitches say where each one is at full strength.',
  },
  {
    kind: 'morph',
    label: 'Morph',
    description:
      'The timbre changes during each note. It starts on A and blends toward B following the morph envelope.',
  },
];

export const DEFAULT_VOLUME_ENVELOPE: Envelope = {
  attack: 0.004,
  decay: 0.08,
  sustain: 0.7,
  release: 0.08,
};
export const DEFAULT_MORPH_ENVELOPE: MorphEnvelope = {
  attack: 0.002,
  decay: 0.3,
  sustain: 0,
  release: 0.05,
  depth: 1,
};
export const DEFAULT_PITCH_ENVELOPE: PitchEnvelope = { startCents: 0, glideSeconds: 0.08 };

export function createInstrument(name: string, settings: Partial<Instrument> = {}): Instrument {
  return {
    name,
    kind: 'single',
    waveA: 'w-square',
    waveB: null,
    referenceA: 261.63,
    referenceB: 1046.5,
    followsPitch: true,
    volume: 0.7,
    volumeEnvelope: DEFAULT_VOLUME_ENVELOPE,
    morphEnvelope: DEFAULT_MORPH_ENVELOPE,
    pitchEnvelope: DEFAULT_PITCH_ENVELOPE,
    ...settings,
  };
}

/** Motif words that mean something else (`x` is a hit, `r` a rest). */
const MOTIF_WORDS = new Set(['x', 'r', 'rest']);

/**
 * Why `name` can't be an instrument's name, or null if it can. `others` are
 * the names of the other instruments.
 */
export function instrumentNameProblem(name: string, others: ReadonlySet<string>): string | null {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    return 'Use letters, digits and _, starting with a letter or _.';
  }
  if (KEYWORDS.has(name) || MOTIF_WORDS.has(name)) {
    return `“${name}” means something else in code; pick another name.`;
  }
  if (others.has(name)) return 'Another instrument already has that name.';
  return null;
}
