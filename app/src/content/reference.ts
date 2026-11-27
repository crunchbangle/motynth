// The quick reference shown in the last lesson of the Learn tab.

import { BUILTIN_MODES, KEYWORDS } from '../engine/index.ts';

/** What the app knows when it shows the reference. */
export interface ReferenceContext {
  instruments: readonly string[];
}

export interface ReferenceRow {
  /** Example code. */
  example: string;
  /** What it means; a function when it depends on the user's setup. */
  meaning: string | ((context: ReferenceContext) => string);
}

export interface ReferenceGroup {
  title: string;
  rows: ReferenceRow[];
}

const row = (example: string, meaning: ReferenceRow['meaning']): ReferenceRow => ({
  example,
  meaning,
});

export const REFERENCE: readonly ReferenceGroup[] = [
  {
    title: 'Settings',
    rows: [
      row('tuning 12 of 2', 'Notes per register, and the register ratio'),
      row('tuning 13', 'Change the note count, keep the ratio'),
      row('register 3', 'Change only the register ratio'),
      row('mode minor', `Pick a mode by name. Built in: ${[...BUILTIN_MODES.keys()].join(', ')}`),
      row('mode [0 2 3 5 7 8 10]', 'Or write the steps yourself'),
      row('mode name = [ ... ]', 'Define a named mode'),
      row('names [C Db D ...]', 'Name each step of the tuning'),
      row('tempo 110', 'Beats per minute (quarter note = 1 beat)'),
      row('root 261.63', 'Frequency of degree 1, in Hz'),
    ],
  },
  {
    title: 'Motif items',
    rows: [
      row('3', 'Degree 3 of the current mode'),
      row('n7', 'Step 7 of the tuning, ignoring the mode'),
      row('3^1  3^-2', 'Up or down registers'),
      row('3#  3b', 'One tuning step sharp or flat'),
      row('C  Eb^1', 'A note name set by names; ^ shifts its register'),
      row('(1 3 5)', 'A chord'),
      row('.  r  rest', 'A rest'),
      row('_', 'Tie: extend the previous note'),
      row('x', 'A percussion hit'),
      row('1:q  :e  :h.', 'Duration, sticky; a dot adds half'),
      row('1:e*2/3', 'Multiply a duration (triplets)'),
      row('other_motif', 'Splice in another motif; give it :dur to fit it'),
    ],
  },
  {
    title: 'Modifiers',
    rows: [
      row('+2  -1', 'Tonal shift in degrees of the mode'),
      row('~3  ~-2', 'Chromatic shift in tuning steps'),
      row('^1  ^-1', 'Shift by registers'),
      row('rev  inv', 'Reverse; invert within the mode'),
      row('x3', 'Repeat'),
      row('*2  /2', 'Double speed; half speed'),
      row('fit', 'Stretch to the section length'),
      row('loop', 'Repeat until the section ends'),
      row('sets-length', 'This block sets the section length'),
    ],
  },
  {
    title: 'Structure',
    rows: [
      row('inst: music', 'Play music on an instrument'),
      row('a, b, c', 'Play in sequence'),
      row('section { ... }', 'Parallel blocks; ends when all are done'),
      row('staff { ... }', 'Same, for grouping inside a section'),
      row('length 2w', 'Fix the length of a section'),
      row('with mode minor { ... }', 'Scope settings to a block'),
      row('name = ...', 'Name any composition'),
      row('piece = ...', 'The thing that plays (else the last line)'),
    ],
  },
  {
    title: 'Names',
    rows: [
      row('my-tune  bass_2', 'Letters, digits, _ and -, starting with a letter or _'),
      row('with  rest  ...', `Keywords can’t be names: ${[...KEYWORDS].join(', ')}`),
      row(
        'x  r  n3',
        'Inside a motif these mean a hit, a rest and a tuning step, so a motif with one of these names can’t be used inside another motif',
      ),
      row(
        'inst:',
        ({ instruments }) =>
          `Your instruments: ${instruments.join(', ')}. Add or rename them in the Sounds tab.`,
      ),
    ],
  },
];
