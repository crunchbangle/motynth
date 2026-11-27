// Rendering components for tests, with fake audio and in-memory storage.

import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import type { Playback } from '../../app/src/sound/player.ts';
import type { KeyValueStore } from '../../app/src/sound/persistence.ts';
import { AudioProvider, type AudioServices } from '../../app/src/ui/state/audio.tsx';
import { SoundsProvider } from '../../app/src/ui/state/sounds.tsx';

/** Records what would be played, and acts like the real player otherwise. */
export class FakePlayer {
  playingId: string | null = null;
  readonly started: Playback[] = [];
  stops = 0;
  private readonly listeners = new Set<() => void>();

  start = (playback: Playback) => {
    this.started.push(playback);
    this.playingId = playback.id;
    this.notify();
  };
  stop = () => {
    this.stops++;
    this.playingId = null;
    this.notify();
  };
  position = () => null;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };
  private notify() {
    for (const listener of this.listeners) listener();
  }
}

export function memoryStore(entries: Record<string, string> = {}): KeyValueStore & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(entries));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

export function renderWithProviders(ui: ReactElement, options: { store?: KeyValueStore } = {}) {
  const player = new FakePlayer();
  const services: AudioServices = {
    player,
    scope: { readWaveform: () => false, waveformSize: 512 },
  };
  const store = options.store ?? memoryStore();
  const result = render(
    <AudioProvider services={services}>
      <SoundsProvider store={store}>{ui}</SoundsProvider>
    </AudioProvider>,
  );
  return { ...result, player, store };
}
