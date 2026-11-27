// @vitest-environment jsdom

import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LESSONS } from '../../app/src/content/lessons.ts';
import { LearnTab } from '../../app/src/ui/learn/LearnTab.tsx';
import { renderWithProviders } from '../support/render.tsx';

window.scrollTo = () => {};

function renderLearn() {
  const opened: string[] = [];
  const view = renderWithProviders(<LearnTab onOpenInCompose={(code) => opened.push(code)} />);
  return { ...view, opened, user: userEvent.setup() };
}

test('lists every lesson and shows the first', () => {
  renderLearn();
  const nav = screen.getByRole('navigation', { name: 'Lessons' });
  expect(within(nav).getAllByRole('button')).toHaveLength(LESSONS.length);
  expect(screen.getByRole('heading', { level: 2, name: LESSONS[0]?.title })).toBeTruthy();
  expect(
    within(nav).getByRole('button', { name: LESSONS[0]?.title }).getAttribute('aria-current'),
  ).toBe('true');
});

test('moves between lessons with the list and the pager', async () => {
  const { user } = renderLearn();
  await user.click(screen.getByRole('button', { name: `Next: ${LESSONS[1]?.title}` }));
  expect(screen.getByRole('heading', { level: 2, name: LESSONS[1]?.title })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: `Previous: ${LESSONS[0]?.title}` }));
  expect(screen.getByRole('heading', { level: 2, name: LESSONS[0]?.title })).toBeTruthy();
  await user.click(screen.getByRole('button', { name: 'Quick reference' }));
  expect(screen.queryByRole('button', { name: /^Next:/ })).toBeNull();
});

test('a snippet plays, then stops, with its own id', async () => {
  const { user, player } = renderLearn();
  const [play] = screen.getAllByRole('button', { name: 'Play' });
  await user.click(play as HTMLElement);
  expect(player.started).toHaveLength(1);
  expect(player.started[0]?.id).toBe('first-1');
  expect(player.started[0]?.events.length).toBe(8);
  // Its button now says Stop; the other snippet's still says Play.
  expect(screen.getAllByRole('button', { name: 'Stop' })).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Stop' }));
  expect(player.stops).toBe(1);
  expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull();
});

test('a snippet opens in Compose', async () => {
  const { user, opened } = renderLearn();
  const [open] = screen.getAllByRole('button', { name: 'Open in Compose' });
  await user.click(open as HTMLElement);
  expect(opened).toEqual(['pulse: [1 2 3 4 5 6 7 8]']);
});

test('snippet code is highlighted', () => {
  const { container } = renderLearn();
  const instrument = container.querySelector('.snip .tk-inst');
  expect(instrument?.textContent).toBe('pulse');
});

test('the reference lists the user’s instruments', async () => {
  const { user } = renderLearn();
  await user.click(screen.getByRole('button', { name: 'Quick reference' }));
  expect(screen.getByText(/^Your instruments: pulse, square, tri/)).toBeTruthy();
  expect(screen.getAllByRole('table').length).toBe(5);
});
