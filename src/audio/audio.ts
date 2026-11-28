// Runtime-synthesised chiptune audio: sound effects and looping music built from
// pulse / triangle / sawtooth oscillators and filtered noise. No audio files.
//
// Everything is a safe no-op until unlock() succeeds, and wherever `window` or
// `AudioContext` does not exist (this module is also imported by Node scripts).

import type { Ambience, AudioApi, MusicTrack, SfxName } from './manifest';

// ---------------------------------------------------------------------------
// Note data
// ---------------------------------------------------------------------------

type Wave = 'p50' | 'p25' | 'p12' | 'tri' | 'saw' | 'sine';

interface NoteEv {
  step: number;
  len: number;
  midis: number[];
}

interface DrumEv {
  step: number;
  hit: DrumHit;
}

type DrumHit = 'k' | 's' | 'h' | 'o' | 't';

interface ChannelBase {
  name: string;
  vol: number;
  /** Total length in steps. */
  steps: number;
  /** Length in steps of each source string (normally one bar each). */
  parts: number[];
}

interface ToneChannel extends ChannelBase {
  kind: 'tone';
  wave: Wave;
  /** Fraction of the written length that actually sounds. */
  gate: number;
  /** Sustain level relative to the peak (lower = pluckier). */
  sus: number;
  /** Quiet repeat of every note: [delay in steps, relative level]. */
  echo?: [number, number];
  /** Second oscillator doubling the note. */
  layer?: { wave: Wave; vol: number; semis: number };
  events: NoteEv[];
}

interface DrumChannel extends ChannelBase {
  kind: 'drums';
  events: DrumEv[];
}

type Channel = ToneChannel | DrumChannel;

export interface TrackData {
  bpm: number;
  key: string;
  stepsPerBar: number;
  /** Loop length in steps (a step is a sixteenth note). */
  steps: number;
  /** Seconds per step. */
  stepDur: number;
  channels: Channel[];
}

const NOTE_INDEX: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midiOf(name: string): number {
  const m = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`audio: bad note "${name}"`);
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return NOTE_INDEX[m[1]] + accidental + (Number(m[3]) + 1) * 12;
}

const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);
const noteHz = (name: string): number => hz(midiOf(name));

/**
 * Parses "C4:2 E4+G4:4 -:2": whitespace separated tokens of `pitch:length`,
 * `+` joins a chord, `-` is a rest, length defaults to 1.
 */
function parseNotes(src: string): { events: NoteEv[]; steps: number } {
  const events: NoteEv[] = [];
  let step = 0;
  for (const token of src.trim().split(/\s+/)) {
    if (!token) continue;
    const [pitch, lenText] = token.split(':');
    const len = lenText === undefined ? 1 : Number(lenText);
    if (!Number.isFinite(len) || len <= 0) throw new Error(`audio: bad length in "${token}"`);
    if (pitch !== '-') events.push({ step, len, midis: pitch.split('+').map(midiOf) });
    step += len;
  }
  return { events, steps: step };
}

interface ToneVoice {
  wave: Wave;
  vol: number;
  gate: number;
  sus: number;
  echo?: [number, number];
  layer?: { wave: Wave; vol: number; semis: number };
}

function toneCh(name: string, voice: ToneVoice, bars: string[]): ToneChannel {
  const events: NoteEv[] = [];
  const parts: number[] = [];
  let offset = 0;
  for (const bar of bars) {
    const parsed = parseNotes(bar);
    for (const ev of parsed.events) events.push({ ...ev, step: ev.step + offset });
    parts.push(parsed.steps);
    offset += parsed.steps;
  }
  return { kind: 'tone', name, ...voice, events, steps: offset, parts };
}

/** Drum bars: one character per step. k kick, s snare, h hat, o open hat, t tom, . rest. */
function drumCh(vol: number, bars: string[]): DrumChannel {
  const events: DrumEv[] = [];
  const parts: number[] = [];
  let offset = 0;
  for (const bar of bars) {
    for (let i = 0; i < bar.length; i++) {
      const ch = bar[i];
      if (ch === '.') continue;
      if (ch !== 'k' && ch !== 's' && ch !== 'h' && ch !== 'o' && ch !== 't') {
        throw new Error(`audio: bad drum "${ch}"`);
      }
      events.push({ step: offset + i, hit: ch });
    }
    parts.push(bar.length);
    offset += bar.length;
  }
  return { kind: 'drums', name: 'drums', vol, events, steps: offset, parts };
}

function makeTrack(bpm: number, key: string, stepsPerBar: number, channels: Channel[]): TrackData {
  return {
    bpm,
    key,
    stepsPerBar,
    steps: Math.max(...channels.map((c) => c.steps)),
    stepDur: 60 / bpm / 4,
    channels,
  };
}

/** Expands a chord progression (one symbol per bar) through a per-chord bar pattern. */
function byChord(chords: string, patterns: Record<string, string>): string[] {
  return chords
    .trim()
    .split(/\s+/)
    .map((chord) => {
      const bar = patterns[chord];
      if (bar === undefined) throw new Error(`audio: no pattern for chord "${chord}"`);
      return bar;
    });
}

const twice = (s: string): string => `${s} ${s}`;
/** One 4/4 bar of eighth-note arpeggio: a b c b a b c b. */
const arp8 = (a: string, b: string, c: string): string => twice(`${a}:2 ${b}:2 ${c}:2 ${b}:2`);

// ---------------------------------------------------------------------------
// Music. All four pieces are original. A step is a sixteenth note.
// ---------------------------------------------------------------------------

// --- hub: slow tavern waltz, F major, 3/4 (12 steps per bar), 32 bars -------

const HUB_A = 'F C Dm Bb F Gm C F';
const HUB_A2 = 'F C Dm Bb Gm C F F';
const HUB_B = 'Bb F Gm Dm Bb F Gm C';
const HUB_CHORDS = [HUB_A, HUB_A2, HUB_B, HUB_A2].join(' ');

const HUB_LEAD = [
  // A
  'A4:6 Bb4:2 C5:4',
  'G4:8 E4:4',
  'F4:6 G4:2 A4:4',
  'D5:8 Bb4:4',
  'C5:6 D5:2 C5:4',
  'Bb4:4 A4:4 G4:4',
  'A4:4 G4:4 E4:4',
  'F4:8 -:4',
  // A'
  'A4:6 Bb4:2 C5:4',
  'G4:8 C5:4',
  'D5:6 E5:2 F5:4',
  'D5:8 Bb4:4',
  'Bb4:4 D5:4 C5:4',
  'Bb4:4 G4:4 E4:4',
  'F4:12',
  '-:4 C5:4 F5:4',
  // B
  'F5:8 D5:4',
  'C5:6 A4:2 C5:4',
  'D5:4 Bb4:4 G4:4',
  'A4:8 F4:4',
  'Bb4:4 D5:4 F5:4',
  'A5:8 F5:4',
  'G5:4 F5:4 D5:4',
  'E5:4 D5:4 C5:2 Bb4:2',
  // A''
  'A4:6 Bb4:2 C5:4',
  'G4:8 E4:4',
  'F4:6 G4:2 A4:4',
  'D5:8 F5:4',
  'D5:4 Bb4:4 G4:4',
  'A4:4 G4:4 E4:4',
  'F4:12',
  '-:8 F4:2 G4:2',
];

const HUB_BASS: Record<string, string> = {
  F: 'F3:8 C3:4',
  C: 'C3:8 G2:4',
  Dm: 'D3:8 A2:4',
  Bb: 'Bb2:8 F3:4',
  Gm: 'G2:8 D3:4',
};

// "pah-pah" dyads on beats two and three.
const HUB_HARMONY: Record<string, string> = {
  F: '-:4 A3+C4:4 A3+C4:4',
  C: '-:4 G3+E4:4 G3+E4:4',
  Dm: '-:4 A3+F4:4 A3+F4:4',
  Bb: '-:4 Bb3+D4:4 Bb3+D4:4',
  Gm: '-:4 Bb3+D4:4 Bb3+D4:4',
};

