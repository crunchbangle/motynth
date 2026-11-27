// Turns program text into a syntax tree (see ast.ts).
//
// The parser is scannerless: it reads characters directly instead of
// splitting the text into tokens first, because what a character means
// depends a lot on where it is (`.` is a rest inside a motif but a dot on a
// duration, `-` is a minus or part of a name, and so on).
//
// Newlines matter: they separate statements and the lines of a block. Commas
// also separate items. `//` starts a comment that runs to the end of the line.

import type {
  BlockNode,
  ChordItem,
  LengthLine,
  Modifier,
  MotifItem,
  MotifNode,
  PitchLiteral,
  PrimaryNode,
  SequenceNode,
  Setting,
  Statement,
  TermNode,
  WithNode,
  WordItem,
} from './ast.ts';
import { MotynthError } from './errors.ts';
import { Fraction } from './fraction.ts';
import { DURATION_LETTERS, KEYWORDS } from './language.ts';

/** Parses a whole program. Throws MotynthError if the text isn't valid. */
export function parseProgram(source: string): Statement[] {
  return new Parser(source).parseProgram();
}

// Sticky (`y`) patterns, matched at the current position only.
const NAME = /[A-Za-z_][A-Za-z0-9_]*(?:-[A-Za-z][A-Za-z0-9_]*)*/y;
const NUMBER = /\d+(?:\.\d+)?/y;
const INTEGER = /\d+/y;
/** One item in a motif: anything up to a space, bracket, colon or comma. */
const MOTIF_WORD = /[^\s[\]():,]+/y;

