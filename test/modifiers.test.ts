import assert from 'node:assert/strict';
import { test } from 'node:test';
import { durations, ok, starts, steps } from './helpers.ts';

test('+n is a tonal shift within the mode', () => {
  assert.deepEqual(steps(ok('[1 2 3] +2')), [4, 5, 7]);
  assert.deepEqual(steps(ok('[1 2 3] -1')), [-1, 0, 2]);
});

test('~n is a chromatic shift in tuning steps, up or down', () => {
  assert.deepEqual(steps(ok('[1 2 3] ~2')), [2, 4, 6]);
  assert.deepEqual(steps(ok('[1 2 3] ~-3')), [-3, -1, 1]);
});

test('^n shifts by registers', () => {
  assert.deepEqual(steps(ok('[1 2] ^1')), [12, 14]);
  assert.deepEqual(steps(ok('[1 2]^-1')), [-12, -10]);
});

test('a shift resolves in the mode where the name is used', () => {
  assert.deepEqual(steps(ok('hook = [1 3]\nwith mode minor { hook +1 }')), [2, 5]);
});

test('rev plays backwards, keeping durations', () => {
  const r = ok('[1:q 2:h] rev');
  assert.deepEqual(steps(r), [2, 0]);
  assert.deepEqual(starts(r), [0, 1]);
  assert.deepEqual(durations(r), [1, 0.5]);
});

test('inv mirrors around the first note within the mode', () => {
  assert.deepEqual(steps(ok('[1 3 5] inv')), [0, -3, -7]);
});

test('xN repeats', () => {
  const r = ok('[1 2] x3');
  assert.equal(r.events.length, 6);
  assert.equal(r.durationSeconds, 3);
});

test('*2 doubles speed and /2 halves it', () => {
  assert.equal(ok('[1 2] *2').durationSeconds, 0.5);
  assert.equal(ok('[1 2] /2').durationSeconds, 2);
});

test('modifiers chain left to right', () => {
  assert.deepEqual(steps(ok('[1 2] x2 rev')), [2, 0, 2, 0]);
  assert.equal(ok('[1 2] x2 *2').durationSeconds, 1);
});
