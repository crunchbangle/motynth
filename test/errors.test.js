import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fails, STARTER} from './helpers.js';
import {parseProgram, MotError} from '../app/src/engine/index.js';

test('an empty program asks for something to play', () => {
  assert.match(fails('').msg, /Nothing to play yet/);
  assert.match(fails('// just a comment').msg, /Nothing to play yet/);
});

test('errors report line and column', () => {
  const e = fails('a = [1]\n\nzz');
  assert.equal(e.line, 3);
  assert.equal(e.col, 1);
  assert.equal(e.msg, 'Unknown name “zz”');
});

test('an unclosed motif points at its opening bracket', () => {
  const e = fails('tempo 90\npulse: [1 2');
  assert.equal(e.line, 2);
  assert.equal(e.col, 8);
  assert.match(e.msg, /missing its closing/);
});

test('unknown instruments are reported when the instrument list is known', () => {
  assert.match(fails('flute: [1]', {instruments: STARTER}).msg, /Unknown instrument “flute”/);
});

test('a bare instrument name gets a hint', () => {
  assert.match(fails('pulse', {instruments: STARTER}).msg, /is an instrument/);
});

test('self-reference is caught', () => {
  assert.match(fails('a = [1 a]').msg, /defined in terms of itself/);
  assert.match(fails('a = b\nb = a\na').msg, /defined in terms of itself/);
});

test('keywords cannot be names', () => {
  assert.match(fails('with = [1]').msg, /is a keyword/);
});

test('modes must fit the tuning', () => {
  assert.match(fails('mode [0 12]\n[1]').msg, /outside the current tuning/);
  assert.match(fails('mode nope\n[1]').msg, /Unknown mode/);
});

test('names must match the tuning size', () => {
  assert.match(fails('names [C D]\n[C]').msg, /needs 12 entries/);
});

test('a tie needs a note before it', () => {
  assert.match(fails('[_ 1]').msg, /needs a note before it/);
});

test('piece size limits', () => {
  assert.match(fails('[1:t] x50000').msg, /more than 40000 notes/);
  assert.match(fails('[1:w] x1000').msg, /over 30 minutes/);
});

test('parseProgram throws MotError with a position', () => {
  assert.throws(() => parseProgram('[1 2'), e => e instanceof MotError && e.pos === 0);
});

test('parseProgram returns statements', () => {
  const p = parseProgram('tempo 90\nmotif a = [1]\nmode m = [0 2]\na');
  assert.deepEqual(p.map(s => s.type), ['setting', 'def', 'modedef', 'expr']);
});
