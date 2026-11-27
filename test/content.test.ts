import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXAMPLES } from '../app/src/content/examples.js';
import { LESSONS } from '../app/src/content/lessons.js';
import { ok, STARTER } from './helpers.ts';

// Every snippet the app ships must compile against the starter instruments.
const options = { instruments: STARTER, defaultInstrument: 'pulse' };

for (const lesson of LESSONS) {
  lesson.blocks.forEach((block: { code?: string }, k: number) => {
    const code = block.code;
    if (code) {
      test(`lesson "${lesson.title}" snippet ${k} compiles`, () => {
        ok(code, options);
      });
    }
  });
}

for (const example of EXAMPLES) {
  test(`example "${example.name}" compiles`, () => {
    assert.ok(example.code);
    ok(example.code, options);
  });
}
