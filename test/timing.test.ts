import assert from 'node:assert/strict';
import { durations, ok, starts } from './helpers.ts';

// At the default tempo of 120 (quarter = 1 beat), a whole note lasts 2 seconds.

test('default duration is a quarter note', () => {
  const r = ok('[1 2 3]');
  assert.deepEqual(starts(r), [0, 0.5, 1]);
  assert.deepEqual(durations(r), [0.5, 0.5, 0.5]);
  assert.equal(r.durationSeconds, 1.5);
  assert.equal(r.bpm, 120);
});

test('durations stick until changed', () => {
  assert.deepEqual(durations(ok('[1:e 2 3:h 4]')), [0.25, 0.25, 1, 1]);
});

test('every duration letter', () => {
  assert.deepEqual(durations(ok('[1:w 1:h 1:q 1:e 1:s 1:t]')), [2, 1, 0.5, 0.25, 0.125, 0.0625]);
});

test('dots add half, then a quarter', () => {
  assert.deepEqual(durations(ok('[1:q. 1:q..]')), [0.75, 0.875]);
});

test('numeric and fractional durations', () => {
  assert.deepEqual(durations(ok('[1:1/8 1:2q 1:1.5]')), [0.25, 1, 3]);
});

test('triplets are exact: three e*2/3 fill a quarter with no drift', () => {
  const r = ok('[1:e*2/3 2 3 4:q]');
  assert.equal(r.events[3]?.start, 0.5);
  assert.equal(r.exactLength.toString(), '1/2');
});

test('rests take time but make no events', () => {
  const r = ok('[1 . 2 rest 3 r 4]');
  assert.equal(r.events.length, 4);
  assert.deepEqual(starts(r), [0, 1, 2, 3]);
});

test('a tie extends the previous note', () => {
  const r = ok('[1:q _:e 2:q]');
  assert.deepEqual(durations(r), [0.75, 0.5]);
  assert.deepEqual(starts(r), [0, 0.75]);
});

test('a chord starts all its notes together', () => {
  assert.deepEqual(starts(ok('[(1 3 5):h 1:q]')), [0, 0, 0, 1]);
});

test('tempo scales seconds', () => {
  const r = ok('tempo 60\n[1 2]');
  assert.deepEqual(starts(r), [0, 1]);
  assert.equal(r.bpm, 60);
});

test('a scoped tempo changes only its block', () => {
  const r = ok('[1], with tempo 60 { [1] }, [1]');
  assert.deepEqual(starts(r), [0, 0.5, 1.5]);
  assert.equal(r.durationSeconds, 2);
});

test('commas play in sequence', () => {
  assert.deepEqual(starts(ok('[1:h], [2:q], [3]')), [0, 1, 1.5]);
});

test('a motif named inside a motif is spliced in, or squeezed to a given duration', () => {
  assert.deepEqual(starts(ok('a = [1:e 2]\n[a 3:q]')), [0, 0.25, 0.5]);
  assert.deepEqual(durations(ok('a = [1 2 3 4]\n[a:q]')), [0.125, 0.125, 0.125, 0.125]);
});
