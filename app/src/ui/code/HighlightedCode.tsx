import { highlightLine } from './highlight.ts';

/** One line of code with syntax colours (classes tk-* in styles.css). */
export function HighlightedLine({ line }: { line: string }) {
  return highlightLine(line).map((token, k) =>
    token.kind ? (
      <span key={k} className={`tk-${CLASS_SUFFIX[token.kind]}`}>
        {token.text}
      </span>
    ) : (
      token.text
    ),
  );
}

/** Several lines, separated by newlines (for use inside <pre>). */
export function HighlightedCode({ code }: { code: string }) {
  return code.split('\n').map((line, k) => (
    <span key={k}>
      {k > 0 && '\n'}
      <HighlightedLine line={line} />
    </span>
  ));
}

const CLASS_SUFFIX = {
  comment: 'com',
  keyword: 'kw',
  modifier: 'mod',
  instrument: 'inst',
  duration: 'dur',
  number: 'num',
  bracket: 'pun',
} as const;