const HUB_DRUMS: string[] = [];
for (let i = 0; i < 8; i++) HUB_DRUMS.push('k...h...h...', 'k...h...h...', 'k...h...h...', 'k...h...h.h.');

const HUB = makeTrack(96, 'F major', 12, [
  toneCh(
    'lead',
    { wave: 'tri', vol: 0.4, gate: 0.92, sus: 0.7, layer: { wave: 'p25', vol: 0.035, semis: 0 } },
    HUB_LEAD,
  ),
  toneCh('harmony', { wave: 'p50', vol: 0.05, gate: 0.45, sus: 0.3 }, byChord(HUB_CHORDS, HUB_HARMONY)),
  toneCh('bass', { wave: 'tri', vol: 0.34, gate: 0.9, sus: 0.75 }, byChord(HUB_CHORDS, HUB_BASS)),
  drumCh(0.14, HUB_DRUMS),
]);

// --- forest: light overworld march, G major, 4/4, 24 bars -------------------

const FOREST_A = 'G Em C D G Em CD G';
const FOREST_B = 'Em D C GB Am G C D';

const FOREST_LEAD = [
  // A
  'G4:2 B4:2 D5:4 B4:2 D5:2 G5:4',
  'F#5:3 E5:1 D5:4 B4:4 E5:4',
  'E5:6 D5:2 C5:2 D5:2 E5:4',
  'D5:6 A4:2 D5:2 E5:2 F#5:4',
  'G5:6 D5:2 B4:4 D5:4',
  'E5:3 F#5:1 G5:4 E5:4 B4:4',
  'C5:2 E5:2 G5:4 F#5:2 E5:2 D5:4',
  'B4:2 A4:2 G4:8 -:2 D5:2',
  // A'
  'G5:2 F#5:2 G5:4 D5:2 B4:2 D5:4',
  'E5:2 D5:2 E5:4 G5:4 B5:4',
  'A5:3 G5:1 E5:4 C5:2 E5:2 G5:4',
  'F#5:6 E5:2 D5:4 A4:4',
  'B4:2 D5:2 G5:4 B4:2 D5:2 G5:4',
  'F#5:2 G5:2 A5:4 G5:4 E5:4',
  'E5:2 G5:2 E5:2 C5:2 D5:2 F#5:2 A5:4',
  'G5:10 -:6',
  // B
  'E5:6 B4:2 E5:4 G5:4',
  'F#5:6 D5:2 A4:8',
  'E5:6 C5:2 E5:4 G5:4',
  'D5:8 B4:4 G4:4',
  'A4:2 C5:2 E5:4 A4:2 C5:2 E5:4',
  'D5:2 B4:2 G4:4 B4:2 D5:2 G5:4',
  'E5:4 G5:4 C6:6 B5:2',
  'A5:4 F#5:4 D5:2 E5:2 F#5:2 A5:2',
];

const FOREST_ARP: Record<string, string> = {
  G: arp8('G3', 'B3', 'D4'),
  Em: arp8('G3', 'B3', 'E4'),
  C: arp8('G3', 'C4', 'E4'),
  D: arp8('F#3', 'A3', 'D4'),
  CD: 'G3:2 C4:2 E4:2 C4:2 F#3:2 A3:2 D4:2 A3:2',
  GB: arp8('G3', 'B3', 'D4'),
  Am: arp8('A3', 'C4', 'E4'),
};

/** Bouncing eighths: root root fifth root | root root fifth octave. */
const bounce = (r: string, f: string, o: string): string =>
  `${r}:2 ${r}:2 ${f}:2 ${r}:2 ${r}:2 ${r}:2 ${f}:2 ${o}:2`;
const FOREST_BASS_A: Record<string, string> = {
  G: bounce('G2', 'D3', 'G3'),
  Em: bounce('E3', 'B2', 'E3'),
  C: bounce('C3', 'G3', 'C3'),
  D: bounce('D3', 'A2', 'D3'),
  CD: 'C3:2 C3:2 G3:2 C3:2 D3:2 D3:2 A2:2 D3:2',
};

const calm = (r: string, f: string): string => `${r}:6 ${r}:2 ${f}:4 ${r}:4`;
const FOREST_BASS_B: Record<string, string> = {
  Em: calm('E3', 'B2'),
  D: calm('D3', 'A2'),
  C: calm('C3', 'G2'),
  GB: calm('B2', 'D3'),
  Am: calm('A2', 'E3'),
  G: calm('G2', 'D3'),
};

const F_MAIN = 'k.h.s.h.k.h.s.h.';
const F_ALT = 'k.h.s.h.k.k.s.hh';
const F_FILL = 'k.h.s.h.k.s.s.ss';
const F_SOFT = 'k.h.h.h.s.h.h.h.';
const FOREST_DRUMS_A = [F_MAIN, F_MAIN, F_MAIN, F_ALT, F_MAIN, F_MAIN, F_MAIN, F_FILL];
const FOREST_DRUMS_B = [F_SOFT, F_SOFT, F_SOFT, F_SOFT, F_SOFT, F_SOFT, F_SOFT, F_FILL];

const FOREST = makeTrack(118, 'G major', 16, [
  toneCh('lead', { wave: 'p25', vol: 0.16, gate: 0.85, sus: 0.55, echo: [3, 0.2] }, FOREST_LEAD),
  toneCh('arp', { wave: 'p12', vol: 0.065, gate: 0.6, sus: 0.3 }, [
    ...byChord(FOREST_A, FOREST_ARP),
    ...byChord(FOREST_A, FOREST_ARP),
    ...byChord(FOREST_B, FOREST_ARP),
  ]),
  toneCh('bass', { wave: 'tri', vol: 0.36, gate: 0.75, sus: 0.8 }, [
    ...byChord(FOREST_A, FOREST_BASS_A),
    ...byChord(FOREST_A, FOREST_BASS_A),
    ...byChord(FOREST_B, FOREST_BASS_B),
  ]),
  drumCh(0.26, [...FOREST_DRUMS_A, ...FOREST_DRUMS_A, ...FOREST_DRUMS_B]),
]);

// --- cave: sparse and tense, D minor, 4/4, 16 bars --------------------------

const CAVE_CHORDS = 'Dm Dm Bb A Dm Dm Gm A Dm C Bb A Gm DmF Eb A';
// The plucked ostinato stays out for the first four bars to leave room.
const CAVE_OSTINATO = '- - - - Dm Dm Gm A Dm C Bb A Gm DmF Eb A';

const CAVE_LEAD = [
  '-:4 A4:2 D5:6 -:4',
  '-:4 F5:2 E5:6 -:4',
  '-:2 D5:2 F5:2 Bb4:6 -:4',
  'A4:2 C#5:2 E5:8 -:4',
  '-:4 A4:2 D5:4 E5:2 F5:4',
  'E5:2 D5:6 -:8',
  '-:4 G4:2 Bb4:2 D5:6 -:2',
  'C#5:6 A4:2 -:8',
  'D5:2 -:2 D5:2 F5:6 -:4',
  'E5:2 -:2 E5:2 G5:6 -:4',
  'F5:4 D5:4 Bb4:4 -:4',
  'A4:6 -:2 E5:2 C#5:2 A4:4',
  '-:4 Bb4:2 D5:2 G5:6 -:2',
  'F5:2 E5:2 D5:4 A4:4 -:4',
  'Eb5:6 -:2 Bb4:2 G4:2 Eb5:4',
  'E5:2 C#5:2 A4:8 -:4',
];

