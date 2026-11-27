import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const page = (file: string) => fileURLToPath(new URL(`app/${file}`, import.meta.url));

// Builds the site. Tests are configured in vitest.config.ts.
export default defineConfig({
  // The site's source; index.html is the entry point.
  root: 'app',
  // Relative URLs, so the build works under any path (GitHub Pages serves it at /motynth/).
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rolldownOptions: {
      // next.html is the React version while it is being built.
      input: { main: page('index.html'), next: page('next.html') },
    },
  },
});
