import { useEffect, useState } from 'react';
import type { SoundLibrary } from '../../sound/library.ts';
import { paletteEntry } from '../theme.ts';
import { WaveThumbnail } from './pictures.tsx';

interface SoundListsProps {
  library: SoundLibrary;
  selectedInstrument: string | undefined;
  selectedWave: string | undefined;
  onSelectInstrument(name: string): void;
  onSelectWave(id: string): void;
  onNewInstrument(): void;
  onNewWave(): void;
  onRestoreStarterSounds(): void;
}

/** The instrument and wave lists. */
export function SoundLists({
  library,
  selectedInstrument,
  selectedWave,
  onSelectInstrument,
  onSelectWave,
  onNewInstrument,
  onNewWave,
  onRestoreStarterSounds,
}: SoundListsProps) {
  return (
    <div className="panel" id="lists">
      <div className="listhead">
        <h2>Instruments</h2>
        <button type="button" className="btn small" onClick={onNewInstrument}>
          New
        </button>
      </div>
      <ul className="list" aria-label="Instruments">
        {library.instruments.map((instrument, k) => (
          <li key={instrument.name}>
            <button
              type="button"
              aria-current={instrument.name === selectedInstrument}
              onClick={() => onSelectInstrument(instrument.name)}
            >
              <i style={{ background: `var(${paletteEntry(k)})` }} />
              {instrument.name}
            </button>
          </li>
        ))}
      </ul>
      <div className="listhead">
        <h2>Waves</h2>
        <button type="button" className="btn small" onClick={onNewWave}>
          New
        </button>
      </div>
      <ul className="list" aria-label="Waves">
        {library.waves.map((wave) => (
          <li key={wave.id}>
            <button
              type="button"
              aria-current={wave.id === selectedWave}
              onClick={() => onSelectWave(wave.id)}
            >
              <WaveThumbnail wave={wave} />
              {wave.name}
            </button>
          </li>
        ))}
      </ul>
      <RestoreButton onRestore={onRestoreStarterSounds} />
    </div>
  );
}

/** How long the button waits for the confirming second click. */
const CONFIRM_MS = 3000;

/** Replaces all sounds, but only on a second click, as it can't be undone. */
function RestoreButton({ onRestore }: { onRestore(): void }) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  return (
    <button
      type="button"
      className="btn small"
      onClick={() => {
        if (!confirming) {
          setConfirming(true);
          return;
        }
        setConfirming(false);
        onRestore();
      }}
    >
      {confirming ? 'Click again to replace everything' : 'Restore starter sounds'}
    </button>
  );
}
