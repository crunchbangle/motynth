import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ok, notes} from './helpers.js';

const ROOT = 261.6256;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}`);

test('degrees follow the major mode by default', () => {
  assert.deepEqual(notes(ok('[1 2 3 4 5 6 7 8]')), [0, 2, 4, 5, 7, 9, 11, 12]);
});

test('degree 1 is the root frequency, degree 8 an octave up', () => {
  const r = ok('[1 8]');
  near(r.events[0].freq, ROOT);
  near(r.events[1].freq, 2 * ROOT);
});

test('root sets the frequency of degree 1', () => {
  assert.equal(ok('root 440\n[1]').events[0].freq, 440);
});

test('n ignores the mode; # and b nudge by one step; ^ shifts registers', () => {
  assert.deepEqual(notes(ok('[n1 3# 3b 1^1 1^-1]')), [1, 5, 3, 12, -12]);
});

test('degrees below 1 wrap downward', () => {
  assert.deepEqual(notes(ok('[0 -1]')), [-1, -3]);
});

test('a with-scoped mode applies inside and is restored after', () => {
  assert.deepEqual(notes(ok('with mode minor { [3] }, [3]')), [3, 4]);
});

test('a custom mode by list or by name', () => {
  assert.deepEqual(notes(ok('mode [0 3 7]\n[1 2 3 4]')), [0, 3, 7, 12]);
  assert.deepEqual(notes(ok('mode gloom = [0 1 4 5 7 8 11]\nwith mode gloom { [2 3] }')), [1, 4]);
});

test('note names', () => {
  assert.deepEqual(notes(ok('names [C Db D Eb E F Gb G Ab A Bb B]\n[C E G C^1]')), [0, 4, 7, 12]);
});

test('a non-octave tuning resets the mode to chromatic', () => {
  const r = ok('with tuning 13 of 3 { [1 2 14] }');
  assert.deepEqual(notes(r), [0, 1, 13]);
  near(r.events[2].freq, 3 * ROOT);
});

test('register changes only the ratio', () => {
  near(ok('register 3\n[8]').events[0].freq, 3 * ROOT);
});
