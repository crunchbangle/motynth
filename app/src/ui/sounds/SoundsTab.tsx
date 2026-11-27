import { useState } from 'react';
import {
  addWave,
  copyInstrument,
  deleteInstrument,
  deleteWave,
  findInstrument,
  findWave,
  renameInstrument,
  starterLibrary,
  updateInstrument,
  updateWave,
} from '../../sound/library.ts';
import { useSounds } from '../state/sounds.tsx';
import { InstrumentEditor } from './InstrumentEditor.tsx';
import { SoundLists } from './SoundLists.tsx';
import { TestBar } from './TestBar.tsx';
import { WaveEditor } from './WaveEditor.tsx';

/** Instruments and waves: lists, editors, and a test bar to hear changes. */
export function SoundsTab({ active }: { active: boolean }) {
  const { library, updateLibrary } = useSounds();
  const [selectedName, setSelectedName] = useState<string | undefined>();
  const [selectedWaveId, setSelectedWaveId] = useState<string | undefined>();

  // Fall back to the first item when nothing (or something since deleted) is selected.
  const instrument = findInstrument(library, selectedName ?? null) ?? library.instruments[0];
  const wave = findWave(library, selectedWaveId ?? null) ?? library.waves[0];

  const selectInstrument = (name: string) => {
    setSelectedName(name);
    // Show its main wave too.
    const main = findInstrument(library, name)?.waveA;
    if (main && findWave(library, main)) setSelectedWaveId(main);
  };

  const addInstrumentCopy = (baseName: string) => {
    const source = instrument ?? library.instruments[0];
    if (!source) return;
    const { library: next, name } = copyInstrument(library, source, baseName);
    updateLibrary(() => next);
    setSelectedName(name);
  };

  return (
    <>
      <TestBar instrument={instrument} library={library} active={active} />
      <div className="sounds">
        <SoundLists
          library={library}
          selectedInstrument={instrument?.name}
          selectedWave={wave?.id}
          onSelectInstrument={selectInstrument}
          onSelectWave={setSelectedWaveId}
          onNewInstrument={() => addInstrumentCopy('inst')}
          onNewWave={() => {
            const { library: next, id } = addWave(library);
            updateLibrary(() => next);
            setSelectedWaveId(id);
          }}
          onRestoreStarterSounds={() => {
            updateLibrary(() => starterLibrary());
            setSelectedName(undefined);
            setSelectedWaveId(undefined);
          }}
        />
        <InstrumentEditor
          // A fresh editor per instrument, so messages don't carry over.
          key={instrument?.name}
          instrument={instrument}
          library={library}
          onChange={(change) => {
            if (instrument) updateLibrary((lib) => updateInstrument(lib, instrument.name, change));
          }}
          onRename={(name) => {
            if (!instrument) return;
            updateLibrary((lib) => renameInstrument(lib, instrument.name, name));
            setSelectedName(name);
          }}
          onDuplicate={() => instrument && addInstrumentCopy(instrument.name)}
          onDelete={() => {
            if (instrument) updateLibrary((lib) => deleteInstrument(lib, instrument.name));
            setSelectedName(undefined);
          }}
          onSelectWave={setSelectedWaveId}
        />
        <WaveEditor
          key={wave?.id}
          wave={wave}
          canDelete={library.waves.length > 1}
          onChange={(change) => {
            if (wave) updateLibrary((lib) => updateWave(lib, wave.id, change));
          }}
          onDelete={() => {
            if (!wave) return;
            const next = deleteWave(library, wave.id);
            updateLibrary(() => next);
            setSelectedWaveId(next.waves[0]?.id);
          }}
        />
      </div>
    </>
  );
}