/** Heartbeat bass: long root, a short repeat, then the fifth. */
const pulseBass = (r: string, f: string): string => `${r}:6 -:2 ${r}:2 -:2 ${f}:4`;
const CAVE_BASS: Record<string, string> = {
  Dm: pulseBass('D3', 'A2'),
  Bb: pulseBass('Bb2', 'F3'),
  A: pulseBass('A2', 'E3'),
  Gm: pulseBass('G2', 'D3'),
  C: pulseBass('C3', 'G2'),
  DmF: pulseBass('F3', 'D3'),
  Eb: pulseBass('Eb3', 'Bb2'),
};

const drip = (a: string, b: string, c: string): string => `${a}:4 ${b}:4 ${c}:4 ${b}:4`;
const CAVE_PLUCK: Record<string, string> = {
  '-': '-:16',
  Dm: drip('D4', 'A3', 'F4'),
  Bb: drip('D4', 'Bb3', 'F4'),
  A: drip('C#4', 'A3', 'E4'),
  Gm: drip('D4', 'Bb3', 'G4'),
  C: drip('C4', 'G3', 'E4'),
  DmF: drip('D4', 'A3', 'F4'),
  Eb: drip('Eb4', 'Bb3', 'G4'),
};

const C_ONE = 'k.......h.....h.';
const C_TOM = 'k.......h...t.t.';
const C_SNR = 'k.....k.s.......';
const CAVE_DRUMS = [
  C_ONE, C_ONE, C_ONE, C_TOM,
  C_ONE, C_ONE, C_ONE, C_TOM,
  C_SNR, C_ONE, C_SNR, C_ONE,
  C_SNR, C_ONE, C_SNR, C_TOM,
];

const CAVE = makeTrack(72, 'D minor', 16, [
  toneCh('lead', { wave: 'p25', vol: 0.14, gate: 0.9, sus: 0.45, echo: [3, 0.3] }, CAVE_LEAD),
  toneCh('pluck', { wave: 'p12', vol: 0.05, gate: 0.35, sus: 0.2 }, byChord(CAVE_OSTINATO, CAVE_PLUCK)),
  toneCh('bass', { wave: 'tri', vol: 0.38, gate: 0.9, sus: 0.7 }, byChord(CAVE_CHORDS, CAVE_BASS)),
  drumCh(0.22, CAVE_DRUMS),
]);

// --- boss: fast and driving, A minor, 4/4, 24 bars --------------------------

const BOSS_A = 'Am Am F G Am Am F E';
const BOSS_B = 'Dm Dm Am Am Bb Bb E E';

const BOSS_LEAD = [
  // A
  'A4:2 C5:2 E5:2 A4:2 C5:2 E5:2 A5:4',
  'G5:2 E5:2 C5:2 E5:2 D5:2 C5:2 B4:4',
  'A4:2 C5:2 F5:2 A4:2 C5:2 F5:2 A5:4',
  'G5:2 D5:2 B4:2 D5:2 G5:4 B5:4',
  'C6:4 B5:2 A5:2 E5:4 A5:4',
  'G5:2 A5:2 G5:2 E5:2 D5:2 E5:2 C5:4',
  'F5:3 F5:3 F5:2 E5:3 E5:3 D5:2',
  'E5:3 E5:3 E5:2 G#5:4 B5:4',
  // A'
  'A5:3 E5:3 A5:2 C6:3 B5:3 A5:2',
  'G5:2 E5:2 G5:2 A5:2 E5:8',
  'F5:3 C5:3 F5:2 A5:3 G5:3 F5:2',
  'G5:2 D5:2 G5:2 B5:2 A5:4 G5:4',
  'E5:2 A5:2 E5:2 C5:2 E5:2 A5:2 E5:2 C5:2',
  'E5:2 G5:2 E5:2 C5:2 D5:2 E5:2 D5:2 B4:2',
  'C5:2 F5:2 A5:2 F5:2 C6:4 A5:4',
  'B5:4 G#5:4 E5:2 G#5:2 B5:2 E5:2',
  // B
  'D5:6 F5:6 A5:4',
  'G5:2 F5:2 E5:2 F5:2 D5:8',
  'C5:6 E5:6 A5:4',
  'G5:2 E5:2 D5:2 E5:2 C5:8',
  'Bb4:6 D5:6 F5:4',
  'Bb5:4 A5:2 F5:2 D5:4 F5:4',
  'E5:2 E5:2 G#5:2 E5:2 B5:2 E5:2 G#5:2 E5:2',
  'B5:2 G#5:2 E5:2 B4:2 D5:2 E5:2 G#5:2 B5:2',
];

/** Galloping bass: three "dum da-da" figures, then an accent and a pickup. */
const gallop = (r: string, o: string): string =>
  `${r}:2 ${r}:1 ${r}:1 ${r}:2 ${r}:1 ${r}:1 ${r}:2 ${r}:1 ${r}:1 ${o}:2 ${r}:2`;
const BOSS_BASS: Record<string, string> = {
  Am: gallop('A2', 'A3'),
  F: gallop('F2', 'F3'),
  G: gallop('G2', 'G3'),
  E: gallop('E2', 'E3'),
  Dm: gallop('D3', 'A3'),
  Bb: gallop('Bb2', 'Bb3'),
};

const BOSS_ARP: Record<string, string> = {
  Am: arp8('A3', 'C4', 'E4'),
  F: arp8('A3', 'C4', 'F4'),
  G: arp8('G3', 'B3', 'D4'),
  E: arp8('G#3', 'B3', 'E4'),
  Dm: arp8('A3', 'D4', 'F4'),
  Bb: arp8('Bb3', 'D4', 'F4'),
};

const B_MAIN = 'k.h.s.hkk.h.s.h.';
const B_ALT = 'k.h.s.hkk.k.s.ss';
const B_FILL = 'k.k.s.s.kks.ssss';
const B_PUSH = 'k.hks.h.k.hks.h.';
const BOSS_DRUMS_A = [B_MAIN, B_MAIN, B_MAIN, B_ALT, B_MAIN, B_MAIN, B_MAIN, B_FILL];
const BOSS_DRUMS_B = [B_PUSH, B_PUSH, B_PUSH, B_ALT, B_PUSH, B_PUSH, B_PUSH, B_FILL];

const BOSS = makeTrack(164, 'A minor', 16, [
  toneCh('lead', { wave: 'p25', vol: 0.16, gate: 0.8, sus: 0.5 }, BOSS_LEAD),
  toneCh('arp', { wave: 'p12', vol: 0.06, gate: 0.55, sus: 0.3 }, [
    ...byChord(BOSS_A, BOSS_ARP),
    ...byChord(BOSS_A, BOSS_ARP),
    ...byChord(BOSS_B, BOSS_ARP),
  ]),
  toneCh(
    'bass',
    { wave: 'tri', vol: 0.38, gate: 0.8, sus: 0.85, layer: { wave: 'p25', vol: 0.03, semis: 12 } },
    [...byChord(BOSS_A, BOSS_BASS), ...byChord(BOSS_A, BOSS_BASS), ...byChord(BOSS_B, BOSS_BASS)],
  ),
  drumCh(0.28, [...BOSS_DRUMS_A, ...BOSS_DRUMS_A, ...BOSS_DRUMS_B]),
]);

// --- swamp: slow and lurching, E minor with a flat second, 4/4, 16 bars -----

const SWAMP_CHORDS = 'Em Em C B Em Em Am B Em D C B Am Em F B';

const SWAMP_LEAD = [
  'E4:4 G4:2 B4:6 -:4',
  '-:4 A4:2 G4:2 E4:8',
  'C5:6 B4:2 G4:4 E4:4',
  'F#4:4 D#4:4 B3:8',
  'E4:2 -:2 E4:2 G4:2 B4:4 D5:4',
  'C5:2 B4:2 G4:4 E4:8',
  'A4:4 C5:4 E5:6 -:2',
  'D#5:4 B4:4 F#4:8',
  'E5:6 D5:2 B4:4 G4:4',
  'A4:6 F#4:2 D4:8',
  'G4:4 E4:4 C4:6 -:2',
  'B3:4 D#4:4 F#4:4 B4:4',
  'A4:2 -:2 A4:2 C5:2 E5:8',
  'B4:4 G4:4 E4:8',
  'F4:6 A4:2 C5:4 F5:4',
  'D#5:4 B4:4 F#4:4 B3:4',
];

