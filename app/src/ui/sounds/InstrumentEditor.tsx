import { useState } from 'react';
import {
  INSTRUMENT_KINDS,
  instrumentNameProblem,
  type Envelope,
  type Instrument,
  type MorphEnvelope,
} from '../../sound/instrument.ts';
import { findWave, instrumentNames, type SoundLibrary } from '../../sound/library.ts';
import { CommitInput } from './CommitInput.tsx';
import { percent, Segmented, Slider, TimeSlider } from './controls.tsx';
import { EnvelopePicture, WaveThumbnail } from './pictures.tsx';

interface InstrumentEditorProps {
  instrument: Instrument | undefined;
  library: SoundLibrary;
  onChange(change: Partial<Instrument>): void;
  onRename(name: string): void;
  onDuplicate(): void;
  onDelete(): void;
  /** Show this wave in the wave editor. */
  onSelectWave(id: string): void;
}

export function InstrumentEditor({
  instrument,
  library,
  onChange,
  onRename,
  onDuplicate,
  onDelete,
  onSelectWave,
}: InstrumentEditorProps) {
  const [nameMessage, setNameMessage] = useState('');

  if (!instrument) {
    return (
      <div className="panel" id="instEd">
        <h2>Instrument</h2>
        <p className="hint">Pick an instrument on the left.</p>
      </div>
    );
  }

  const otherNames = instrumentNames(library);
  otherNames.delete(instrument.name);
  const nameProblem = (name: string) =>
    name === instrument.name ? null : instrumentNameProblem(name, otherNames);

  const kind = INSTRUMENT_KINDS.find((k) => k.kind === instrument.kind);

  return (
    <div className="panel" id="instEd">
      <h2>Instrument</h2>
      <div className="field">
        <span className="l">Name in code</span>
        <CommitInput
          type="text"
          maxLength={24}
          aria-label="Instrument name"
          value={instrument.name}
          onDraft={(name) => setNameMessage(nameProblem(name) ?? '')}
          onCommit={(name) => {
            const problem = nameProblem(name);
            if (problem) {
              setNameMessage(`Kept the old name. ${problem}`);
            } else {
              setNameMessage('');
              onRename(name);
            }
          }}
        />
      </div>
      <div className="warn" role="alert">
        {nameMessage}
      </div>

      <div className="field">
        <span className="l">Sound type</span>
        <Segmented
          label="Sound type"
          options={INSTRUMENT_KINDS.map((k) => ({ value: k.kind, label: k.label }))}
          value={instrument.kind}
          onChange={(value) => onChange({ kind: value })}
        />
      </div>
      <p className="hint">{kind?.description}</p>

      <WaveSlot
        label="A"
        waveId={instrument.waveA}
        reference={instrument.referenceA}
        instrument={instrument}
        library={library}
        onWaveChange={(id) => onChange({ waveA: id })}
        onReferenceChange={(hz) => onChange({ referenceA: hz })}
        onSelectWave={onSelectWave}
      />
      {instrument.kind !== 'single' && instrument.waveB && (
        <WaveSlot
          label="B"
          waveId={instrument.waveB}
          reference={instrument.referenceB}
          instrument={instrument}
          library={library}
          onWaveChange={(id) => onChange({ waveB: id })}
          onReferenceChange={(hz) => onChange({ referenceB: hz })}
          onSelectWave={onSelectWave}
        />
      )}

      <label className="field">
        <input
          type="checkbox"
          checked={instrument.followsPitch}
          onChange={(event) => onChange({ followsPitch: event.target.checked })}
        />
        <span>Follows the note’s pitch</span>
      </label>
      {!instrument.followsPitch && (
        <p className="hint">It plays at its reference pitch whatever the note. Good for drums.</p>
      )}
      <Slider
        label="Volume"
        min={0}
        max={2}
        step={0.01}
        value={instrument.volume}
        format={percent}
        onChange={(volume) => onChange({ volume })}
      />

      <h3>Volume envelope</h3>
      <EnvelopeControls
        envelope={instrument.volumeEnvelope}
        onChange={(volumeEnvelope) => onChange({ volumeEnvelope })}
      />

      {instrument.kind === 'morph' && (
        <>
          <h3>Morph envelope (A to B)</h3>
          <p className="hint">Same controls, but it moves the blend: 0% is all A, 100% is all B.</p>
          <EnvelopeControls
            envelope={instrument.morphEnvelope}
            onChange={(morphEnvelope) => onChange({ morphEnvelope })}
          />
          <Slider
            label="Amount of B"
            min={0}
            max={1}
            step={0.01}
            value={instrument.morphEnvelope.depth}
            format={percent}
            onChange={(depth) =>
              onChange({ morphEnvelope: { ...instrument.morphEnvelope, depth } })
            }
          />
        </>
      )}

      <h3>Pitch envelope</h3>
      <p className="hint">
        Starts off-pitch and glides to the note. A big drop is what makes a kick.
      </p>
      <Slider
        label="Start offset"
        min={-4800}
        max={4800}
        step={50}
        value={instrument.pitchEnvelope.startCents}
        format={(cents) => `${cents > 0 ? '+' : ''}${cents / 100} st`}
        onChange={(startCents) =>
          onChange({ pitchEnvelope: { ...instrument.pitchEnvelope, startCents } })
        }
      />
      <TimeSlider
        label="Glide time"
        max={0.6}
        value={instrument.pitchEnvelope.glideSeconds}
        onChange={(seconds) =>
          onChange({
            pitchEnvelope: { ...instrument.pitchEnvelope, glideSeconds: Math.max(0.005, seconds) },
          })
        }
      />

      <div className="row" style={{ marginTop: 16 }}>
        <button type="button" className="btn small" onClick={onDuplicate}>
          Duplicate
        </button>
        <button
          type="button"
          className="btn small danger"
          disabled={library.instruments.length < 2}
          onClick={onDelete}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function WaveSlot({
  label,
  waveId,
  reference,
  instrument,
  library,
  onWaveChange,
  onReferenceChange,
  onSelectWave,
}: {
  label: 'A' | 'B';
  waveId: string;
  reference: number;
  instrument: Instrument;
  library: SoundLibrary;
  onWaveChange(id: string): void;
  onReferenceChange(hz: number): void;
  onSelectWave(id: string): void;
}) {
  const wave = findWave(library, waveId);
  // The reference pitch matters for pitch pairs, fixed-pitch sounds and one-shots.
  const showReference =
    instrument.kind === 'pitchPair' || !instrument.followsPitch || wave?.kind === 'shot';
  return (
    <div className="slot">
      <span className="l">Wave {label}</span>
      <select
        aria-label={`Wave ${label}`}
        value={waveId}
        onChange={(event) => onWaveChange(event.target.value)}
      >
        {library.waves.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      {wave && (
        <WaveThumbnail wave={wave} title="Edit this wave" onClick={() => onSelectWave(waveId)} />
      )}
      {showReference && (
        <label className="hint">
          Reference{' '}
          <CommitInput
            type="number"
            min={20}
            max={12000}
            step={1}
            aria-label={`Reference pitch ${label} in Hz`}
            value={String(Math.round(reference * 100) / 100)}
            onCommit={(text) => {
              const hz = parseFloat(text);
              if (hz > 0) onReferenceChange(hz);
            }}
          />{' '}
          Hz
        </label>
      )}
    </div>
  );
}

/** A picture of an envelope with its four sliders. */
function EnvelopeControls<T extends Envelope | MorphEnvelope>({
  envelope,
  onChange,
}: {
  envelope: T;
  onChange(envelope: T): void;
}) {
  const set = (change: Partial<Envelope>) => onChange({ ...envelope, ...change });
  return (
    <>
      <EnvelopePicture className="envcv" envelope={envelope} />
      <TimeSlider
        label="Attack"
        max={1.5}
        value={envelope.attack}
        onChange={(attack) => set({ attack })}
      />
      <TimeSlider
        label="Decay"
        max={2}
        value={envelope.decay}
        onChange={(decay) => set({ decay })}
      />
      <Slider
        label="Sustain"
        min={0}
        max={1}
        step={0.01}
        value={envelope.sustain}
        format={percent}
        onChange={(sustain) => set({ sustain })}
      />
      <TimeSlider
        label="Release"
        max={2}
        value={envelope.release}
        onChange={(release) => set({ release })}
      />
    </>
  );
}
