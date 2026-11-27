import { useState, type ChangeEvent, type RefObject } from 'react';
import { EXAMPLES } from '../../content/examples.ts';
import type { CompileResult } from '../../engine/index.ts';
import { formatTime, oneDecimal } from '../format.ts';
import { CodeEditor } from './CodeEditor.tsx';
import { PianoRoll } from './PianoRoll.tsx';

interface ComposeTabProps {
  code: string;
  onCodeChange(code: string): void;
  /** The result of compiling the code, shortly after it last changed. */
  result: CompileResult;
  /** Ctrl+Enter in the editor: play from the start. */
  onPlay(): void;
  playbackId: string;
  editorRef: RefObject<HTMLTextAreaElement | null>;
}

/** The code editor, its status line, and the score. */
export function ComposeTab({
  code,
  onCodeChange,
  result,
  onPlay,
  playbackId,
  editorRef,
}: ComposeTabProps) {
  // Loading an example keeps the previous text, until the user edits again.
  const [previousCode, setPreviousCode] = useState<string | null>(null);

  const edit = (next: string) => {
    setPreviousCode(null);
    onCodeChange(next);
  };

  const loadExample = (event: ChangeEvent<HTMLSelectElement>) => {
    const example = EXAMPLES[Number(event.target.value)];
    if (!example) return;
    setPreviousCode(code);
    onCodeChange(example.code);
  };

  const restore = () => {
    if (previousCode !== null) onCodeChange(previousCode);
    setPreviousCode(null);
  };

  return (
    <>
      <div>
        <div className="bar">
          {/* Always shows the prompt, so choosing the same example twice works. */}
          <select aria-label="Load an example" value="" onChange={loadExample}>
            <option value="">Load an example…</option>
            {EXAMPLES.map((example, k) => (
              <option key={example.name} value={k}>
                {example.name}
              </option>
            ))}
          </select>
          {previousCode !== null && (
            <button type="button" className="btn small" onClick={restore}>
              Restore previous text
            </button>
          )}
          <span className="grow" />
          <span className="hint">Ctrl+Enter plays</span>
        </div>
        <CodeEditor
          value={code}
          onChange={edit}
          errorLine={result.ok ? 0 : result.error.line}
          onPlay={onPlay}
          textareaRef={editorRef}
        />
        <Status result={result} />
      </div>
      <div className="panel">
        <h2>Score</h2>
        <PianoRoll piece={result.ok ? result : null} playbackId={playbackId} />
        <p className="hint" style={{ marginTop: 14 }}>
          New here? The Learn tab has six short lessons, each with snippets you can play.
        </p>
      </div>
    </>
  );
}

function Status({ result }: { result: CompileResult }) {
  return (
    <div className={result.ok ? 'status' : 'status err'} role="status" aria-live="polite">
      <span className="dot" />
      {result.ok ? (
        <span>
          Ready. <b>{formatTime(result.durationSeconds)}</b> long, {result.events.length} notes,{' '}
          {oneDecimal(result.bpm)} bpm.
        </span>
      ) : (
        <span>
          <b>Line {result.error.line}: </b>
          {result.error.message}
        </span>
      )}
    </div>
  );
}
