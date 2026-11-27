import assert from 'node:assert/strict';
import { WaveBufferCache } from '../../app/src/sound/buffers.ts';
import { createInstrument, type Instrument } from '../../app/src/sound/instrument.ts';
import { findWave, starterLibrary } from '../../app/src/sound/library.ts';
import { pitchPairBlend, playbackRate, playVoice } from '../../app/src/sound/voice.ts';
import { asReal, FakeAudioContext, FakeGain } from '../support/fake-audio.ts';

const library = starterLibrary();
const waveFor = (id: string) => findWave(library, id);

function play(instrument: Instrument, frequency = 440, start = 1, duration = 0.5) {
  const context = new FakeAudioContext(48000);
  const destination = new FakeGain();
  const sources = new Set<AudioBufferSourceNode>();
  playVoice(
    {
      context: asReal(context),
      destination: asReal(destination),
      sources,
      buffers: new WaveBufferCache(),
    },
    instrument,
    waveFor,
    frequency,
    start,
    duration,
  );
  return { context, destination, sources };
}

test('playback rates', () => {
  // A 512-sample cycle at 48 kHz plays at 440 Hz when sped up 440 * 512 / 48000 times.
  assert.equal(playbackRate('cycle', 512, 48000, true, 440, 100), (440 * 512) / 48000);
  assert.equal(playbackRate('cycle', 512, 48000, false, 440, 100), (100 * 512) / 48000);
  assert.equal(playbackRate('shot', 999, 48000, true, 440, 220), 2);
  assert.equal(playbackRate('shot', 999, 48000, false, 440, 220), 1);
  assert.equal(playbackRate('noise', 999, 48000, true, 523.26, 1), 2);
  assert.equal(playbackRate('cycle', 512, 48000, true, 1e9, 1), 256, 'clamped');
});

test('a pitch pair blends from A to B between its reference pitches', () => {
  const keys = createInstrument('keys', { kind: 'pitchPair', referenceA: 100, referenceB: 400 });
  assert.equal(pitchPairBlend(keys, 50), 0);
  assert.equal(pitchPairBlend(keys, 100), 0);
  assert.equal(pitchPairBlend(keys, 200), 0.5);
  assert.equal(pitchPairBlend(keys, 400), 1);
  assert.equal(pitchPairBlend(keys, 800), 1);
  assert.equal(pitchPairBlend({ ...keys, followsPitch: false }, 400), 0);
  assert.equal(pitchPairBlend({ ...keys, referenceB: 100 }, 400), 0);
});

test('a single instrument plays one looping source through a volume envelope', () => {
  const { context, destination, sources } = play(
    createInstrument('lead', { waveA: 'w-saw', volume: 1 }),
  );
  assert.equal(context.sources.length, 1);
  assert.equal(sources.size, 1);
  const [source] = context.sources;
  assert.ok(source);
  assert.equal(source.loop, true);
  assert.equal(source.startedAt, 1);
  // Volume envelope: 0.5 s note plus 0.08 s release, stopping 0.03 s later.
  assert.ok(Math.abs((source.stoppedAt ?? 0) - 1.61) < 1e-9);
  const amp = context.gains[0];
  assert.ok(amp && destination.connections.length === 0 && amp.connections[0] === destination);
  assert.deepEqual(amp.gain.calls[0], ['setValueAtTime', 0, 1]);
  const peak = Math.max(...amp.gain.calls.map((c) => c[1] ?? 0));
  assert.ok(Math.abs(peak - 0.28) < 1e-9, 'volume 1 peaks at the voice level');
});

test('a finished source removes itself', () => {
  const { context, sources } = play(createInstrument('lead', { waveA: 'w-saw' }));
  context.sources[0]?.onended?.();
  assert.equal(sources.size, 0);
  assert.ok(context.sources[0]?.disconnected);
});

test('a pitch envelope starts off-pitch and glides', () => {
  const kick = library.instruments.find((i) => i.name === 'kick');
  assert.ok(kick);
  const { context } = play(kick, 60);
  assert.deepEqual(context.sources[0]?.detune.calls, [
    ['setValueAtTime', 3600, 1],
    ['setTargetAtTime', 0, 1, 0.025],
  ]);
});

test('a pitch pair skips a wave that would be silent', () => {
  const pair = createInstrument('p', {
    kind: 'pitchPair',
    waveA: 'w-tri',
    waveB: 'w-saw',
    referenceA: 100,
    referenceB: 400,
  });
  assert.equal(play(pair, 100).context.sources.length, 1);
  assert.equal(play(pair, 200).context.sources.length, 2);
  assert.equal(play(pair, 400).context.sources.length, 1);
});

test('a morph crossfades from A to B', () => {
  const pluck = library.instruments.find((i) => i.name === 'pluck');
  assert.ok(pluck);
  const { context } = play(pluck);
  assert.equal(context.sources.length, 2);
  // gains: amp, A, B
  const [, gainA, gainB] = context.gains;
  assert.ok(gainA && gainB);
  const sums = gainA.gain.calls.map((call, k) => (call[1] ?? 0) + (gainB.gain.calls[k]?.[1] ?? 0));
  assert.ok(
    sums.every((sum) => Math.abs(sum - 1) < 1e-9),
    'A and B always add up to 1',
  );
});

test('nothing plays when the wave is missing or too much is already playing', () => {
  assert.equal(play(createInstrument('x', { waveA: 'w-gone' })).context.sources.length, 0);

  const context = new FakeAudioContext();
  const sources = new Set(Array.from({ length: 181 }, () => asReal<AudioBufferSourceNode>({})));
  playVoice(
    {
      context: asReal(context),
      destination: asReal(new FakeGain()),
      sources,
      buffers: new WaveBufferCache(),
    },
    createInstrument('lead', { waveA: 'w-saw' }),
    waveFor,
    440,
    0,
    1,
  );
  assert.equal(context.sources.length, 0);
});
