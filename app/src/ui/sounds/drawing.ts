// Canvas pictures of waves and envelopes. Each function sizes the canvas
// (in canvas pixels; CSS scales it up with crisp, pixelated edges) and draws.

import type { Envelope } from '../../sound/instrument.ts';
import type { Wave } from '../../sound/wave.ts';

/** The drawing calls these pictures use; a real canvas context, or a fake in tests. */
export type PictureCanvas = Pick<
  CanvasRenderingContext2D,
  'fillRect' | 'beginPath' | 'moveTo' | 'lineTo' | 'stroke'
> & { fillStyle: unknown; strokeStyle: unknown; lineWidth: number };

export interface Sizable {
  width: number;
  height: number;
}

export interface CellColors {
  /** Background. */
  background: string;
  /** A column's level. */
  on: string;
  /** Area between a column and silence. */
  fill: string;
  grid: string;
  /** The silence line, and the smoothed curve. */
  zero: string;
}

/** Grid cells are scaled to fit about 448 × 224 canvas pixels. */
const GRID_WIDTH = 448;
const GRID_HEIGHT = 224;

/** The editable wave grid. */
export function drawWaveGrid(canvas: Sizable, g: PictureCanvas, wave: Wave, colors: CellColors) {
  const width = wave.columns.length;
  const levels = wave.levels;
  const cellWidth = Math.floor(GRID_WIDTH / width);
  const cellHeight = Math.floor(GRID_HEIGHT / levels);
  canvas.width = width * cellWidth;
  canvas.height = levels * cellHeight;

  g.fillStyle = colors.background;
  g.fillRect(0, 0, canvas.width, canvas.height);

  // Shade each column from its level to the middle (silence).
  const middle = levels / 2;
  const rowOf = (column: number) => levels - 1 - (wave.columns[column] as number);
  for (let i = 0; i < width; i++) {
    const row = rowOf(i);
    g.fillStyle = colors.fill;
    if (row < middle)
      g.fillRect(i * cellWidth, row * cellHeight, cellWidth, (middle - row) * cellHeight);
    else g.fillRect(i * cellWidth, middle * cellHeight, cellWidth, (row - middle + 1) * cellHeight);
  }

  g.fillStyle = colors.grid;
  for (let i = 1; i < width; i++) g.fillRect(i * cellWidth, 0, 1, canvas.height);
  for (let j = 1; j < levels; j++) g.fillRect(0, j * cellHeight, canvas.width, 1);

  g.fillStyle = colors.zero;
  g.fillRect(0, middle * cellHeight - 1, canvas.width, 2);

  g.fillStyle = colors.on;
  for (let i = 0; i < width; i++) {
    g.fillRect(i * cellWidth + 1, rowOf(i) * cellHeight + 1, cellWidth - 1, cellHeight - 1);
  }

  if (wave.smooth) {
    g.strokeStyle = colors.zero;
    g.lineWidth = 2;
    g.beginPath();
    for (let i = 0; i < width; i++) {
      const x = i * cellWidth + cellWidth / 2;
      const y = rowOf(i) * cellHeight + cellHeight / 2;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
  }
}

const THUMB_HEIGHT = 10;
const NOISE_THUMB_WIDTH = 24;

/** A small line picture of a wave, for lists. Noise gets a fixed scribble. */
export function drawWaveThumbnail(
  canvas: Sizable,
  g: PictureCanvas,
  wave: Wave,
  colors: Pick<CellColors, 'background' | 'on'>,
) {
  const width = wave.kind === 'noise' ? NOISE_THUMB_WIDTH : wave.columns.length;
  const height = THUMB_HEIGHT;
  canvas.width = width;
  canvas.height = height;
  g.fillStyle = colors.background;
  g.fillRect(0, 0, width, height);
  g.fillStyle = colors.on;

  if (wave.kind === 'noise') {
    // Pseudo-random, seeded by the wave, so the scribble doesn't change on every draw.
    let seed = wave.id.length * 7 + (wave.metallic ? 3 : 1);
    for (let i = 0; i < width; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      g.fillRect(i, Math.floor((seed / 0x7fffffff) * (height - 2)), 1, 2);
    }
    return;
  }
  for (let i = 0; i < width; i++) {
    const level = wave.columns[i] as number;
    g.fillRect(i, Math.round((1 - level / (wave.levels - 1)) * (height - 2)), 1, 2);
  }
}

const ENVELOPE_WIDTH = 56;
const ENVELOPE_HEIGHT = 14;

/** A small filled picture of an envelope, with a held note between decay and release. */
export function drawEnvelope(
  canvas: Sizable,
  g: PictureCanvas,
  envelope: Envelope,
  colors: Pick<CellColors, 'background' | 'on' | 'fill' | 'grid'>,
) {
  const width = ENVELOPE_WIDTH;
  const height = ENVELOPE_HEIGHT;
  canvas.width = width;
  canvas.height = height;
  g.fillStyle = colors.background;
  g.fillRect(0, 0, width, height);

  const { attack, decay, sustain, release } = envelope;
  const hold = Math.max(0.12, (attack + decay) * 0.6);
  const total = attack + decay + hold + release;
  for (let x = 0; x < width; x++) {
    const t = ((x + 0.5) / width) * total;
    let level: number;
    if (t < attack) level = attack > 0 ? t / attack : 1;
    else if (t < attack + decay) level = 1 + (sustain - 1) * ((t - attack) / Math.max(decay, 1e-6));
    else if (t < attack + decay + hold) level = sustain;
    else level = sustain * (1 - (t - attack - decay - hold) / Math.max(release, 1e-6));
    const columnHeight = Math.round(Math.min(1, Math.max(0, level)) * (height - 2));
    g.fillStyle = colors.fill;
    g.fillRect(x, height - columnHeight, 1, columnHeight);
    g.fillStyle = colors.on;
    g.fillRect(x, height - columnHeight - 1, 1, 1);
  }

  // Marks where the sustain starts and ends.
  g.fillStyle = colors.grid;
  g.fillRect(Math.round(((attack + decay) / total) * width), 0, 1, height);
  g.fillRect(Math.round(((attack + decay + hold) / total) * width), 0, 1, height);
}
