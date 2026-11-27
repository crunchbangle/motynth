// The rewritten engine must behave exactly like the prototype's: same notes,
// times, frequencies and instruments, and the same error messages at the
// same positions. This compares the two on every lesson and example, on
// hand-picked edge cases, and on a few hundred random programs.

import assert from 'node:assert/strict';
import { compile, type CompileResult } from '../app/src/engine/index.ts';
import { STARTER } from './helpers.ts';
import { loadPrototype } from './support/prototype.ts';
import { corruptPrograms, randomPrograms } from './support/random-programs.ts';

const prototype = loadPrototype();

/** The options the app passes (Compose tab, Learn snippets), in each engine's naming. */
const APP_OPTIONS = { instruments: STARTER, defaultInstrument: 'pulse' };
const PROTOTYPE_APP_OPTIONS = { instruments: STARTER, defaultInst: 'pulse' };

const EDGE_CASES = [
  '',
  '// only a comment',
  '[1 2',
  'pulse',
  'flute: [1]',
  'a = [1 a]',
  'a = b\nb = a\na',
  'with = [1]',
  'mode [0 12]\n[1]',
  'mode nope\n[1]',
  'names [C D]\n[C]',
  '[_ 1]',
  '[1:t] x50000',
  '[1:w] x1000',
  '[1 2 3] inv',
  '[] rev',
  'section { }',
  'section {\n  length 1w\n}',
  'x = [5]\nr = [5]\nn3 = [5]\n[x r n3]',
  'my-tune = [1 2]\n_b = my-tune\nrev = _b\npulse: [rev], rev',
  '[1:0]',
  '[1] /0',
  'tempo 0\n[1]',
  'register 1\n[1]',
  'tuning 200\n[1]',
  '[1:q. 1:q.. 1:1.5 1:e*2/3]',
  '[(1 3 5):h (2 4 6)]',
  '[C]',
  'a = [1]\n[a^1]',
  'with tuning 13 of 3 { [1 2 14] }',
  // Parser errors
  'mode [0 x 4]\n[1]',
  'mode [0 2\n[1]',
  'names C D\n[1]',
  'names [C D',
  'tuning x\n[1]',
  'tuning 12 of\n[1]',
  'tempo\n[1]',
  'root 0\n[1]',
  'tuning 12 of 1\n[1]',
  'colour 3\n[1]',
  'with colour 3 { [1] }',
  'with mode minor [1]',
  'with mode minor { [1]',
  'with mode minor tempo 80 { [1] }',
  '[1:]',
  '[1:qq]',
  '[1:q*]',
  '[1:q*2/3.]',
  '[1:2 q]',
  '[( ]',
  '[()]',
  '[(1 [2])]',
  '[1]]',
  '[1 [2]]',
  '[1 ?]',
  '[1 a b]',
  'a =',
  'a = ',
  'motif = [1]',
  'motif 3 = [1]',
  'motif a [1]',
  'mode m = [0 2]\nmode m\n[1]',
  'mode minor = [0 2]\nwith mode minor { [3] }',
  '[1] ~x',
  '[1] ^',
  '[1] x0',
  '[1] / x',
  '[1] foo',
  'pulse: [1] bass: [2]',
  '[1], , [2]',
  '[1] ,',
  '(',
  '([1]',
  '([1] [2])',
  'section [',
  'section {\n  a: [1] b: [2]\n}',
  'section {\n  length\n}',
  'section {\n  length 2 w\n  a: [1]\n}',
  'section {\n  a: [1]',
  'rest',
  'rest q',
  'rest 2 q, [1]',
  'pulse:',
  'pulse: :',
  '= [1]',
  '[1] == [2]',
  'a = [1]\nb = [(1 a)]\nb',
  '[1 2]\n\n   \n// end',
  // Errors at the very end of the text
  '[(1 2',
  '[(1 2\n',
  '([1]\n',
  '(\n',
  'with mode minor {\n[1]\n',
  'section {\n  a: [1]\n',
  'names [C D\n',
  'mode [0 2\n',
  '[1 2\n',
];

/** The parts of a compile result that matter, as plain data in one common shape. */
interface Summary {
  ok: boolean;
  [key: string]: unknown;
}

