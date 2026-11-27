// Generates random Motynth programs from a seed, for comparing two engines.
// The programs are not meant to be musical, only to reach many parts of the
// language in many combinations. Some are invalid on purpose, so error
// messages and positions get compared too.

const INSTRUMENTS = ['pulse', 'tri', 'bass', 'pluck', 'keys', 'kick', 'hat'];
const MODES = ['major', 'minor', 'dorian', 'phrygian', 'pentatonic', 'blues', 'chromatic'];
const DURATIONS = ['q', 'e', 'h', 's', 'w', 't', 'q.', 'e.', 'h..', 'e*2/3', '1/8', '3/16', '2q'];
const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const MODIFIERS = [
  '+1',
  '+2',
  '-1',
  '~3',
  '~-2',
  '^1',
  '^-1',
  'rev',
  'inv',
  'x2',
  'x3',
  '*2',
  '/2',
  '*1.5',
];
const LANE_FLAGS = ['', '', 'loop', 'fit', 'sets-length'];

/** A small, fast, seedable pseudo-random generator (mulberry32). */
function makeRandom(seed: number) {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T;
  const chance = (p: number): boolean => next() < p;
  return { int, pick, chance };
}

type Random = ReturnType<typeof makeRandom>;

class ProgramGenerator {
  private readonly random: Random;
  private readonly names: string[] = [];
  private readonly useNoteNames: boolean;

  constructor(random: Random) {
    this.random = random;
    this.useNoteNames = random.chance(0.15);
  }

  program(): string {
    const lines: string[] = [];
    const r = this.random;
    if (r.chance(0.4)) lines.push(`tempo ${r.pick([60, 90, 110, 137.5])}`);
    if (r.chance(0.3)) lines.push(`mode ${r.pick(MODES)}`);
    if (r.chance(0.15)) lines.push(`root ${r.pick([220, 261.63, 440])}`);
    if (r.chance(0.08)) lines.push('tuning 13 of 3');
    if (this.useNoteNames) lines.push(`names [${NOTE_NAMES.join(' ')}]`);

    const definitions = r.int(0, 3);
    for (let k = 0; k < definitions; k++) {
      const name = `m${k}`;
      // Occasionally refer to a name before it is defined, or to itself.
      if (r.chance(0.05)) this.names.push(name);
      lines.push(`${r.chance(0.3) ? 'motif ' : ''}${name} = ${this.sequence(0)}`);
      if (!this.names.includes(name)) this.names.push(name);
    }

    const ending = r.int(0, 2);
    if (ending === 0) lines.push(`piece = ${this.sequence(0)}`);
    else if (ending === 1) lines.push(this.sequence(0));
    return lines.join('\n');
  }

  private sequence(depth: number): string {
    const count = this.random.int(1, depth > 1 ? 2 : 3);
    return Array.from({ length: count }, () => this.term(depth)).join(', ');
  }

  private term(depth: number): string {
    const r = this.random;
    let base: string;
    const roll = r.int(0, 9);
    if (roll <= 4 || depth >= 3) base = this.motif();
    else if (roll <= 5 && this.names.length) base = r.pick(this.names);
    else if (roll <= 7) base = this.section(depth + 1);
    else if (roll <= 8) base = this.withBlock(depth + 1);
    else base = `(${this.sequence(depth + 1)})`;

    if (r.chance(0.35)) base = `${r.pick(INSTRUMENTS)}: ${base}`;
    const modifiers = Array.from({ length: r.int(0, 2) }, () => r.pick(MODIFIERS));
    return [base, ...modifiers].join(' ');
  }

  private section(depth: number): string {
    const r = this.random;
    const lines: string[] = [];
    if (r.chance(0.3)) lines.push(`length ${r.pick(['1w', '2w', '3q', '1/2'])}`);
    const lanes = r.int(1, 4);
    for (let k = 0; k < lanes; k++) {
      if (r.chance(0.1) && depth < 3) {
        lines.push(`staff {\n${r.pick(INSTRUMENTS)}: ${this.motif()}\n}`);
        continue;
      }
      const flag = r.pick(LANE_FLAGS);
      lines.push(`${r.pick(INSTRUMENTS)}: ${this.term(depth + 1)}${flag ? ' ' + flag : ''}`);
    }
    return `${r.chance(0.8) ? 'section' : 'staff'} {\n${lines.join('\n')}\n}`;
  }

  private withBlock(depth: number): string {
    const r = this.random;
    const setting = r.pick([
      `mode ${r.pick(MODES)}`,
      `tempo ${r.pick([70, 140])}`,
      `root ${r.pick([200, 300])}`,
      'tuning 7 of 2',
      'mode [0 3 7]',
      // Modes that skip step 0 exercise the "below the first step" paths.
      'mode [2 5 9]',
      'mode [11 4]',
      'mode minor, tempo 80',
    ]);
    return `with ${setting} { ${this.sequence(depth)} }`;
  }

  private motif(): string {
    const r = this.random;
    const count = r.int(1, 8);
    const items: string[] = [];
    // A tie (_) needs a sounding note right before it. Mostly respect that,
    // but generate a stray tie now and then so the error is compared too.
    let afterNote = false;
    for (let k = 0; k < count; k++) {
      if ((afterNote && r.chance(0.12)) || r.chance(0.01)) {
        items.push(`_${this.duration()}`);
        continue;
      }
      const item = this.motifItem();
      items.push(item.text + this.duration());
      afterNote = item.isNote;
    }
    return `[${items.join(' ')}]`;
  }

  private motifItem(): { text: string; isNote: boolean } {
    const r = this.random;
    const roll = r.int(0, 19);
    if (roll === 0) return { text: r.pick(['.', 'r', 'rest']), isNote: false };
    if (roll === 1) return { text: 'x', isNote: true };
    if (roll === 2)
      return { text: `(${this.pitch()} ${this.pitch()} ${this.pitch()})`, isNote: true };
    if (roll === 3 && this.names.length) return { text: r.pick(this.names), isNote: false };
    return { text: this.pitch(), isNote: true };
  }

  private duration(): string {
    return this.random.chance(0.4) ? `:${this.random.pick(DURATIONS)}` : '';
  }

  private pitch(): string {
    const r = this.random;
    let pitch: string;
    if (this.useNoteNames && r.chance(0.5)) pitch = r.pick(NOTE_NAMES);
    else if (r.chance(0.1)) pitch = `n${r.int(0, 14)}`;
    else pitch = String(r.int(-2, 12)) + (r.chance(0.1) ? r.pick(['#', 'b', '##']) : '');
    if (r.chance(0.15)) pitch += `^${r.int(-1, 1)}`;
    return pitch;
  }
}

/** Returns `count` random programs; the same seed always gives the same programs. */
export function randomPrograms(seed: number, count: number): string[] {
  const random = makeRandom(seed);
  return Array.from({ length: count }, () => new ProgramGenerator(random).program());
}
