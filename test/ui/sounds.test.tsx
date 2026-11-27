// @vitest-environment jsdom

import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SoundLibrary } from '../../app/src/sound/library.ts';
import { LIBRARY_KEY } from '../../app/src/sound/persistence.ts';
import { SoundsTab } from '../../app/src/ui/sounds/SoundsTab.tsx';
import { memoryStore, renderWithProviders } from '../support/render.tsx';

function renderSounds({ active = true } = {}) {
  const store = memoryStore();
  const view = renderWithProviders(<SoundsTab active={active} />, { store });
  return { ...view, store, user: userEvent.setup() };
}

/** Waits for debounced saving (400 ms) and test replays (380 ms). */
const wait = (ms = 450) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

function saved(store: ReturnType<typeof memoryStore>): SoundLibrary {
  return JSON.parse(store.data.get(LIBRARY_KEY) ?? 'null') as SoundLibrary;
}

const list = (name: 'Instruments' | 'Waves') => screen.getByRole('list', { name });
const nameInput = () =>
  screen.getByRole('textbox', { name: 'Instrument name' }) as HTMLInputElement;
const waveName = () => screen.getByRole('textbox', { name: 'Wave name' }) as HTMLInputElement;

test('lists the starter instruments and waves, with the first selected', () => {
  renderSounds();
  expect(within(list('Instruments')).getAllByRole('button')).toHaveLength(11);
  expect(within(list('Waves')).getAllByRole('button')).toHaveLength(8);
  expect(nameInput().value).toBe('pulse');
  expect(waveName().value).toBe('Pulse 25%');
});

test('selecting an instrument shows it and its wave', async () => {
  const { user } = renderSounds();
  await user.click(within(list('Instruments')).getByRole('button', { name: 'bass' }));
  expect(nameInput().value).toBe('bass');
  expect(waveName().value).toBe('Organ');
  expect(
    within(list('Instruments')).getByRole('button', { name: 'bass' }).getAttribute('aria-current'),
  ).toBe('true');
});

test('renaming checks the name, and a valid name is used everywhere', async () => {
  const { user, store } = renderSounds();
  await user.clear(nameInput());
  await user.type(nameInput(), 'with');
  expect(screen.getByText(/means something else in code/)).toBeTruthy();
  await user.keyboard('{Enter}');
  expect(nameInput().value).toBe('pulse');
  expect(screen.getByText(/^Kept the old name/)).toBeTruthy();

  await user.clear(nameInput());
  await user.type(nameInput(), 'lead{Enter}');
  expect(within(list('Instruments')).getByRole('button', { name: 'lead' })).toBeTruthy();
  expect(within(list('Instruments')).queryByRole('button', { name: 'pulse' })).toBeNull();
  await wait();
  expect(saved(store).instruments[0]?.name).toBe('lead');
});

