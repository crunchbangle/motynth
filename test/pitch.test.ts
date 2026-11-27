import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ok, steps } from './helpers.ts';

const ROOT = 261.6256;

function near(actual: number | undefined, expected: number): void {
  assert.ok(
    actual !== undefined && Math.abs(actual - expected) < 1e-9,
    `${actual} is not ${expected}`,
  );
}

const frequency = (source: string, index = 0): number | undefined =>
  ok(source).events[index]?.frequency;

test('degrees follow the major mode by default', () => {
  assert.deepEqual(steps(ok('[1 2 3 4 5 6 7 8]')), [0, 2, 4, 5, 7, 9, 11, 12]);
});

test('degree 1 is the root frequency, degree 8 an octave up', () => {
  near(frequency('[1 8]', 0), ROOT);
  near(frequency('[1 8]', 1), 2 * ROOT);
});

test('root sets the frequency of degree 1', () => {
  assert.equal(frequency('root 440\n[1]'), 440);
});

test('n ignores the mode; # and b nudge by one step; ^ shifts registers', () => {
  assert.deepEqual(steps(ok('[n1 3# 3b 1^1 1^-1]')), [1, 5, 3, 12, -12]);
});

test('degrees below 1 wrap downward', () => {
  assert.deepEqual(steps(ok('[0 -1]')), [-1, -3]);
});

test('a with-scoped mode applies inside and is restored after', () => {
  assert.deepEqual(steps(ok('with mode minor { [3] }, [3]')), [3, 4]);
});

test('a custom mode by list or by name', () => {
  assert.deepEqual(steps(ok('mode [0 3 7]\n[1 2 3 4]')), [0, 3, 7, 12]);
  assert.deepEqual(steps(ok('mode gloom = [0 1 4 5 7 8 11]\nwith mode gloom { [2 3] }')), [1, 4]);
});

test('note names', () => {
  assert.deepEqual(steps(ok('names [C Db D Eb E F Gb G Ab A Bb B]\n[C E G C^1]')), [0, 4, 7, 12]);
});

test('a non-octave tuning resets the mode to chromatic', () => {
  assert.deepEqual(steps(ok('with tuning 13 of 3 { [1 2 14] }')), [0, 1, 13]);
  near(frequency('with tuning 13 of 3 { [1 2 14] }', 2), 3 * ROOT);
});

test('register changes only the ratio', () => {
  near(frequency('register 3\n[8]'), 3 * ROOT);
});
