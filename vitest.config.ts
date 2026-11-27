import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Tests run from the repo root; the site build (vite.config.ts) runs from app/.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    // Component tests opt into a browser-like DOM with `// @vitest-environment jsdom`.
    environment: 'node',
    setupFiles: ['test/support/setup.ts'],
    // Tests use the global `test`, `expect` and `vi` instead of importing them
    // from 'vitest'. On Windows, importing 'vitest' from a working directory
    // with a lowercase drive letter (as VS Code and Git Bash use) loads a
    // second copy of it, and then no tests are found.
    globals: true,
  },
});
