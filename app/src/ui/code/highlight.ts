// Syntax highlighting for Motynth code, one line at a time.
//
// This is a quick visual aid, not a parser: it colours words by how they
// look, so it works on code that doesn't compile yet.

export type TokenKind =
  'comment' | 'keyword' | 'modifier' | 'instrument' | 'duration' | 'number' | 'bracket';

/** A piece of a line; `kind` is null for text that isn't highlighted. */
export interface Token {
  text: string;
  kind: TokenKind | null;
}

/** A duration after a colon: `:q`, `:e.`, `:h*2/3`. */
const DURATION = String.raw`[whqest][.*\d\/]*(?![A-Za-z0-9_])`;

// One alternative per kind, tried left to right at each position.
const PATTERNS: [TokenKind, string][] = [
  ['comment', String.raw`\/\/.*$`],
  [
    'keyword',
    String.raw`\b(?:tuning|register|names|mode|tempo|root|motif|play|with|section|staff|length|rest|of)\b`,
  ],
  ['modifier', String.raw`\b(?:rev|inv|fit|loop|sets-length|x\d+)\b`],
  // A name followed by a colon, unless the colon starts a duration: `pluck:` but not `3:q`.
  ['instrument', String.raw`\b[A-Za-z_][A-Za-z0-9_]*(?=\s*:(?!\s*${DURATION}))`],
  ['duration', `:${DURATION}`],
  ['number', String.raw`\bn?\d+(?:\.\d+)?[#b]*(?:\^-?\d+)?`],
  ['bracket', String.raw`[\[\]\(\)\{\}]`],
];

const TOKEN = new RegExp(PATTERNS.map(([, pattern]) => `(${pattern})`).join('|'), 'g');

export function highlightLine(line: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  TOKEN.lastIndex = 0;
  for (let match = TOKEN.exec(line); match; match = TOKEN.exec(line)) {
    if (match[0] === '') {
      TOKEN.lastIndex++;
      continue;
    }
    if (match.index > last) tokens.push({ text: line.slice(last, match.index), kind: null });
    const group = match.slice(1).findIndex((text) => text !== undefined);
    tokens.push({ text: match[0], kind: (PATTERNS[group] as [TokenKind, string])[0] });
    last = match.index + match[0].length;
  }
  if (last < line.length) tokens.push({ text: line.slice(last), kind: null });
  return tokens;
}