/** Squelching bass: a heavy root, a short repeat, the fifth, and the root again. */
const squelch = (r: string, f: string): string => `${r}:3 -:1 ${r}:2 -:2 ${f}:3 -:1 ${r}:4`;
const SWAMP_BASS: Record<string, string> = {
  Em: squelch('E2', 'B2'),
  C: squelch('C3', 'G2'),
  B: squelch('B2', 'F#2'),
  Am: squelch('A2', 'E3'),
  D: squelch('D3', 'A2'),
  F: squelch('F2', 'C3'),
};

/** Two croaks off the beat, twice a bar. */
const croak = (a: string, b: string): string => `-:2 ${a}:1 ${a}:1 -:4 -:2 ${b}:1 ${b}:1 -:4`;
const SWAMP_CROAK: Record<string, string> = {
  Em: croak('G3', 'B3'),
  C: croak('G3', 'C4'),
  B: croak('F#3', 'B3'),
  Am: croak('A3', 'C4'),
  D: croak('F#3', 'A3'),
  F: croak('A3', 'C4'),
};

const S_ONE = 'k.....h.s.....h.';
const S_TOM = 'k.....h.s...t.t.';
const SWAMP_DRUMS = [S_ONE, S_ONE, S_ONE, S_TOM, S_ONE, S_ONE, S_ONE, S_TOM, S_ONE, S_ONE, S_ONE, S_TOM, S_ONE, S_ONE, S_TOM, S_TOM];

const SWAMP = makeTrack(92, 'E minor', 16, [
  toneCh('lead', { wave: 'p50', vol: 0.12, gate: 0.85, sus: 0.5, echo: [4, 0.25] }, SWAMP_LEAD),
  toneCh('croak', { wave: 'p12', vol: 0.06, gate: 0.5, sus: 0.2 }, byChord(SWAMP_CHORDS, SWAMP_CROAK)),
  toneCh('bass', { wave: 'tri', vol: 0.38, gate: 0.85, sus: 0.7 }, byChord(SWAMP_CHORDS, SWAMP_BASS)),
  drumCh(0.2, SWAMP_DRUMS),
]);

// --- temple: a slow drowned chant, B minor, 3/4 (12 steps per bar), 16 bars --

const TEMPLE_CHORDS = 'Bm Bm G F# Bm Bm Em F# D A G F# Em Bm G F#';

const TEMPLE_LEAD = [
  'B4:6 D5:6',
  'F#5:8 E5:4',
  'D5:6 B4:6',
  'A#4:8 C#5:4',
  'B4:4 D5:4 F#5:4',
  'B5:8 A5:4',
  'G5:6 E5:6',
  'F#5:12',
  'A5:6 F#5:6',
  'E5:8 C#5:4',
  'D5:6 B4:6',
  'C#5:8 A#4:4',
  'E5:4 G5:4 B5:4',
  'F#5:8 D5:4',
  'G5:6 B4:6',
  'A#4:6 F#4:6',
];

/** A held root, then the fifth. */
const drone = (r: string, f: string): string => `${r}:8 ${f}:4`;
const TEMPLE_BASS: Record<string, string> = {
  Bm: drone('B2', 'F#3'),
  G: drone('G2', 'D3'),
  'F#': drone('F#2', 'C#3'),
  Em: drone('E2', 'B2'),
  D: drone('D3', 'A2'),
  A: drone('A2', 'E3'),
};

/** Two bells a bar, high and far away. */
const bells = (a: string, b: string): string => `-:4 ${a}:2 -:2 ${b}:2 -:2`;
const TEMPLE_BELLS: Record<string, string> = {
  Bm: bells('B5', 'F#5'),
  G: bells('B5', 'G5'),
  'F#': bells('A#5', 'F#5'),
  Em: bells('G5', 'E5'),
  D: bells('A5', 'F#5'),
  A: bells('A5', 'E5'),
};

const T_TOLL = 't...........';
const T_STEP = 'k.....h.....';
const TEMPLE_DRUMS = [T_TOLL, T_STEP, T_STEP, T_STEP, T_TOLL, T_STEP, T_STEP, T_STEP, T_TOLL, T_STEP, T_STEP, T_STEP, T_TOLL, T_STEP, T_STEP, T_TOLL];

const TEMPLE = makeTrack(84, 'B minor', 12, [
  toneCh('lead', { wave: 'tri', vol: 0.2, gate: 0.95, sus: 0.8, layer: { wave: 'p25', vol: 0.04, semis: 12 } }, TEMPLE_LEAD),
  toneCh('bells', { wave: 'p12', vol: 0.05, gate: 0.4, sus: 0.15, echo: [3, 0.4] }, byChord(TEMPLE_CHORDS, TEMPLE_BELLS)),
  toneCh('bass', { wave: 'tri', vol: 0.36, gate: 0.95, sus: 0.85 }, byChord(TEMPLE_CHORDS, TEMPLE_BASS)),
  drumCh(0.2, TEMPLE_DRUMS),
]);

/** Exported for tooling and tests; the game only needs `audio`. */
export const MUSIC: Record<MusicTrack, TrackData> = { hub: HUB, forest: FOREST, cave: CAVE, swamp: SWAMP, temple: TEMPLE, boss: BOSS };

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

interface Engine {
  c: AudioContext;
  music: GainNode;
  sfx: GainNode;
  noise: AudioBuffer;
  waves: Partial<Record<Wave, PeriodicWave>>;
}

const TICK_MS = 30;
const LOOKAHEAD = 0.16;
const FADE = 0.4;
const SFX_MIN_GAP_MS = 40;

let eng: Engine | null = null;
const vols = { music: 0.35, sfx: 0.6 };
let lastResumeAt = 0;

function quiet(p: Promise<void> | undefined): void {
  if (p && typeof p.catch === 'function') p.catch(() => {});
}

function isHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden === true;
}

/** Band-limited pulse wave, slightly rolled off so it never gets piercing. */
function pulseWave(c: AudioContext, duty: number): PeriodicWave {
  const harmonics = 32;
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let k = 1; k <= harmonics; k++) {
    const x = (Math.PI * k) / (harmonics + 1);
    const taper = Math.sin(x) / x;
    real[k] = ((2 * Math.sin(2 * Math.PI * k * duty)) / (Math.PI * k)) * taper;
    imag[k] = ((2 * (1 - Math.cos(2 * Math.PI * k * duty))) / (Math.PI * k)) * taper;
  }
  return c.createPeriodicWave(real, imag);
}

