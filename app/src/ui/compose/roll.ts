// The piano roll: where each note goes, and drawing it.
//
// Pitched notes are laid out by pitch, low at the bottom. Unpitched sounds
// (drums, and hits on instruments that don't follow pitch) get one band each
// along the bottom.

import type { CompiledPiece, NoteEvent } from '../../engine/index.ts';

/** Space around the notes, in CSS pixels. */
const PAD = 6;
/** Pitched rows are between 2 and 14 pixels tall. */
const MIN_ROW = 2;
const MAX_ROW = 14;

export interface RollRect {
  x: number;
  y: number;
  width: number;
  height: number;
  instrument: string | null;
}

export interface RollLayout {
  width: number;
  height: number;
  /** x of a faint line at the start of every whole note (bar). */
  barLines: number[];
  /** y of the line above the drum bands, if there are any. */
  bandSeparator: number | null;
  pitched: RollRect[];
  unpitched: RollRect[];
}

/** Where the playhead goes at `seconds` into the piece. */
export function playheadX(seconds: number, durationSeconds: number, width: number): number {
  return Math.round(PAD + (seconds / Math.max(durationSeconds, 0.1)) * (width - PAD * 2));
}

export function layoutRoll(
  piece: Pick<CompiledPiece, 'events' | 'durationSeconds' | 'bpm'>,
  isUnpitched: (event: NoteEvent) => boolean,
  width: number,
  height: number,
): RollLayout {
  const total = Math.max(piece.durationSeconds, 0.1);
  const span = width - PAD * 2;
  const xOf = (seconds: number) => PAD + (seconds / total) * span;

  const pitched = piece.events.filter((e) => !isUnpitched(e));
  const unpitched = piece.events.filter(isUnpitched);
  const bands = [...new Set(unpitched.map((e) => e.instrument))];

  // Drum bands share up to 38% of the height, 5 to 10 pixels each.
  const bandRow = Math.min(
    10,
    Math.max(5, Math.floor((height * 0.38) / Math.max(1, bands.length))),
  );
  const bandHeight = bands.length ? bands.length * bandRow + 6 : 0;
  const pitchedHeight = height - bandHeight - PAD * 2;

  const barLines: number[] = [];
  const secondsPerWholeNote = 240 / piece.bpm;
  for (let t = 0; t < total; t += secondsPerWholeNote) barLines.push(Math.round(xOf(t)));

  const layout: RollLayout = {
    width,
    height,
    barLines,
    bandSeparator: bandHeight ? height - bandHeight - PAD + 2 : null,
    pitched: [],
    unpitched: [],
  };

  if (pitched.length) {
    const steps = pitched.map((e) => e.step);
    const lowest = Math.min(...steps);
    const highest = Math.max(...steps);
    // One spare row above and below.
    const rows = highest - lowest + 3;
    const rowHeight = Math.min(MAX_ROW, Math.max(MIN_ROW, pitchedHeight / rows));
    const top = PAD + (pitchedHeight - rowHeight * rows) / 2;
    layout.pitched = pitched.map((e) => ({
      x: Math.round(xOf(e.start)),
      y: Math.round(top + (highest - e.step + 1) * rowHeight),
      width: Math.round(Math.max(2, (e.duration / total) * span - 1)),
      height: Math.max(2, Math.floor(rowHeight) - 1),
      instrument: e.instrument,
    }));
  }

  const bandsTop = height - bandHeight - PAD + 5;
  layout.unpitched = unpitched.map((e) => ({
    x: Math.round(xOf(e.start)),
    y: bandsTop + bands.indexOf(e.instrument) * bandRow,
    width: Math.max(2, Math.min(6, Math.round((e.duration / total) * span))),
    height: Math.max(2, bandRow - 2),
    instrument: e.instrument,
  }));

  return layout;
}

export interface RollColors {
  background: string;
  grid: string;
  instrument(name: string | null): string;
}

/** The 2D drawing calls the roll needs; a real canvas context, or a fake in tests. */
export type RollCanvas = Pick<CanvasRenderingContext2D, 'fillRect'> & { fillStyle: unknown };

export function drawRoll(g: RollCanvas, layout: RollLayout, colors: RollColors): void {
  g.fillStyle = colors.background;
  g.fillRect(0, 0, layout.width, layout.height);
  g.fillStyle = colors.grid;
  for (const x of layout.barLines) g.fillRect(x, 0, 1, layout.height);
  if (layout.bandSeparator !== null) g.fillRect(0, layout.bandSeparator, layout.width, 1);
  for (const rect of [...layout.pitched, ...layout.unpitched]) {
    g.fillStyle = colors.instrument(rect.instrument);
    g.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
}
