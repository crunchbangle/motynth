import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EXAMPLES } from '../content/examples.ts';
import { useDebouncedValue } from './common/hooks.ts';
import { ComposeTab } from './compose/ComposeTab.tsx';
import { LearnTab } from './learn/LearnTab.tsx';
import { Header, TABS, type TabName } from './shell/Header.tsx';
import { SoundsTab } from './sounds/SoundsTab.tsx';
import { useAudio, usePlay, usePlayingId } from './state/audio.tsx';
import { compileWithLibrary, useSounds } from './state/sounds.tsx';
import { browserStorage, STORAGE_KEYS } from './state/storage.ts';

/** The id Compose playback uses, so the header knows when it is playing. */
export const COMPOSE_PLAYBACK = 'compose';

/** Errors and the score update this long after typing stops. */
const LIVE_COMPILE_DELAY_MS = 220;

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
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const settledCode = useDebouncedValue(code, LIVE_COMPILE_DELAY_MS);
  const liveResult = useMemo(
    () => compileWithLibrary(settledCode, library),
    [settledCode, library],
  );

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

  /** Plays the Compose code from the start; with errors, puts the cursor in the editor instead. */
  const playCompose = useCallback(() => {
    const result = compileWithLibrary(code, library);
    if (!result.ok) {
      editorRef.current?.focus();
      return;
    }
    if (result.events.length > 0) play(COMPOSE_PLAYBACK, result, { loop });
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
          <ComposeTab
            code={code}
            onCodeChange={setCode}
            result={liveResult}
            onPlay={playCompose}
            playbackId={COMPOSE_PLAYBACK}
            editorRef={editorRef}
          />
        </section>
        <section
          id="view-sounds"
          role="tabpanel"
          aria-labelledby="tab-sounds"
          hidden={tab !== 'sounds'}
        >
          <SoundsTab active={tab === 'sounds'} />
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