function createEngine(): Engine | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    const c = new Ctor();

    // music -> lowpass --\
    //                     +--> limiter -> headroom -> speakers
    // sfx ---------------/
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.2;
    const headroom = c.createGain();
    headroom.gain.value = 0.85;
    limiter.connect(headroom);
    headroom.connect(c.destination);

    const music = c.createGain();
    music.gain.value = vols.music;
    const soften = c.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 6500;
    soften.Q.value = 0.5;
    music.connect(soften);
    soften.connect(limiter);

    const sfx = c.createGain();
    sfx.gain.value = vols.sfx;
    sfx.connect(limiter);

    const noise = c.createBuffer(1, Math.floor(c.sampleRate * 2), c.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const waves: Partial<Record<Wave, PeriodicWave>> = {};
    try {
      waves.p50 = pulseWave(c, 0.5);
      waves.p25 = pulseWave(c, 0.25);
      waves.p12 = pulseWave(c, 0.125);
    } catch {
      // Plain square oscillators are used instead.
    }

    return { c, music, sfx, noise, waves };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Synth primitives
// ---------------------------------------------------------------------------

interface ToneOpts {
  w: Wave;
  /** Frequency in Hz. */
  f: number;
  /** Slide target in Hz, reached at the end of the note. */
  f2?: number;
  /** Duration in seconds. */
  d: number;
  /** Peak gain. */
  v: number;
  a?: number;
  r?: number;
  /** Sustain level relative to peak; 1 holds flat, 0 decays to silence. */
  s?: number;
  /** Vibrato: [rate in Hz, depth in Hz]. */
  vib?: [number, number];
}

interface NoiseOpts {
  ft: BiquadFilterType;
  f: number;
  f2?: number;
  q?: number;
  d: number;
  v: number;
  a?: number;
  r?: number;
  s?: number;
}

/** Attack, exponential decay toward the sustain level, short linear release. */
function envelope(p: AudioParam, t: number, d: number, v: number, a: number, r: number, s: number): void {
  const attack = Math.min(a, d * 0.4);
  const release = Math.min(r, d * 0.4);
  const hold = d - attack - release;
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(v, t + attack);
  let level = v;
  if (s < 1 && hold > 0.004) {
    p.setTargetAtTime(v * s, t + attack, hold / 3);
    // Where the decay curve has got to after three time constants.
    level = v * (s + (1 - s) * Math.exp(-3));
  }
  p.setValueAtTime(level, t + d - release);
  p.linearRampToValueAtTime(0, t + d);
}

function tone(e: Engine, dest: AudioNode, t: number, o: ToneOpts): void {
  const c = e.c;
  const osc = c.createOscillator();
  const wave = e.waves[o.w];
  if (wave) osc.setPeriodicWave(wave);
  else if (o.w === 'tri') osc.type = 'triangle';
  else if (o.w === 'saw') osc.type = 'sawtooth';
  else if (o.w === 'sine') osc.type = 'sine';
  else osc.type = 'square';

  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + o.d);

  const stopAt = t + o.d + 0.02;
  if (o.vib) {
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = o.vib[0];
    depth.gain.value = o.vib[1];
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(stopAt);
  }

  const g = c.createGain();
  envelope(g.gain, t, o.d, o.v, o.a ?? 0.004, o.r ?? 0.02, o.s ?? 0.6);
  osc.connect(g);
  g.connect(dest);
  osc.start(t);
  osc.stop(stopAt);
}

function noise(e: Engine, dest: AudioNode, t: number, o: NoiseOpts): void {
  const c = e.c;
  const src = c.createBufferSource();
  src.buffer = e.noise;
  src.loop = true;

  const filter = c.createBiquadFilter();
  filter.type = o.ft;
  filter.Q.value = o.q ?? 0.8;
  filter.frequency.setValueAtTime(o.f, t);
  if (o.f2 !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + o.d);

  const g = c.createGain();
  envelope(g.gain, t, o.d, o.v, o.a ?? 0.002, o.r ?? 0.01, o.s ?? 0);
  src.connect(filter);
  filter.connect(g);
  g.connect(dest);
  src.start(t, Math.random() * 1.5);
  src.stop(t + o.d + 0.02);
}

function drum(e: Engine, dest: AudioNode, t: number, hit: DrumHit, vol: number): void {
  switch (hit) {
    case 'k':
      tone(e, dest, t, { w: 'tri', f: 150, f2: 48, d: 0.11, v: vol, s: 0.15, a: 0.002 });
      noise(e, dest, t, { ft: 'lowpass', f: 1200, d: 0.02, v: vol * 0.3 });
      break;
    case 's':
      noise(e, dest, t, { ft: 'bandpass', f: 1900, q: 0.6, d: 0.1, v: vol * 0.6 });
      tone(e, dest, t, { w: 'tri', f: 200, f2: 130, d: 0.06, v: vol * 0.45, s: 0.2, a: 0.002 });
      break;
    case 'h':
      noise(e, dest, t, { ft: 'highpass', f: 6500, d: 0.035, v: vol * 0.28 });
      break;
    case 'o':
      noise(e, dest, t, { ft: 'highpass', f: 6000, d: 0.14, v: vol * 0.24 });
      break;
    case 't':
      tone(e, dest, t, { w: 'tri', f: 130, f2: 70, d: 0.16, v: vol * 0.9, s: 0.2, a: 0.002 });
      break;
  }
}

// ---------------------------------------------------------------------------
// Sound effects
// ---------------------------------------------------------------------------

interface Fx {
  e: Engine;
  /** Start time on the context clock. */
  t: number;
  /** Small random pitch factor, used by the sounds that repeat constantly. */
  k: number;
}

type ToneExtra = Partial<Pick<ToneOpts, 'f2' | 'a' | 'r' | 's' | 'vib'>>;
type NoiseExtra = Partial<Pick<NoiseOpts, 'f2' | 'q' | 'a' | 'r' | 's'>>;

/** Tone at `at` seconds after the effect starts. */
function T(x: Fx, w: Wave, f: number, at: number, d: number, v: number, o: ToneExtra = {}): void {
  tone(x.e, x.e.sfx, x.t + at, { w, f, d, v, ...o });
}

/** Filtered noise burst at `at` seconds after the effect starts. */
function N(x: Fx, ft: BiquadFilterType, f: number, at: number, d: number, v: number, o: NoiseExtra = {}): void {
  noise(x.e, x.e.sfx, x.t + at, { ft, f, d, v, ...o });
}

const phraseCache = new Map<string, NoteEv[]>();

/** A short phrase in the music notation, `unit` seconds per length unit. */
function Q(x: Fx, w: Wave, src: string, at: number, unit: number, v: number, o: ToneExtra = {}): void {
  let events = phraseCache.get(src);
  if (!events) {
    events = parseNotes(src).events;
    phraseCache.set(src, events);
  }
  for (const ev of events) {
    for (const m of ev.midis) {
      tone(x.e, x.e.sfx, x.t + at + ev.step * unit, { w, f: hz(m), d: ev.len * unit * 0.95, v, s: 0.5, ...o });
    }
  }
}

