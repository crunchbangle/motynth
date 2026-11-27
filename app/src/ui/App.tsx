import { useCallback, useEffect, useState } from 'react';
import { EXAMPLES } from '../content/examples.ts';
import { LearnTab } from './learn/LearnTab.tsx';
import { Header, TABS, type TabName } from './shell/Header.tsx';
import { useAudio, usePlay, usePlayingId } from './state/audio.tsx';
import { compileWithLibrary, useSounds } from './state/sounds.tsx';
import { browserStorage, STORAGE_KEYS } from './state/storage.ts';

/** The id Compose playback uses, so the header knows when it is playing. */
export const COMPOSE_PLAYBACK = 'compose';

function initialTab(): TabName {
  const saved = browserStorage.getItem(STORAGE_KEYS.tab);
  return TABS.some((t) => t.name === saved) ? (saved as TabName) : 'compose';
}

function initialCode(): string {
  const saved = browserStorage.getItem(STORAGE_KEYS.code);
  return saved?.trim() ? saved : (EXAMPLES[0]?.code ?? '');
}

export function App() {
  const { player } = useAudio();
  const { library } = useSounds();
  const play = usePlay();
  const playingId = usePlayingId();

  const [tab, setTab] = useState(initialTab);
  const [code, setCode] = useState(initialCode);
  const [loop, setLoop] = useState(false);

  useEffect(() => browserStorage.setItem(STORAGE_KEYS.tab, tab), [tab]);
  useEffect(() => browserStorage.setItem(STORAGE_KEYS.code, code), [code]);

  // Escape stops whatever is playing.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') player.stop();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [player]);

  /** Plays the Compose code from the start. */
  const playCompose = useCallback(() => {
    const result = compileWithLibrary(code, library);
    if (result.ok && result.events.length > 0) play(COMPOSE_PLAYBACK, result, { loop });
  }, [code, library, loop, play]);

  const openInCompose = useCallback((snippet: string) => {
    setCode(snippet);
    setTab('compose');
  }, []);

  const composePlaying = playingId === COMPOSE_PLAYBACK;

  return (
    <>
      <Header
        tab={tab}
        onTabChange={setTab}
        loop={loop}
        onLoopChange={setLoop}
        playing={composePlaying}
        onPlayToggle={() => (composePlaying ? player.stop() : playCompose())}
      />
      <main>
        {/* Every tab stays mounted, so switching keeps its state (scroll, selection, edits). */}
        <section
          id="view-compose"
          className="compose"
          role="tabpanel"
          aria-labelledby="tab-compose"
          hidden={tab !== 'compose'}
        >
          <p className="hint">The Compose tab is being rebuilt.</p>
        </section>
        <section
          id="view-sounds"
          role="tabpanel"
          aria-labelledby="tab-sounds"
          hidden={tab !== 'sounds'}
        >
          <p className="hint">The Sounds tab is being rebuilt.</p>
        </section>
        <section
          id="view-learn"
          role="tabpanel"
          aria-labelledby="tab-learn"
          hidden={tab !== 'learn'}
        >
          <LearnTab onOpenInCompose={openInCompose} />
        </section>
      </main>
    </>
  );
}
