// Example pieces for the Compose tab's "Load an example" menu.

export interface Example {
  name: string;
  code: string;
}

/** Also the finished piece in the "Building a piece" lesson. */
export const VERSE_BRIDGE_OUTRO = `// Motynth example
tuning 12 of 2
mode   major
tempo  110

motif hook  = [1:q 3 5:h rest:q 4 3:h]
motif bassl = [1:h 5 4 1]
motif beat  = [x:q . x:q .]

verse = section {
  staff {
    pluck: hook      sets-length
    bass:  bassl^-1  loop
    kick:  beat      loop
    snare: [.:q x]   loop
    hat:   [x:e]     loop
  }
}

bridge = with mode minor { verse +2 }
outro  = verse rev /2

piece  = verse, verse, bridge, verse, outro`;

export const EXAMPLES: readonly Example[] = [
  { name: 'Verse, bridge, outro', code: VERSE_BRIDGE_OUTRO },
  {
    name: 'Three against four',
    code: `// Two lines that only meet at the start of each cycle
tempo 100

cycle = section {
  length 2w
  pulse: [1 3 5]      fit
  pluck: [1 3 5 8]^1  fit
  bass:  [1:h]^-1     loop
  hat:   [x:e]        loop
  kick:  [x:q . . .]  loop
}

piece = cycle x4`,
  },
  {
    name: 'Bohlen–Pierce drift',
    code: `// Thirteen steps across a 3:1 register
tuning 13 of 3
root   220
tempo  84

motif walk = [1:e 3 5 4 6 8 7 9 11 10 12 14 13:q]

phrase = section {
  pluck: walk              sets-length
  tri:   walk +4 ^-1 inv
  hat:   [x:s]             loop
}

piece = phrase, phrase +2, phrase ~5`,
  },
  {
    name: 'Drum machine',
    code: `tempo 100

bar = section {
  length 1w
  kick:  [x:s . . . . . . . x . . . . . x .]
  snare: [.:s . . . x . . . . . . . x . . x]
  hat:   [x:e]  loop
  tom:   [.:s . . . . . . . . . . . . x x x] ^-1
}

piece = bar x4`,
  },
  {
    name: 'Modal sketch',
    code: `// The same motif in three modes
tempo 108
hook = [1:e 3 5 3 2 4 6 4 3:q 1:q]

line = section {
  pluck: hook sets-length
  bass:  [1:h 5]^-1 loop
  hat:   [x:e] loop
}

piece = with mode major    { line },
        with mode dorian   { line },
        with mode phrygian { line }`,
  },
];
