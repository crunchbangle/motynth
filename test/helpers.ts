import assert from 'node:assert/strict';
import {
  compile,
  type CompileError,
  type CompileOptions,
  type CompiledPiece,
} from '../app/src/engine/index.ts';

/** The starter instruments, as the app passes them to the compiler. */
export const STARTER: ReadonlySet<string> = new Set([
  'pulse',
  'square',
  'tri',
  'saw',
  'bass',
  'pluck',
  'keys',
  'kick',
  'snare',
  'hat',
  'tom',
]);

/** Compiles and asserts success. */
export function ok(source: string, options?: CompileOptions): CompiledPiece {
  const result = compile(source, options);
  if (!result.ok) {
    assert.fail(`expected success, got line ${result.error.line}: ${result.error.message}`);
  }
  return result;
}

/** Compiles and asserts failure. */
export function fails(source: string, options?: CompileOptions): CompileError {
  const result = compile(source, options);
  if (result.ok) assert.fail('expected a compile error');
  return result.error;
}

type HasEvents = Pick<CompiledPiece, 'events'>;

export const steps = (r: HasEvents): number[] => r.events.map((e) => e.step);
export const starts = (r: HasEvents): number[] => r.events.map((e) => e.start);
export const durations = (r: HasEvents): number[] => r.events.map((e) => e.duration);
