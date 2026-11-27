import type { ButtonHTMLAttributes } from 'react';

/** A pixel-art play or stop icon. */
export function PlayIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 8 8" aria-hidden="true">
      <path d={playing ? 'M1 1h6v6H1z' : 'M1 0h2v1h1v1h1v1h1v2H5v1H4v1H3v1H1z'} />
    </svg>
  );
}

interface PlayButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  playing: boolean;
  /** Label when not playing; it says "Stop" while playing. */
  label?: string;
}

/** A button that shows Play or Stop. */
export function PlayButton({
  playing,
  label = 'Play',
  className = 'btn',
  ...rest
}: PlayButtonProps) {
  return (
    <button type="button" className={className} aria-pressed={playing} {...rest}>
      <PlayIcon playing={playing} />
      <span>{playing ? 'Stop' : label}</span>
    </button>
  );
}
