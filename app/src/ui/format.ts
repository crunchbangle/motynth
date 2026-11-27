/** Seconds as m:ss, e.g. 75 → "1:15". */
export function formatTime(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** A short duration: milliseconds below a second, else seconds. */
export function formatDuration(seconds: number): string {
  return seconds < 1 ? `${Math.round(seconds * 1000)} ms` : `${seconds.toFixed(2)} s`;
}

/** Rounded to one decimal place, e.g. a tempo of 137.5. */
export const oneDecimal = (value: number): number => Math.round(value * 10) / 10;
