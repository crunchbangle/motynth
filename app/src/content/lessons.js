import {BUILTIN_MODES, KEYWORDS} from '../engine/index.ts';

const LESSONS=[
{id:'first',title:'Your first notes',blocks:[
 {p:'A Motynth piece is text. Write an instrument name, a colon, then a motif in square brackets. Numbers are degrees of the current scale: 1 is the tonic, 2 the next note up, and so on. Degree 8 wraps around to the tonic one octave higher.'},
 {code:'pulse: [1 2 3 4 5 6 7 8]'},
 {p:'Swap pulse for tri, bass, pluck or keys to hear the other starter instruments. Everything is built from the waveforms in the Sounds tab, where you can draw your own.'},
 {code:'tri: [1 3 5 3 1]'},
 {p:'Press Play in the header, or Ctrl+Enter inside the editor. Nothing else is needed: a line that plays something is a whole piece.'}
]},
{id:'motifs',title:'Motifs and durations',blocks:[
 {p:'After a colon, a duration. The letters are w (whole), h (half), q (quarter), e (eighth), s (sixteenth) and t (thirty-second). A duration sticks to the notes after it until you change it, so you only write it when it changes.'},
 {code:'motif hook = [1:e 2 3 4 5:q 3 1:h]\npluck: hook'},
 {p:'A dot after the letter lengthens it by half. A dot on its own is a rest, and so is the word rest. An underscore ties the previous note onward. Parentheses make a chord.'},
 {code:'keys: [(1 3 5):h .:q (4 6 8):h  1:q. _:e 2:h]'},
 {p:'For triplets, multiply: e*2/3 is an eighth squeezed to two thirds of its length, so three of them fill a quarter. Durations are exact fractions, so nothing drifts out of sync.'},
 {code:'pulse: [1:e*2/3 2 3 4:q 5]'},
 {p:'A motif can also contain another motif by name. Give it a duration and the whole thing is squeezed to fit.'},
 {code:'a = [1:e 3 5 3]\nb = [a 4:q 2:q a:q]\npluck: b'}
]},
{id:'scopes',title:'Tunings, modes and names',blocks:[
 {p:'Pitch comes in layers. A tuning splits a register into equal steps: tuning 12 of 2 is the usual octave of 12 notes. A mode picks some of those steps as the scale. Degrees count through the mode, so the same motif can change character just by changing the mode around it.'},
 {code:'hook = [1:e 3 5 3 2 4 6 4]\nwith mode major { pluck: hook },\nwith mode minor { pluck: hook },\nwith mode phrygian { pluck: hook }'},
 {p:'with opens a scope. Inside the braces the setting has a new value; outside, the old one is back. You can scope tuning, register, names, mode, tempo and root (the tonic frequency in Hz). Built-in modes: major, minor, dorian, phrygian, lydian, mixolydian, locrian, harmonic-minor, pentatonic, minor-pentatonic, blues, whole-tone and chromatic. Define your own with a list of step numbers.'},
 {code:'mode gloom = [0 1 4 5 7 8 11]\nwith mode gloom { tri: [1 2 3 4 5 6 7 8] }'},
 {p:'Writing n7 means \u201cstep 7 of the tuning, ignoring the mode\u201d. If a mode can\u2019t express a pitch, n lets you reach it. Name the steps with names and you can write them directly. # and b nudge a degree by one step.'},
 {code:'names [C Db D Eb E F Gb G Ab A Bb B]\npulse: [C E G C^1  Eb G Bb Eb^1]'},
 {p:'Nothing says the register is an octave. Here is the Bohlen\u2013Pierce scale: thirteen steps across a 3:1 register. Changing the tuning resets the mode to \u201cchromatic\u201d (every step), so degrees 1 to 13 walk the whole register.'},
 {code:'with tuning 13 of 3 { pluck: [1 3 5 7 9 11 13 14] }'}
]},
{id:'transpose',title:'Transposing and transforming',blocks:[
 {p:'Any motif, section or name can take modifiers after it. +2 moves up two degrees of the mode (tonal, a \u201csequence\u201d): the intervals bend to stay in the scale. ~2 moves up two steps of the tuning (chromatic): the intervals keep their size and may leave the scale. ^1 moves up one register.'},
 {code:'hook = [1:e 2 3 5 3 2 1:q]\npluck: (hook, hook +2, hook ~2, hook ^1)'},
 {p:'The rest change the music itself. rev plays backwards, inv flips the contour (around the first note, within the mode), x3 repeats three times, *2 doubles the speed and /2 halves it. They chain left to right.'},
 {code:'hook = [1:e 2 3 5 3 2 1:q]\npluck: (hook, hook rev, hook inv, hook x2 *2)'},
 {p:'Because the transposition is a scope setting under the hood, it works on whatever is inside, including sections, and it respects the mode in force where the name is used.'},
 {code:'hook = [1:e 3 5 8 5 3 1:q]\ntri: (hook, with mode minor { hook +2 }, hook)'}
]},
{id:'staffs',title:'Staffs, sections and polyrhythm',blocks:[
 {p:'A staff plays blocks in parallel. Each line is an instrument and its music. A section is a staff that must finish completely before the next thing starts. By default it lasts as long as its longest block.'},
 {code:'section {\n  pluck: [1:q 3 5 3 4 2 1:h]\n  bass:  [1:h 5 4 1]^-1\n}'},
 {p:'Three modifiers let blocks react to the section length. loop repeats a block until the section ends and cuts the last repeat off. fit stretches or squeezes a block to fill the section exactly. sets-length marks the block that decides how long the section is. Instead, write length 2w (or 3q, 1/2 and so on) as a line of its own.'},
 {code:'section {\n  pluck: [1:e 3 5 8 5 3] sets-length\n  bass:  [1:q 5] ^-1 loop\n  kick:  [x:q .] loop\n  hat:   [x:e] loop\n}'},
 {p:'fit is where polyrhythm comes from. Three notes and four notes both stretch to the same two bars, so they meet only at the start. x is a percussion hit.'},
 {code:'section {\n  length 2w\n  pulse: [1 3 5] fit\n  bass:  [1 5 1 5]^-1 fit\n  hat:   [x:s] loop\n}'}
]},
{id:'piece',title:'Building a piece',blocks:[
 {p:'Names let you build upward: notes make motifs, motifs make sections, sections make a piece. A name refers to a composition, and any modifier works on it. Here the bridge is the verse played inside a minor scope and shifted up two degrees, and the outro is the verse backwards at half speed. If a piece is called piece, that is what plays.'},
 {code:'// Motynth example\ntuning 12 of 2\nmode   major\ntempo  110\n\nmotif hook  = [1:q 3 5:h rest:q 4 3:h]\nmotif bassl = [1:h 5 4 1]\nmotif beat  = [x:q . x:q .]\n\nverse = section {\n  staff {\n    pluck: hook      sets-length\n    bass:  bassl^-1  loop\n    kick:  beat      loop\n    snare: [.:q x]   loop\n    hat:   [x:e]     loop\n  }\n}\n\nbridge = with mode minor { verse +2 }\noutro  = verse rev /2\n\npiece  = verse, verse, bridge, verse, outro'},
 {p:'Open it in Compose and change things: try a different tempo, mode or instrument. Make your own sounds in the Sounds tab and use their names as instruments here.'}
]},
{id:'ref',title:'Quick reference',ref:true,blocks:[]}
];
const REFERENCE=[
 ['Settings',[
  ['tuning 12 of 2','Notes per register, and the register ratio'],
  ['tuning 13','Change the note count, keep the ratio'],
  ['register 3','Change only the register ratio'],
  ['mode minor','Pick a mode by name. Built in: '+[...BUILTIN_MODES.keys()].join(', ')],
  ['mode [0 2 3 5 7 8 10]','Or write the steps yourself'],
  ['mode name = [ ... ]','Define a named mode'],
  ['names [C Db D ...]','Name each step of the tuning'],
  ['tempo 110','Beats per minute (quarter note = 1 beat)'],
  ['root 261.63','Frequency of degree 1, in Hz']]],
 ['Motif items',[
  ['3','Degree 3 of the current mode'],
  ['n7','Step 7 of the tuning, ignoring the mode'],
  ['3^1  3^-2','Up or down registers'],
  ['3#  3b','One tuning step sharp or flat'],
  ['C  Eb^1','A note name set by names; ^ shifts its register'],
  ['(1 3 5)','A chord'],
  ['.  r  rest','A rest'],
  ['_','Tie: extend the previous note'],
  ['x','A percussion hit'],
  ['1:q  :e  :h.','Duration, sticky; a dot adds half'],
  ['1:e*2/3','Multiply a duration (triplets)'],
  ['other_motif','Splice in another motif; give it :dur to fit it']]],
 ['Modifiers',[
  ['+2  -1','Tonal shift in degrees of the mode'],
  ['~3  ~-2','Chromatic shift in tuning steps'],
  ['^1  ^-1','Shift by registers'],
  ['rev  inv','Reverse; invert within the mode'],
  ['x3','Repeat'],
  ['*2  /2','Double speed; half speed'],
  ['fit','Stretch to the section length'],
  ['loop','Repeat until the section ends'],
  ['sets-length','This block sets the section length']]],
 ['Structure',[
  ['inst: music','Play music on an instrument'],
  ['a, b, c','Play in sequence'],
  ['section { ... }','Parallel blocks; ends when all are done'],
  ['staff { ... }','Same, for grouping inside a section'],
  ['length 2w','Fix the length of a section'],
  ['with mode minor { ... }','Scope settings to a block'],
  ['name = ...','Name any composition'],
  ['piece = ...','The thing that plays (else the last line)']]],
 ['Names',[
  ['my-tune  bass_2','Letters, digits, _ and -, starting with a letter or _'],
  ['with  rest  ...','Keywords can’t be names: '+[...KEYWORDS].join(', ')],
  ['x  r  n3','Inside a motif these mean a hit, a rest and a tuning step, so a motif with one of these names can’t be used inside another motif'],
  // A function is filled in when the reference is shown, with the current instruments.
  ['inst:',ctx=>'Your instruments: '+[...ctx.instruments].join(', ')+'. Add or rename them in the Sounds tab.']]]
];

export {LESSONS, REFERENCE};
