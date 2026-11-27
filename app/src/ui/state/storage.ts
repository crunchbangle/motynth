// The browser's localStorage, made safe: it can be missing or throw (private
// windows, blocked site data, full storage), and the app must keep working.

import type { KeyValueStore } from '../../sound/persistence.ts';

export const browserStorage: KeyValueStore = {
  getItem(key) {
    try {
      return globalThis.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      globalThis.localStorage.setItem(key, value);
    } catch {
      // Not saved; the app carries on.
    }
  },
};

/** Keys for things the UI remembers between visits. Kept from the prototype, so nothing is lost. */
export const STORAGE_KEYS = {
  code: 'motynth.code.v1',
  tab: 'motynth.tab',
} as const;
