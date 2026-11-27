// Music as the evaluator builds it: notes timed in exact whole-note
// fractions, plus the operations that combine them.

import { MotynthError } from './errors.ts';
import { Fraction } from './fraction.ts';
import { LIMITS } from './language.ts';

/**
 * One note. Each note keeps the tuning it was written in, because pieces can
 * mix tunings and modes from scope to scope.
 */
export interface Note {
  start: Fraction;
  duration: Fraction;
  /** Tuning step, counted from the root. */
  step: number;
  stepsPerRegister: number;
  registerRatio: number;
  rootHz: number;
  /** Sorted steps of the mode in force (chromatic expanded), used by `inv`. */
  mode: readonly number[];
  /** Set by the nearest `instrument:` around the note. */
  instrument: string | null;
  isHit: boolean;
}

/** How a block line should adapt to its section's length (`fit`, `loop`, `sets-length`). */
export interface LaneFlags {
  fit?: boolean;
  loop?: boolean;
  setsLength?: boolean;
}

export interface Music {
  /** How long it lasts. Notes may end after this (they are cut only inside sections). */
  length: Fraction;
  notes: Note[];
  flags: LaneFlags;
}

export function music(length: Fraction, notes: Note[], flags: LaneFlags = {}): Music {
  return { length, notes, flags };
}

/** Throws if `notes` is over the note limit; `offset` is where the error points. */
export function checkNoteCount(notes: readonly Note[], offset: number): void {
  if (notes.length > LIMITS.maxNotes) {
    throw new MotynthError(
      `That makes more than ${LIMITS.maxNotes} notes — try something shorter`,
      offset,
    );
  }
}

/** Sorts by start time, then pitch (in place). */
export function sortNotes(notes: Note[]): Note[] {
  return notes.sort((a, b) => a.start.compare(b.start) || a.step - b.step);
}

/** Plays each part after the previous one. */
export function concatenate(parts: readonly Music[], offset: number): Music {
  let time = Fraction.ZERO;
  const notes: Note[] = [];
  for (const part of parts) {
    for (const note of part.notes) notes.push({ ...note, start: note.start.plus(time) });
    time = time.plus(part.length);
    checkNoteCount(notes, offset);
  }
  return music(time, notes);
}

/** Stretches all times by `factor`. */
export function scale(m: Music, factor: Fraction): Music {
  return music(
    m.length.times(factor),
    m.notes.map((note) => ({
      ...note,
      start: note.start.times(factor),
      duration: note.duration.times(factor),
    })),
    m.flags,
  );
}

/** Drops notes that start at or after `end`, and shortens notes that run past it. */
export function clip(m: Music, end: Fraction): Music {
  const notes: Note[] = [];
  for (const note of m.notes) {
    if (!note.start.isLessThan(end)) continue;
    const room = end.minus(note.start);
    notes.push(note.duration.isGreaterThan(room) ? { ...note, duration: room } : note);
  }
  return music(m.length, notes, m.flags);
}

/** Repeats `m` until `end`; the last repeat is cut off (by a later clip). */
export function loopUntil(m: Music, end: Fraction, offset: number): Music {
  if (m.length.isZero()) {
    throw new MotynthError('Can’t loop something with no length', offset);
  }
  const notes: Note[] = [];
  for (
    let repeatStart = Fraction.ZERO;
    repeatStart.isLessThan(end);
    repeatStart = repeatStart.plus(m.length)
  ) {
    for (const note of m.notes) {
      const start = note.start.plus(repeatStart);
      if (start.isLessThan(end)) notes.push({ ...note, start });
    }
    checkNoteCount(notes, offset);
  }
  return music(end, notes, m.flags);
}