test('switching to morph adds wave B and the morph envelope', async () => {
  const { user } = renderSounds();
  expect(screen.queryByRole('combobox', { name: 'Wave B' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Morph' }));
  expect(screen.getByRole('combobox', { name: 'Wave B' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Morph envelope (A to B)' })).toBeTruthy();
  expect(screen.getByRole('slider', { name: /Amount of B/ })).toBeTruthy();
});

test('sliders change the instrument, and the change is saved', async () => {
  const { store } = renderSounds();
  fireEvent.change(screen.getByRole('slider', { name: /Volume/ }), { target: { value: '1.5' } });
  expect(screen.getByText('150%')).toBeTruthy();
  await wait();
  expect(saved(store).instruments[0]?.volume).toBe(1.5);
});

test('new, duplicate and delete instruments', async () => {
  const { user } = renderSounds();
  await user.click(
    within(screen.getByText('Instruments').parentElement!).getByRole('button', { name: 'New' }),
  );
  expect(nameInput().value).toBe('inst');
  await user.click(screen.getByRole('button', { name: 'Duplicate' }));
  expect(nameInput().value).toBe('inst_2');
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(within(list('Instruments')).queryByRole('button', { name: 'inst_2' })).toBeNull();
  expect(within(list('Instruments')).getAllByRole('button')).toHaveLength(12);
});

test('wave edits change the grid, and noise waves have their own settings', async () => {
  const { user, store } = renderSounds();
  await user.click(screen.getByRole('button', { name: 'Flip' }));
  await wait();
  expect(saved(store).waves[0]?.columns.slice(0, 3)).toEqual([0, 0, 0]);

  await user.click(screen.getByRole('button', { name: 'Noise' }));
  expect(screen.getByRole('slider', { name: /Grain rate/ })).toBeTruthy();
  expect(screen.queryByRole('img', { name: /pixel grid/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Delete wave' })).toBeTruthy();
});

test('changing the grid size resamples the wave', async () => {
  const { user, store } = renderSounds();
  await user.selectOptions(screen.getByRole('combobox', { name: 'Width in pixels' }), '8 px');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Number of levels' }), '4');
  await wait();
  const wave = saved(store).waves[0];
  expect(wave?.columns).toHaveLength(8);
  expect(wave?.levels).toBe(4);
});

test('drawing on the grid sets columns when the drag ends', async () => {
  const { store } = renderSounds();
  const grid = screen.getByRole('img', { name: /pixel grid/ });
  // 32 columns over 320 pixels, 16 levels over 160 pixels.
  grid.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 160 }) as DOMRect;
  fireEvent.pointerDown(grid, { clientX: 5, clientY: 155, pointerId: 1 });
  fireEvent.pointerMove(grid, { clientX: 45, clientY: 115, pointerId: 1 });
  fireEvent.pointerUp(grid, { pointerId: 1 });
  await wait();
  // Columns 0..4 rise in a line from level 0 to level 4.
  expect(saved(store).waves[0]?.columns.slice(0, 5)).toEqual([0, 1, 2, 3, 4]);
});

test('restoring the starter sounds needs a second click', async () => {
  const { user } = renderSounds();
  await user.click(screen.getByRole('button', { name: 'Delete' }));
  expect(within(list('Instruments')).getAllByRole('button')).toHaveLength(10);
  await user.click(screen.getByRole('button', { name: 'Restore starter sounds' }));
  expect(within(list('Instruments')).getAllByRole('button')).toHaveLength(10);
  await user.click(screen.getByRole('button', { name: 'Click again to replace everything' }));
  expect(within(list('Instruments')).getAllByRole('button')).toHaveLength(11);
});

test('the test bar plays the motif on the current instrument', async () => {
  const { user, player } = renderSounds();
  await user.click(within(list('Instruments')).getByRole('button', { name: 'bass' }));
  await user.click(screen.getByRole('button', { name: 'Play test' }));
  const playback = player.started.at(-1);
  expect(playback?.id).toBe('test');
  expect(playback?.events).toHaveLength(7);
  // Every note plays on the selected instrument, whatever the code says.
  expect(playback?.instrumentFor(null)?.name).toBe('bass');
  expect(playback?.instrumentFor('kick')?.name).toBe('bass');
});

test('the test replays after a change, only while the tab is showing', async () => {
  const shown = renderSounds();
  fireEvent.change(screen.getByRole('slider', { name: /Volume/ }), { target: { value: '1' } });
  await wait();
  expect(shown.player.started).toHaveLength(1);
  shown.unmount();

  const hidden = renderSounds({ active: false });
  fireEvent.change(screen.getByRole('slider', { name: /Volume/ }), { target: { value: '1' } });
  await wait();
  expect(hidden.player.started).toHaveLength(0);
});

test('a broken test motif shows why', async () => {
  const { user, player } = renderSounds();
  const motif = screen.getByRole('textbox', { name: 'Test motif' });
  await user.clear(motif);
  // In user-event, `[[` types a single `[`.
  await user.type(motif, '[[1 2{Enter}');
  expect(player.started).toHaveLength(0);
  // The test bar plays `piece = ([1 2)^0`, so the parser meets the `)` first.
  expect(screen.getByText('Unexpected “)” in motif')).toBeTruthy();
});
