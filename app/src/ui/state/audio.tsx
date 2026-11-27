// Audio for the React app: one engine and one player, shared through context.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { CompiledPiece } from '../../engine/index.ts';
import { AudioEngine } from '../../sound/audio-engine.ts';
import type { Instrument } from '../../sound/instrument.ts';
import { findInstrument, findWave } from '../../sound/library.ts';
import { Player } from '../../sound/player.ts';
import { useSounds } from './sounds.tsx';

/** The audio objects the UI uses. Tests provide fakes. */
export interface AudioServices {
  player: Pick<Player, 'start' | 'stop' | 'position' | 'subscribe' | 'playingId'>;
  /** For the oscilloscope. */
  scope: Pick<AudioEngine, 'readWaveform' | 'waveformSize'>;
}

const AudioServicesContext = createContext<AudioServices | null>(null);

function createAudioServices(): AudioServices {
  const engine = new AudioEngine();
  return { player: new Player(engine), scope: engine };
}

export function AudioProvider({
  services,
  children,
}: {
  services?: AudioServices;
  children: ReactNode;
}) {
  const [value] = useState(() => services ?? createAudioServices());
  return <AudioServicesContext.Provider value={value}>{children}</AudioServicesContext.Provider>;
}

export function useAudio(): AudioServices {
  const value = useContext(AudioServicesContext);
  if (!value) throw new Error('useAudio must be used inside <AudioProvider>');
  return value;
}

/** What is playing (e.g. 'compose', 'test', a snippet id), or null. Re-renders on change. */
export function usePlayingId(): string | null {
  const { player } = useAudio();
  return useSyncExternalStore(player.subscribe, () => player.playingId);
}

export interface PlayOptions {
  loop?: boolean;
  /** Play every note on this instrument, whatever the code says (the Sounds tab test bar). */
  instrument?: Instrument;
}

/**
 * Returns a function that plays a compiled piece. Instruments and waves are
 * looked up as notes are scheduled, so editing sounds changes what is playing.
 */
export function usePlay(): (id: string, piece: CompiledPiece, options?: PlayOptions) => void {
  const { player } = useAudio();
  const { library } = useSounds();
  const latest = useRef(library);
  useEffect(() => {
    latest.current = library;
  }, [library]);

  return useCallback(
    (id, piece, options = {}) => {
      const fixed = options.instrument?.name;
      player.start({
        id,
        events: piece.events,
        durationSeconds: piece.durationSeconds,
        loop: options.loop ?? false,
        instrumentFor: (name) => findInstrument(latest.current, fixed ?? name),
        waveFor: (waveId) => findWave(latest.current, waveId),
      });
    },
    [player],
  );
}
