import assert from 'node:assert/strict';
import type { CompiledPiece } from '../app/src/engine/index.ts';
import { durations, ok, starts, steps } from './helpers.ts';

const lane = (r: CompiledPiece, instrument: string) => ({
  events: r.events.filter((e) => e.instrument === instrument),
});

test('instrument names tag their events; defaultInstrument fills the rest', () => {
  const r = ok('pulse: [1], [2]', { defaultInstrument: 'tri' });
  assert.deepEqual(
    r.events.map((e) => e.instrument),
    ['pulse', 'tri'],
  );
  assert.deepEqual(r.instrumentsUsed.sort(), ['pulse', 'tri']);
});

test('x is a percussion hit', () => {
  assert.deepEqual(
    ok('kick: [x . x]').events.map((e) => e.isHit),
    [true, true],
  );
});

test('a section lasts as long as its longest block', () => {
  const r = ok('section {\n  a: [1:w]\n  b: [1:h]\n}');
  assert.equal(r.durationSeconds, 2);
  assert.deepEqual(starts(r), [0, 0]);
});

test('loop repeats a block to the section length and cuts the last repeat', () => {
  // A 1.5 s block in a 2 s section: the second repeat is cut to 0.5 s.
  const b = lane(ok('section {\n  a: [1:w]\n  b: [1:h.] loop\n}'), 'b');
  assert.deepEqual(starts(b), [0, 1.5]);
  assert.deepEqual(durations(b), [1.5, 0.5]);
});

test('fit stretches a block to the section length', () => {
  const r = ok('section {\n  length 1w\n  a: [1 2 3] fit\n}');
  assert.equal(r.durationSeconds, 2);
  for (const d of durations(r)) assert.ok(Math.abs(d - 2 / 3) < 1e-12);
});

test('sets-length decides the section length and clips the others', () => {
  const r = ok('section {\n  a: [1:h] sets-length\n  b: [1:w]\n}');
  assert.equal(r.durationSeconds, 1);
  assert.deepEqual(durations(lane(r, 'b')), [1]);
});

test('length drops events that start after the end', () => {
  const r = ok('section {\n  length 1q\n  a: [1 2 3]\n}');
  assert.equal(r.events.length, 1);
  assert.equal(r.durationSeconds, 0.5);
});

test('a staff inside a section shares its length', () => {
  const r = ok('section {\n  staff {\n    a: [1:w]\n  }\n  b: [1] loop\n}');
  assert.equal(lane(r, 'b').events.length, 4);
});

test('sections play one after another', () => {
  const r = ok('s = section {\n  a: [1:h]\n}\ns, s +1');
  assert.deepEqual(starts(r), [0, 1]);
  assert.deepEqual(steps(r), [0, 2]);
});

test('piece plays when defined', () => {
  assert.equal(ok('a = [1 2]\npiece = a x2\n[1]').events.length, 4);
});

test('otherwise the bare expressions play', () => {
  assert.equal(ok('a = [1 2]\n[1 2 3]').events.length, 3);
});

test('otherwise the last definition plays', () => {
  assert.equal(ok('a = [1]\nb = [1 2]').events.length, 2);
});

test('play and motif keywords', () => {
  assert.equal(ok('motif a = [1 2]\nplay a, a').events.length, 4);
});

// The Names section of the reference warns about these.
test('inside a motif, x, r and n3 are a hit, a rest and a tuning step, even if defined as names', () => {
  const r = ok('x = [5]\nr = [5]\nn3 = [5]\n[x r n3]');
  assert.deepEqual(
    r.events.map((e) => e.isHit),
    [true, false],
  );
  assert.deepEqual(starts(r), [0, 1]);
  assert.equal(r.events[1]?.step, 3);
});

test('names may contain - and _, and modifier words can be names', () => {
  assert.equal(ok('my-tune = [1 2]\n_b = my-tune\nrev = _b\npulse: [rev], rev').events.length, 4);
});

test('comments are ignored', () => {
  assert.equal(ok('// hello\n[1 2] // trailing\n').events.length, 2);
});
