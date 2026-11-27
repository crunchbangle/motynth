import assert from 'node:assert/strict';
import { MotynthError, parseProgram } from '../app/src/engine/index.ts';
import { fails, STARTER } from './helpers.ts';

test('an empty program asks for something to play', () => {
  assert.match(fails('').message, /Nothing to play yet/);
  assert.match(fails('// just a comment').message, /Nothing to play yet/);
});

test('errors report line and column', () => {
  const e = fails('a = [1]\n\nzz');
  assert.equal(e.line, 3);
  assert.equal(e.column, 1);
  assert.equal(e.message, 'Unknown name “zz”');
});

test('an unclosed motif points at its opening bracket', () => {
  const e = fails('tempo 90\npulse: [1 2');
  assert.equal(e.line, 2);
  assert.equal(e.column, 8);
  assert.match(e.message, /missing its closing/);
});

test('unknown instruments are reported when the instrument list is known', () => {
  assert.match(fails('flute: [1]', { instruments: STARTER }).message, /Unknown instrument “flute”/);
});

test('a bare instrument name gets a hint', () => {
  assert.match(fails('pulse', { instruments: STARTER }).message, /is an instrument/);
});

test('self-reference is caught', () => {
  assert.match(fails('a = [1 a]').message, /defined in terms of itself/);
  assert.match(fails('a = b\nb = a\na').message, /defined in terms of itself/);
});

test('keywords cannot be names', () => {
  assert.match(fails('with = [1]').message, /is a keyword/);
});

test('modes must fit the tuning', () => {
  assert.match(fails('mode [0 12]\n[1]').message, /outside the current tuning/);
  assert.match(fails('mode nope\n[1]').message, /Unknown mode/);
});

test('names must match the tuning size', () => {
  assert.match(fails('names [C D]\n[C]').message, /needs 12 entries/);
});

test('a tie needs a note before it', () => {
  assert.match(fails('[_ 1]').message, /needs a note before it/);
});

test('piece size limits', () => {
  assert.match(fails('[1:t] x50000').message, /more than 40000 notes/);
  assert.match(fails('[1:w] x1000').message, /over 30 minutes/);
});

test('parseProgram throws MotynthError with an offset', () => {
  assert.throws(
    () => parseProgram('[1 2'),
    (e: unknown) => e instanceof MotynthError && e.offset === 0,
  );
});

test('parseProgram returns statements', () => {
  const statements = parseProgram('tempo 90\nmotif a = [1]\nmode m = [0 2]\na');
  assert.deepEqual(
    statements.map((s) => s.type),
    ['setting', 'definition', 'modeDefinition', 'expression'],
  );
});
