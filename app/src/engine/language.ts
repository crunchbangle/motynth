// Fixed vocabulary of the Motynth language.

import { Fraction } from './fraction.ts';

/** Duration letters, as fractions of a whole note. */
export const DURATION_LETTERS: ReadonlyMap<string, Fraction> = new Map([
  ['w', Fraction.of(1)],
  ['h', Fraction.of(1, 2)],
  ['q', Fraction.of(1, 4)],
  ['e', Fraction.of(1, 8)],
  ['s', Fraction.of(1, 16)],
  ['t', Fraction.of(1, 32)],
]);

/** Words that can't be used as names. */
export const KEYWORDS: ReadonlySet<string> = new Set([
  'tuning',
  'register',
  'names',
  'mode',
  'tempo',
  'root',
  'motif',
  'play',
  'with',
  'section',
  'staff',
  'length',
  'rest',
  'of',
]);

/**
 * A mode is the set of tuning steps that make up a scale, counted from the
 * root. `null` means chromatic: every step of the tuning.
 */
export type ModeSteps = readonly number[] | null;

/** Modes every program can use by name, in the order they are listed to users. */
export const BUILTIN_MODES: ReadonlyMap<string, ModeSteps> = new Map<string, ModeSteps>([
  ['major', [0, 2, 4, 5, 7, 9, 11]],
  ['minor', [0, 2, 3, 5, 7, 8, 10]],
  ['dorian', [0, 2, 3, 5, 7, 9, 10]],
  ['phrygian', [0, 1, 3, 5, 7, 8, 10]],
  ['lydian', [0, 2, 4, 6, 7, 9, 11]],
  ['mixolydian', [0, 2, 4, 5, 7, 9, 10]],
  ['locrian', [0, 1, 3, 5, 6, 8, 10]],
  ['harmonic-minor', [0, 2, 3, 5, 7, 8, 11]],
  ['pentatonic', [0, 2, 4, 7, 9]],
  ['minor-pentatonic', [0, 3, 5, 7, 10]],
  ['blues', [0, 3, 5, 6, 7, 10]],
  ['whole-tone', [0, 2, 4, 6, 8, 10]],
  ['chromatic', null],
]);

/** Limits that keep the browser responsive. */
export const LIMITS = {
  /** Most notes a piece, or any part of it, may contain. */
  maxNotes: 40000,
  /** Longest a piece may play, in seconds. */
  maxSeconds: 1800,
  /** Deepest nesting of expressions, which also catches runaway recursion. */
  maxDepth: 150,
} as const;
