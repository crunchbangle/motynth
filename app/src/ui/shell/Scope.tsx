import { useEffect, useRef } from 'react';
import { useAudio } from '../state/audio.tsx';

// Fixed colours: the scope is always drawn on the dark header.
const BACKGROUND = '#0a0c1b';
const TRACE = '#2ed3bf';
const IDLE_LINE = '#3b4380';

/** A tiny oscilloscope showing the audio output, in the header. */
export function Scope() {
  const { player, scope } = useAudio();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    const samples = new Uint8Array(scope.waveformSize);
    let frame = 0;

    const draw = () => {
      const { width, height } = canvas;
      g.fillStyle = BACKGROUND;
      g.fillRect(0, 0, width, height);
      if (player.playingId !== null && scope.readWaveform(samples)) {
        // Half the buffer across the width; one 2-pixel dot per column.
        g.fillStyle = TRACE;
        for (let x = 0; x < width; x++) {
          const value = (samples[Math.floor((x / width) * samples.length * 0.5)] ?? 128) / 255;
          const y = Math.round((1 - value) * (height - 2));
          g.fillRect(x, Math.min(Math.max(y, 0), height - 2), 1, 2);
        }
      } else {
        g.fillStyle = IDLE_LINE;
        g.fillRect(0, height / 2, width, 1);
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [player, scope]);

  return <canvas id="scope" ref={canvasRef} width={48} height={16} aria-hidden="true" />;
}
