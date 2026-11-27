// The engine's entry point: program text in, timed note events out.

import type { ExpressionNode, SequenceNode } from './ast.ts';
import { MotynthError } from './errors.ts';
import { Evaluator } from './evaluator.ts';
import type { Fraction } from './fraction.ts';
import { BUILTIN_MODES, LIMITS, type ModeSteps } from './language.ts';
import { sortNotes } from './music.ts';
import { parseProgram } from './parser.ts';
import { stepFrequency } from './pitch.ts';
import { applySetting, INITIAL_SCOPE } from './scope.ts';

export interface CompileOptions {
  /** Instrument names that exist. Unknown names become errors. Omit to accept any name. */
  instruments?: ReadonlySet<string> | null;
  /** Instrument for notes that aren't inside any `instrument:`. */
  defaultInstrument?: string | null;
}

/** One note to play. */
export interface NoteEvent {
  /** Seconds from the start of the piece. */
  start: number;
  /** Seconds; at least 10 ms. */
  duration: number;
  /** Tuning step counted from the root (degree 1 is step 0). Orders notes by pitch. */
  step: number;
  frequency: number;
  /** Null when the note has no instrument and there is no default. */
  instrument: string | null;
  /** A percussion hit (`x`). */
  isHit: boolean;
}

export interface CompiledPiece {
  ok: true;
  /** Sorted by start time, then pitch. */
  events: NoteEvent[];
  durationSeconds: number;
  /** The program's top-level tempo. */
  bpm: number;
  /** Instruments that play at least one note, in order of first use. */
  instrumentsUsed: string[];
  /** Length in whole notes at the top-level tempo, as an exact fraction. */
  exactLength: Fraction;
}

export interface CompileError {
  message: string;
  /** Position in the source text. */
  offset: number;
  /** 1-based. */
  line: number;
  /** 1-based. */
  column: number;
}

export type CompileResult = CompiledPiece | { ok: false; error: CompileError };

/**
 * Compiles a program. Mistakes in the program come back as `{ ok: false }`
 * with a message for the user; this only throws on bugs.
 *
 * What plays: `piece` if it is defined; otherwise every line that isn't a
 * definition or setting, in order; otherwise the last definition.
 */
export function compile(source: string, options: CompileOptions = {}): CompileResult {
  try {
    return compileOrThrow(source, options);
  } catch (error) {
    if (error instanceof MotynthError) return { ok: false, error: describeError(source, error) };
    throw error;
  }
}

function compileOrThrow(source: string, options: CompileOptions): CompiledPiece {
  // Top-level settings and mode definitions take effect in order, before
  // anything is evaluated; definitions can be used anywhere.
  const definitions = new Map<string, SequenceNode>();
  const modes = new Map<string, ModeSteps>(BUILTIN_MODES);
  const linesToPlay: SequenceNode[] = [];
  let scope = INITIAL_SCOPE;
  let lastDefined: string | null = null;

  for (const statement of parseProgram(source)) {
    switch (statement.type) {
      case 'setting':
        scope = applySetting(scope, statement.setting, modes);
        break;
      case 'modeDefinition':
        modes.set(statement.name, statement.steps);
        break;
      case 'definition':
        definitions.set(statement.name, statement.expression);
        lastDefined = statement.name;
        break;
      case 'expression':
        linesToPlay.push(statement.expression);
        break;
    }
  }

  let entry: ExpressionNode;
  if (definitions.has('piece')) {
    entry = { type: 'reference', name: 'piece', offset: 0 };
  } else if (linesToPlay.length > 0) {
    entry = { type: 'sequence', items: linesToPlay.flatMap((line) => line.items), offset: 0 };
  } else if (lastDefined !== null) {
    entry = { type: 'reference', name: lastDefined, offset: 0 };
  } else {
    throw new MotynthError('Nothing to play yet. Try a line like  pulse: [1 3 5]', 0);
  }

  const evaluator = new Evaluator({
    definitions,
    modes,
    baseTempo: scope.tempo,
    instruments: options.instruments ?? null,
  });
  const piece = evaluator.evaluate(entry, scope);

  // Tempo counts quarter notes per minute, so a whole note lasts 240/bpm seconds.
  const bpm = scope.tempo.toNumber();
  const secondsPerWholeNote = 240 / bpm;
  const durationSeconds = piece.length.toNumber() * secondsPerWholeNote;
  if (durationSeconds > LIMITS.maxSeconds) {
    throw new MotynthError(
      `That piece is over ${Math.round(LIMITS.maxSeconds / 60)} minutes long`,
      0,
    );
  }

  const instrumentsUsed = new Set<string>();
  const events = sortNotes([...piece.notes]).map((note): NoteEvent => {
    const instrument = note.instrument ?? options.defaultInstrument ?? null;
    if (instrument) instrumentsUsed.add(instrument);
    return {
      start: note.start.toNumber() * secondsPerWholeNote,
      duration: Math.max(note.duration.toNumber() * secondsPerWholeNote, 0.01),
      step: note.step,
      frequency: stepFrequency(note.step, note.rootHz, note.registerRatio, note.stepsPerRegister),
      instrument,
      isHit: note.isHit,
    };
  });

  return {
    ok: true,
    events,
    durationSeconds,
    bpm,
    instrumentsUsed: [...instrumentsUsed],
    exactLength: piece.length,
  };
}

function describeError(source: string, error: MotynthError): CompileError {
  const offset = error.offset || 0;
  let line = 1;
  let column = 1;
  for (let k = 0; k < offset && k < source.length; k++) {
    if (source[k] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  // Messages quote with straight quotes; show them as typographic ones.
  const message = error.message.replace(/"([^"]*)"/g, '“$1”');
  return { message, offset, line, column };
}
