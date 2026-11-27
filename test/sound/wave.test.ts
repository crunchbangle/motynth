import assert from 'node:assert/strict';
import {
  WAVE_LEVELS,
  WAVE_WIDTHS,
  clearColumns,
  flipColumns,
  mirrorColumns,
  paintLine,
  resampleColumns,
  shapeColumns,
  shiftColumnsLeft,
  shiftColumnsRight,
  type Shape,
} from '../../app/src/sound/wave.ts';
import { loadPrototypeSound } from '../support/prototype.ts';

const prototype = loadPrototypeSound();
const SHAPES: Shape[] = ['sine', 'tri', 'saw', 'pulse', 'organ'];

test('shapes match the prototype on every grid size', () => {
  for (const shape of SHAPES) {
    for (const width of WAVE_WIDTHS) {
      for (const levels of WAVE_LEVELS) {
        for (const duty of [0.25, 0.5]) {
          assert.deepEqual(
            shapeColumns(shape, width, levels, duty),
            [...prototype.shape(shape, width, levels, duty)],
            `${shape} ${width}x${levels} duty ${duty}`,
          );
        }
      }
    }
  }
});

test('a random shape uses the random source, scaled to the levels', () => {
  const values = [0, 0.5, 0.999];
  let k = 0;
  assert.deepEqual(
    shapeColumns('random', 3, 16, 0.5, () => values[k++] as number),
    [0, 8, 15],
  );
});

test('resampling matches the prototype', () => {
  const columns = shapeColumns('organ', 32, 16);
  for (const width of WAVE_WIDTHS) {
    for (const levels of WAVE_LEVELS) {
      assert.deepEqual(resampleColumns(columns, 16, width, levels), [
        ...prototype.resampleData(columns, 32, 16, width, levels),
      ]);
    }
  }
});

test('flip, mirror, shift and clear', () => {
  const columns = [0, 1, 2, 7];
  assert.deepEqual(flipColumns(columns, 8), [7, 6, 5, 0]);
  assert.deepEqual(mirrorColumns(columns), [7, 2, 1, 0]);
  assert.deepEqual(shiftColumnsRight(columns), [7, 0, 1, 2]);
  assert.deepEqual(shiftColumnsLeft(columns), [1, 2, 7, 0]);
  assert.deepEqual(clearColumns(columns, 8), [4, 4, 4, 4]);
  assert.deepEqual(columns, [0, 1, 2, 7], 'the input is unchanged');
});

test('painting sets one column, or a straight line across skipped columns', () => {
  const flat = [0, 0, 0, 0, 0, 0];
  assert.deepEqual(
    paintLine(flat, { column: 1, level: 0 }, { column: 2, level: 9 }),
    [0, 0, 9, 0, 0, 0],
  );
  assert.deepEqual(
    paintLine(flat, { column: 0, level: 0 }, { column: 4, level: 8 }),
    [0, 2, 4, 6, 8, 0],
  );
  assert.deepEqual(
    paintLine(flat, { column: 5, level: 10 }, { column: 1, level: 2 }),
    [0, 2, 4, 6, 8, 10],
  );
});
