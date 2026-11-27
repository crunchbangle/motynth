// Envelope shapes over the length of a note.

import type { Envelope } from './instrument.ts';

/** A point on an envelope: seconds after the note starts, and level. */
export type EnvelopePoint = readonly [time: number, level: number];

export interface EnvelopeShape {
  /** Starts at [0, 0] and ends at [end, 0]. */
  points: EnvelopePoint[];
  /** When the release has finished, in seconds after the note starts. */
  end: number;
}

// Very short stages click, so each has a minimum length.
const MIN_ATTACK = 0.002;
const MIN_DECAY = 0.002;
const MIN_RELEASE = 0.006;

/**
 * The attack-decay-sustain-release shape of a note lasting `noteSeconds`,
 * rising to `peak`. A note shorter than the attack (or attack plus decay)
 * releases from wherever it has got to.
 */
export function envelopeShape(
  envelope: Envelope,
  noteSeconds: number,
  peak: number,
): EnvelopeShape {
  const attack = Math.max(envelope.attack, MIN_ATTACK);
  const decay = Math.max(envelope.decay, MIN_DECAY);
  const release = Math.max(envelope.release, MIN_RELEASE);
  const sustain = envelope.sustain * peak;

  const points: EnvelopePoint[] = [[0, 0]];
  if (noteSeconds <= attack) {
    points.push([noteSeconds, (peak * noteSeconds) / attack]);
  } else if (noteSeconds <= attack + decay) {
    points.push([attack, peak]);
    points.push([noteSeconds, peak + (sustain - peak) * ((noteSeconds - attack) / decay)]);
  } else {
    points.push([attack, peak], [attack + decay, sustain], [noteSeconds, sustain]);
  }
  points.push([noteSeconds + release, 0]);
  return { points, end: noteSeconds + release };
}
