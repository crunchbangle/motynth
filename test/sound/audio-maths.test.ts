// Buffers and envelopes, compared with the prototype's own code.

import assert from 'node:assert/strict';
import { buildWaveBuffer, WaveBufferCache } from '../../app/src/sound/buffers.ts';
import { envelopeShape } from '../../app/src/sound/envelope.ts';
import { createWave, shapeColumns, type Wave } from '../../app/src/sound/wave.ts';
import { asReal, FakeAudioContext } from '../support/fake-audio.ts';
import { loadPrototypeSound } from '../support/prototype.ts';

const prototype = loadPrototypeSound();

/** The prototype's field names for a wave. */
const asPrototypeWave = (wave: Wave) => ({
  id: wave.id,
  name: wave.name,
  type: wave.kind,
  w: wave.columns.length,
  d: wave.levels,
  data: wave.columns,
  smooth: wave.smooth,
  shotMs: wave.shotMs,
  hz: wave.noiseRateHz,
  metal: wave.metallic,
});

function samples(wave: Wave, sampleRate: number): Float32Array {
  const context = asReal<BaseAudioContext>(new FakeAudioContext(sampleRate));
  return buildWaveBuffer(context, wave).buffer.getChannelData(0);
}

function prototypeSamples(wave: Wave, sampleRate: number): Float32Array {
  return prototype
    .buildBuffer(new FakeAudioContext(sampleRate), asPrototypeWave(wave))
    .buf.getChannelData(0);
}

test('cycle and one-shot buffers match the prototype sample for sample', () => {
  const grids: [number, number][] = [
    [8, 2],
    [16, 4],
    [32, 16],
    [64, 8],
  ];
  for (const sampleRate of [44100, 48000]) {
    for (const [width, levels] of grids) {
      for (const shape of ['sine', 'organ', 'saw', 'pulse'] as const) {
        for (const kind of ['cycle', 'shot'] as const) {
          for (const smooth of [false, true]) {
            const wave: Wave = {
              ...createWave('w', 'w', shape, { kind, shotMs: 37 }),
              columns: shapeColumns(shape, width, levels, 0.25),
              levels,
              smooth,
            };
            assert.deepEqual(
              samples(wave, sampleRate),
              prototypeSamples(wave, sampleRate),
              `${shape} ${kind} ${width}x${levels} smooth=${smooth} @${sampleRate}`,
            );
          }
        }
      }
    }
  }
});

test('metallic noise matches the prototype', () => {
  for (const rate of [500, 7000, 44100]) {
    const wave = createWave('w', 'w', 'sine', { kind: 'noise', metallic: true, noiseRateHz: rate });
    assert.deepEqual(samples(wave, 48000), prototypeSamples(wave, 48000), `rate ${rate}`);
  }
});

test('white noise lasts a second and holds each random value for one grain', () => {
  const wave = createWave('w', 'w', 'sine', { kind: 'noise', noiseRateHz: 8000 });
  const values = [0.1, 0.9, 0.5];
  let k = 0;
  const context = asReal<BaseAudioContext>(new FakeAudioContext(48000));
  const data = buildWaveBuffer(
    context,
    wave,
    () => values[k++ % 3] as number,
  ).buffer.getChannelData(0);
  assert.equal(data.length, 48000);
  // 48000 / 8000 = 6 samples per grain.
  assert.deepEqual(
    [...data.slice(0, 13)].map((v) => Math.round(v * 10) / 10),
    [-0.8, -0.8, -0.8, -0.8, -0.8, -0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0],
  );
});

test('a cycle is centred on zero and reaches full scale', () => {
  // A wave drawn entirely in the top half still plays centred.
  const wave: Wave = { ...createWave('w', 'w', 'pulse'), columns: [15, 15, 12, 12], levels: 16 };
  const data = samples(wave, 48000);
  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  assert.ok(Math.abs(mean) < 1e-6);
  assert.ok(Math.abs(Math.max(...data.map(Math.abs)) - 1) < 1e-6);
});

test('the buffer cache builds a wave once, and again after it changes', () => {
  const context = asReal<BaseAudioContext>(new FakeAudioContext());
  const cache = new WaveBufferCache(2);
  const wave = createWave('w', 'w', 'sine');
  const first = cache.get(context, wave);
  assert.equal(cache.get(context, { ...wave, name: 'renamed' }), first, 'name does not matter');
  assert.notEqual(cache.get(context, { ...wave, smooth: true }), first);
  cache.get(context, { ...wave, levels: 8 });
  assert.notEqual(cache.get(context, wave), first, 'the oldest entry was dropped');
});

test('envelopes match the prototype', () => {
  const envelopes = [
    { attack: 0.004, decay: 0.08, sustain: 0.7, release: 0.08 },
    { attack: 0, decay: 0, sustain: 1, release: 0 },
    { attack: 0.5, decay: 1, sustain: 0.2, release: 2 },
  ];
  for (const envelope of envelopes) {
    for (const seconds of [0.001, 0.003, 0.05, 0.3, 1.2, 4]) {
      for (const peak of [1, 0.4]) {
        const ours = envelopeShape(envelope, seconds, peak);
        const theirs = prototype.adsrPts(
          { a: envelope.attack, d: envelope.decay, s: envelope.sustain, r: envelope.release },
          seconds,
          peak,
        );
        assert.deepEqual(
          ours.points.map((p) => [...p]),
          Array.from(theirs.pts, (p) => [...p]),
        );
        assert.equal(ours.end, theirs.end);
      }
    }
  }
});