const SFX: Record<SfxName, (x: Fx) => void> = {
  // --- interface ---
  ui: (x) => {
    T(x, 'p25', 1047, 0, 0.045, 0.15, { s: 0.3 });
  },
  deny: (x) => {
    T(x, 'p50', 185, 0, 0.07, 0.2);
    T(x, 'p50', 139, 0.085, 0.12, 0.2);
  },
  buy: (x) => {
    N(x, 'highpass', 6000, 0, 0.03, 0.12);
    Q(x, 'p25', 'E5:1 G#5:1 B5:1 E6:4', 0, 0.05, 0.16, { s: 0.3 });
  },
  turn: (x) => {
    Q(x, 'tri', 'G5:1 D6:1 G6:2', 0, 0.06, 0.34);
    Q(x, 'p12', 'G5:1 D6:1 G6:2', 0, 0.06, 0.035);
  },

  // --- combat: short, soft-edged, slightly different every time ---
  punch: (x) => {
    N(x, 'lowpass', 900 * x.k, 0, 0.07, 0.4, { f2: 200 });
    T(x, 'tri', 190 * x.k, 0, 0.08, 0.45, { f2: 60, s: 0.2 });
  },
  swing: (x) => {
    N(x, 'bandpass', 700 * x.k, 0, 0.12, 0.38, { f2: 2600 * x.k, q: 1.5, a: 0.02, s: 0.4 });
    T(x, 'tri', 420 * x.k, 0, 0.09, 0.1, { f2: 180 });
  },
  shoot: (x) => {
    T(x, 'tri', 980 * x.k, 0, 0.09, 0.3, { f2: 320 * x.k, s: 0.2 });
    N(x, 'highpass', 3500, 0, 0.035, 0.16);
  },
  hit: (x) => {
    N(x, 'bandpass', 2000 * x.k, 0, 0.05, 0.32, { q: 0.8 });
    T(x, 'p25', 540 * x.k, 0, 0.06, 0.18, { f2: 250 * x.k, s: 0.3 });
  },
  hurt: (x) => {
    T(x, 'p50', 250 * x.k, 0, 0.05, 0.22);
    T(x, 'p50', 180 * x.k, 0.05, 0.085, 0.22, { f2: 95 * x.k });
    N(x, 'lowpass', 1200, 0, 0.05, 0.2);
  },
  block: (x) => {
    T(x, 'p12', 1245, 0, 0.09, 0.15, { s: 0.1 });
    T(x, 'p12', 1865, 0, 0.07, 0.09, { s: 0.1 });
    T(x, 'tri', 220, 0, 0.05, 0.3, { f2: 140 });
    N(x, 'highpass', 4000, 0, 0.025, 0.2);
  },
  dash: (x) => {
    N(x, 'bandpass', 500, 0, 0.16, 0.3, { f2: 4000, q: 2, s: 0.4 });
    T(x, 'p12', 330, 0, 0.12, 0.09, { f2: 990 });
  },

  // --- spells and bombs ---
  fire: (x) => {
    T(x, 'saw', 240, 0, 0.16, 0.14, { f2: 880 });
    T(x, 'p25', 440, 0.02, 0.2, 0.09, { f2: 1320, s: 0.2 });
    N(x, 'bandpass', 700, 0, 0.32, 0.4, { f2: 3200, q: 0.9, s: 0.3 });
  },
  frost: (x) => {
    Q(x, 'p12', 'C7:1 G6:1 E6:1 C6:1 G5:1 E5:2', 0, 0.04, 0.12, { s: 0.3 });
    T(x, 'tri', 1320, 0, 0.3, 0.12, { f2: 440 });
    N(x, 'highpass', 5000, 0, 0.35, 0.14, { f2: 9000, s: 0.3 });
  },
  explode: (x) => {
    N(x, 'lowpass', 2400, 0, 0.6, 0.7, { f2: 90, s: 0.15 });
    T(x, 'tri', 130, 0, 0.45, 0.6, { f2: 32, s: 0.3 });
    T(x, 'p50', 90, 0, 0.25, 0.16, { f2: 40 });
  },

  // --- water, gas and stone (map 2) ---
  splash: (x) => {
    N(x, 'lowpass', 2200, 0, 0.38, 0.5, { f2: 320, s: 0.2 });
    T(x, 'tri', 320, 0, 0.2, 0.2, { f2: 90 });
    N(x, 'highpass', 4200, 0.04, 0.22, 0.1, { s: 0.2 });
  },
  poison: (x) => {
    N(x, 'highpass', 2800, 0, 0.45, 0.16, { f2: 6500, a: 0.04, s: 0.4 });
    T(x, 'p12', 233 * x.k, 0, 0.3, 0.08, { f2: 165, vib: [14, 8] });
  },
  zap: (x) => {
    T(x, 'saw', 1900 * x.k, 0, 0.11, 0.12, { f2: 320 });
    T(x, 'p12', 2600, 0.02, 0.08, 0.07, { f2: 900, s: 0.2 });
    N(x, 'highpass', 5000, 0, 0.1, 0.14, { s: 0.2 });
  },
  crumble: (x) => {
    N(x, 'lowpass', 900, 0, 0.42, 0.45, { f2: 150, s: 0.3 });
    T(x, 'p50', 110, 0, 0.3, 0.14, { f2: 48 });
    N(x, 'bandpass', 1800, 0.08, 0.12, 0.16, { q: 2, s: 0.2 });
  },
  valve: (x) => {
    N(x, 'bandpass', 520, 0.1, 1.1, 0.34, { f2: 1500, q: 0.8, a: 0.15, s: 0.5 });
    T(x, 'tri', 82, 0, 0.5, 0.3, { f2: 60, s: 0.7 });
  },

  // --- deaths ---
  monsterDie: (x) => {
    Q(x, 'p25', 'C5:1 G4:1 E4:1 C4:1 G3:1', 0, 0.045, 0.17);
    T(x, 'p50', 300, 0.2, 0.15, 0.13, { f2: 60 });
    N(x, 'lowpass', 1800, 0, 0.3, 0.3, { f2: 200, s: 0.2 });
  },
  death: (x) => {
    Q(x, 'p25', 'B4:2 A4:2 G4:2 E4:3', 0, 0.075, 0.19);
    T(x, 'tri', 165, 0.68, 0.6, 0.45, { f2: 55 });
    T(x, 'p50', 165, 0.68, 0.5, 0.11, { f2: 55, vib: [9, 6] });
  },

  // --- pickups ---
  pickup: (x) => {
    Q(x, 'p25', 'E5:1 A5:2', 0, 0.05, 0.16);
  },
  coin: (x) => {
    Q(x, 'p25', 'B5:1 E6:4', 0, 0.06, 0.15, { s: 0.1 });
  },
  heart: (x) => {
    Q(x, 'tri', 'C5:1 E5:1 G5:1 C6:3', 0, 0.065, 0.4);
    Q(x, 'p50', 'C5:1 E5:1 G5:1 C6:3', 0, 0.065, 0.05);
  },
  key: (x) => {
    Q(x, 'p12', 'A5:1 C#6:1 E6:1 A6:3', 0, 0.05, 0.14, { s: 0.3 });
  },

  // --- dungeon furniture ---
  door: (x) => {
    T(x, 'p50', 82, 0, 0.26, 0.13, { f2: 124, s: 0.9 });
    N(x, 'lowpass', 500, 0, 0.28, 0.3, { f2: 300, s: 0.8, a: 0.02 });
    T(x, 'tri', 95, 0.28, 0.12, 0.5, { f2: 48 });
    N(x, 'lowpass', 800, 0.28, 0.07, 0.35);
  },
  lever: (x) => {
    N(x, 'bandpass', 1600, 0, 0.03, 0.3, { q: 2 });
    T(x, 'p50', 233, 0, 0.04, 0.15);
    N(x, 'bandpass', 900, 0.09, 0.04, 0.35, { q: 2 });
    T(x, 'p50', 156, 0.09, 0.07, 0.17);
  },
  plate: (x) => {
    N(x, 'bandpass', 750, 0, 0.035, 0.35, { q: 1.5 });
    T(x, 'tri', 210, 0, 0.06, 0.4, { f2: 120 });
  },
  push: (x) => {
    for (let i = 0; i < 3; i++) {
      N(x, 'bandpass', 320 + i * 40, i * 0.09, 0.085, 0.4, { q: 0.9, a: 0.015, s: 0.6 });
    }
    T(x, 'tri', 62, 0, 0.28, 0.35, { s: 0.8 });
  },
  chest: (x) => {
    N(x, 'lowpass', 700, 0, 0.06, 0.35);
    T(x, 'tri', 150, 0, 0.07, 0.35, { f2: 90 });
    Q(x, 'p25', 'G4:1 C5:1 E5:1 G5:4', 0.09, 0.07, 0.16);
  },
  torch: (x) => {
    N(x, 'bandpass', 500, 0, 0.3, 0.35, { f2: 3000, q: 0.8, a: 0.03, s: 0.4 });
    T(x, 'saw', 150, 0, 0.18, 0.09, { f2: 420 });
    N(x, 'highpass', 5000, 0.12, 0.2, 0.07);
  },

  // --- puzzle feedback and jingles ---
  wrong: (x) => {
    T(x, 'p50', 311, 0, 0.13, 0.18);
    T(x, 'saw', 220, 0, 0.13, 0.09);
    T(x, 'p50', 208, 0.15, 0.26, 0.18);
    T(x, 'saw', 147, 0.15, 0.26, 0.09);
  },
  solved: (x) => {
    Q(x, 'p25', 'G4:1 C5:1 E5:1 G5:1 E5:1 G5:1 C6:5', 0, 0.08, 0.16);
    Q(x, 'p50', '-:6 E5:5', 0, 0.08, 0.07);
    Q(x, 'tri', 'C3:6 C4:5', 0, 0.08, 0.4);
  },
  secret: (x) => {
    Q(x, 'p12', 'A4:1 C5:1 E5:1 G#5:1 B5:1 E6:5', 0, 0.07, 0.15);
    Q(x, 'p12', 'A4:1 C5:1 E5:1 G#5:1 B5:1 E6:5', 0.105, 0.07, 0.05);
    T(x, 'tri', noteHz('A3'), 0.35, 0.42, 0.3);
  },
  checkpoint: (x) => {
    Q(x, 'p25', 'D4:1 F#4:1 A4:1 D5:2 B4:1 D5:1 F#5:4', 0, 0.1, 0.15);
    Q(x, 'p50', '-:3 F#4:2 G4:2 A4:4', 0, 0.1, 0.06);
    Q(x, 'tri', 'D3:5 G3:2 D3:4', 0, 0.1, 0.4);
  },
  life: (x) => {
    Q(x, 'p25', 'C5:1 E5:1 G5:1 E5:1 G5:1 C6:1 E6:1 G6:3', 0, 0.065, 0.14);
    Q(x, 'tri', 'C4:3 G4:2 C5:5', 0, 0.065, 0.3);
  },
  victory: (x) => {
    Q(x, 'p25', 'G4:1 C5:1 E5:1 G5:2 E5:1 G5:1 A5:1 B5:1 C6:5', 0, 0.105, 0.16);
    Q(x, 'p50', 'E4:1 G4:1 C5:1 E5:2 C5:1 E5:1 F5:1 G5:1 E5:5', 0, 0.105, 0.07);
    Q(x, 'tri', 'C3:3 C3:2 G3:2 F3:1 G3:1 C3:5', 0, 0.105, 0.42);
    N(x, 'highpass', 6000, 0.945, 0.3, 0.08, { s: 0.2 });
  },
  gameover: (x) => {
    Q(x, 'p50', 'A4:2 G4:2 F4:2 E4:6', 0, 0.115, 0.16);
    Q(x, 'p25', 'C5:2 B4:2 A4:2 G#4:6', 0, 0.115, 0.06);
    Q(x, 'tri', 'A2:4 F2:2 E2:6', 0, 0.115, 0.42, { s: 0.8 });
  },

  // --- boss ---
  bossRoar: (x) => {
    T(x, 'saw', 120, 0, 0.9, 0.28, { f2: 52, vib: [26, 14], a: 0.05, s: 0.8 });
    T(x, 'saw', 127, 0, 0.9, 0.2, { f2: 49, vib: [31, 10], a: 0.05, s: 0.8 });
    T(x, 'tri', 60, 0, 0.9, 0.4, { f2: 38, s: 0.8 });
    N(x, 'lowpass', 900, 0, 0.9, 0.35, { f2: 220, a: 0.08, s: 0.6 });
  },
  phase: (x) => {
    N(x, 'lowpass', 4000, 0, 0.35, 0.5, { f2: 200, s: 0.15 });
    Q(x, 'p25', 'E6:1 B5:1 G5:1 E5:1 B4:1', 0, 0.05, 0.15);
    T(x, 'saw', noteHz('E3'), 0.3, 0.5, 0.15, { s: 0.5 });
    T(x, 'saw', noteHz('B3'), 0.3, 0.5, 0.11, { s: 0.5 });
    T(x, 'p25', noteHz('E5'), 0.3, 0.5, 0.11, { s: 0.4 });
  },

  // --- title screen ---
  pop: (x) => {
    // a sharp crack with a little knock of wood under it, then two sparks spitting
    N(x, 'bandpass', 2300 * x.k, 0, 0.03, 0.5, { q: 1.4, a: 0.0005 });
    N(x, 'highpass', 4800, 0, 0.01, 0.22, { a: 0.0005 });
    T(x, 'tri', 190 * x.k, 0, 0.07, 0.2, { f2: 70, s: 0.1, a: 0.001 });
    N(x, 'bandpass', 3600 * x.k, 0.055, 0.006, 0.2, { q: 3, a: 0.0005 });
    N(x, 'bandpass', 5000 * x.k, 0.1, 0.005, 0.13, { q: 3, a: 0.0005 });
  },
};

