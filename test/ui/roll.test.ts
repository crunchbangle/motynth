import assert from 'node:assert/strict';
import { EXAMPLES } from '../../app/src/content/examples.ts';
import { LESSONS } from '../../app/src/content/lessons.ts';
import { compile, type CompiledPiece } from '../../app/src/engine/index.ts';
import { starterLibrary } from '../../app/src/sound/library.ts';
import { drawRoll, layoutRoll, playheadX } from '../../app/src/ui/compose/roll.ts';
import { isUnpitched } from '../../app/src/ui/compose/PianoRoll.tsx';
import { STARTER } from '../helpers.ts';
import { prototypeRollDrawing, type FillCall } from '../support/prototype.ts';
import { randomPrograms } from '../support/random-programs.ts';

const library = starterLibrary();
const instruments = library.instruments.map((i) => ({ name: i.name, follow: i.followsPitch }));

function ourDrawing(piece: CompiledPiece, width: number, height: number): FillCall[] {
  const calls: FillCall[] = [];
  const g = {
    fillStyle: '' as unknown,
    fillRect(x: number, y: number, w: number, h: number) {
      calls.push([this.fillStyle, x, y, w, h]);
    },
  };
  const layout = layoutRoll(piece, (e) => isUnpitched(library, e), width, height);
  drawRoll(g, layout, {
    background: '--cell-bg',
    grid: '--cell-grid',
    instrument: (name) => `inst:${name}`,
  });
  return calls;
}

function theirDrawing(piece: CompiledPiece, width: number, height: number): FillCall[] {
  const events = piece.events.map((e) => ({
    t: e.start,
    d: e.duration,
    n: e.step,
    inst: e.instrument,
    hit: e.isHit,
  }));
  const calls = prototypeRollDrawing(
    { events, total: piece.durationSeconds, bpm: piece.bpm, used: piece.instrumentsUsed },
    instruments,
    width,
    height,
  );
  return Array.from(calls, (call) => [...call] as FillCall);
}

test('the piano roll is drawn exactly as the prototype drew it', () => {
  const sources = [
    ...LESSONS.flatMap((l) => l.blocks.flatMap((b) => (b.type === 'code' ? [b.code] : []))),
    ...EXAMPLES.map((e) => e.code),
    ...randomPrograms(99, 200),
    // A hit on a pitched instrument, and notes with no instrument.
    'pluck: [x 1 3], tom: [x x], [1 2]',
  ];
  let drawn = 0;
  for (const source of sources) {
    const result = compile(source, { instruments: STARTER, defaultInstrument: 'pulse' });
    if (!result.ok || result.events.length === 0) continue;
    for (const [width, height] of [
      [600, 300],
      [333, 296],
      [1200, 120],
    ] as const) {
      assert.deepEqual(
        ourDrawing(result, width, height),
        theirDrawing(result, width, height),
        source,
      );
    }
    drawn++;
  }
  assert.ok(drawn > 100);
});

test('drums go in bands below the pitched notes', () => {
  const result = compile('pluck: [1 8], kick: [x], hat: [x x]', { instruments: STARTER });
  assert.ok(result.ok);
  const layout = layoutRoll(result, (e) => isUnpitched(library, e), 400, 200);
  assert.equal(layout.pitched.length, 2);
  assert.equal(layout.unpitched.length, 3);
  const lowestNote = Math.max(...layout.pitched.map((r) => r.y + r.height));
  assert.ok(layout.bandSeparator !== null && layout.bandSeparator >= lowestNote);
  const kickRow = layout.unpitched.find((r) => r.instrument === 'kick')?.y;
  const hatRow = layout.unpitched.find((r) => r.instrument === 'hat')?.y;
  assert.ok(kickRow !== undefined && hatRow !== undefined && hatRow > kickRow, 'one band each');
});

test('the playhead moves across the padded width', () => {
  assert.equal(playheadX(0, 10, 612), 6);
  assert.equal(playheadX(5, 10, 612), 306);
  assert.equal(playheadX(10, 10, 612), 606);
});
