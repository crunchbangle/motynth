import { useState } from 'react';
import { LESSONS, type Lesson } from '../../content/lessons.ts';
import { REFERENCE } from '../../content/reference.ts';
import { HighlightedCode } from '../code/HighlightedCode.tsx';
import { PlayButton } from '../common/PlayButton.tsx';
import { useAudio, usePlay, usePlayingId } from '../state/audio.tsx';
import { compileWithLibrary, useSounds } from '../state/sounds.tsx';

interface LearnTabProps {
  onOpenInCompose(code: string): void;
}

/** Lessons with playable snippets, and the quick reference. */
export function LearnTab({ onOpenInCompose }: LearnTabProps) {
  const [index, setIndex] = useState(0);
  const lesson = LESSONS[index] as Lesson;

  const goTo = (next: number) => {
    setIndex(next);
    window.scrollTo({ top: 0 });
  };

  const previous = LESSONS[index - 1];
  const next = LESSONS[index + 1];

  return (
    <div className="learn">
      <nav className="panel lessons" aria-label="Lessons">
        <h2 style={{ marginBottom: 10, fontSize: 18 }}>Lessons</h2>
        {LESSONS.map((l, k) => (
          <button key={l.id} type="button" aria-current={k === index} onClick={() => goTo(k)}>
            {l.title}
          </button>
        ))}
      </nav>
      <article className="lesson">
        <h2>{lesson.title}</h2>
        {lesson.isReference && <Reference />}
        {lesson.blocks.map((block, k) =>
          block.type === 'text' ? (
            <p key={k}>{block.text}</p>
          ) : (
            <Snippet
              key={k}
              id={`${lesson.id}-${k}`}
              code={block.code}
              onOpenInCompose={onOpenInCompose}
            />
          ),
        )}
        <div className="pager">
          {previous ? (
            <button type="button" className="btn" onClick={() => goTo(index - 1)}>
              Previous: {previous.title}
            </button>
          ) : (
            <span />
          )}
          {next ? (
            <button type="button" className="btn" onClick={() => goTo(index + 1)}>
              Next: {next.title}
            </button>
          ) : (
            <span />
          )}
        </div>
      </article>
    </div>
  );
}

/** A code example with Play and "Open in Compose". */
function Snippet({
  id,
  code,
  onOpenInCompose,
}: {
  id: string;
  code: string;
  onOpenInCompose(code: string): void;
}) {
  const { player } = useAudio();
  const { library } = useSounds();
  const play = usePlay();
  const playing = usePlayingId() === id;
  const [message, setMessage] = useState('');

  const toggle = () => {
    if (playing) {
      player.stop();
      return;
    }
    const result = compileWithLibrary(code, library);
    if (!result.ok) {
      setMessage(`Line ${result.error.line}: ${result.error.message}`);
      return;
    }
    setMessage('');
    play(id, result);
  };

  return (
    <div className="snip">
      <pre>
        <HighlightedCode code={code} />
      </pre>
      <div className="snip-bar">
        <PlayButton className="btn small" playing={playing} onClick={toggle} />
        <button type="button" className="btn small" onClick={() => onOpenInCompose(code)}>
          Open in Compose
        </button>
        <span className="snip-msg" role="alert">
          {message}
        </span>
      </div>
    </div>
  );
}

/** The quick reference tables. */
function Reference() {
  const { library } = useSounds();
  const context = { instruments: library.instruments.map((i) => i.name) };
  return (
    <>
      <p>Everything the language understands, in one place.</p>
      {REFERENCE.map((group) => (
        <div key={group.title}>
          <h3>{group.title}</h3>
          <table className="reftbl">
            <tbody>
              {group.rows.map((row) => (
                <tr key={row.example}>
                  <td>{row.example}</td>
                  <td>{typeof row.meaning === 'function' ? row.meaning(context) : row.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}
