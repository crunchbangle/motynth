import { expect, test, type Page } from '@playwright/test';

/** Fails the test on any error in the page or its console. */
function watchForErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = watchForErrors(page);
});
test.afterEach(() => {
  // Fonts load from Google; offline runs shouldn't fail on that.
  expect(errors.filter((e) => !e.includes('fonts.g'))).toEqual([]);
});

const status = (page: Page) => page.getByRole('status');
const editor = (page: Page) => page.getByRole('textbox', { name: 'Composition code' });
const tab = (page: Page, name: string) => page.getByRole('tab', { name });

test('opens on the example piece, ready to play', async ({ page }) => {
  await page.goto('/');
  await expect(status(page)).toHaveText('Ready. 0:26 long, 165 notes, 110 bpm.');
  await expect(page.locator('.legend span')).toHaveText(['bass', 'pluck', 'kick', 'hat', 'snare']);
});

test('shows errors as you type, and clears them when fixed', async ({ page }) => {
  await page.goto('/');
  await editor(page).fill('pulse: [1 2 3]\nbass: [1 2');
  await expect(status(page)).toHaveText('Line 2: This motif is missing its closing “]”');
  await expect(page.locator('.gutter .bad')).toHaveText('2');
  await editor(page).press('End');
  await editor(page).pressSequentially(']');
  await expect(status(page)).toHaveText('Ready. 0:03 long, 5 notes, 120 bpm.');
});

test('plays and stops with real Web Audio', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play' }).click();
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
  await expect(page.locator('#playhead')).toBeVisible();
  // The playhead moves.
  const start = await page.locator('#playhead').evaluate((el) => el.style.left);
  await expect
    .poll(() => page.locator('#playhead').evaluate((el) => el.style.left))
    .not.toBe(start);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await expect(page.locator('#playhead')).toBeHidden();
});

test('Ctrl+Enter plays from the editor', async ({ page }) => {
  await page.goto('/');
  await editor(page).fill('pulse: [1 2 3 4 5 6 7 8]');
  await editor(page).press('Control+Enter');
  await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
});

test('a lesson snippet plays and opens in Compose', async ({ page }) => {
  await page.goto('/');
  await tab(page, 'Learn').click();
  await page.getByRole('button', { name: 'Tunings, modes and names' }).click();
  const snippet = page.locator('.snip').first();
  await snippet.getByRole('button', { name: 'Play' }).click();
  await expect(snippet.getByRole('button', { name: 'Stop' })).toBeVisible();
  await snippet.getByRole('button', { name: 'Open in Compose' }).click();
  await expect(page.locator('#view-compose')).toBeVisible();
  await expect(editor(page)).toHaveValue(/^hook = \[1:e 3 5 3 2 4 6 4\]/);
  await expect(status(page)).toHaveText(/^Ready\./);
});

test('sound edits are saved and survive a reload', async ({ page }) => {
  await page.goto('/');
  await tab(page, 'Sounds').click();
  const name = page.getByRole('textbox', { name: 'Instrument name' });
  await name.fill('lead');
  await name.press('Enter');
  await expect(
    page.getByRole('list', { name: 'Instruments' }).getByRole('button', { name: 'lead' }),
  ).toBeVisible();

  // Draw on the wave grid: a drag from the bottom-left corner.
  const grid = page.getByRole('img', { name: /pixel grid/ });
  const box = await grid.boundingBox();
  if (!box) throw new Error('no grid');
  await page.mouse.move(box.x + 2, box.y + box.height - 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height - 2, { steps: 5 });
  await page.mouse.up();

  // Saving waits 400 ms after the last change.
  await page.waitForTimeout(600);
  await page.reload();
  await expect(
    page.getByRole('list', { name: 'Instruments' }).getByRole('button', { name: 'lead' }),
  ).toBeVisible();
  // The tab is remembered too.
  await expect(page.locator('#view-sounds')).toBeVisible();
  // Compose now knows the instrument as `lead`, not `pulse`.
  await tab(page, 'Compose').click();
  await editor(page).fill('lead: [1 2 3]');
  await expect(status(page)).toHaveText(/^Ready\./);
});

test('the test bar plays the current instrument', async ({ page }) => {
  await page.goto('/');
  await tab(page, 'Sounds').click();
  await page
    .getByRole('list', { name: 'Instruments' })
    .getByRole('button', { name: 'kick' })
    .click();
  await page.getByRole('button', { name: 'Play test' }).click();
  await expect(page.getByRole('button', { name: 'Stop' }).first()).toBeVisible();
});

test('sounds saved by the prototype are converted on first load', async ({ page }) => {
  await page.addInitScript(() => {
    if (localStorage.getItem('motynth.library.v2')) return;
    localStorage.setItem(
      'motynth.lib.v1',
      JSON.stringify({
        waves: [
          {
            id: 'w-old',
            name: 'Old wave',
            type: 'cycle',
            w: 4,
            d: 4,
            data: [0, 3, 1, 2],
            smooth: false,
            shotMs: 90,
            hz: 11025,
            metal: false,
          },
        ],
        insts: [
          {
            name: 'oldie',
            mode: 'single',
            waveA: 'w-old',
            waveB: null,
            refA: 261.63,
            refB: 1046.5,
            follow: true,
            gain: 0.7,
            amp: { a: 0.01, d: 0.1, s: 0.5, r: 0.1 },
          },
        ],
      }),
    );
  });
  await page.goto('/');
  await tab(page, 'Sounds').click();
  await expect(page.getByRole('list', { name: 'Instruments' }).getByRole('button')).toHaveText([
    'oldie',
  ]);
  await expect(page.getByRole('list', { name: 'Waves' }).getByRole('button')).toHaveText([
    'Old wave',
  ]);
});
