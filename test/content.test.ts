import assert from 'node:assert/strict';
import { EXAMPLES } from '../app/src/content/examples.ts';
import { LESSONS } from '../app/src/content/lessons.ts';
import { REFERENCE } from '../app/src/content/reference.ts';
import { BUILTIN_MODES } from '../app/src/engine/index.ts';
import { ok, STARTER } from './helpers.ts';

// Every snippet the app ships must compile against the starter instruments.
const options = { instruments: STARTER, defaultInstrument: 'pulse' };

for (const lesson of LESSONS) {
  lesson.blocks.forEach((block, k) => {
    if (block.type === 'code') {
      test(`lesson "${lesson.title}" snippet ${k} compiles`, () => {
        ok(block.code, options);
      });
    }
  });
}

for (const example of EXAMPLES) {
  test(`example "${example.name}" compiles`, () => {
    ok(example.code, options);
  });
}

test('lesson ids are unique, and exactly one lesson is the reference', () => {
  assert.equal(new Set(LESSONS.map((l) => l.id)).size, LESSONS.length);
  assert.equal(LESSONS.filter((l) => l.isReference).length, 1);
});

test('the reference lists every built-in mode and the current instruments', () => {
  const meanings = REFERENCE.flatMap((group) => group.rows).map((row) =>
    typeof row.meaning === 'function'
      ? row.meaning({ instruments: ['pulse', 'drone'] })
      : row.meaning,
  );
  const modeRow = meanings.find((m) => m.startsWith('Pick a mode by name'));
  for (const mode of BUILTIN_MODES.keys()) assert.ok(modeRow?.includes(mode), mode);
  assert.ok(meanings.some((m) => m.includes('Your instruments: pulse, drone.')));
});
