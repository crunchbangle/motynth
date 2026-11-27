import { useEffect, useRef, useState } from 'react';
import type { CompiledPiece, NoteEvent } from '../../engine/index.ts';
import { findInstrument, type SoundLibrary } from '../../sound/library.ts';
import { useElementSize } from '../common/hooks.ts';
import { formatTime, oneDecimal } from '../format.ts';
import { useAudio, usePlayingId } from '../state/audio.tsx';
import { useSounds } from '../state/sounds.tsx';
import { cssVar, instrumentColorVar, paletteEntry, useColorScheme } from '../theme.ts';
import { drawRoll, layoutRoll, playheadX } from './roll.ts';

/** The roll's canvas sits inside a 2-pixel border. */
const BORDER = 2;

/**
 * Drums go in bands at the bottom: notes on instruments that don't follow
 * pitch, and hits (`x`) unless their instrument follows pitch.
 */
export function isUnpitched(library: SoundLibrary, event: NoteEvent): boolean {
  const instrument = findInstrument(library, event.instrument);
  if (instrument) return !instrument.followsPitch;
  return event.isHit;
}

interface PianoRollProps {
  /** Null while the code has errors. */
  piece: CompiledPiece | null;
  /** The playback id that moves the playhead. */
  playbackId: string;
}

/** The score: notes over time, a playhead while playing, a legend and some numbers. */
export function PianoRoll({ piece, playbackId }: PianoRollProps) {
  const { library } = useSounds();
  const scheme = useColorScheme();
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const size = useElementSize(box);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const empty = !piece || piece.events.length === 0;
  const width = size.width - BORDER * 2;
  const height = size.height - BORDER * 2;

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g || width <= 0 || height <= 0) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    g.setTransform(ratio, 0, 0, ratio, 0, 0);

    const background = cssVar('--cell-bg');
    if (empty) {
      g.fillStyle = background;
      g.fillRect(0, 0, width, height);
      return;
    }
    const layout = layoutRoll(piece, (e) => isUnpitched(library, e), width, height);
    const colors = new Map(
      library.instruments.map((instrument, k) => [instrument.name, cssVar(paletteEntry(k))]),
    );
    drawRoll(g, layout, {
      background,
      grid: cssVar('--cell-grid'),
      instrument: (name) => colors.get(name ?? '') ?? cssVar(paletteEntry(0)),
    });
    // `scheme` is a dependency so colours update when the system theme changes.
  }, [piece, empty, library, width, height, scheme]);

  return (
    <>
      <div className="roll-wrap" ref={setBox}>
        <canvas id="roll" ref={canvasRef} aria-label="Piano roll of the composition" />
        {piece && (
          <Playhead playbackId={playbackId} durationSeconds={piece.durationSeconds} width={width} />
        )}
        {empty && <div className="roll-empty">Your notes appear here once the code can play.</div>}
      </div>
      <div className="legend">
        {!empty &&
          piece.instrumentsUsed.map((name) => (
            <span key={name}>
              <i style={{ background: instrumentColorVar(library, name) }} />
              {name}
            </span>
          ))}
      </div>
      <div className="stats">
        {!empty && (
          <>
            <span>
              Length <b>{formatTime(piece.durationSeconds)}</b>
            </span>
            <span>
              Notes <b>{piece.events.length}</b>
            </span>
            <span>
              Tempo <b>{oneDecimal(piece.bpm)}</b>
            </span>
          </>
        )}
      </div>
    </>
  );
}

/** Follows the playback position, without re-rendering React on every frame. */
function Playhead({
  playbackId,
  durationSeconds,
  width,
}: {
  playbackId: string;
  durationSeconds: number;
  width: number;
}) {
  const { player } = useAudio();
  const playing = usePlayingId() === playbackId;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !playing) return;
    let frame = 0;
    const move = () => {
      const position = player.position();
      if (position !== null)
        element.style.left = `${playheadX(position, durationSeconds, width)}px`;
      frame = requestAnimationFrame(move);
    };
    move();
    return () => cancelAnimationFrame(frame);
  }, [playing, player, durationSeconds, width]);

  return <div id="playhead" ref={ref} style={{ display: playing ? 'block' : 'none' }} />;
}
