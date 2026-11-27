// Form controls used by the sound editors.

import { formatDuration } from '../format.ts';

interface SliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format(value: number): string;
  onChange(value: number): void;
}

/** A labelled range slider that shows its value. */
export function Slider({ label, min, max, step, value, format, onChange }: SliderProps) {
  return (
    <label className="sl">
      <span className="sl-l">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(parseFloat(event.target.value))}
      />
      <output>{format(value)}</output>
    </label>
  );
}

/** Slider positions for time sliders run from 0 to this. */
const TIME_STEPS = 1000;

/**
 * A slider for a time from 0 to `max` seconds. The scale is squared, so
 * short times, which matter most for envelopes, get most of the travel.
 */
export function TimeSlider({
  label,
  max,
  value,
  onChange,
}: {
  label: string;
  max: number;
  value: number;
  onChange(seconds: number): void;
}) {
  const toPosition = (seconds: number) =>
    Math.round(Math.sqrt(Math.min(1, Math.max(0, seconds / max))) * TIME_STEPS);
  const toSeconds = (position: number) =>
    Math.round((position / TIME_STEPS) ** 2 * max * 1000) / 1000;
  return (
    <Slider
      label={label}
      min={0}
      max={TIME_STEPS}
      step={1}
      value={toPosition(value)}
      format={(position) => formatDuration(toSeconds(position))}
      onChange={(position) => onChange(toSeconds(position))}
    />
  );
}

/** A row of buttons where one is pressed, like radio buttons. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange(value: T): void;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export const percent = (value: number): string => `${Math.round(value * 100)}%`;
