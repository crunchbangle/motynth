# Motynth

A small music composition tool built around two ideas: **synth** and **motif**.

- **Sounds are drawn.** You paint single-cycle waveforms on a pixel grid (8 to 64 columns, 2 to 16 levels), then build instruments from them. The limits are deliberate: the crunch is the charm.
- **Music is text.** A tiny language lets you name notes, motifs, sections and whole pieces, and combine them with scopes (tuning, mode, tempo) and modifiers (transpose, reverse, fit, loop).

Everything runs in the browser with the Web Audio API. There is no build step and no dependencies.

## Run it

Open `motynth.html` in a modern browser. That is the whole app (HTML, CSS and JS in one file).

Fonts load from Google Fonts (Pixelify Sans, Atkinson Hyperlegible, JetBrains Mono) and fall back to system fonts offline.

Your code and sounds are saved in the browser's `localStorage`.

## The app

| Tab | What it does |
| --- | --- |
| Compose | Code editor, live error checking, piano-roll score with playhead, example menu |
| Sounds | Pixel wave editor, instrument editor, test bar that plays a motif after every change |
| Learn | Six lessons with playable snippets, plus a language reference |

## Sounds

- **Wave kinds:** cycle (looped, follows pitch), one-shot (plays once, pitched by playback rate against a reference pitch), noise (white, or a short metallic LFSR pattern).
- **Instrument types:**
  - *Single:* one wave.
  - *Pitch pair:* two waves with reference pitches, crossfaded by note pitch.
  - *Morph:* wave A blends toward wave B over the note, driven by its own attack/decay/sustain/release envelope.
- **Envelopes:** volume ADSR, morph ADSR, and a pitch envelope (start offset plus glide time) for kicks and toms.
- **Follow pitch:** turn it off and the instrument always plays at its reference pitch (drums).

## The language in one screen

```
tuning 12 of 2            // notes per register, and the register ratio
mode   major
tempo  110
root   261.63             // Hz of degree 1

motif hook  = [1:q 3 5:h rest:q 4 3:h]   // degrees; durations stick until changed
motif bassl = [1:h 5 4 1]
motif beat  = [x:q . x:q .]              // x = percussion hit, . = rest

verse = section {
  staff {
    pluck: hook       sets-length         // this block decides the section length
    bass:  bassl^-1   loop                // repeat until the section ends
    kick:  beat       loop
    hat:   [x:e]      loop
  }
}

bridge = with mode minor { verse +2 }     // scoped mode, tonal shift of two degrees
outro  = verse rev /2                     // backwards, half speed

piece  = verse, verse, bridge, verse, outro
```

Key points:

- **Pitch literals** are never frequencies. `3` is a degree of the current mode, `n7` is a step of the tuning, `3#` and `3b` nudge a degree by one step, and `names [...]` lets you write note names.
- **Durations** are exact fractions of a whole note: `w h q e s t`, a trailing `.` for dotted, and `*2/3` for triplets.
- **Modifiers** go after any motif, section or name: `+2` (tonal shift), `~2` (chromatic shift), `^1` (register shift), `rev`, `inv`, `x3`, `*2`, `/2`, `fit`, `loop`, `sets-length`.
- **Scopes** use `with <setting> { ... }`. Settings are `tuning`, `register`, `names`, `mode`, `tempo` and `root`. Musical parameters are dynamically scoped, so a motif resolves its pitches where it is used.
- **Sequence and parallel:** commas make a sequence; `section` and `staff` play their blocks in parallel.
- **Entry point:** `piece` plays if defined; otherwise the bare expressions play; otherwise the last definition plays.

The Learn tab has the full walkthrough and a reference table.

## How it is put together

The single file is assembled from these parts, in this order:

1. **Engine:** exact fractions, a scannerless recursive-descent parser, the pitch math (register, tuning, mode, degree), and the evaluator that turns a program into timed events. It has no browser dependencies and can run in Node.
2. **Lessons and examples:** plain data.
3. **UI:** sound library and persistence, Web Audio voices and a look-ahead scheduler, syntax highlighting, the piano roll, the wave and instrument editors, and the tutorial.

Audio is scheduled in real time with a short look-ahead. Each note is a few Web Audio nodes (buffer sources, gains) with automated envelopes.

## Todo

### Verify first
- [ ] Listen-test every starter instrument in real browsers (Chrome, Firefox, Safari) and tune the kick, snare, hat and tom.
- [ ] Check the code editor's highlight layer stays aligned with the textarea across browsers, fonts and zoom levels.
- [ ] Test on mobile: header wrapping, wave drawing by touch, the on-screen keyboard in the editor.

### Language
- [ ] Block-scoped names (lexical scoping), so definitions can live inside sections and `with` blocks.
- [ ] Parameterised motifs or functions (for example `arp(chord)`).
- [ ] Time signatures and bar-based lengths (`length 2 bars`).
- [ ] Velocity and accents per note; swing.
- [ ] Randomness: choose, shuffle, probability per note, with a seed.
- [ ] Tonal inversion that handles notes outside the mode more gracefully.
- [ ] Tuning helpers: just-intonation ratios, scala-style tuning lists, microtonal note names.
- [ ] Tempo changes over time (ramps), not just scoped tempo.
- [ ] Imports, or a way to share motif libraries between projects.
- [ ] Error ranges (underline the offending token, not only the line), and suggestions for typos.

### Sounds
- [ ] Combine pitch pairs and morphing in one instrument.
- [ ] Multi-cycle and imported samples, with pixel-art downsampling.
- [ ] Draw envelopes directly instead of using sliders.
- [ ] Vibrato and tremolo (LFO), a simple filter, stereo pan.
- [ ] Undo and redo in the wave editor; copy and paste between waves.
- [ ] Export and import instruments and waves as JSON.
- [ ] Keyboard-accessible wave editing (arrow keys to set columns).

### Editor and Compose
- [ ] Autocomplete for instrument names, motif names, modes and modifiers.
- [ ] Click an error to jump to its line; bracket matching.
- [ ] Click the piano roll to seek or to select the code that made a note.
- [ ] Mute and solo per instrument or lane.
- [ ] A visual block editor on top of the text language.

### Project and app
- [ ] Save and open project files (code plus sounds) and share by link.
- [ ] Export to WAV (offline render) and to MIDI.
- [ ] Split the single file into modules with a small build script, and add the engine tests (Node) to the repo.
- [ ] Unit tests for the parser and evaluator: scoping, `fit`/`loop`/`sets-length`, exact-fraction timing.
- [ ] Performance: cache compiled results, and pre-render long pieces.

## Known limits (v1)

- Names (motifs, sections, pieces) are global. Only musical settings are scoped.
- Changing the tuning inside a scope resets the mode to chromatic and clears note names unless you set them in the same `with`.
- Pitch pair and morph are separate instrument types.
- High notes alias on purpose: waves are played back as raw staircases. Turn on "Smooth the steps" for a softer sound.
- There are limits on piece size (40,000 notes, 30 minutes) to keep the browser responsive.
