import assert from 'node:assert/strict';
import { EXAMPLES } from '../../app/src/content/examples.ts';
import { LESSONS } from '../../app/src/content/lessons.ts';
import { highlightLine, type Token } from '../../app/src/ui/code/highlight.ts';
import { loadPrototypeHighlighter } from '../support/prototype.ts';
import { randomPrograms } from '../support/random-programs.ts';

const prototype = loadPrototypeHighlighter();

const CLASS: Record<string, string> = {
  comment: 'com',
  keyword: 'kw',
  modifier: 'mod',
  instrument: 'inst',
  duration: 'dur',
  number: 'num',
  bracket: 'pun',
};

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** The tokens as the HTML the prototype produced. */
const asHtml = (tokens: Token[]) =>
  tokens
    .map((t) =>
      t.kind ? `<span class="tk-${CLASS[t.kind]}">${escape(t.text)}</span>` : escape(t.text),
    )
    .join('');

test('highlighting matches the prototype on every line of the lessons, examples and random programs', () => {
  const code = [
    ...LESSONS.flatMap((l) => l.blocks.flatMap((b) => (b.type === 'code' ? [b.code] : []))),
    ...EXAMPLES.map((e) => e.code),
    ...randomPrograms(7, 300),
    'pluck: [1:q 2:e.] // a <comment> & more',
    'a:q  b :q  c:  d: e',
  ];
  const lines = code.flatMap((c) => c.split('\n'));
  assert.ok(lines.length > 1000);
  for (const line of lines) assert.equal(asHtml(highlightLine(line)), prototype.hi(line), line);
});

test('tokens cover the whole line', () => {
  const line = 'verse = section { pluck: hook sets-length } // hi';
  assert.equal(
    highlightLine(line)
      .map((t) => t.text)
      .join(''),
    line,
  );
});

test('an instrument is a name before a colon, but a duration is not', () => {
  assert.deepEqual(highlightLine('bass: [1:q]'), [
    { text: 'bass', kind: 'instrument' },
    { text: ': ', kind: null },
    { text: '[', kind: 'bracket' },
    { text: '1', kind: 'number' },
    { text: ':q', kind: 'duration' },
    { text: ']', kind: 'bracket' },
  ]);
});
