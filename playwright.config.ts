import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// Browser tests: the built site in a real browser. Run with `npm run test:e2e`.
// The first time, install the browser with `npx playwright install chromium`,
// or set PLAYWRIGHT_CHANNEL=msedge (or chrome) to use one already installed.
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL },
    },
  ],
  // Serves the production build, as GitHub Pages would.
  webServer: {
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
