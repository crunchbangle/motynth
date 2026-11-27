import { useEffect, useRef, useState } from 'react';
import { compile } from '../../engine/index.ts';
import type { Instrument } from '../../sound/instrument.ts';
import type { SoundLibrary } from '../../sound/library.ts';
import { PlayButton } from '../common/PlayButton.tsx';
import { useAudio, usePlay, usePlayingId } from '../state/audio.tsx';

export const TEST_PLAYBACK = 'test';

/** Motifs to try a sound with. */
export const TEST_MOTIFS: readonly { name: string; motif: string }[] = [
  { name: 'Melody', motif: '[1:e 3 5 8 5 3 1:q]' },
  { name: 'Scale', motif: '[1:e 2 3 4 5 6 7 8:q]' },
  { name: 'Chords', motif: '[(1 3 5):h (2 4 6):h]' },
  { name: 'Low line', motif: '[1:e 1 5 1 4 1 5:q]' },
  { name: 'Hits', motif: '[x:q x x:e x x:q]' },
];

/** After a change to the sounds, wait this long before playing the test again. */
const AUTO_PLAY_DELAY_MS = 380;

interface TestBarProps {
  /** The instrument being edited; the test plays every note on it. */
  instrument: Instrument | undefined;
  /** Changes to this trigger an automatic replay. */
  library: SoundLibrary;
  /** Only replay automatically while the Sounds tab is showing. */
  active: boolean;
}

/** Plays a short motif on the current instrument, and again after each change. */
export function TestBar({ instrument, library, active }: TestBarProps) {
  const { player } = useAudio();
  const play = usePlay();
  const playing = usePlayingId() === TEST_PLAYBACK;
  const [motif, setMotif] = useState(TEST_MOTIFS[0]?.motif ?? '');
  const [octave, setOctave] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [message, setMessage] = useState('');
  /** The motif as it was last played, to replay when it is edited. */
  const lastPlayed = useRef(motif);

  const playTest = (testMotif = motif, testOctave = octave) => {
    if (!instrument) return;
    lastPlayed.current = testMotif;
    setMessage('');
    const result = compile(`piece = (${testMotif})^${testOctave}`);
    if (!result.ok) {
      setMessage(result.error.message);
      return;
    }
    play(TEST_PLAYBACK, result, { instrument });
  };

  // Replay shortly after the sounds or the chosen instrument change.
  const latestPlay = useRef(playTest);
  useEffect(() => {
    latestPlay.current = playTest;
  });
  const instrumentName = instrument?.name;
  const previous = useRef({ library, instrumentName });
  useEffect(() => {
    // Compare with the last run rather than skipping the first, so React's
    // development double-run of effects doesn't play on page load.
    const changed =
      previous.current.library !== library || previous.current.instrumentName !== instrumentName;
    previous.current = { library, instrumentName };
    if (!changed || !autoPlay || !active) return;
    const timer = setTimeout(() => latestPlay.current(), AUTO_PLAY_DELAY_MS);
    return () => clearTimeout(timer);
  }, [library, instrumentName, autoPlay, active]);

  const replayIfEdited = () => {
    if (motif !== lastPlayed.current) playTest();
  };

  return (
    <div className="panel testbar">
      <PlayButton
        className="btn primary"
        label="Play test"
        playing={playing}
        onClick={() => (playing ? player.stop() : playTest())}
      />
      <input
        type="text"
        value={motif}
        onChange={(event) => setMotif(event.target.value)}
        onBlur={replayIfEdited}
        onKeyDown={(event) => event.key === 'Enter' && playTest()}
        spellCheck={false}
        aria-label="Test motif"
      />
      <select
        aria-label="Test motif presets"
        onChange={(event) => {
          const preset = TEST_MOTIFS[Number(event.target.value)];
          if (!preset) return;
          setMotif(preset.motif);
          playTest(preset.motif);
        }}
      >
        {TEST_MOTIFS.map((preset, k) => (
          <option key={preset.name} value={k}>
            {preset.name}
          </option>
        ))}
      </select>
      <label>
        Octave{' '}
        <input
          type="number"
          className="oct"
          value={octave}
          min={-3}
          max={3}
          step={1}
          onChange={(event) => {
            const next = parseInt(event.target.value, 10) || 0;
            setOctave(next);
            playTest(motif, next);
          }}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={autoPlay}
          onChange={(event) => setAutoPlay(event.target.checked)}
        />{' '}
        Play after each change
      </label>
      <span className="warn" role="alert">
        {message}
      </span>
    </div>
  );
}
