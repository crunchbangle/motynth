// Colours come from CSS custom properties in styles.css, which switch with
// the light/dark colour scheme. Canvases can't use CSS variables, so they
// read the current values and redraw when the scheme changes.

import { useSyncExternalStore } from 'react';
import type { SoundLibrary } from '../sound/library.ts';

/** Instrument colours, in order; instruments take them by position in the library. */
const INSTRUMENT_PALETTE = ['--blue', '--pink', '--amber', '--teal', '--violet', '--red'];

/** The CSS variable for an instrument's colour, for use in styles: `var(--teal)`. */
export function instrumentColorVar(library: SoundLibrary, name: string | null): string {
  return `var(${paletteEntry(library.instruments.findIndex((i) => i.name === name))})`;
}

/** The colour for the instrument at `index` in the library. */
export function paletteEntry(index: number): string {
  return INSTRUMENT_PALETTE[Math.max(0, index) % INSTRUMENT_PALETTE.length] as string;
}

/** The current value of a CSS custom property, such as '--cell-bg'. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const DARK_QUERY = '(prefers-color-scheme: dark)';

function subscribeToScheme(onChange: () => void): () => void {
  const query = window.matchMedia?.(DARK_QUERY);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}

/** 'dark' or 'light'; re-renders when the system setting changes, so canvases can redraw. */
export function useColorScheme(): 'dark' | 'light' {
  return useSyncExternalStore(
    subscribeToScheme,
    () => (window.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light'),
    () => 'light',
  );
}
