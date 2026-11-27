// @vitest-environment jsdom

import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../app/src/ui/App.tsx';
import { STORAGE_KEYS } from '../../app/src/ui/state/storage.ts';
import { renderWithProviders } from '../support/render.tsx';

window.scrollTo = () => {};

const visiblePanel = () => document.querySelector('[role="tabpanel"]:not([hidden])')?.id;

test('starts on Compose, switches tabs, and remembers the tab', async () => {
  const user = userEvent.setup();
  const first = renderWithProviders(<App />);
  expect(visiblePanel()).toBe('view-compose');
  await user.click(screen.getByRole('tab', { name: 'Learn' }));
  expect(visiblePanel()).toBe('view-learn');
  expect(screen.getByRole('tab', { name: 'Learn' }).getAttribute('aria-selected')).toBe('true');
  expect(localStorage.getItem(STORAGE_KEYS.tab)).toBe('learn');

  first.unmount();
  renderWithProviders(<App />);
  expect(visiblePanel()).toBe('view-learn');
});

test('the header Play button plays the Compose code, looping if asked', async () => {
  localStorage.setItem(STORAGE_KEYS.code, 'pulse: [1 2 3]');
  const user = userEvent.setup();
  const { player } = renderWithProviders(<App />);
  await user.click(screen.getByRole('checkbox', { name: 'Loop' }));
  await user.click(screen.getByRole('button', { name: 'Play' }));
  expect(player.started[0]?.id).toBe('compose');
  expect(player.started[0]?.events).toHaveLength(3);
  expect(player.started[0]?.loop).toBe(true);
  await user.click(screen.getByRole('button', { name: 'Stop' }));
  expect(player.playingId).toBeNull();
});

test('Escape stops playback', async () => {
  const user = userEvent.setup();
  const { player } = renderWithProviders(<App />);
  await user.click(screen.getByRole('button', { name: 'Play' }));
  expect(player.playingId).toBe('compose');
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(player.playingId).toBeNull();
});

test('Open in Compose replaces the code and switches to Compose', async () => {
  const user = userEvent.setup();
  renderWithProviders(<App />);
  await user.click(screen.getByRole('tab', { name: 'Learn' }));
  const [open] = screen.getAllByRole('button', { name: 'Open in Compose' });
  await user.click(open as HTMLElement);
  expect(visiblePanel()).toBe('view-compose');
  expect(localStorage.getItem(STORAGE_KEYS.code)).toBe('pulse: [1 2 3 4 5 6 7 8]');
});
