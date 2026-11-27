import assert from 'node:assert/strict';
import { instrumentNameProblem } from '../../app/src/sound/instrument.ts';
import {
  addWave,
  copyInstrument,
  defaultInstrumentName,
  deleteInstrument,
  deleteWave,
  findInstrument,
  instrumentNames,
  starterLibrary,
  uniqueName,
  updateInstrument,
} from '../../app/src/sound/library.ts';
import { loadLibrary, PROTOTYPE_LIBRARY_KEY } from '../../app/src/sound/persistence.ts';
import { loadPrototypeSound } from '../support/prototype.ts';

const prototype = loadPrototypeSound();

function storeWith(entries: Record<string, string>) {
  return { getItem: (key: string) => entries[key] ?? null, setItem: () => {} };
}

test('the starter sounds are the prototype starter sounds', () => {
  // Converting the prototype's starter library from its saved format must
  // give exactly the new starter library: this checks both at once.
  const saved = JSON.stringify(prototype.starterLibrary());
  assert.deepEqual(loadLibrary(storeWith({ [PROTOTYPE_LIBRARY_KEY]: saved })), starterLibrary());
});

test('every starter instrument uses waves that exist', () => {
  const library = starterLibrary();
  const ids = new Set(library.waves.map((w) => w.id));
  for (const instrument of library.instruments) {
    assert.ok(ids.has(instrument.waveA), instrument.name);
    if (instrument.kind !== 'single') assert.ok(ids.has(instrument.waveB ?? ''), instrument.name);
  }
});

test('unique names match the prototype', () => {
  const taken = new Set(['inst', 'inst_2', 'pulse']);
  for (const base of ['inst', 'pulse', 'fresh']) {
    assert.equal(uniqueName(base, taken), prototype.uniqueName(base, taken));
  }
});

test('the default instrument is pulse, else the first', () => {
  const library = starterLibrary();
  assert.equal(defaultInstrumentName(library), 'pulse');
  assert.equal(defaultInstrumentName(deleteInstrument(library, 'pulse')), 'square');
});

test('copying an instrument gives it a free name and its own settings', () => {
  const library = starterLibrary();
  const kick = findInstrument(library, 'kick');
  assert.ok(kick);
  const { library: next, name } = copyInstrument(library, kick, 'kick');
  assert.equal(name, 'kick_2');
  const copy = findInstrument(next, 'kick_2');
  assert.deepEqual({ ...copy, name: 'kick' }, kick);
  assert.notEqual(copy?.volumeEnvelope, kick.volumeEnvelope, 'envelopes are copied, not shared');
  assert.equal(library.instruments.length + 1, next.instruments.length);
});

test('the last instrument and the last wave cannot be deleted', () => {
  let library = starterLibrary();
  for (const name of instrumentNames(library)) library = deleteInstrument(library, name);
  assert.equal(library.instruments.length, 1);
  for (const wave of [...library.waves]) library = deleteWave(library, wave.id);
  assert.equal(library.waves.length, 1);
});

test('deleting a wave moves its instruments to another wave', () => {
  const library = deleteWave(starterLibrary(), 'w-tri');
  assert.equal(findInstrument(library, 'tri')?.waveA, 'w-pulse');
  assert.equal(findInstrument(library, 'pluck')?.waveA, 'w-pulse');
  assert.ok(!library.waves.some((w) => w.id === 'w-tri'));
});

test('switching to a pitch pair or morph gives the instrument a second wave', () => {
  const library = updateInstrument(starterLibrary(), 'tri', { kind: 'morph' });
  assert.equal(findInstrument(library, 'tri')?.waveB, 'w-pulse');
});

test('adding a wave gives it the next number and a new id', () => {
  const { library, id } = addWave(starterLibrary(), () => 'w-new');
  assert.equal(id, 'w-new');
  assert.equal(library.waves.at(-1)?.name, 'Wave 9');
});

test('instrument names must be usable in code', () => {
  const others = new Set(['pulse']);
  assert.equal(instrumentNameProblem('lead_2', others), null);
  assert.match(instrumentNameProblem('2lead', others) ?? '', /letters/);
  assert.match(instrumentNameProblem('my-lead', others) ?? '', /letters/);
  assert.match(instrumentNameProblem('pulse', others) ?? '', /already/);
  for (const word of ['x', 'r', 'rest', 'with', 'section']) {
    assert.match(instrumentNameProblem(word, others) ?? '', /something else/, word);
  }
});