const lastSfxAt: Partial<Record<SfxName, number>> = {};

// ---------------------------------------------------------------------------
// Ambience: the campfire
// ---------------------------------------------------------------------------
//
// Three beds of looping noise (a low roar that breathes, the flutter of the
// flames, a trace of hiss) and, over them, crackles: clicks of band-passed
// noise a few milliseconds long, scattered at random and mostly in little runs.

interface Amb {
  gain: GainNode;
  roar: GainNode;
  sources: AudioBufferSourceNode[];
  nextCrackle: number;
  nextBreath: number;
}

const AMB_IN = 1.5;
const AMB_OUT = 0.6;
const ROAR = 0.4;

/** What the game last asked for; survives until unlock() if there is no context yet. */
let wantedAmb: Ambience | null = null;
let amb: Amb | null = null;

function startCampfire(e: Engine): void {
  const c = e.c;
  const now = c.currentTime;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + AMB_IN);
  gain.connect(e.sfx);
  const roar = c.createGain();
  roar.gain.value = ROAR;
  roar.connect(gain);

  // Each bed plays the shared noise at its own speed, so the loops never line up.
  const bed = (rate: number, ft: BiquadFilterType, f: number, q: number, v: number, dest: AudioNode): AudioBufferSourceNode => {
    const src = c.createBufferSource();
    src.buffer = e.noise;
    src.loop = true;
    src.playbackRate.value = rate;
    const filter = c.createBiquadFilter();
    filter.type = ft;
    filter.frequency.value = f;
    filter.Q.value = q;
    const g = c.createGain();
    g.gain.value = v;
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(now, Math.random() * 1.5);
    return src;
  };
  amb = {
    gain,
    roar,
    sources: [bed(0.47, 'lowpass', 240, 0.5, 1, roar), bed(0.81, 'bandpass', 560, 0.7, 0.3, roar), bed(1, 'highpass', 5200, 0.4, 0.016, gain)],
    nextCrackle: now + 0.3,
    nextBreath: now,
  };
}

function stopAmbience(e: Engine): void {
  const a = amb;
  if (!a) return;
  amb = null;
  const now = e.c.currentTime;
  const g = a.gain.gain;
  const level = g.value;
  g.cancelScheduledValues(now);
  g.setValueAtTime(level, now);
  g.linearRampToValueAtTime(0, now + AMB_OUT);
  a.sources[0].onended = () => a.gain.disconnect();
  for (const src of a.sources) src.stop(now + AMB_OUT + 0.05);
}

function switchAmbience(e: Engine, name: Ambience | null): void {
  stopAmbience(e);
  if (name) startCampfire(e);
  syncTimer();
}

function scheduleAmbience(e: Engine, a: Amb, now: number): void {
  while (a.nextCrackle < now + LOOKAHEAD) {
    const t = Math.max(a.nextCrackle, now + 0.005);
    // Mostly faint ticks, now and then a sharp snap.
    const snap = Math.random() ** 3;
    const d = 0.003 + Math.random() * 0.006 + snap * 0.022;
    noise(e, a.gain, t, { ft: 'bandpass', f: 900 * 2 ** (Math.random() * 2.6), q: 1.2 + Math.random() * 3, d, v: 0.05 + snap * 0.4, a: 0.0005, r: d * 0.6 });
    // A crackle is usually followed at once by another; the runs are spaced out at random.
    a.nextCrackle = t + (Math.random() < 0.4 ? 0.012 + Math.random() * 0.05 : -Math.log(1 - Math.random()) * 0.3);
  }
  if (now >= a.nextBreath) {
    a.nextBreath = now + 0.12 + Math.random() * 0.25;
    a.roar.gain.setTargetAtTime(ROAR * (0.65 + Math.random() * 0.7), now, 0.18);
  }
}

