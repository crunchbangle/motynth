// The musical settings in force at a point in a program, and how settings
// and transpositions change them.
//
// Scopes are dynamic: a motif resolves its pitches with the scope where it is
// *used*, not where it was defined, so the same motif can be played in
// different modes or transposed from outside.

import type { PitchLiteral, Setting } from './ast.ts';
import { MotynthError } from './errors.ts';
import { Fraction } from './fraction.ts';
import { BUILTIN_MODES, type ModeSteps } from './language.ts';
import { degreeToStep, stepToDegree } from './pitch.ts';

export interface Scope {
  readonly stepsPerRegister: number;
  /** Frequency ratio of one register, e.g. 2 for an octave. */
  readonly registerRatio: number;
  /** Sorted tuning steps of the mode; null for chromatic (every step). */
  readonly mode: readonly number[] | null;
  /** Names for each tuning step, from `names [...]`. */
  readonly noteNames: readonly string[] | null;
  /** Frequency of step 0 (degree 1). */
  readonly rootHz: number;
  readonly tempo: Fraction;
  /** Transposition from modifiers such as `+2`, `~3` and `^1` around this point. */
  readonly shift: Transposition;
}

export interface Transposition {
  /** Tonal shift, in degrees of the mode. */
  readonly degrees: number;
  /** Chromatic shift, in tuning steps. */
  readonly steps: number;
  readonly registers: number;
}

/** The settings a program starts with: 12 steps per octave, C major, 120 bpm. */
export const INITIAL_SCOPE: Scope = {
  stepsPerRegister: 12,
  registerRatio: 2,
  mode: BUILTIN_MODES.get('major') as readonly number[],
  noteNames: null,
  rootHz: 261.6256,
  tempo: Fraction.of(120),
  shift: { degrees: 0, steps: 0, registers: 0 },
};

/** The mode's steps, with chromatic expanded to every step of the tuning. */
export function modeSteps(scope: Scope): readonly number[] {
  if (scope.mode) return scope.mode;
  return Array.from({ length: scope.stepsPerRegister }, (_, k) => k);
}

/**
 * Returns the scope with one setting applied.
 * `modes` holds every mode name the program can use, built-in or defined.
 */
export function applySetting(
  scope: Scope,
  setting: Setting,
  modes: ReadonlyMap<string, ModeSteps>,
): Scope {
  switch (setting.kind) {
    case 'tuning': {
      // A new number of steps makes the old mode and names meaningless.
      const changesSteps = setting.stepsPerRegister !== scope.stepsPerRegister;
      let next: Scope = {
        ...scope,
        stepsPerRegister: setting.stepsPerRegister,
        mode: changesSteps ? null : scope.mode,
        noteNames: changesSteps ? null : scope.noteNames,
      };
      if (setting.registerRatio !== null) {
        next = { ...next, registerRatio: checkRatio(setting.registerRatio, setting.offset) };
      }
      return next;
    }
    case 'register':
      return { ...scope, registerRatio: checkRatio(setting.registerRatio, setting.offset) };
    case 'names':
      if (setting.names.length !== scope.stepsPerRegister) {
        throw new MotynthError(
          `This tuning has ${scope.stepsPerRegister} notes, so names needs ${scope.stepsPerRegister} entries (got ${setting.names.length})`,
          setting.offset,
        );
      }
      return { ...scope, noteNames: setting.names };
    case 'mode':
      return { ...scope, mode: resolveMode(scope, setting.mode, modes, setting.offset) };
    case 'tempo':
      return { ...scope, tempo: setting.bpm };
    case 'root':
      return { ...scope, rootHz: setting.hz };
  }
}

function checkRatio(ratio: number, offset: number): number {
  if (!(ratio > 0) || ratio === 1) {
    throw new MotynthError('The register ratio must be above 0 and not 1', offset);
  }
  return ratio;
}

function resolveMode(
  scope: Scope,
  mode: { name: string } | { steps: number[] },
  modes: ReadonlyMap<string, ModeSteps>,
  offset: number,
): readonly number[] | null {
  let steps: ModeSteps;
  if ('steps' in mode) {
    steps = mode.steps;
  } else {
    const named = modes.get(mode.name);
    if (named === undefined) {
      throw new MotynthError(
        `Unknown mode "${mode.name}". Built in: ${[...BUILTIN_MODES.keys()].join(', ')}`,
        offset,
      );
    }
    steps = named;
  }
  if (steps === null) return null;
  if (steps.length === 0) throw new MotynthError('A mode needs at least one note', offset);

  const sorted = [...new Set(steps)].sort((a, b) => a - b);
  const lowest = sorted[0] as number;
  const highest = sorted[sorted.length - 1] as number;
  const last = scope.stepsPerRegister - 1;
  if (lowest < 0 || highest > last) {
    const outside = highest > last ? highest : lowest;
    throw new MotynthError(
      `This mode uses note ${outside}, which is outside the current tuning of ${scope.stepsPerRegister} notes (0–${last}). Set the tuning first, or use "mode chromatic".`,
      offset,
    );
  }
  return sorted;
}

/** Adds a transposition to the scope. */
export function shifted(scope: Scope, change: Partial<Transposition>): Scope {
  return {
    ...scope,
    shift: {
      degrees: scope.shift.degrees + (change.degrees ?? 0),
      steps: scope.shift.steps + (change.steps ?? 0),
      registers: scope.shift.registers + (change.registers ?? 0),
    },
  };
}

/** The tuning step a pitch lands on in this scope, including transposition. */
export function resolvePitch(
  scope: Scope,
  pitch: Pick<PitchLiteral, 'kind' | 'value' | 'accidental' | 'register'>,
): number {
  const mode = modeSteps(scope);
  const steps = scope.stepsPerRegister;
  const shift = scope.shift;
  let step: number;

  if (pitch.kind === 'degree') {
    step = degreeToStep(pitch.value - 1 + shift.degrees, mode, steps) + pitch.accidental;
  } else {
    step = pitch.value + pitch.accidental;
    if (shift.degrees) {
      // A tonal shift moves a raw step along the mode, keeping its distance
      // above the degree it sits on.
      const { degree, remainder } = stepToDegree(step, mode, steps);
      step = degreeToStep(degree + shift.degrees, mode, steps) + remainder;
    }
  }
  return step + (pitch.register + shift.registers) * steps + shift.steps;
}