/** `3`, `n7`, `3#`, `2b^-1`, ... */
const PITCH_WORD = /^(n?)(-?\d+)([#b]*)(?:\^(-?\d+))?$/;
/** A note name or motif name, with an optional register: `Eb^1`. */
const NAME_WORD = /^([A-Za-z][A-Za-z0-9#_-]*)(?:\^(-?\d+))?$/;

const TWO = Fraction.of(2);

const isDigit = (c: string | undefined): boolean => c !== undefined && c >= '0' && c <= '9';
const isWordChar = (c: string | undefined): boolean => c !== undefined && /[A-Za-z0-9_]/.test(c);

class Parser {
  private readonly source: string;
  /** Current position in `source`. */
  private pos = 0;

  constructor(source: string) {
    this.source = source;
  }

  parseProgram(): Statement[] {
    const statements: Statement[] = [];
    this.skipSpacesAndNewlines();
    while (!this.atEnd()) {
      statements.push(this.parseStatement());
      this.skipSpaces();
      if (!this.atEnd() && this.char() !== '\n') {
        this.fail(
          `Unexpected ${this.describeHere()} — separate items with commas, or start a new line`,
        );
      }
      this.skipSpacesAndNewlines();
    }
    return statements;
  }

  // -------------------------------------------------------------------------
  // Statements

  private parseStatement(): Statement {
    const offset = this.pos;
    const word = this.peekName();

    if (word === 'motif') {
      this.pos += word.length;
      this.skipSpaces();
      const nameOffset = this.pos;
      const name = this.checkDefinableName(this.readName('a motif name'), nameOffset);
      this.expectChar('=', 'after the motif name');
      this.skipSpaces();
      return { type: 'definition', name, expression: this.parseSequence(), offset };
    }

    if (word === 'mode') {
      // Either a mode definition (`mode gloom = [...]`) or a mode setting.
      const start = this.pos;
      this.pos += word.length;
      this.skipSpaces();
      const name = this.peekName();
      if (name) {
        this.pos += name.length;
        this.skipSpaces();
        if (this.isAssignment()) {
          this.pos++;
          return { type: 'modeDefinition', name, steps: this.parseStepList(), offset };
        }
      }
      this.pos = start;
      return { type: 'setting', setting: this.parseSetting(), offset };
    }

    if (
      word === 'tuning' ||
      word === 'register' ||
      word === 'names' ||
      word === 'tempo' ||
      word === 'root'
    ) {
      return { type: 'setting', setting: this.parseSetting(), offset };
    }

    if (word === 'play') {
      this.pos += word.length;
      this.skipSpaces();
      return { type: 'expression', expression: this.parseSequence(), offset };
    }

    if (word) {
      // `name = ...` defines a name; otherwise the word starts an expression.
      const start = this.pos;
      this.pos += word.length;
      this.skipSpaces();
      if (this.isAssignment()) {
        this.checkDefinableName(word, offset);
        this.pos++;
        this.skipSpaces();
        return { type: 'definition', name: word, expression: this.parseSequence(), offset };
      }
      this.pos = start;
    }

    return { type: 'expression', expression: this.parseSequence(), offset };
  }

  /** At a single `=` (not `==`). */
  private isAssignment(): boolean {
    return this.char() === '=' && this.peek(1) !== '=';
  }

  private checkDefinableName(name: string, offset: number): string {
    if (KEYWORDS.has(name)) {
      this.fail(`"${name}" is a keyword and can’t be used as a name`, offset);
    }
    return name;
  }

  // -------------------------------------------------------------------------
  // Settings

  private parseSetting(): Setting {
    const offset = this.pos;
    const kind = this.readName('a setting');

    switch (kind) {
      case 'tuning': {
        const steps = parseInt(this.readNumber('the number of notes'), 10);
        if (steps < 1 || steps > 128) {
          this.fail('A tuning needs between 1 and 128 notes', offset);
        }
        let ratio: number | null = null;
        this.skipSpaces();
        if (this.peekName() === 'of') {
          this.pos += 'of'.length;
          ratio = parseFloat(this.readNumber('the register ratio'));
        }
        return { kind, stepsPerRegister: steps, registerRatio: ratio, offset };
      }
      case 'register':
        return {
          kind,
          registerRatio: parseFloat(this.readNumber('the register ratio')),
          offset,
        };
      case 'names':
        return { kind, names: this.parseNameList(), offset };
      case 'mode': {
        this.skipSpaces();
        if (this.char() === '[') {
          return { kind, mode: { steps: this.parseStepList() }, offset };
        }
        return { kind, mode: { name: this.readName('a mode name') }, offset };
      }
      case 'tempo': {
        const bpm = Fraction.parseDecimal(this.readNumber('the tempo')) as Fraction;
        if (bpm.numerator <= 0) this.fail('Tempo must be above zero', offset);
        return { kind, bpm, offset };
      }
      case 'root': {
        const hz = parseFloat(this.readNumber('the root frequency in Hz'));
        if (!(hz > 0)) this.fail('Root must be above zero', offset);
        return { kind, hz, offset };
      }
    }
    return this.fail(
      `Unknown setting "${kind}". Use tuning, register, names, mode, tempo or root`,
      offset,
    );
  }

  /** `[C Db D ...]` after `names`. */
  private parseNameList(): string[] {
    this.skipSpaces();
    if (this.char() !== '[') this.fail('Expected "[" after names');
    this.pos++;
    const names: string[] = [];
    for (;;) {
      this.skipSeparators();
      if (this.char() === ']') {
        this.pos++;
        return names;
      }
      if (this.atEnd()) this.fail('Missing "]"');
      names.push(this.readMotifWord());
    }
  }

  /** `[0 2 4 5 7 9 11]`: a list of tuning steps for a mode. */
  private parseStepList(): number[] {
    this.skipSpaces();
    if (this.char() !== '[') this.fail('Expected "[" to start a list of note numbers');
    this.pos++;
    const steps: number[] = [];
    for (;;) {
      this.skipSeparators();
      if (this.char() === ']') {
        this.pos++;
        return steps;
      }
      if (this.atEnd()) this.fail('Missing "]"');
      const digits = this.matchHere(INTEGER);
      if (!digits) this.fail(`Expected a whole number, found ${this.describeHere()}`);
      this.pos += digits.length;
      steps.push(parseInt(digits, 10));
    }
  }

  // -------------------------------------------------------------------------
  // Expressions

  /**
   * Terms separated by commas. Without `closing`, the sequence ends at the
   * end of the line (a trailing comma continues it on the next line). With
   * `closing`, it runs until that character, and newlines separate items too.
   */
  private parseSequence(closing?: ')' | '}'): SequenceNode {
    const offset = this.pos;
    const items: TermNode[] = [];
    for (;;) {
      if (closing) this.skipSpacesAndNewlines();
      else this.skipSpaces();
      if (closing && this.char() === closing) break;
      if (this.atEnd()) {
        if (closing) this.fail(`Missing "${closing}"`, offset);
        break;
      }
      items.push(this.parseTerm());
      this.skipSpaces();
      if (this.char() === ',') {
        this.pos++;
        this.skipSpacesAndNewlines();
        continue;
      }
      if (closing) {
        if (this.char() === '\n' || this.char() === closing) continue;
        this.fail(`Unexpected ${this.describeHere()} — separate items with commas or new lines`);
      }
      break;
    }
    if (!closing && items.length === 0) {
      this.fail(`Expected something to play, found ${this.describeHere()}`);
    }
    return { type: 'sequence', items, offset };
  }

  private parseTerm(): TermNode {
    this.skipSpaces();
    const offset = this.pos;
    const base = this.parsePrimary();
    const modifiers = this.parseModifiers();
    return { type: 'term', base, modifiers, offset };
  }

  private parsePrimary(): PrimaryNode {
    this.skipSpaces();
    const offset = this.pos;

    if (this.char() === '[') {
      this.pos++;
      return this.parseMotif(offset);
    }
    if (this.char() === '(') {
      this.pos++;
      const sequence = this.parseSequence(')');
      this.expectChar(')');
      return sequence;
    }

    const word = this.peekName();
    if (!word) {
      this.fail(
        this.atEnd()
          ? 'Expected a motif, a name or a block, but the line ended'
          : `Unexpected "${this.char()}" — expected a motif, a name or a block`,
      );
    }

    if (word === 'section' || word === 'staff') {
      this.pos += word.length;
      return this.parseBlock(word, offset);
    }
    if (word === 'with') {
      this.pos += word.length;
      return this.parseWith(offset);
    }
    if (word === 'rest') {
      this.pos += word.length;
      this.skipSpaces();
      return { type: 'rest', duration: this.parseDuration(true), offset };
    }

    this.pos += word.length;
    this.skipSpaces();
    if (this.char() === ':' && this.peek(1) !== ':') {
      this.pos++;
      return { type: 'instrument', name: word, term: this.parseTerm(), offset };
    }
    return { type: 'reference', name: word, offset };
  }

  private parseBlock(kind: 'section' | 'staff', offset: number): BlockNode {
    this.expectChar('{', `after ${kind}`);
    const items: (TermNode | LengthLine)[] = [];
    for (;;) {
      this.skipSeparators();
      if (this.char() === '}') break;
      if (this.atEnd()) this.fail('Missing "}"');
      if (this.peekName() === 'length') {
        const lineOffset = this.pos;
        this.pos += 'length'.length;
        this.skipSpaces();
        items.push({ type: 'length', duration: this.parseDuration(true), offset: lineOffset });
      } else {
        items.push(this.parseTerm());
      }
      this.skipSpaces();
      if (!this.atEnd() && this.char() !== '\n' && this.char() !== ',' && this.char() !== '}') {
        this.fail(`Unexpected ${this.describeHere()} — put each block on its own line`);
      }
    }
    this.expectChar('}');
    return { type: 'block', kind, items, offset };
  }

  /** After `with`: one or more settings, then `{ ... }`. */
  private parseWith(offset: number): WithNode {
    const settings: Setting[] = [];
    for (;;) {
      this.skipSpaces();
      settings.push(this.parseSetting());
      this.skipSpaces();
      if (this.char() === ',') {
        this.pos++;
        continue;
      }
      if (this.char() === '{') break;
      if (this.peekName()) continue;
      this.fail(`Expected "," or "{" after the setting, found ${this.describeHere()}`);
    }
    this.expectChar('{');
    const body = this.parseSequence('}');
    this.expectChar('}', 'to close the with block');
    return { type: 'with', settings, body, offset };
  }

  private parseModifiers(): Modifier[] {
    const modifiers: Modifier[] = [];
    for (;;) {
      this.skipSpaces();
      const c = this.char();
      const offset = this.pos;

      if ((c === '+' || c === '-') && isDigit(this.peek(1))) {
        modifiers.push({ type: 'shiftDegrees', amount: this.readSignedInteger(), offset });
        continue;
      }
      if (c === '~') {
        this.pos++;
        modifiers.push({ type: 'shiftSteps', amount: this.readSignedInteger(), offset });
        continue;
      }
      if (c === '^') {
        this.pos++;
        modifiers.push({ type: 'shiftRegisters', amount: this.readSignedInteger(), offset });
        continue;
      }
      if (c === '*' && isDigit(this.peek(1))) {
        // `*2` plays twice as fast: every time is multiplied by 1/2.
        this.pos++;
        const speed = Fraction.parseDecimal(this.readNumber()) as Fraction;
        modifiers.push({ type: 'scale', factor: Fraction.ONE.dividedBy(speed), offset });
        continue;
      }
      if (c === '/' && this.peek(1) !== '/') {
        this.pos++;
        const factor = Fraction.parseDecimal(this.readNumber()) as Fraction;
        if (factor.isZero()) this.fail('Can’t divide by zero', offset);
        modifiers.push({ type: 'scale', factor, offset });
        continue;
      }

      const word = this.peekName();
      const simple = word ? SIMPLE_MODIFIERS.get(word) : undefined;
      if (word && simple) {
        this.pos += word.length;
        modifiers.push({ type: simple, offset });
        continue;
      }
      if (word && /^x\d+$/.test(word)) {
        this.pos += word.length;
        const times = parseInt(word.slice(1), 10);
        if (times < 1) this.fail('Repeat at least once', offset);
        modifiers.push({ type: 'repeat', times, offset });
        continue;
      }
      return modifiers;
    }
  }

  // -------------------------------------------------------------------------
  // Motifs

  /** After `[`. `offset` is the position of the `[`. */
  private parseMotif(offset: number): MotifNode {
    const items: MotifItem[] = [];
    for (;;) {
      this.skipSeparators();
      if (this.char() === ']') {
        this.pos++;
        break;
      }
      if (this.atEnd()) this.fail('This motif is missing its closing "]"', offset);

      const itemOffset = this.pos;
      let item: MotifItem;
      if (this.char() === '(') {
        item = this.parseChord(itemOffset);
      } else {
        const word = this.readMotifWord();
        if (word === '.' || word === 'rest' || word === 'r')
          item = { type: 'rest', offset: itemOffset };
        else if (word === '_') item = { type: 'tie', offset: itemOffset };
        else if (word === 'x') item = { type: 'hit', offset: itemOffset };
        else item = this.pitchFromWord(word, itemOffset);
      }

      this.skipSpaces();
      if (this.char() === ':') {
        this.pos++;
        this.skipSpaces();
        item.duration = this.parseDuration(false);
      }
      items.push(item);
    }
    return { type: 'motif', items, offset };
  }

  /** `(1 3 5)` */
  private parseChord(offset: number): ChordItem {
    this.pos++;
    const pitches: (PitchLiteral | WordItem)[] = [];
    for (;;) {
      this.skipSpacesAndNewlines();
      if (this.char() === ')') {
        this.pos++;
        break;
      }
      if (this.atEnd()) this.fail('Missing ")" after chord', offset);
      const pitchOffset = this.pos;
      pitches.push(this.pitchFromWord(this.readMotifWord(), pitchOffset));
    }
    if (pitches.length === 0) this.fail('Empty chord', offset);
    return { type: 'chord', pitches, offset };
  }

  private pitchFromWord(word: string, offset: number): PitchLiteral | WordItem {
    const pitch = PITCH_WORD.exec(word);
    if (pitch) {
      const [, stepPrefix = '', value = '0', accidentals = '', register] = pitch;
      const sharps = accidentals.split('#').length - 1;
      const flats = accidentals.split('b').length - 1;
      return {
        type: 'pitch',
        kind: stepPrefix ? 'step' : 'degree',
        value: parseInt(value, 10),
        accidental: sharps - flats,
        register: register ? parseInt(register, 10) : 0,
        offset,
      };
    }
    const name = NAME_WORD.exec(word);
    if (name) {
      const [, text = '', register] = name;
      return { type: 'word', name: text, register: register ? parseInt(register, 10) : 0, offset };
    }
    return this.fail(`Can’t read "${word}" as a note`, offset);
  }

  private readMotifWord(): string {
    const word = this.matchHere(MOTIF_WORD);
    if (!word) this.fail(`Unexpected ${this.describeHere()} in motif`);
    this.pos += word.length;
    return word;
  }

  // -------------------------------------------------------------------------
  // Durations

  /**
   * A duration: a letter (`q`), a number of whole notes (`3/16`, `1.5`), or a
   * number times a letter (`2q`, or `2 q` when `allowSpace` is set, as after
   * `rest` and `length`). Then any dots (each adds half of the last addition)
   * and an optional multiplier such as `*2/3` for triplets.
   */
  private parseDuration(allowSpace: boolean): Fraction {
    let value: Fraction;

    if (isDigit(this.char())) {
      const amount = Fraction.parseDecimal(this.consume(NUMBER)) as Fraction;
      if (this.char() === '/' && isDigit(this.peek(1))) {
        this.pos++;
        value = amount.dividedBy(Fraction.of(parseInt(this.consume(INTEGER), 10)));
      } else {
        let unit: Fraction | undefined;
        if (allowSpace) {
          const start = this.pos;
          this.skipSpaces();
          const word = this.peekName();
          unit = word ? DURATION_LETTERS.get(word) : undefined;
          if (word && unit) this.pos += word.length;
          else this.pos = start;
        } else {
          const letter = this.char();
          unit = letter !== undefined ? DURATION_LETTERS.get(letter) : undefined;
          if (unit && !isWordChar(this.peek(1))) this.pos++;
          else unit = undefined;
        }
        value = unit ? amount.times(unit) : amount;
      }
    } else {
      const letter = this.char();
      const unit = letter !== undefined ? DURATION_LETTERS.get(letter) : undefined;
      if (!unit || isWordChar(this.peek(1))) {
        this.fail(`Expected a duration such as q, e, h or 1/8, found ${this.describeHere()}`);
      }
      this.pos++;
      value = unit;
    }

    let added = value;
    while (this.char() === '.') {
      this.pos++;
      added = added.dividedBy(TWO);
      value = value.plus(added);
    }

    if (this.char() === '*') {
      this.pos++;
      const text = this.matchHere(NUMBER);
      if (!text) this.fail('Expected a number after *');
      this.pos += text.length;
      let factor = Fraction.parseDecimal(text) as Fraction;
      if (this.char() === '/' && isDigit(this.peek(1))) {
        this.pos++;
        factor = factor.dividedBy(Fraction.of(parseInt(this.consume(INTEGER), 10)));
      }
      value = value.times(factor);
    }

    if (value.numerator <= 0) this.fail('A duration must be longer than zero');
    return value;
  }

  // -------------------------------------------------------------------------
  // Low-level reading

  private char(): string | undefined {
    return this.source[this.pos];
  }

  private peek(ahead: number): string | undefined {
    return this.source[this.pos + ahead];
  }

  private atEnd(): boolean {
    return this.pos >= this.source.length;
  }

  private fail(message: string, offset: number = this.pos): never {
    throw new MotynthError(message, offset);
  }

  /** How to show the current character in an error message. */
  private describeHere(): string {
    if (this.atEnd()) return 'the end';
    if (this.char() === '\n') return 'the end of the line';
    return `"${this.char()}"`;
  }

  /** Skips spaces, tabs and comments, but not newlines. */
  private skipSpaces(): void {
    for (;;) {
      const c = this.char();
      if (c === ' ' || c === '\t' || c === '\r') {
        this.pos++;
      } else if (c === '/' && this.peek(1) === '/') {
        while (!this.atEnd() && this.char() !== '\n') this.pos++;
      } else {
        return;
      }
    }
  }

  private skipSpacesAndNewlines(): void {
    for (;;) {
      this.skipSpaces();
      if (this.char() !== '\n') return;
      this.pos++;
    }
  }

  /** Skips whitespace, newlines and commas between list items. */
  private skipSeparators(): void {
    this.skipSpacesAndNewlines();
    while (this.char() === ',') {
      this.pos++;
      this.skipSpacesAndNewlines();
    }
  }

  /** The text `pattern` matches at the current position, without consuming it. */
  private matchHere(pattern: RegExp): string | null {
    pattern.lastIndex = this.pos;
    const match = pattern.exec(this.source);
    return match ? match[0] : null;
  }

  /** Consumes text the caller already knows `pattern` matches here. */
  private consume(pattern: RegExp): string {
    const text = this.matchHere(pattern) ?? '';
    this.pos += text.length;
    return text;
  }

  private peekName(): string | null {
    return this.matchHere(NAME);
  }

  private readName(what = 'a name'): string {
    const name = this.peekName();
    if (!name) this.fail(`Expected ${what}`);
    this.pos += name.length;
    return name;
  }

  private expectChar(expected: string, context?: string): void {
    this.skipSpaces();
    if (this.char() !== expected) {
      this.fail(
        `Expected "${expected}"${context ? ' ' + context : ''}, found ${this.describeHere()}`,
      );
    }
    this.pos++;
  }

  private readNumber(what?: string): string {
    this.skipSpaces();
    const text = this.matchHere(NUMBER);
    if (!text) {
      this.fail(`Expected a number${what ? ' for ' + what : ''}, found ${this.describeHere()}`);
    }
    this.pos += text.length;
    return text;
  }

  /** An integer with an optional sign, directly at the current position. */
  private readSignedInteger(): number {
    let sign = 1;
    if (this.char() === '-') {
      sign = -1;
      this.pos++;
    } else if (this.char() === '+') {
      this.pos++;
    }
    const digits = this.matchHere(INTEGER);
    if (!digits) this.fail('Expected a whole number');
    this.pos += digits.length;
    return sign * parseInt(digits, 10);
  }
}

/** Modifiers that are a single word. */
const SIMPLE_MODIFIERS: ReadonlyMap<string, 'reverse' | 'invert' | 'fit' | 'loop' | 'setsLength'> =
  new Map([
    ['rev', 'reverse'],
    ['inv', 'invert'],
    ['fit', 'fit'],
    ['loop', 'loop'],
    ['sets-length', 'setsLength'],
  ]);
