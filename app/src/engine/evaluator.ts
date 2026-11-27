// Turns syntax-tree expressions into timed notes.

import type {
  BlockNode,
  ExpressionNode,
  LengthLine,
  Modifier,
  MotifNode,
  PitchLiteral,
  SequenceNode,
  TermNode,
  WordItem,
} from './ast.ts';
import { MotynthError } from './errors.ts';
import { Fraction } from './fraction.ts';
import { LIMITS, type ModeSteps } from './language.ts';
import {
  checkNoteCount,
  clip,
  concatenate,
  loopUntil,
  music,
  scale,
  sortNotes,
  type Music,
  type Note,
} from './music.ts';
import { degreeToStep, stepToDegree } from './pitch.ts';
import { applySetting, modeSteps, resolvePitch, shifted, type Scope } from './scope.ts';

export interface ProgramContext {
  /** Every `name = ...` in the program. */
  definitions: ReadonlyMap<string, SequenceNode>;
  /** Built-in and defined modes, by name. */
  modes: ReadonlyMap<string, ModeSteps>;
  /**
   * The program's top-level tempo. Times are kept in whole notes at this
   * tempo, so music in a scope with another tempo is stretched to match.
   */
  baseTempo: Fraction;
  /** Instrument names that exist, or null to accept any name. */
  instruments: ReadonlySet<string> | null;
}

/** The pitch every hit (`x`) is given: degree 1. */
const HIT_PITCH = { kind: 'degree', value: 1, accidental: 0, register: 0 } as const;

/** Default note length until a motif sets one: a quarter. */
const QUARTER = Fraction.of(1, 4);

type ResolvedWord =
  { pitch: Pick<PitchLiteral, 'kind' | 'value' | 'accidental' | 'register'> } | { music: Music };

export class Evaluator {
  private readonly program: ProgramContext;
  /** Names currently being expanded, to catch definitions that use themselves. */
  private readonly expanding: string[] = [];
  private depth = 0;

  constructor(program: ProgramContext) {
    this.program = program;
  }

  evaluate(node: ExpressionNode, scope: Scope): Music {
    this.depth++;
    try {
      if (this.depth > LIMITS.maxDepth) {
        throw new MotynthError(
          'Nested too deeply — is something defined in terms of itself?',
          node.offset,
        );
      }
      return this.evaluateNode(node, scope);
    } finally {
      this.depth--;
    }
  }

