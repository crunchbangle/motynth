import assert from 'node:assert/strict';
import {compile} from '../app/src/engine/index.js';

// The starter instruments, as the app passes them to the compiler.
export const STARTER = new Set(['pulse', 'square', 'tri', 'saw', 'bass', 'pluck', 'keys', 'kick', 'snare', 'hat', 'tom']);

// Compile and assert success; returns the result.
export function ok(src, opts) {
  const r = compile(src, opts);
  assert.ok(r.ok, r.ok ? '' : `expected success, got line ${r.error.line}: ${r.error.msg}`);
  return r;
}

// Compile and assert failure; returns the error.
export function fails(src, opts) {
  const r = compile(src, opts);
  assert.equal(r.ok, false, 'expected a compile error');
  return r.error;
}

export const notes = r => r.events.map(e => e.n);
export const times = r => r.events.map(e => e.t);
export const durs = r => r.events.map(e => e.d);
