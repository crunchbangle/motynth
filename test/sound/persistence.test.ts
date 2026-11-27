import assert from 'node:assert/strict';
import { findInstrument, starterLibrary, updateInstrument } from '../../app/src/sound/library.ts';
import {
  LIBRARY_KEY,
  PROTOTYPE_LIBRARY_KEY,
  loadLibrary,
  saveLibrary,
} from '../../app/src/sound/persistence.ts';

function memoryStore(entries: Record<string, string> = {}) {
  const data = new Map(Object.entries(entries));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

test('with nothing saved, the starter sounds load', () => {
  assert.deepEqual(loadLibrary(memoryStore()), starterLibrary());
});

test('a saved library loads back unchanged', () => {
  const store = memoryStore();
  const library = updateInstrument(starterLibrary(), 'kick', { volume: 1.9 });
  saveLibrary(store, library);
  assert.deepEqual(loadLibrary(store), library);
});

test('saving never touches the prototype’s saved data', () => {
  const store = memoryStore({ [PROTOTYPE_LIBRARY_KEY]: 'old' });
  saveLibrary(store, starterLibrary());
  assert.equal(store.data.get(PROTOTYPE_LIBRARY_KEY), 'old');
});

test('the current format wins over the prototype’s', () => {
  const library = updateInstrument(starterLibrary(), 'hat', { volume: 0.1 });
  const store = memoryStore({ [PROTOTYPE_LIBRARY_KEY]: JSON.stringify({ waves: [], insts: [] }) });
  saveLibrary(store, library);
  assert.equal(findInstrument(loadLibrary(store), 'hat')?.volume, 0.1);
});

test('a user’s prototype library is converted, filling in what is missing', () => {
  const saved = {
    waves: [
      {
        id: 'w-mine',
        name: 'Mine',
        type: 'shot',
        w: 4,
        d: 4,
        data: [0, 3, 1, 2],
        smooth: true,
        shotMs: 120,
        hz: 8000,
        metal: false,
      },
    ],
    insts: [
      // An early save: no morph or pitch envelope, and a wave that no longer exists.
      {
        name: 'lead',
        mode: 'pair',
        waveA: 'w-gone',
        waveB: 'w-mine',
        refA: 200,
        refB: 800,
        follow: false,
        gain: 1.1,
        amp: { a: 0.01, d: 0.2, s: 0.5, r: 0.3 },
      },
    ],
  };
  const library = loadLibrary(memoryStore({ [PROTOTYPE_LIBRARY_KEY]: JSON.stringify(saved) }));
  assert.deepEqual(library.waves, [
    {
      id: 'w-mine',
      name: 'Mine',
      kind: 'shot',
      columns: [0, 3, 1, 2],
      levels: 4,
      smooth: true,
      shotMs: 120,
      noiseRateHz: 8000,
      metallic: false,
    },
  ]);
  assert.deepEqual(library.instruments, [
    {
      name: 'lead',
      kind: 'pitchPair',
      waveA: 'w-mine',
      waveB: 'w-mine',
      referenceA: 200,
      referenceB: 800,
      followsPitch: false,
      volume: 1.1,
      volumeEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 },
      morphEnvelope: { attack: 0.002, decay: 0.3, sustain: 0, release: 0.05, depth: 1 },
      pitchEnvelope: { startCents: 0, glideSeconds: 0.08 },
    },
  ]);
});

test('unusable saved data falls back to the starter sounds', () => {
  for (const text of [
    'not json',
    'null',
    '[]',
    '{}',
    '{"waves":[],"instruments":[]}',
    '{"waves":[{"id":"w"}],"instruments":[{}]}',
  ]) {
    assert.deepEqual(loadLibrary(memoryStore({ [LIBRARY_KEY]: text })), starterLibrary(), text);
  }
});

test('bad fields fall back to defaults instead of breaking the app', () => {
  const library = starterLibrary();
  const raw = JSON.parse(JSON.stringify(library));
  raw.instruments[0].volume = 'loud';
  raw.instruments[0].volumeEnvelope = null;
  raw.instruments[0].kind = 'banjo';
  raw.waves[0].kind = 'mystery';
  const loaded = loadLibrary(memoryStore({ [LIBRARY_KEY]: JSON.stringify(raw) }));
  const first = loaded.instruments[0];
  assert.equal(first?.volume, 0.7);
  assert.equal(first?.kind, 'single');
  assert.deepEqual(first?.volumeEnvelope, {
    attack: 0.004,
    decay: 0.08,
    sustain: 0.7,
    release: 0.08,
  });
  assert.equal(loaded.waves[0]?.kind, 'cycle');
});
