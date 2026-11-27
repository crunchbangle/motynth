import assert from 'node:assert/strict';
import { starterLibrary } from '../../app/src/sound/library.ts';
import { shapeColumns, type Wave } from '../../app/src/sound/wave.ts';
import { drawEnvelope, drawWaveGrid, drawWaveThumbnail } from '../../app/src/ui/sounds/drawing.ts';
import { loadPrototypePictures, recordingCanvas } from '../support/prototype.ts';

const prototype = loadPrototypePictures();

const COLORS = {
  background: '--cell-bg',
  on: '--cell-on',
  fill: '--cell-fill',
  grid: '--cell-grid',
  zero: '--cell-zero',
};

const asPrototypeWave = (wave: Wave) => ({
  id: wave.id,
  type: wave.kind,
  d: wave.levels,
  data: wave.columns,
  smooth: wave.smooth,
  metal: wave.metallic,
});

/** Draws with one function and the prototype's, and compares sizes and calls. */
function compare(
  ours: (canvas: { width: number; height: number }, g: never) => void,
  theirs: (canvas: unknown) => void,
  label: string,
) {
  const a = recordingCanvas();
  const b = recordingCanvas();
  ours(a.canvas, a.g as never);
  theirs(b.canvas);
  assert.deepEqual([a.canvas.width, a.canvas.height], [b.canvas.width, b.canvas.height], label);
  assert.deepEqual(a.calls, b.calls, label);
}

const waves: Wave[] = [...starterLibrary().waves];
for (const width of [8, 16, 64]) {
  for (const levels of [2, 4, 8, 16]) {
    for (const smooth of [false, true]) {
      waves.push({
        ...starterLibrary().waves[0]!,
        id: `w-${width}-${levels}`,
        columns: shapeColumns('organ', width, levels),
        levels,
        smooth,
      });
    }
  }
}

test('wave grids are drawn as the prototype drew them', () => {
  for (const wave of waves.filter((w) => w.kind !== 'noise')) {
    compare(
      (canvas, g) => drawWaveGrid(canvas, g, wave, COLORS),
      (canvas) => prototype.drawWave(canvas, asPrototypeWave(wave)),
      wave.id,
    );
  }
});

test('wave thumbnails, including noise, are drawn as the prototype drew them', () => {
  for (const wave of waves) {
    compare(
      (canvas, g) => drawWaveThumbnail(canvas, g, wave, COLORS),
      (canvas) => prototype.drawThumb(canvas, asPrototypeWave(wave)),
      wave.id,
    );
  }
});

test('envelopes are drawn as the prototype drew them', () => {
  const envelopes = [
    ...starterLibrary().instruments.flatMap((i) => [i.volumeEnvelope, i.morphEnvelope]),
    { attack: 0, decay: 0, sustain: 0, release: 0 },
    { attack: 1.5, decay: 2, sustain: 1, release: 2 },
  ];
  for (const e of envelopes) {
    compare(
      (canvas, g) => drawEnvelope(canvas, g, e, COLORS),
      (canvas) =>
        prototype.drawEnv(canvas, { a: e.attack, d: e.decay, s: e.sustain, r: e.release }),
      JSON.stringify(e),
    );
  }
});
