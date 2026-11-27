import {test} from 'node:test';
import {ok, STARTER} from './helpers.js';
import {LESSONS} from '../app/src/content/lessons.js';
import {EXAMPLES} from '../app/src/content/examples.js';

// Every snippet the app ships must compile against the starter instruments.
const opts = {instruments: STARTER, defaultInst: 'pulse'};

for (const l of LESSONS) {
  l.blocks.forEach((b, k) => {
    if (b.code) test(`lesson "${l.title}" snippet ${k} compiles`, () => { ok(b.code, opts); });
  });
}

for (const x of EXAMPLES) {
  test(`example "${x.name}" compiles`, () => { ok(x.code, opts); });
}
