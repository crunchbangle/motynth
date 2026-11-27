import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ok, notes, times, durs} from './helpers.js';

test('+n is a tonal shift within the mode', () => {
  assert.deepEqual(notes(ok('[1 2 3] +2')), [4, 5, 7]);
  assert.deepEqual(notes(ok('[1 2 3] -1')), [-1, 0, 2]);
});

test('~n is a chromatic shift in tuning steps', () => {
  assert.deepEqual(notes(ok('[1 2 3] ~2')), [2, 4, 6]);
});

test('^n shifts by registers', () => {
  assert.deepEqual(notes(ok('[1 2] ^1')), [12, 14]);
  assert.deepEqual(notes(ok('[1 2]^-1')), [-12, -10]);
});

test('a shift resolves in the mode where the name is used', () => {
  assert.deepEqual(notes(ok('hook = [1 3]\nwith mode minor { hook +1 }')), [2, 5]);
});

test('rev plays backwards, keeping durations', () => {
  const r = ok('[1:q 2:h] rev');
  assert.deepEqual(notes(r), [2, 0]);
  assert.deepEqual(times(r), [0, 1]);
  assert.deepEqual(durs(r), [1, 0.5]);
});

test('inv mirrors around the first note within the mode', () => {
  assert.deepEqual(notes(ok('[1 3 5] inv')), [0, -3, -7]);
});

test('xN repeats', () => {
  const r = ok('[1 2] x3');
  assert.equal(r.count, 6);
  assert.equal(r.total, 3);
});

test('*2 doubles speed and /2 halves it', () => {
  assert.equal(ok('[1 2] *2').total, 0.5);
  assert.equal(ok('[1 2] /2').total, 2);
});

test('modifiers chain left to right', () => {
  assert.deepEqual(notes(ok('[1 2] x2 rev')), [2, 0, 2, 0]);
  assert.equal(ok('[1 2] x2 *2').total, 1);
});
