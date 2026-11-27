// Plays compiled music in real time.
//
// Web Audio can schedule sounds precisely, but scheduling a whole piece up
// front would create thousands of nodes and make stopping slow. Instead a
// timer runs every 50 ms and schedules the notes due in the next 0.8 s.

import type { NoteEvent } from '../engine/index.ts';
import type { AudioOutput } from './audio-engine.ts';
import type { Instrument } from './instrument.ts';
import { playVoice, type VoiceOutput } from './voice.ts';
import type { Wave } from './wave.ts';

export interface Playback {
  /** Says what is playing, e.g. 'compose' or a lesson snippet, so the UI can show it. */
  id: string;
  events: readonly NoteEvent[];
  durationSeconds: number;
  /** Start again from the beginning at the end. */
  loop: boolean;
  /** Looked up as each note is scheduled, so edits to sounds apply while playing. */
  instrumentFor(name: string | null): Instrument | undefined;
  waveFor(id: string): Wave | undefined;
}

/** Timer functions, replaceable in tests. */
export interface Timers {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
  setTimeout(callback: () => void, ms: number): unknown;
}

const browserTimers: Timers = {
  setInterval: (callback, ms) => globalThis.setInterval(callback, ms),
  clearInterval: (handle) => globalThis.clearInterval(handle as number),
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
};

const TICK_MS = 50;
/** How far ahead notes are scheduled, in seconds. */
const LOOKAHEAD = 0.8;
/** Gap before the first note, so it isn't cut off. */
const START_DELAY = 0.12;
/** A late note is moved to just after now rather than into the past. */
const LATE_NOTE_MARGIN = 0.003;
/** After the last note, wait this long for releases to finish before stopping. */
const TAIL = 1.8;
/** Stopping fades out over about this long (a time constant, in seconds). */
const FADE = 0.012;
const FADE_MS = 120;

interface Session {
  playback: Playback;
  output: VoiceOutput;
  bus: GainNode;
  /** Index of the next event to schedule. */
  next: number;
  /** Audio-clock time of the piece's start (moves on each loop). */
  startTime: number;
  timer: unknown;
}

export class Player {
  private readonly audio: AudioOutput;
  private readonly timers: Timers;
  private readonly voice: typeof playVoice;
  private session: Session | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(audio: AudioOutput, options: { timers?: Timers; voice?: typeof playVoice } = {}) {
    this.audio = audio;
    this.timers = options.timers ?? browserTimers;
    this.voice = options.voice ?? playVoice;
  }

  /** The id of what is playing, or null. */
  get playingId(): string | null {
    return this.session?.playback.id ?? null;
  }

  /** Calls `listener` whenever playback starts or stops. Returns an unsubscribe function. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Stops anything playing, then plays `playback`. */
  start(playback: Playback): void {
    this.stop({ quietly: true });
    const { context, destination } = this.audio.open();
    const bus = context.createGain();
    bus.connect(destination);
    const session: Session = {
      playback,
      output: { context, destination: bus, sources: new Set(), buffers: this.audio.buffers },
      bus,
      next: 0,
      startTime: context.currentTime + START_DELAY,
      timer: null,
    };
    this.session = session;
    session.timer = this.timers.setInterval(() => this.tick(), TICK_MS);
    this.tick();
    this.notify();
  }

  /** Seconds into the piece, or null when nothing is playing. */
  position(): number | null {
    const session = this.session;
    if (!session) return null;
    const elapsed = session.output.context.currentTime - session.startTime;
    return Math.min(session.playback.durationSeconds, Math.max(0, elapsed));
  }

  /** Fades out and stops. `quietly` skips notifying listeners (used when starting something else). */
  stop({ quietly = false } = {}): void {
    const session = this.session;
    if (!session) return;
    this.timers.clearInterval(session.timer);
    this.session = null;

    const { context, sources } = session.output;
    session.bus.gain.cancelScheduledValues(context.currentTime);
    session.bus.gain.setTargetAtTime(0, context.currentTime, FADE);
    this.timers.setTimeout(() => {
      for (const source of sources) stopQuietly(source);
      session.bus.disconnect();
    }, FADE_MS);

    if (!quietly) this.notify();
  }

  private tick(): void {
    const session = this.session;
    if (!session) return;
    const { playback, output } = session;
    const now = output.context.currentTime;
    const horizon = now + LOOKAHEAD;

    while (session.next < playback.events.length) {
      const event = playback.events[session.next] as NoteEvent;
      const at = session.startTime + event.start;
      if (at > horizon) break;
      const instrument = playback.instrumentFor(event.instrument);
      if (instrument) {
        this.voice(
          output,
          instrument,
          (id) => playback.waveFor(id),
          event.frequency,
          Math.max(at, now + LATE_NOTE_MARGIN),
          event.duration,
        );
      }
      session.next++;
    }

    if (session.next < playback.events.length) return;
    const end = session.startTime + playback.durationSeconds;
    if (playback.loop && playback.durationSeconds > 0.1) {
      if (horizon >= end) {
        session.startTime = end;
        session.next = 0;
      }
    } else if (now > end + TAIL) {
      this.stop();
    }
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}

/** Stops a source that may already have stopped; some browsers throw if so. */
function stopQuietly(source: AudioScheduledSourceNode): void {
  try {
    source.stop();
  } catch {
    // Already stopped.
  }
}