// ---------------------------------------------------------------------------
// Music player
// ---------------------------------------------------------------------------

interface Player {
  track: TrackData;
  gain: GainNode;
  /** Context time of step 0 of loop 0. */
  t0: number;
  /** Next event index per channel. */
  idx: number[];
  /** Loop count per channel. */
  loop: number[];
  /** Nothing is scheduled at or after this time. */
  stopAt: number;
}

/** What the game last asked for; survives until unlock() if there is no context yet. */
let wanted: MusicTrack | null = null;
let current: Player | null = null;
const fading: Player[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let listening = false;

function startTrack(e: Engine, name: MusicTrack): void {
  const now = e.c.currentTime;
  const track = MUSIC[name];
  const gain = e.c.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + FADE);
  gain.connect(e.music);
  current = {
    track,
    gain,
    t0: now + 0.06,
    idx: track.channels.map(() => 0),
    loop: track.channels.map(() => 0),
    stopAt: Infinity,
  };
}

function fadeOutCurrent(e: Engine): void {
  const p = current;
  if (!p) return;
  current = null;
  const now = e.c.currentTime;
  const g = p.gain.gain;
  const level = g.value;
  g.cancelScheduledValues(now);
  g.setValueAtTime(level, now);
  g.linearRampToValueAtTime(0, now + FADE);
  p.stopAt = now + FADE;
  fading.push(p);
}

function switchTo(e: Engine, name: MusicTrack | null): void {
  fadeOutCurrent(e);
  if (name) startTrack(e, name);
  syncTimer();
}

function playEvent(e: Engine, p: Player, ch: Channel, ev: NoteEv | DrumEv, time: number): void {
  if (ch.kind === 'drums') {
    drum(e, p.gain, time, (ev as DrumEv).hit, ch.vol);
    return;
  }
  const note = ev as NoteEv;
  const sd = p.track.stepDur;
  const d = Math.max(0.03, note.len * sd * ch.gate);
  for (const m of note.midis) {
    const f = hz(m);
    tone(e, p.gain, time, { w: ch.wave, f, d, v: ch.vol, a: 0.006, r: 0.03, s: ch.sus });
    if (ch.layer) {
      const lf = f * 2 ** (ch.layer.semis / 12);
      tone(e, p.gain, time, { w: ch.layer.wave, f: lf, d, v: ch.layer.vol, a: 0.006, r: 0.03, s: ch.sus });
    }
    if (ch.echo) {
      const at = time + ch.echo[0] * sd;
      tone(e, p.gain, at, { w: ch.wave, f, d, v: ch.vol * ch.echo[1], a: 0.006, r: 0.03, s: ch.sus });
    }
  }
}

function schedule(e: Engine, p: Player, now: number): void {
  const { channels, steps, stepDur } = p.track;
  const timeOf = (i: number): number =>
    p.t0 + (p.loop[i] * steps + channels[i].events[p.idx[i]].step) * stepDur;

  // If the timer was starved (throttled tab, long frame), slide the whole
  // track forward rather than firing a burst of late notes.
  let earliest = Infinity;
  for (let i = 0; i < channels.length; i++) {
    if (channels[i].events.length) earliest = Math.min(earliest, timeOf(i));
  }
  if (earliest < now - 0.02) p.t0 += now + 0.03 - earliest;

  const horizon = now + LOOKAHEAD;
  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    const count = ch.events.length;
    if (!count) continue;
    for (;;) {
      const time = timeOf(i);
      if (time >= horizon) break;
      if (time < p.stopAt) playEvent(e, p, ch, ch.events[p.idx[i]], time);
      if (++p.idx[i] >= count) {
        p.idx[i] = 0;
        p.loop[i]++;
      }
    }
  }
}

function tick(): void {
  const e = eng;
  if (!e) return;
  try {
    const now = e.c.currentTime;
    for (let i = fading.length - 1; i >= 0; i--) {
      if (now >= fading[i].stopAt + 0.25) {
        fading[i].gain.disconnect();
        fading.splice(i, 1);
      }
    }
    if (current) schedule(e, current, now);
    for (const p of fading) schedule(e, p, now);
    if (amb) scheduleAmbience(e, amb, now);
  } catch {
    // Audio must never take the game down.
  }
  if (!current && fading.length === 0 && !amb) stopTimer();
}

function stopTimer(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

/** Runs the scheduler only while something is playing and the page is visible. */
function syncTimer(): void {
  const needed = eng !== null && (current !== null || fading.length > 0 || amb !== null) && !isHidden();
  if (needed && timer === null) {
    timer = setInterval(tick, TICK_MS);
    tick();
  } else if (!needed) {
    stopTimer();
  }
}

function resumeContext(e: Engine): void {
  if (e.c.state === 'running' || isHidden()) return;
  lastResumeAt = Date.now();
  try {
    quiet(e.c.resume());
  } catch {
    // Ignored: the next unlock() tries again.
  }
}

function onVisibilityChange(): void {
  const e = eng;
  if (!e) return;
  if (isHidden()) {
    // Freeze the audio clock so music picks up exactly where it stopped.
    stopTimer();
    try {
      quiet(e.c.suspend());
    } catch {
      // Ignored.
    }
  } else {
    lastResumeAt = Date.now();
    try {
      quiet(e.c.resume());
    } catch {
      // Ignored: the next unlock() tries again.
    }
    syncTimer();
  }
}

function clamp01(v: number, fallback: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : fallback;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const audio: AudioApi = {
  unlock(): void {
    if (!eng) {
      eng = createEngine();
      if (!eng) return;
      lastResumeAt = Date.now();
      if (!listening && typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', onVisibilityChange);
        listening = true;
      }
      if (wanted) switchTo(eng, wanted);
      if (wantedAmb) switchAmbience(eng, wantedAmb);
    }
    resumeContext(eng);
  },

  sfx(name: SfxName): void {
    const e = eng;
    if (!e) return;
    const play = SFX[name];
    if (!play) return;
    // A context that is not running would queue everything up and fire it all
    // at once later, so drop instead (allowing for a resume that is in flight).
    if (e.c.state !== 'running' && Date.now() - lastResumeAt > 300) return;
    const stamp = Date.now();
    const last = lastSfxAt[name];
    if (last !== undefined && stamp - last < SFX_MIN_GAP_MS && stamp >= last) return;
    lastSfxAt[name] = stamp;
    try {
      play({ e, t: e.c.currentTime + 0.003, k: 1 + (Math.random() * 2 - 1) * 0.07 });
    } catch {
      // Audio must never take the game down.
    }
  },

  music(track: MusicTrack | null): void {
    if (track === wanted) return;
    wanted = track;
    if (!eng) return;
    try {
      switchTo(eng, track);
    } catch {
      // Audio must never take the game down.
    }
  },

  ambience(name: Ambience | null): void {
    if (name === wantedAmb) return;
    wantedAmb = name;
    if (!eng) return;
    try {
      switchAmbience(eng, name);
    } catch {
      // Audio must never take the game down.
    }
  },

  setVolumes(music: number, sfx: number): void {
    vols.music = clamp01(music, vols.music);
    vols.sfx = clamp01(sfx, vols.sfx);
    const e = eng;
    if (!e) return;
    const now = e.c.currentTime;
    e.music.gain.cancelScheduledValues(now);
    e.music.gain.setTargetAtTime(vols.music, now, 0.012);
    e.sfx.gain.cancelScheduledValues(now);
    e.sfx.gain.setTargetAtTime(vols.sfx, now, 0.012);
  },

  getVolumes(): { music: number; sfx: number } {
    return { music: vols.music, sfx: vols.sfx };
  },
};
