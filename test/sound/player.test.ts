import assert from 'node:assert/strict';
import type { NoteEvent } from '../../app/src/engine/index.ts';
import type { AudioOutput } from '../../app/src/sound/audio-engine.ts';
import { WaveBufferCache } from '../../app/src/sound/buffers.ts';
import { createInstrument } from '../../app/src/sound/instrument.ts';
import { Player, type Playback, type Timers } from '../../app/src/sound/player.ts';
import { asReal, FakeAudioContext, FakeGain, FakeSource } from '../support/fake-audio.ts';

/** Timers driven by hand: `advance` moves the audio clock and fires due callbacks. */
function setup() {
  const context = new FakeAudioContext();
  const output = new FakeGain();
  const audio: AudioOutput = {
    buffers: new WaveBufferCache(),
    open: () => ({ context: asReal(context), destination: asReal(output) }),
  };
  let intervals: (() => void)[] = [];
  let timeouts: { at: number; run: () => void }[] = [];
  const timers: Timers = {
    setInterval: (run) => (intervals.push(run), run),
    clearInterval: (handle) => (intervals = intervals.filter((run) => run !== handle)),
    setTimeout: (run, ms) => timeouts.push({ at: context.currentTime + ms / 1000, run }),
  };
  const played: { frequency: number; at: number; duration: number }[] = [];
  const player = new Player(audio, {
    timers,
    voice: (_output, _instrument, _waveFor, frequency, at, duration) =>
      void played.push({ frequency, at, duration }),
  });
  const advance = (seconds: number) => {
    const end = context.currentTime + seconds;
    while (context.currentTime < end - 1e-9) {
      context.currentTime = Math.min(end, context.currentTime + 0.05);
      for (const run of [...intervals]) run();
      const due = timeouts.filter((t) => t.at <= context.currentTime);
      timeouts = timeouts.filter((t) => t.at > context.currentTime);
      for (const t of due) t.run();
    }
  };
  return { context, player, played, advance };
}

const note = (start: number, frequency = 440): NoteEvent => ({
  start,
  duration: 0.25,
  step: 0,
  frequency,
  instrument: 'lead',
  isHit: false,
});

function playback(events: NoteEvent[], options: Partial<Playback> = {}): Playback {
  const lead = createInstrument('lead');
  return {
    id: 'test',
    events,
    durationSeconds: 2,
    loop: false,
    instrumentFor: (name) => (name === 'lead' ? lead : undefined),
    waveFor: () => undefined,
    ...options,
  };
}

test('notes are scheduled a little ahead, starting 0.12 s after play', () => {
  const { player, played, advance } = setup();
  player.start(playback([note(0), note(0.5), note(1.5)]));
  // Look-ahead is 0.8 s, so at first only the first two are scheduled.
  assert.deepEqual(
    played.map((p) => p.at),
    [0.12, 0.62],
  );
  advance(1);
  assert.deepEqual(
    played.map((p) => p.at),
    [0.12, 0.62, 1.62],
  );
});

test('notes for unknown instruments are skipped', () => {
  const { player, played } = setup();
  player.start(playback([note(0), { ...note(0.1), instrument: 'nobody' }]));
  assert.equal(played.length, 1);
});

test('playback stops by itself after the end and notifies listeners', () => {
  const { player, advance } = setup();
  const seen: (string | null)[] = [];
  player.subscribe(() => seen.push(player.playingId));
  player.start(playback([note(0)]));
  assert.equal(player.playingId, 'test');
  advance(3.5);
  assert.equal(player.playingId, 'test', 'still waiting for the release to finish');
  advance(0.6);
  assert.equal(player.playingId, null);
  assert.deepEqual(seen, ['test', null]);
});

test('looping starts again at the end', () => {
  const { player, played, advance } = setup();
  player.start(playback([note(0, 1), note(1, 2)], { loop: true }));
  advance(4.5);
  assert.deepEqual(
    played.map((p) => [p.frequency, Math.round(p.at * 100) / 100]),
    [
      [1, 0.12],
      [2, 1.12],
      [1, 2.12],
      [2, 3.12],
      [1, 4.12],
      [2, 5.12],
    ],
  );
  assert.equal(player.playingId, 'test');
});

test('position runs from 0 to the length of the piece', () => {
  const { player, advance } = setup();
  assert.equal(player.position(), null);
  player.start(playback([note(0)]));
  assert.equal(player.position(), 0);
  advance(1.12);
  assert.ok(Math.abs((player.position() ?? 0) - 1) < 1e-9);
  advance(1.5);
  assert.equal(player.position(), 2);
});

test('stopping fades out, then stops the sources', () => {
  const { context, player, advance } = setup();
  player.start(playback([]));
  const bus = context.gains[0];
  const source = new FakeSource();
  // A source the voice would have registered.
  (
    player as unknown as { session: { output: { sources: Set<unknown> } } }
  ).session.output.sources.add(source);
  player.stop();
  assert.equal(player.playingId, null);
  assert.deepEqual(
    bus?.gain.calls.map((c) => c[0]),
    ['cancel', 'setTargetAtTime'],
  );
  assert.equal(source.stopCalls, 0);
  advance(0.2);
  assert.equal(source.stopCalls, 1);
  assert.ok(bus?.disconnected);
});

test('starting something else replaces what is playing, with one notification', () => {
  const { player } = setup();
  let notifications = 0;
  player.start(playback([note(0)]));
  player.subscribe(() => notifications++);
  player.start(playback([note(0)], { id: 'other' }));
  assert.equal(player.playingId, 'other');
  assert.equal(notifications, 1);
});
