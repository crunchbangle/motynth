// Builds the site into dist/: compiles app/src with tsc, then copies the
// static files next to it. Run with `npm run build`.

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, rmSync } from 'node:fs';

const OUT = 'dist';
const STATIC_FILES = ['index.html', 'styles.css'];

rmSync(OUT, { recursive: true, force: true });

// `npm run` puts node_modules/.bin on the PATH; the shell finds tsc there
// on every platform.
const tsc = spawnSync('tsc -p tsconfig.build.json', { stdio: 'inherit', shell: true });
if (tsc.status !== 0) {
  process.exit(tsc.status ?? 1);
}

mkdirSync(OUT, { recursive: true });
for (const file of STATIC_FILES) {
  copyFileSync(`app/${file}`, `${OUT}/${file}`);
}

console.log(`Built ${OUT}/`);
