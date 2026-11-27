// A code editor: a transparent textarea over a highlighted copy of the text.
// The textarea does all the editing (selection, undo, keyboards on phones);
// the copy underneath shows the colours. Their scroll positions are kept in
// step.

import { useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from 'react';
import { HighlightedLine } from '../code/HighlightedCode.tsx';

interface CodeEditorProps {
  value: string;
  onChange(value: string): void;
  /** 1-based line to mark as wrong, or 0 for none. */
  errorLine: number;
  /** Ctrl+Enter (Cmd+Enter on a Mac). */
  onPlay(): void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

const INDENT = '  ';

export function CodeEditor({ value, onChange, errorLine, onPlay, textareaRef }: CodeEditorProps) {
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const textarea = textareaRef ?? ownRef;
  const highlight = useRef<HTMLDivElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  /** Where to put the cursor after a change made by a key handler. */
  const pendingCursor = useRef<number | null>(null);

  const syncScroll = () => {
    const area = textarea.current;
    if (!area) return;
    if (highlight.current) {
      highlight.current.style.transform = `translate(${-area.scrollLeft}px, ${-area.scrollTop}px)`;
    }
    if (gutter.current) gutter.current.style.transform = `translateY(${-area.scrollTop}px)`;
  };

  useLayoutEffect(() => {
    const area = textarea.current;
    if (area && pendingCursor.current !== null) {
      area.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
    syncScroll();
  });

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab') {
      // Indent instead of leaving the editor.
      event.preventDefault();
      const { selectionStart, selectionEnd } = event.currentTarget;
      pendingCursor.current = selectionStart + INDENT.length;
      onChange(value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd));
    } else if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      onPlay();
    }
  };

  const lines = value.split('\n');
  return (
    <div className="editor">
      <div className="gutter" aria-hidden="true">
        <div ref={gutter}>
          {lines.map((_, k) => (
            <div key={k} className={k + 1 === errorLine ? 'bad' : ''}>
              {k + 1}
            </div>
          ))}
        </div>
      </div>
      <div className="edwrap">
        <div className="hl" aria-hidden="true">
          <div className="hl-in" ref={highlight}>
            {lines.map((line, k) => (
              <div key={k} className={k + 1 === errorLine ? 'ln bad' : 'ln'}>
                {line ? <HighlightedLine line={line} /> : ' '}
              </div>
            ))}
          </div>
        </div>
        <textarea
          ref={textarea}
          className="code"
          id="code"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          onScroll={syncScroll}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          wrap="off"
          aria-label="Composition code"
        />
      </div>
    </div>
  );
}
