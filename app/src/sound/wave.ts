// Waves: the pixel-grid waveforms that every sound is built from.

export type WaveKind =
  /** One cycle, looped at the pitch of each note. */
  | 'cycle'
  /** Played once through, sped up or slowed down to follow pitch. */
  | 'shot'
  /** Random steps (or a short repeating pattern), ignoring the grid. */
  | 'noise';

export interface Wave {
  id: string;
  name: string;
  kind: WaveKind;
  /** Height of each column, from 0 to `levels - 1`. Its length is the grid width. */
  columns: number[];
  /** Number of heights a column can take. */
  levels: number;
  /** Interpolate between columns instead of holding each one (softer, less crunchy). */
  smooth: boolean;
  /** Length of a one-shot, in milliseconds. */
  shotMs: number;
  /** How often noise picks a new random value, in Hz. */
  noiseRateHz: number;
  /** Noise repeats a short 127-step pattern, which rings like a hi-hat. */
  metallic: boolean;
}

export const WAVE_WIDTHS = [8, 16, 32, 64] as const;
export const WAVE_LEVELS = [2, 4, 8, 16] as const;

/** Shapes a wave's grid can be filled with. */
export type Shape = 'sine' | 'tri' | 'saw' | 'pulse' | 'organ' | 'random';

export const SHAPES: readonly { shape: Shape; label: string }[] = [
  { shape: 'sine', label: 'Sine' },
  { shape: 'tri', label: 'Triangle' },
  { shape: 'saw', label: 'Saw' },
  { shape: 'pulse', label: 'Pulse' },
  { shape: 'organ', label: 'Organ' },
  { shape: 'random', label: 'Random' },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Column heights for a shape, on a grid `width` columns wide with `levels`
 * heights. `duty` is the fraction of a pulse that is high.
 */
export function shapeColumns(
  shape: Shape,
  width: number,
  levels: number,
  duty = 0.5,
  random: () => number = Math.random,
): number[] {
  const top = levels - 1;
  return Array.from({ length: width }, (_, i) => {
    const x = i / width;
    let value: number;
    switch (shape) {
      case 'sine':
        value = (Math.sin(x * 2 * Math.PI) + 1) / 2;
        break;
      case 'tri':
        value = x < 0.5 ? x * 2 : 2 - x * 2;
        break;
      case 'saw':
        value = i / (width - 1);
        break;
      case 'pulse':
        value = x < duty ? 1 : 0;
        break;
      case 'organ': {
        // A fundamental with two quieter harmonics.
        const sum =
          Math.sin(x * 2 * Math.PI) +
          0.5 * Math.sin(x * 4 * Math.PI + 0.6) +
          0.3 * Math.sin(x * 6 * Math.PI + 1.2);
        value = (sum / 1.8 + 1) / 2;
        break;
      }
      case 'random':
        value = random();
        break;
    }
    return clamp(Math.round(value * top), 0, top);
  });
}

export interface NewWaveOptions {
  kind?: WaveKind;
  width?: number;
  levels?: number;
  duty?: number;
  shotMs?: number;
  noiseRateHz?: number;
  metallic?: boolean;
}

export function createWave(
  id: string,
  name: string,
  shape: Shape,
  options: NewWaveOptions = {},
): Wave {
  const width = options.width ?? 32;
  const levels = options.levels ?? 16;
  return {
    id,
    name,
    kind: options.kind ?? 'cycle',
    columns: shapeColumns(shape, width, levels, options.duty),
    levels,
    smooth: false,
    shotMs: options.shotMs ?? 90,
    noiseRateHz: options.noiseRateHz ?? 11025,
    metallic: options.metallic ?? false,
  };
}

/** The level that is silence (the middle of the grid). */
export function silentLevel(levels: number): number {
  return Math.floor(levels / 2);
}

// ---------------------------------------------------------------------------
// Edits. Each returns new columns and leaves the input alone.

/** Upside down. */
export const flipColumns = (columns: readonly number[], levels: number): number[] =>
  columns.map((v) => levels - 1 - v);

/** Back to front. */
export const mirrorColumns = (columns: readonly number[]): number[] => [...columns].reverse();

/** Moves every column one place right; the last wraps to the start. */
export const shiftColumnsRight = (columns: readonly number[]): number[] =>
  columns.length ? [columns[columns.length - 1] as number, ...columns.slice(0, -1)] : [];

/** Moves every column one place left; the first wraps to the end. */
export const shiftColumnsLeft = (columns: readonly number[]): number[] =>
  columns.length ? [...columns.slice(1), columns[0] as number] : [];

/** Every column at silence. */
export const clearColumns = (columns: readonly number[], levels: number): number[] =>
  columns.map(() => silentLevel(levels));

/** The same shape on a grid of a different size. */
export function resampleColumns(
  columns: readonly number[],
  levels: number,
  newWidth: number,
  newLevels: number,
): number[] {
  const width = columns.length;
  return Array.from({ length: newWidth }, (_, i) => {
    const value = columns[Math.min(width - 1, Math.floor((i / newWidth) * width))] as number;
    return clamp(Math.round((value / (levels - 1)) * (newLevels - 1)), 0, newLevels - 1);
  });
}

/**
 * Sets the columns from `from` to `to` (inclusive) along a straight line, as
 * when a drag moves across several columns at once.
 */
export function paintLine(
  columns: readonly number[],
  from: { column: number; level: number },
  to: { column: number; level: number },
): number[] {
  const next = [...columns];
  if (Math.abs(to.column - from.column) <= 1) {
    next[to.column] = to.level;
    return next;
  }
  const first = Math.min(from.column, to.column);
  const last = Math.max(from.column, to.column);
  for (let column = first; column <= last; column++) {
    const t = (column - from.column) / (to.column - from.column);
    next[column] = Math.round(from.level + (to.level - from.level) * t);
  }
  return next;
}
