// The Learn tab's lessons: paragraphs and playable code snippets. The last
// lesson shows the quick reference (see reference.ts) instead.

import { VERSE_BRIDGE_OUTRO } from './examples.ts';

export type LessonBlock = { type: 'text'; text: string } | { type: 'code'; code: string };

export interface Lesson {
  id: string;
  title: string;
  blocks: LessonBlock[];
  /** Shows the quick reference instead of blocks. */
  isReference?: boolean;
}

const text = (value: string): LessonBlock => ({ type: 'text', text: value });
const code = (value: string): LessonBlock => ({ type: 'code', code: value });

export const LESSONS: readonly Lesson[] = [
  {
    id: 'first',
    title: 'Your first notes',
    blocks: [
      text(
        'A Motynth piece is text. Write an instrument name, a colon, then a motif in square brackets. Numbers are degrees of the current scale: 1 is the tonic, 2 the next note up, and so on. Degree 8 wraps around to the tonic one octave higher.',
      ),
      code('pulse: [1 2 3 4 5 6 7 8]'),
      text(
        'Swap pulse for tri, bass, pluck or keys to hear the other starter instruments. Everything is built from the waveforms in the Sounds tab, where you can draw your own.',
      ),
      code('tri: [1 3 5 3 1]'),
      text(
        'Press Play in the header, or Ctrl+Enter inside the editor. Nothing else is needed: a line that plays something is a whole piece.',
      ),
    ],
  },
  {
    id: 'motifs',
    title: 'Motifs and durations',
    blocks: [
      text(
        'After a colon, a duration. The letters are w (whole), h (half), q (quarter), e (eighth), s (sixteenth) and t (thirty-second). A duration sticks to the notes after it until you change it, so you only write it when it changes.',
      ),
      code(`motif hook = [1:e 2 3 4 5:q 3 1:h]
pluck: hook`),
      text(
        'A dot after the letter lengthens it by half. A dot on its own is a rest, and so is the word rest. An underscore ties the previous note onward. Parentheses make a chord.',
      ),
      code('keys: [(1 3 5):h .:q (4 6 8):h  1:q. _:e 2:h]'),
      text(
        'For triplets, multiply: e*2/3 is an eighth squeezed to two thirds of its length, so three of them fill a quarter. Durations are exact fractions, so nothing drifts out of sync.',
      ),
      code('pulse: [1:e*2/3 2 3 4:q 5]'),
      text(
        'A motif can also contain another motif by name. Give it a duration and the whole thing is squeezed to fit.',
      ),
      code(`a = [1:e 3 5 3]
b = [a 4:q 2:q a:q]
pluck: b`),
    ],
  },
  {
    id: 'scopes',
    title: 'Tunings, modes and names',
    blocks: [
      text(
        'Pitch comes in layers. A tuning splits a register into equal steps: tuning 12 of 2 is the usual octave of 12 notes. A mode picks some of those steps as the scale. Degrees count through the mode, so the same motif can change character just by changing the mode around it.',
      ),
      code(`hook = [1:e 3 5 3 2 4 6 4]
with mode major { pluck: hook },
with mode minor { pluck: hook },
with mode phrygian { pluck: hook }`),
      text(
        'with opens a scope. Inside the braces the setting has a new value; outside, the old one is back. You can scope tuning, register, names, mode, tempo and root (the tonic frequency in Hz). Built-in modes: major, minor, dorian, phrygian, lydian, mixolydian, locrian, harmonic-minor, pentatonic, minor-pentatonic, blues, whole-tone and chromatic. Define your own with a list of step numbers.',
      ),
      code(`mode gloom = [0 1 4 5 7 8 11]
with mode gloom { tri: [1 2 3 4 5 6 7 8] }`),
      text(
        'Writing n7 means “step 7 of the tuning, ignoring the mode”. If a mode can’t express a pitch, n lets you reach it. Name the steps with names and you can write them directly. # and b nudge a degree by one step.',
      ),
      code(`names [C Db D Eb E F Gb G Ab A Bb B]
pulse: [C E G C^1  Eb G Bb Eb^1]`),
      text(
        'Nothing says the register is an octave. Here is the Bohlen–Pierce scale: thirteen steps across a 3:1 register. Changing the tuning resets the mode to “chromatic” (every step), so degrees 1 to 13 walk the whole register.',
      ),
      code('with tuning 13 of 3 { pluck: [1 3 5 7 9 11 13 14] }'),
    ],
  },
  {
    id: 'transpose',
    title: 'Transposing and transforming',
    blocks: [
      text(
        'Any motif, section or name can take modifiers after it. +2 moves up two degrees of the mode (tonal, a “sequence”): the intervals bend to stay in the scale. ~2 moves up two steps of the tuning (chromatic): the intervals keep their size and may leave the scale. ^1 moves up one register.',
      ),
      code(`hook = [1:e 2 3 5 3 2 1:q]
pluck: (hook, hook +2, hook ~2, hook ^1)`),
      text(
        'The rest change the music itself. rev plays backwards, inv flips the contour (around the first note, within the mode), x3 repeats three times, *2 doubles the speed and /2 halves it. They chain left to right.',
      ),
      code(`hook = [1:e 2 3 5 3 2 1:q]
pluck: (hook, hook rev, hook inv, hook x2 *2)`),
      text(
        'Because the transposition is a scope setting under the hood, it works on whatever is inside, including sections, and it respects the mode in force where the name is used.',
      ),
      code(`hook = [1:e 3 5 8 5 3 1:q]
tri: (hook, with mode minor { hook +2 }, hook)`),
    ],
  },
  {
    id: 'staffs',
    title: 'Staffs, sections and polyrhythm',
    blocks: [
      text(
        'A staff plays blocks in parallel. Each line is an instrument and its music. A section is a staff that must finish completely before the next thing starts. By default it lasts as long as its longest block.',
      ),
      code(`section {
  pluck: [1:q 3 5 3 4 2 1:h]
  bass:  [1:h 5 4 1]^-1
}`),
      text(
        'Three modifiers let blocks react to the section length. loop repeats a block until the section ends and cuts the last repeat off. fit stretches or squeezes a block to fill the section exactly. sets-length marks the block that decides how long the section is. Instead, write length 2w (or 3q, 1/2 and so on) as a line of its own.',
      ),
      code(`section {
  pluck: [1:e 3 5 8 5 3] sets-length
  bass:  [1:q 5] ^-1 loop
  kick:  [x:q .] loop
  hat:   [x:e] loop
}`),
      text(
        'fit is where polyrhythm comes from. Three notes and four notes both stretch to the same two bars, so they meet only at the start. x is a percussion hit.',
      ),
      code(`section {
  length 2w
  pulse: [1 3 5] fit
  bass:  [1 5 1 5]^-1 fit
  hat:   [x:s] loop
}`),
    ],
  },
  {
    id: 'piece',
    title: 'Building a piece',
    blocks: [
      text(
        'Names let you build upward: notes make motifs, motifs make sections, sections make a piece. A name refers to a composition, and any modifier works on it. Here the bridge is the verse played inside a minor scope and shifted up two degrees, and the outro is the verse backwards at half speed. If a piece is called piece, that is what plays.',
      ),
      code(VERSE_BRIDGE_OUTRO),
      text(
        'Open it in Compose and change things: try a different tempo, mode or instrument. Make your own sounds in the Sounds tab and use their names as instruments here.',
      ),
    ],
  },
  {
    id: 'ref',
    title: 'Quick reference',
    isReference: true,
    blocks: [],
  },
];
