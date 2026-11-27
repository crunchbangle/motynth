/**
 * An exact rational number. All musical time is kept as fractions of a whole
 * note, so triplets and other tuplets add up exactly and never drift.
 *
 * Fractions are immutable and always stored in lowest terms with a positive
 * denominator.
 */
export class Fraction {
  readonly numerator: number;
  readonly denominator: number;

  private constructor(numerator: number, denominator: number) {
    this.numerator = numerator;
    this.denominator = denominator;
  }

  static of(numerator: number, denominator = 1): Fraction {
    if (denominator < 0) {
      numerator = -numerator;
      denominator = -denominator;
    }
    const divisor = greatestCommonDivisor(numerator, denominator);
    return new Fraction(numerator / divisor, denominator / divisor);
  }

  static readonly ZERO = Fraction.of(0);
  static readonly ONE = Fraction.of(1);

  /** Parses a plain decimal such as "3" or "1.25"; returns null for anything else. */
  static parseDecimal(text: string): Fraction | null {
    const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
    if (!match) return null;
    const whole = match[1] ?? '';
    const decimals = match[2] ?? '';
    return Fraction.of(parseInt(whole + decimals, 10), 10 ** decimals.length);
  }

  static max(a: Fraction, b: Fraction): Fraction {
    return b.isGreaterThan(a) ? b : a;
  }

  plus(other: Fraction): Fraction {
    return Fraction.of(
      this.numerator * other.denominator + other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  minus(other: Fraction): Fraction {
    return Fraction.of(
      this.numerator * other.denominator - other.numerator * this.denominator,
      this.denominator * other.denominator,
    );
  }

  times(other: Fraction): Fraction {
    return Fraction.of(this.numerator * other.numerator, this.denominator * other.denominator);
  }

  dividedBy(other: Fraction): Fraction {
    return Fraction.of(this.numerator * other.denominator, this.denominator * other.numerator);
  }

  /** Negative if this is smaller than `other`, zero if equal, positive if larger. */
  compare(other: Fraction): number {
    return this.numerator * other.denominator - other.numerator * this.denominator;
  }

  isLessThan(other: Fraction): boolean {
    return this.compare(other) < 0;
  }

  isGreaterThan(other: Fraction): boolean {
    return this.compare(other) > 0;
  }

  isZero(): boolean {
    return this.numerator === 0;
  }

  toNumber(): number {
    return this.numerator / this.denominator;
  }

  toString(): string {
    return this.denominator === 1 ? `${this.numerator}` : `${this.numerator}/${this.denominator}`;
  }
}

function greatestCommonDivisor(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) {
    [a, b] = [b, a % b];
  }
  return a || 1;
}
