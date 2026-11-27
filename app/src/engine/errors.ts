/**
 * A mistake in a Motynth program. `offset` is the position in the source text
 * (in UTF-16 code units) that the message refers to.
 */
export class MotynthError extends Error {
  readonly offset: number;

  constructor(message: string, offset: number) {
    super(message);
    this.name = 'MotynthError';
    this.offset = offset;
  }
}