  private evaluateNode(node: ExpressionNode, scope: Scope): Music {
    switch (node.type) {
      case 'sequence':
        if (node.items.length === 1) return this.evaluate(node.items[0] as TermNode, scope);
        return concatenate(
          node.items.map((item) => this.evaluate(item, scope)),
          node.offset,
        );
      case 'term':
        return this.evaluateTerm(node, scope);
      case 'motif':
        return this.evaluateMotif(node, scope);
      case 'rest':
        return music(node.duration.times(this.timeScale(scope)), []);
      case 'reference':
        return this.evaluateReference(node.name, node.offset, scope);
      case 'instrument': {
        const { instruments } = this.program;
        if (instruments && !instruments.has(node.name)) {
          throw new MotynthError(
            `Unknown instrument "${node.name}". Your instruments: ${[...instruments].join(', ')}`,
            node.offset,
          );
        }
        const inner = this.evaluate(node.term, scope);
        // Inner instruments win: `pulse: (bass: a, b)` plays `a` on bass.
        const notes = inner.notes.map((note) =>
          note.instrument ? note : { ...note, instrument: node.name },
        );
        return music(inner.length, notes, inner.flags);
      }
      case 'block':
        return this.evaluateBlock(node, scope);
      case 'with': {
        let inner = scope;
        for (const setting of node.settings) {
          inner = applySetting(inner, setting, this.program.modes);
        }
        return this.evaluate(node.body, inner);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Names

  private evaluateReference(name: string, offset: number, scope: Scope): Music {
    if (!this.program.definitions.has(name)) {
      const isInstrument = this.program.instruments?.has(name) ?? false;
      throw new MotynthError(
        isInstrument
          ? `"${name}" is an instrument. Give it something to play, like  ${name}: [1 3 5]`
          : `Unknown name "${name}"`,
        offset,
      );
    }
    return this.expandDefinition(name, offset, scope);
  }

  private expandDefinition(name: string, offset: number, scope: Scope): Music {
    const definition = this.program.definitions.get(name) as SequenceNode;
    if (this.expanding.includes(name)) {
      throw new MotynthError(`"${name}" is defined in terms of itself`, offset);
    }
    this.expanding.push(name);
    try {
      return this.evaluate(definition, scope);
    } finally {
      this.expanding.pop();
    }
  }

  /** A word in a motif is a note name if `names` defines it, otherwise a motif name. */
  private resolveWord(scope: Scope, item: PitchLiteral | WordItem): ResolvedWord {
    if (item.type === 'pitch') return { pitch: item };

    const nameIndex = scope.noteNames ? scope.noteNames.indexOf(item.name) : -1;
    if (nameIndex >= 0) {
      return { pitch: { kind: 'step', value: nameIndex, accidental: 0, register: item.register } };
    }

    if (this.program.definitions.has(item.name)) {
      if (item.register) {
        throw new MotynthError(
          `"${item.name}" is a motif, so ^ can’t be attached here — put it after the closing bracket instead`,
          item.offset,
        );
      }
      return { music: this.expandDefinition(item.name, item.offset, scope) };
    }

    const looksLikeNoteName = /^[A-G][b#]?$/.test(item.name);
    const hint =
      looksLikeNoteName && !scope.noteNames
        ? ' (to use note names, define them first, e.g. names [C Db D Eb E F Gb G Ab A Bb B])'
        : '';
    throw new MotynthError(`"${item.name}" isn’t a note name or a motif here${hint}`, item.offset);
  }

  // -------------------------------------------------------------------------
  // Terms and modifiers

  private evaluateTerm(node: TermNode, scope: Scope): Music {
    // Transpositions change the scope the base is evaluated in, so they
    // respect the mode and work on names. They apply before anything else,
    // wherever they are written. The other modifiers apply afterwards, in order.
    let inner = scope;
    const afterwards: Modifier[] = [];
    for (const modifier of node.modifiers) {
      if (modifier.type === 'shiftDegrees') inner = shifted(inner, { degrees: modifier.amount });
      else if (modifier.type === 'shiftSteps') inner = shifted(inner, { steps: modifier.amount });
      else if (modifier.type === 'shiftRegisters')
        inner = shifted(inner, { registers: modifier.amount });
      else afterwards.push(modifier);
    }

    let result = this.evaluate(node.base, inner);
    for (const modifier of afterwards) result = applyModifier(result, modifier);
    return result;
  }

  // -------------------------------------------------------------------------
  // Motifs

  private evaluateMotif(node: MotifNode, scope: Scope): Music {
    const timeScale = this.timeScale(scope);
    const notes: Note[] = [];
    let time = Fraction.ZERO;
    let lastDuration = QUARTER;
    /** The notes a following tie extends. */
    let tieable: Note[] = [];

    for (const item of node.items) {
      // A written duration sticks to the following items.
      const written = item.duration ?? lastDuration;
      if (item.duration) lastDuration = item.duration;
      const duration = written.times(timeScale);

      switch (item.type) {
        case 'rest':
          time = time.plus(duration);
          tieable = [];
          break;
        case 'tie':
          if (tieable.length === 0) {
            throw new MotynthError('A tie (_) needs a note before it', item.offset);
          }
          for (const note of tieable) note.duration = note.duration.plus(duration);
          time = time.plus(duration);
          break;
        case 'hit': {
          const note = { ...this.makeNote(scope, time, duration, HIT_PITCH), isHit: true };
          notes.push(note);
          tieable = [note];
          time = time.plus(duration);
          break;
        }
        case 'pitch': {
          const note = this.makeNote(scope, time, duration, item);
          notes.push(note);
          tieable = [note];
          time = time.plus(duration);
          break;
        }
        case 'chord': {
          const chord: Note[] = [];
          for (const pitch of item.pitches) {
            const resolved = this.resolveWord(scope, pitch);
            if ('music' in resolved) {
              throw new MotynthError('Only notes can go inside a chord', pitch.offset);
            }
            const note = this.makeNote(scope, time, duration, resolved.pitch);
            notes.push(note);
            chord.push(note);
          }
          tieable = chord;
          time = time.plus(duration);
          break;
        }
        case 'word': {
          const resolved = this.resolveWord(scope, item);
          if ('pitch' in resolved) {
            const note = this.makeNote(scope, time, duration, resolved.pitch);
            notes.push(note);
            tieable = [note];
            time = time.plus(duration);
          } else {
            // Another motif spliced in. With a written duration it is
            // squeezed or stretched to fit; without one it keeps its length.
            let inner = resolved.music;
            if (item.duration && !inner.length.isZero()) {
              inner = scale(inner, duration.dividedBy(inner.length));
            }
            for (const note of inner.notes) notes.push({ ...note, start: note.start.plus(time) });
            time = time.plus(inner.length);
            tieable = [];
          }
          break;
        }
      }
      checkNoteCount(notes, item.offset);
    }
    return music(time, notes);
  }

  private makeNote(
    scope: Scope,
    start: Fraction,
    duration: Fraction,
    pitch: Pick<PitchLiteral, 'kind' | 'value' | 'accidental' | 'register'>,
  ): Note {
    return {
      start,
      duration,
      step: resolvePitch(scope, pitch),
      stepsPerRegister: scope.stepsPerRegister,
      registerRatio: scope.registerRatio,
      rootHz: scope.rootHz,
      mode: modeSteps(scope),
      instrument: null,
      isHit: false,
    };
  }

  // -------------------------------------------------------------------------
  // Sections and staffs

  /**
   * Plays every line of the block at once. The block's length is, in order
   * of preference: a `length` line; the longest `sets-length` line; the
   * longest line that is neither `fit` nor `loop`; the longest line.
   * Then `fit` lines are stretched to that length, `loop` lines repeated,
   * and everything is cut off at the end.
   */
  private evaluateBlock(node: BlockNode, scope: Scope): Music {
    const lanes: Music[] = [];
    const fixedLength = this.collectLanes(node.items, scope, lanes);

    if (lanes.length === 0) return music(fixedLength ?? Fraction.ZERO, []);

    let length = fixedLength;
    if (!length) {
      const setters = lanes.filter((lane) => lane.flags.setsLength);
      const plain = lanes.filter((lane) => !lane.flags.fit && !lane.flags.loop);
      const candidates = setters.length ? setters : plain.length ? plain : lanes;
      length = candidates.reduce(
        (longest, lane) => Fraction.max(longest, lane.length),
        Fraction.ZERO,
      );
    }

    const notes: Note[] = [];
    for (const lane of lanes) {
      let fitted = lane;
      if (lane.flags.fit) {
        if (!lane.length.isZero() && !length.isZero()) {
          fitted = scale(lane, length.dividedBy(lane.length));
        }
      } else if (lane.flags.loop) {
        fitted = loopUntil(lane, length, node.offset);
      }
      notes.push(...clip(fitted, length).notes);
    }
    const result = music(length, sortNotes(notes));
    checkNoteCount(result.notes, node.offset);
    return result;
  }

  /**
   * Evaluates each line of a block into `lanes`. A nested `staff { ... }`
   * with no modifiers is merged into the same block. Returns the length
   * from the last `length` line, if any.
   */
  private collectLanes(
    items: readonly (TermNode | LengthLine)[],
    scope: Scope,
    lanes: Music[],
  ): Fraction | null {
    let length: Fraction | null = null;
    for (const item of items) {
      if (item.type === 'length') {
        length = item.duration.times(this.timeScale(scope));
      } else if (item.base.type === 'block' && item.modifiers.length === 0) {
        const nested = this.collectLanes(item.base.items, scope, lanes);
        if (nested) length = nested;
      } else {
        lanes.push(this.evaluate(item, scope));
      }
    }
    return length;
  }

  /** How much longer one written whole note lasts in this scope than at the base tempo. */
  private timeScale(scope: Scope): Fraction {
    return this.program.baseTempo.dividedBy(scope.tempo);
  }
}

function applyModifier(m: Music, modifier: Modifier): Music {
  switch (modifier.type) {
    case 'reverse':
      return music(
        m.length,
        sortNotes(
          m.notes.map((note) => ({
            ...note,
            start: m.length.minus(note.start).minus(note.duration),
          })),
        ),
        m.flags,
      );
    case 'invert':
      return invert(m);
    case 'repeat':
      return concatenate(new Array<Music>(modifier.times).fill(m), modifier.offset);
    case 'scale':
      return scale(m, modifier.factor);
    case 'fit':
      return { ...m, flags: { ...m.flags, fit: true } };
    case 'loop':
      return { ...m, flags: { ...m.flags, loop: true } };
    case 'setsLength':
      return { ...m, flags: { ...m.flags, setsLength: true } };
    case 'shiftDegrees':
    case 'shiftSteps':
    case 'shiftRegisters':
      // Applied to the scope in evaluateTerm.
      return m;
  }
}

/** Mirrors the melody around its first note, counting in degrees of each note's mode. */
function invert(m: Music): Music {
  const first = m.notes[0];
  if (!first) return m;
  const notes = m.notes.map((note) => {
    const axis = stepToDegree(first.step, note.mode, note.stepsPerRegister);
    const own = stepToDegree(note.step, note.mode, note.stepsPerRegister);
    const step =
      degreeToStep(2 * axis.degree - own.degree, note.mode, note.stepsPerRegister) + own.remainder;
    return { ...note, step };
  });
  return music(m.length, notes, m.flags);
}
