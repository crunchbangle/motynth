import { useRef, useState, type PointerEvent } from 'react';
import {
  clearColumns,
  flipColumns,
  mirrorColumns,
  paintLine,
  resampleColumns,
  shapeColumns,
  shiftColumnsLeft,
  shiftColumnsRight,
  SHAPES,
  WAVE_LEVELS,
  WAVE_WIDTHS,
  type Wave,
  type WaveKind,
} from '../../sound/wave.ts';
import { CommitInput } from './CommitInput.tsx';
import { Segmented, Slider } from './controls.tsx';
import { WaveGridPicture } from './pictures.tsx';

const WAVE_KINDS: readonly { value: WaveKind; label: string }[] = [
  { value: 'cycle', label: 'Cycle' },
  { value: 'shot', label: 'One-shot' },
  { value: 'noise', label: 'Noise' },
];

interface WaveEditorProps {
  wave: Wave | undefined;
  onChange(change: Partial<Wave>): void;
  onDelete(): void;
  canDelete: boolean;
}

export function WaveEditor({ wave, onChange, onDelete, canDelete }: WaveEditorProps) {
  if (!wave) {
    return (
      <div className="panel wave-col" id="waveEd">
        <h2>Wave</h2>
      </div>
    );
  }

  const setColumns = (columns: number[]) => onChange({ columns });

  return (
    <div className="panel wave-col" id="waveEd">
      <h2>Wave</h2>
      <div className="field">
        <span className="l">Name</span>
        <CommitInput
          type="text"
          maxLength={28}
          aria-label="Wave name"
          value={wave.name}
          onCommit={(name) => onChange({ name: name || wave.name })}
        />
      </div>
      <div className="field">
        <span className="l">Kind</span>
        <Segmented
          label="Wave kind"
          options={WAVE_KINDS}
          value={wave.kind}
          onChange={(kind) => onChange({ kind })}
        />
      </div>

      {wave.kind === 'noise' ? (
        <>
          <p className="hint">
            Random steps, held for a short grain. A low rate sounds crunchy; a high rate sounds like
            static. Metallic repeats a short 127-step pattern, which rings like a hi-hat.
          </p>
          <Slider
            label="Grain rate"
            min={500}
            max={44100}
            step={100}
            value={wave.noiseRateHz}
            format={(hz) => `${Math.round(hz)} Hz`}
            onChange={(noiseRateHz) => onChange({ noiseRateHz })}
          />
          <label className="field">
            <input
              type="checkbox"
              checked={wave.metallic}
              onChange={(event) => onChange({ metallic: event.target.checked })}
            />
            <span>Metallic (short repeating pattern)</span>
          </label>
          <div className="row">
            <button
              type="button"
              className="btn small danger"
              disabled={!canDelete}
              onClick={onDelete}
            >
              Delete wave
            </button>
          </div>
        </>
      ) : (
        <>
          <WaveGrid wave={wave} onColumnsChange={setColumns} />
          <div className="row">
            <span className="rowl">Width</span>
            <select
              aria-label="Width in pixels"
              value={wave.columns.length}
              onChange={(event) =>
                setColumns(
                  resampleColumns(
                    wave.columns,
                    wave.levels,
                    Number(event.target.value),
                    wave.levels,
                  ),
                )
              }
            >
              {WAVE_WIDTHS.map((width) => (
                <option key={width} value={width}>
                  {width} px
                </option>
              ))}
            </select>
            <span className="rowl">Levels</span>
            <select
              aria-label="Number of levels"
              value={wave.levels}
              onChange={(event) => {
                const levels = Number(event.target.value);
                onChange({
                  columns: resampleColumns(wave.columns, wave.levels, wave.columns.length, levels),
                  levels,
                });
              }}
            >
              {WAVE_LEVELS.map((levels) => (
                <option key={levels} value={levels}>
                  {levels}
                </option>
              ))}
            </select>
          </div>
          <label className="field">
            <input
              type="checkbox"
              checked={wave.smooth}
              onChange={(event) => onChange({ smooth: event.target.checked })}
            />
            <span>Smooth the steps (off keeps the crunch)</span>
          </label>
          {wave.kind === 'shot' ? (
            <>
              <Slider
                label="Length"
                min={10}
                max={600}
                step={5}
                value={wave.shotMs}
                format={(ms) => `${Math.round(ms)} ms`}
                onChange={(shotMs) => onChange({ shotMs })}
              />
              <p className="hint">
                Plays once through the grid at the instrument’s reference pitch, and is sped up or
                slowed down to follow other notes.
              </p>
            </>
          ) : (
            <p className="hint">One cycle of the wave. It repeats at the pitch of each note.</p>
          )}
          <div className="row">
            <span className="rowl">Start from</span>
            {SHAPES.map(({ shape, label }) => (
              <button
                key={shape}
                type="button"
                className="btn small"
                onClick={() =>
                  setColumns(
                    shapeColumns(
                      shape,
                      wave.columns.length,
                      wave.levels,
                      shape === 'pulse' ? 0.25 : 0.5,
                    ),
                  )
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div className="row">
            <span className="rowl">Edit</span>
            <button
              type="button"
              className="btn small"
              onClick={() => setColumns(flipColumns(wave.columns, wave.levels))}
            >
              Flip
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() => setColumns(mirrorColumns(wave.columns))}
            >
              Mirror
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() => setColumns(shiftColumnsRight(wave.columns))}
            >
              Shift right
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() => setColumns(shiftColumnsLeft(wave.columns))}
            >
              Shift left
            </button>
            <button
              type="button"
              className="btn small"
              onClick={() => setColumns(clearColumns(wave.columns, wave.levels))}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn small danger"
              disabled={!canDelete}
              onClick={onDelete}
            >
              Delete wave
            </button>
          </div>
          <ul className="tiplist">
            <li>Click and drag on the grid to set each column.</li>
            <li>
              The pink line is silence; a wave that sits above or below it is re-centered
              automatically.
            </li>
          </ul>
        </>
      )}
    </div>
  );
}

/**
 * The grid, drawn on with a mouse, pen or finger. While dragging, the
 * picture updates on every move; the wave is saved (and the test replayed)
 * when the drag ends.
 */
function WaveGrid({
  wave,
  onColumnsChange,
}: {
  wave: Wave;
  onColumnsChange(columns: number[]): void;
}) {
  const [draft, setDraft] = useState<number[] | null>(null);
  const last = useRef<{ column: number; level: number } | null>(null);
  const shown = draft ? { ...wave, columns: draft } : wave;

  const cellAt = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const width = wave.columns.length;
    const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value));
    const column = clamp(Math.floor(((event.clientX - box.left) / box.width) * width), width - 1);
    const row = clamp(
      Math.floor(((event.clientY - box.top) / box.height) * wave.levels),
      wave.levels - 1,
    );
    return { column, level: wave.levels - 1 - row };
  };

  const paint = (event: PointerEvent<HTMLCanvasElement>, columns: readonly number[]) => {
    const cell = cellAt(event);
    const next = paintLine(columns, last.current ?? cell, cell);
    last.current = cell;
    setDraft(next);
  };

  const finish = () => {
    if (draft) onColumnsChange(draft);
    setDraft(null);
    last.current = null;
  };

  return (
    <WaveGridPicture
      wave={shown}
      className="wavecv"
      role="img"
      aria-label="Waveform pixel grid. Click or drag to draw."
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        last.current = null;
        paint(event, wave.columns);
      }}
      onPointerMove={(event) => {
        if (draft) paint(event, draft);
      }}
      onPointerUp={finish}
      onPointerCancel={finish}
    />
  );
}
