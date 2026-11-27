// Public API of the Motynth engine. The engine has no browser dependencies
// and runs in Node as well.

export {
  compile,
  type CompileError,
  type CompileOptions,
  type CompileResult,
  type CompiledPiece,
  type NoteEvent,
} from './compile.ts';
export { MotynthError } from './errors.ts';
export { Fraction } from './fraction.ts';
export { BUILTIN_MODES, KEYWORDS, LIMITS } from './language.ts';
export { parseProgram } from './parser.ts';
export type { Statement } from './ast.ts';
