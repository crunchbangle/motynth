// React components for the canvas pictures in drawing.ts.

import { useEffect, useRef, type CanvasHTMLAttributes, type Ref } from 'react';
import type { Envelope } from '../../sound/instrument.ts';
import type { Wave } from '../../sound/wave.ts';
import { cssVar, useColorScheme } from '../theme.ts';
import {
  drawEnvelope,
  drawWaveGrid,
  drawWaveThumbnail,
  type CellColors,
  type PictureCanvas,
} from './drawing.ts';

function cellColors(): CellColors {
  return {
    background: cssVar('--cell-bg'),
    on: cssVar('--cell-on'),
    fill: cssVar('--cell-fill'),
    grid: cssVar('--cell-grid'),
    zero: cssVar('--cell-zero'),
  };
}

type CanvasProps = CanvasHTMLAttributes<HTMLCanvasElement>;

/**
 * A canvas showing `subject`, redrawn when it or the colour scheme changes.
 * `draw` must depend only on `subject`.
 */
function Picture<T>({
  subject,
  draw,
  canvasRef,
  ...props
}: CanvasProps & {
  subject: T;
  draw(canvas: HTMLCanvasElement, g: PictureCanvas, subject: T, colors: CellColors): void;
  canvasRef?: Ref<HTMLCanvasElement>;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  const scheme = useColorScheme();
  useEffect(() => {
    drawRef.current = draw;
  });
  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (canvas && g) drawRef.current(canvas, g, subject, cellColors());
  }, [subject, scheme]);
  return (
    <canvas
      ref={(canvas) => {
        ref.current = canvas;
        if (typeof canvasRef === 'function') canvasRef(canvas);
        else if (canvasRef) canvasRef.current = canvas;
      }}
      {...props}
    />
  );
}

export function WaveThumbnail({ wave, ...props }: CanvasProps & { wave: Wave }) {
  return <Picture {...props} subject={wave} draw={drawWaveThumbnail} />;
}

export function EnvelopePicture({ envelope, ...props }: CanvasProps & { envelope: Envelope }) {
  return <Picture {...props} subject={envelope} draw={drawEnvelope} />;
}

/** The editable wave grid. `canvasRef` gives the editor the element, to map pointer positions. */
export function WaveGridPicture({
  wave,
  canvasRef,
  ...props
}: CanvasProps & { wave: Wave; canvasRef?: Ref<HTMLCanvasElement> }) {
  return <Picture {...props} subject={wave} draw={drawWaveGrid} canvasRef={canvasRef} />;
}
