// @vitest-environment jsdom

import { act, fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EXAMPLES } from '../../app/src/content/examples.ts';
import { App } from '../../app/src/ui/App.tsx';
import { STORAGE_KEYS } from '../../app/src/ui/state/storage.ts';
import { renderWithProviders } from '../support/render.tsx';

window.scrollTo = () => {};

function renderCompose(code: string) {
  localStorage.setItem(STORAGE_KEYS.code, code);
  const view = renderWithProviders(<App />);
  const editor = screen.getByRole('textbox', { name: 'Composition code' }) as HTMLTextAreaElement;
  return { ...view, editor, user: userEvent.setup() };
}

/** Waits for the live compile that follows typing. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 300)));

const status = () => screen.getByRole('status').textContent;

test('shows the length, notes and tempo of code that compiles', () => {
  renderCompose('tempo 60\npulse: [1 2 3 4]');
  expect(status()).toBe('Ready. 0:04 long, 4 notes, 60 bpm.');
  expect(screen.getByText('Notes').querySelector('b')?.textContent).toBe('4');
  expect(screen.getByText('pulse', { selector: '.legend span' })).toBeTruthy();
});

test('an error shows its line and marks it, shortly after typing', async () => {
  const { editor } = renderCompose('pulse: [1 2 3]');
  fireEvent.change(editor, { target: { value: 'pulse: [1 2 3]\nbass: [1 2' } });
  expect(status()).toMatch(/^Ready/);
  await settle();
  expect(status()).toBe('Line 2: This motif is missing its closing “]”');
  expect(document.querySelector('.gutter .bad')?.textContent).toBe('2');
  expect(document.querySelectorAll('.ln.bad')).toHaveLength(1);
  expect(screen.getByText('Your notes appear here once the code can play.')).toBeTruthy();
});

test('the code is highlighted line by line', () => {
  renderCompose('// hi\npluck: [1:q]');
  const lines = document.querySelectorAll('.hl-in .ln');
  expect(lines).toHaveLength(2);
  expect(lines[0]?.querySelector('.tk-com')?.textContent).toBe('// hi');
  expect(lines[1]?.querySelector('.tk-dur')?.textContent).toBe(':q');
});

test('Tab indents and Ctrl+Enter plays', async () => {
  const { editor, user, player } = renderCompose('pulse: [1]');
  await user.click(editor);
  editor.setSelectionRange(0, 0);
  await user.keyboard('{Tab}');
  expect(editor.value).toBe('  pulse: [1]');
  expect(editor.selectionStart).toBe(2);
  await user.keyboard('{Control>}{Enter}{/Control}');
  expect(player.started[0]?.id).toBe('compose');
  expect(player.started[0]?.events).toHaveLength(1);
});

test('playing code with errors puts the cursor in the editor instead', async () => {
  const { editor, user, player } = renderCompose('pulse: [1');
  await user.click(screen.getByRole('button', { name: 'Play' }));
  expect(player.started).toHaveLength(0);
  expect(document.activeElement).toBe(editor);
});

test('loading an example can be undone until the next edit', async () => {
  const { editor, user } = renderCompose('my tune');
  const example = EXAMPLES[1];
  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Load an example' }),
    example?.name ?? '',
  );
  expect(editor.value).toBe(example?.code);
  await user.click(screen.getByRole('button', { name: 'Restore previous text' }));
  expect(editor.value).toBe('my tune');
  expect(screen.queryByRole('button', { name: 'Restore previous text' })).toBeNull();

  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Load an example' }),
    example?.name ?? '',
  );
  await user.type(editor, '!');
  expect(screen.queryByRole('button', { name: 'Restore previous text' })).toBeNull();
});

test('the code is remembered', async () => {
  const { editor, user } = renderCompose('pulse: [1]');
  await user.type(editor, ' // more');
  expect(localStorage.getItem(STORAGE_KEYS.code)).toBe('pulse: [1] // more');
});
