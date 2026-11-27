// The rewritten engine must behave exactly like the prototype's: same notes,
// times, frequencies and instruments, and the same error messages at the
// same positions. This compares the two on every lesson and example, on
// hand-picked edge cases, and on a few hundred random programs.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compile } from '../app/src/engine/index.js';
import { STARTER } from './helpers.js';
import { loadPrototype } from './support/prototype.ts';
import { randomPrograms } from './support/random-programs.ts';

const prototype = loadPrototype();

/** How the app calls the compiler (Compose tab, Learn snippets). */
const APP_OPTIONS = { instruments: STARTER, defaultInst: 'pulse' };

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
];

/** The parts of a compile result that matter, as plain data. */
function summarize(result: unknown): unknown {
  const r = result as Record<string, any>;
  if (!r.ok) return { ok: false, ...r.error };
  return {
    ok: true,
    total: r.total,
    bpm: r.bpm,
    count: r.count,
    used: [...r.used],
    exactDuration: { ...r.exact.dur },
    events: r.events.map((e: Record<string, unknown>) => [e.t, e.d, e.n, e.freq, e.inst, e.hit]),
  };
}

function run(engine: (src: string, opts?: object) => unknown, src: string, opts?: object): unknown {
  try {
    return summarize(engine(src, opts));
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

function assertParity(src: string, opts?: object): void {
  assertSame(run(compile, src, opts), run(prototype.compile, src, opts));
}

test('lessons and examples compile exactly as in the prototype', () => {
  const snippets = [
    ...prototype.LESSONS.flatMap((l) => l.blocks.map((b) => b.code).filter((c) => c !== undefined)),
    ...prototype.EXAMPLES.map((x) => x.code),
  ];
  assert.ok(snippets.length > 20);
  for (const src of snippets) assertParity(src, APP_OPTIONS);
});

test('edge cases and errors match the prototype', () => {
  for (const src of EDGE_CASES) {
    assertParity(src, APP_OPTIONS);
    assertParity(src);
  }
});

test('the Sounds tab test bar wrapping matches the prototype', () => {
  for (const motif of [
    '[1:e 3 5 8 5 3 1:q]',
    '[(1 3 5):h (2 4 6):h]',
    '[x:q x x:e x x:q]',
    '[1 2',
  ]) {
    for (const octave of [-1, 0, 2]) assertParity(`piece = (${motif})^${octave}`);
  }
});

test('random programs match the prototype', () => {
  const programs = randomPrograms(20261127, 600);
  let failures = 0;
  for (const src of programs) {
    try {
      assertParity(src, APP_OPTIONS);
    } catch (error) {
      failures++;
      if (failures <= 3)
        console.error(`Mismatch for program:\n${src}\n${(error as Error).message}`);
    }
  }
  assert.equal(failures, 0, `${failures} of ${programs.length} random programs differ`);
});
