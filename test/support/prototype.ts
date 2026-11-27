// Loads the engine and content from the original single-file prototype, so
// tests can compare the rewritten engine against it. prototype/ is never
// edited, so it is a fixed reference.

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

export interface PrototypeExports {
  compile: (src: string, opts?: object) => unknown;
  LESSONS: { id: string; title: string; blocks: { p?: string; code?: string }[] }[];
  EXAMPLES: { name: string; code: string }[];
}

const PROTOTYPE_PATH = new URL('../../prototype/motynth.html', import.meta.url);

// The prototype's engine and content sit at the top of its script, ending
// with a CommonJS export guard that was written for exactly this use.
const START = "'use strict';";
const END = "if(typeof module!=='undefined')module.exports={LESSONS,REFERENCE,EXAMPLES};";

export function loadPrototype(): PrototypeExports {
  const html = readFileSync(PROTOTYPE_PATH, 'utf8');
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  if (start < 0 || end < 0) {
    throw new Error('Could not find the engine in prototype/motynth.html');
  }
  const code = html.slice(start, end) + '\nmodule.exports = { compile, LESSONS, EXAMPLES };';
  const sandbox = { module: { exports: {} as PrototypeExports } };
  runInNewContext(code, sandbox, { filename: 'prototype/motynth.html' });
  return sandbox.module.exports;
}
