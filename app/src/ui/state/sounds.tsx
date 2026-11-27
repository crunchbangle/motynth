// The sound library as React state, saved to storage after each change.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { compile, type CompileResult } from '../../engine/index.ts';
import { defaultInstrumentName, instrumentNames, type SoundLibrary } from '../../sound/library.ts';
import { loadLibrary, saveLibrary, type KeyValueStore } from '../../sound/persistence.ts';
import { browserStorage } from './storage.ts';

/** Saving waits for changes to pause, so dragging a slider doesn't save on every step. */
const SAVE_DELAY_MS = 400;

interface SoundsValue {
  library: SoundLibrary;
  /** Applies a change, given as a function from the current library to the next. */
  updateLibrary(change: (library: SoundLibrary) => SoundLibrary): void;
}

const SoundsContext = createContext<SoundsValue | null>(null);

export function SoundsProvider({
  store = browserStorage,
  children,
}: {
  store?: KeyValueStore;
  children: ReactNode;
}) {
  const [library, setLibrary] = useState(() => loadLibrary(store));

  // Save shortly after the last change, and right away when leaving.
  const pending = useRef<SoundLibrary | null>(null);
  useEffect(() => {
    pending.current = library;
    const timer = setTimeout(() => {
      saveLibrary(store, library);
      pending.current = null;
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [library, store]);
  useEffect(() => {
    const flush = () => {
      if (pending.current) saveLibrary(store, pending.current);
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [store]);

  const updateLibrary = useCallback(
    (change: (library: SoundLibrary) => SoundLibrary) => setLibrary(change),
    [],
  );
  const value = useMemo(() => ({ library, updateLibrary }), [library, updateLibrary]);
  return <SoundsContext.Provider value={value}>{children}</SoundsContext.Provider>;
}

export function useSounds(): SoundsValue {
  const value = useContext(SoundsContext);
  if (!value) throw new Error('useSounds must be used inside <SoundsProvider>');
  return value;
}

/** Compiles code the way the app plays it: with the user's instruments, and a default for bare notes. */
export function compileWithLibrary(code: string, library: SoundLibrary): CompileResult {
  return compile(code, {
    instruments: instrumentNames(library),
    defaultInstrument: defaultInstrumentName(library),
  });
}
