// The syntax tree produced by the parser. Every node records `offset`, its
// position in the source text, so errors can point at it.

import type { Fraction } from './fraction.ts';

// ---------------------------------------------------------------------------
// Pitches and motif items

/**
 * A pitch written as a number: a degree of the mode (`3`) or a step of the
 * tuning (`n7`), with optional accidentals (`#`, `b`) and register (`^1`).
 */
export interface PitchLiteral {
  type: 'pitch';
  kind: 'degree' | 'step';
  value: number;
  /** Tuning steps added by accidentals: +1 per `#`, -1 per `b`. */
  accidental: number;
  register: number;
  offset: number;
}

/**
 * A word in a motif: either a note name from `names [...]` or the name of
 * another motif. Which one is only known when the motif is evaluated.
 */
export interface WordItem {
  type: 'word';
  name: string;
  register: number;
  offset: number;
}

export interface ChordItem {
  type: 'chord';
  pitches: (PitchLiteral | WordItem)[];
  offset: number;
}

export interface MotifRest {
  type: 'rest';
  offset: number;
}

/** `_`: extends the previous note. */
export interface TieItem {
  type: 'tie';
  offset: number;
}

/** `x`: a percussion hit. */
export interface HitItem {
  type: 'hit';
  offset: number;
}

/** One item in `[...]`, with its duration if one was written (`3:q`). */
export type MotifItem = (PitchLiteral | WordItem | ChordItem | MotifRest | TieItem | HitItem) & {
  duration?: Fraction;
};

// ---------------------------------------------------------------------------
// Settings

export type Setting =
  | { kind: 'tuning'; stepsPerRegister: number; registerRatio: number | null; offset: number }
  | { kind: 'register'; registerRatio: number; offset: number }
  | { kind: 'names'; names: string[]; offset: number }
  | { kind: 'mode'; mode: { name: string } | { steps: number[] }; offset: number }
  | { kind: 'tempo'; bpm: Fraction; offset: number }
  | { kind: 'root'; hz: number; offset: number };

// ---------------------------------------------------------------------------
// Modifiers, written after a term: `hook +2 rev x3`

export type Modifier =
  | { type: 'shiftDegrees' | 'shiftSteps' | 'shiftRegisters'; amount: number; offset: number }
  /** Multiplies every time by `factor`; `*2` is a factor of 1/2. */
  | { type: 'scale'; factor: Fraction; offset: number }
  | { type: 'repeat'; times: number; offset: number }
  | { type: 'reverse' | 'invert' | 'fit' | 'loop' | 'setsLength'; offset: number };

// ---------------------------------------------------------------------------
// Expressions

/** `[1 3 5]` */
export interface MotifNode {
  type: 'motif';
  items: MotifItem[];
  offset: number;
}

/** Terms played one after another: `a, b, c`. Also what `( ... )` contains. */
export interface SequenceNode {
  type: 'sequence';
  items: TermNode[];
  offset: number;
}

/** Something to play, followed by its modifiers. */
export interface TermNode {
  type: 'term';
  base: PrimaryNode;
  modifiers: Modifier[];
  offset: number;
}

/** `length 2w` inside a section or staff. */
export interface LengthLine {
  type: 'length';
  duration: Fraction;
  offset: number;
}

/** `section { ... }` or `staff { ... }`: lines played in parallel. */
export interface BlockNode {
  type: 'block';
  kind: 'section' | 'staff';
  items: (TermNode | LengthLine)[];
  offset: number;
}

/** `with mode minor, tempo 90 { ... }` */
export interface WithNode {
  type: 'with';
  settings: Setting[];
  body: SequenceNode;
  offset: number;
}

/** `rest q` outside a motif. */
export interface RestNode {
  type: 'rest';
  duration: Fraction;
  offset: number;
}

/** `pluck: hook` */
export interface InstrumentNode {
  type: 'instrument';
  name: string;
  term: TermNode;
  offset: number;
}

/** A name that refers to a definition. */
export interface ReferenceNode {
  type: 'reference';
  name: string;
  offset: number;
}

export type PrimaryNode =
  MotifNode | SequenceNode | BlockNode | WithNode | RestNode | InstrumentNode | ReferenceNode;

export type ExpressionNode = PrimaryNode | TermNode;

// ---------------------------------------------------------------------------
// Statements: one per top-level line

export type Statement =
  | { type: 'setting'; setting: Setting; offset: number }
  /** `mode gloom = [0 1 4 5 7 8 11]` */
  | { type: 'modeDefinition'; name: string; steps: number[]; offset: number }
  /** `hook = ...` or `motif hook = ...` */
  | { type: 'definition'; name: string; expression: SequenceNode; offset: number }
  /** A bare line to play, or `play ...` */
  | { type: 'expression'; expression: SequenceNode; offset: number };
