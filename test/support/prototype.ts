// Loads code from the original single-file prototype, so tests can compare
// the rewritten app against it. prototype/ is never edited, so it is a fixed
// reference.

import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const PROTOTYPE_PATH = new URL('../../prototype/motynth.html', import.meta.url);

function prototypeSource(): string {
  return readFileSync(PROTOTYPE_PATH, 'utf8');
}

/** The text between two markers in the prototype's source (`end` excluded). */
function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  if (from < 0 || to < 0) throw new Error(`Could not find "${start}" in prototype/motynth.html`);
  return source.slice(from, to);
}

function run<T>(code: string, exportExpression: string, globals: object = {}): T {
  const sandbox = { ...globals, module: { exports: {} as T } };
  runInNewContext(`${code}\nmodule.exports = ${exportExpression};`, sandbox, {
    filename: 'prototype/motynth.html',
  });
  return sandbox.module.exports;
}

// ---------------------------------------------------------------------------
// Engine and content

export interface PrototypeExports {
  compile: (src: string, opts?: object) => unknown;
  LESSONS: { id: string; title: string; blocks: { p?: string; code?: string }[] }[];
  EXAMPLES: { name: string; code: string }[];
}

export function loadPrototype(): PrototypeExports {
  // The engine and content sit at the top of the script, ending with a
  // CommonJS export guard that was written for exactly this use.
  const code = between(
    prototypeSource(),
    "'use strict';",
    "if(typeof module!=='undefined')module.exports={LESSONS,REFERENCE,EXAMPLES};",
  );
  return run<PrototypeExports>(code, '{ compile, LESSONS, EXAMPLES }');
}

// ---------------------------------------------------------------------------
// Sound library and audio maths

/** The prototype's sound data, in its own short-named format. */
export interface PrototypeLibrary {
  waves: Record<string, unknown>[];
  insts: Record<string, unknown>[];
}

/** A Web Audio buffer, as far as buildBuffer uses one. */
export interface FakeBuffer {
  length: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export interface PrototypeSoundExports {
  shape: (kind: string, width: number, levels: number, duty?: number) => number[];
  starterLibrary: () => PrototypeLibrary;
  uniqueName: (base: string, taken: Set<string>) => string;
  resampleData: (data: number[], w: number, d: number, nw: number, nd: number) => number[];
  buildBuffer: (
    ctx: { sampleRate: number; createBuffer: (ch: number, n: number, rate: number) => FakeBuffer },
    wave: Record<string, unknown>,
  ) => { buf: FakeBuffer; type: string };
  adsrPts: (
    envelope: { a: number; d: number; s: number; r: number },
    duration: number,
    peak: number,
  ) => { pts: [number, number][]; end: number };
}

/** The prototype's syntax highlighter: one line of code to an HTML string. */
export function loadPrototypeHighlighter(): { hi: (line: string) => string } {
  const source = prototypeSource();
  const esc = between(source, 'const esc=', 'const uid=');
  const highlighter = between(
    source,
    '/* =====================  syntax highlighting',
    '/* =====================  compose',
  );
  return run(esc + highlighter, '{ hi }');
}

/**
 * The prototype's helpers, sound library and audio maths. None of it touches
 * the page or Web Audio when loaded; only when its functions are called.
 */
export function loadPrototypeSound(): PrototypeSoundExports {
  const source = prototypeSource();
  const helpers = between(
    source,
    '/* =====================  helpers',
    '/* =====================  syntax highlighting',
  );
  const resample = between(source, 'function resampleData(', 'function renderWaveEditor(');
  return run<PrototypeSoundExports>(
    helpers + resample,
    '{ shape, starterLibrary, uniqueName, resampleData, buildBuffer, adsrPts }',
  );
}

// ---------------------------------------------------------------------------
// Piano roll

/** One fillRect call: [fillStyle, x, y, width, height]. */
export type FillCall = [unknown, number, number, number, number];

/** The prototype's note event fields. */
export interface PrototypeEvent {
  t: number;
  d: number;
  n: number;
  inst: string | null;
  hit: boolean;
}

/**
 * Runs the prototype's drawRoll on a fake canvas of the given CSS size and
 * returns its fillRect calls. Colours are the names of the CSS variables, and
 * instruments' colours are `inst:<name>`.
 */
export function prototypeRollDrawing(
  piece: { events: PrototypeEvent[]; total: number; bpm: number; used: string[] },
  instruments: { name: string; follow: boolean }[],
  width: number,
  height: number,
): FillCall[] {
  const calls: FillCall[] = [];
  const g = {
    fillStyle: '' as unknown,
    setTransform() {},
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push([this.fillStyle, x, y, w, h]);
    },
  };
  const element = () => ({ hidden: false, replaceChildren() {}, style: {} });
  // The canvas's box includes a 2-pixel border on each side.
  const box = { clientWidth: width + 4, clientHeight: height + 4 };
  const elements: Record<string, unknown> = {
    '#roll': { parentElement: box, getContext: () => g, width: 0, height: 0 },
    '#rollEmpty': element(),
    '#legend': element(),
    '#stats': element(),
  };
  const source = prototypeSource();
  const helpers =
    between(source, 'const clamp=', 'function h(') +
    between(source, 'const fmtTime=', 'const fmtT=');
  const roll = between(source, 'let rollState=null;', '/* =====================  transport');
  const { drawRoll } = run<{ drawRoll: (res: unknown) => void }>(helpers + roll, '{ drawRoll }', {
    window: { devicePixelRatio: 1 },
    $: (selector: string) => elements[selector],
    cssv: (name: string) => name,
    h: () => ({}),
    Lib: { inst: (name: string) => instruments.find((i) => i.name === name) },
    instColor: (name: string) => `inst:${name}`,
  });
  drawRoll({ ok: true, ...piece });
  return calls;
}