function summarizeCurrent(result: CompileResult): Summary {
  if (!result.ok) {
    const { message, offset, line, column } = result.error;
    return { ok: false, message, offset, line, column };
  }
  return {
    ok: true,
    seconds: result.durationSeconds,
    bpm: result.bpm,
    instrumentsUsed: result.instrumentsUsed,
    exactLength: [result.exactLength.numerator, result.exactLength.denominator],
    events: result.events.map((e) => [
      e.start,
      e.duration,
      e.step,
      e.frequency,
      e.instrument,
      e.isHit,
    ]),
  };
}

/** The prototype's result, which used short field names. */
function summarizePrototype(result: unknown): Summary {
  const r = result as Record<string, any>;
  if (!r.ok) {
    const { msg, pos, line, col } = r.error;
    return { ok: false, message: msg, offset: pos, line, column: col };
  }
  return {
    ok: true,
    seconds: r.total,
    bpm: r.bpm,
    instrumentsUsed: [...r.used],
    exactLength: [r.exact.dur.n, r.exact.dur.d],
    events: r.events.map((e: Record<string, unknown>) => [e.t, e.d, e.n, e.freq, e.inst, e.hit]),
  };
}

function capture(run: () => Summary): Summary | { threw: string } {
  try {
    return run();
  } catch (error) {
    return { threw: (error as Error).message };
  }
}

/** Deep equality, allowing floating-point results to differ in the last few bits. */
function assertSame(actual: unknown, expected: unknown, path = 'result'): void {
  if (typeof expected === 'number' && typeof actual === 'number') {
    const tolerance = 1e-9 * Math.max(1, Math.abs(expected));
    assert.ok(Math.abs(actual - expected) <= tolerance, `${path}: ${actual} != ${expected}`);
  } else if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${path}: expected an array`);
    assert.equal(actual.length, expected.length, `${path}: length`);
    expected.forEach((item, k) => assertSame(actual[k], item, `${path}[${k}]`));
  } else if (expected !== null && typeof expected === 'object') {
    assert.ok(actual !== null && typeof actual === 'object', `${path}: expected an object`);
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), `${path}: keys`);
    for (const [key, value] of Object.entries(expected)) {
      assertSame((actual as Record<string, unknown>)[key], value, `${path}.${key}`);
    }
  } else {
    assert.equal(actual, expected, path);
  }
}

/** Compiles with both engines, the way the app does or with no options. */
function assertParity(src: string, appOptions = true): void {
  const current = capture(() => summarizeCurrent(compile(src, appOptions ? APP_OPTIONS : {})));
  const original = capture(() =>
    summarizePrototype(prototype.compile(src, appOptions ? PROTOTYPE_APP_OPTIONS : {})),
  );
  assertSame(current, original);
}

test('lessons and examples compile exactly as in the prototype', () => {
  const snippets = [
    ...prototype.LESSONS.flatMap((l) => l.blocks.map((b) => b.code).filter((c) => c !== undefined)),
    ...prototype.EXAMPLES.map((x) => x.code),
  ];
  assert.ok(snippets.length > 20);
  for (const src of snippets) assertParity(src);
});

test('edge cases and errors match the prototype', () => {
  for (const src of EDGE_CASES) {
    assertParity(src);
    assertParity(src, false);
  }
});

test('the Sounds tab test bar wrapping matches the prototype', () => {
  for (const motif of [
    '[1:e 3 5 8 5 3 1:q]',
    '[(1 3 5):h (2 4 6):h]',
    '[x:q x x:e x x:q]',
    '[1 2',
  ]) {
    for (const octave of [-1, 0, 2]) assertParity(`piece = (${motif})^${octave}`, false);
  }
});

test('random programs, and randomly corrupted copies of them, match the prototype', () => {
  const valid = randomPrograms(20261127, 600);
  const programs = [...valid, ...corruptPrograms(valid, 1127)];
  let failures = 0;
  for (const src of programs) {
    try {
      assertParity(src);
    } catch (error) {
      failures++;
      if (failures <= 3)
        console.error(`Mismatch for program:\n${src}\n${(error as Error).message}`);
    }
  }
  assert.equal(failures, 0, `${failures} of ${programs.length} random programs differ`);
});
