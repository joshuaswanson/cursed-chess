import { audio, noiseSource, sfx } from "./sfx";

// A dark synth track, sequenced and synthesized live like the sound
// effects: a slow, smooth melody and held chords over busy sixteenth-note
// drums. A four-bar intro, then a loop that builds, drops out briefly, and
// comes back harder.

const BPM = 128;
const STEP = 60 / BPM / 4;
const STEPS_PER_BAR = 16;
/** Schedule notes this far ahead, so the beat stays tight when the page is busy */
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;
const VOLUME = 0.3;

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** E minor: Em, C, D, and B major to pull back to Em, as bass roots with their chord tones above */
const CHORDS = [
  { root: 40, tones: [0, 3, 7] },
  { root: 36, tones: [0, 4, 7] },
  { root: 38, tones: [0, 4, 7] },
  { root: 35, tones: [0, 4, 7] },
];

const _ = null;
/** The lead line, eight bars over two turns of the chords: each note holds until the next one, or to the end of its bar */
const LEAD: (number | null)[][] = [
  [71, _, _, _, _, _, _, _, 74, _, _, _, 76, _, _, _],
  [76, _, _, _, _, _, _, _, _, _, _, _, 74, _, _, _],
  [74, _, _, _, _, _, _, _, 78, _, _, _, 74, _, _, _],
  [75, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [79, _, _, _, _, _, _, _, 78, _, _, _, 76, _, _, _],
  [76, _, _, _, _, _, _, _, 72, _, _, _, _, _, _, _],
  [74, _, _, _, _, _, 78, _, _, _, _, _, 81, _, _, _],
  [78, _, _, _, _, _, _, _, 75, _, _, _, _, _, _, _],
];
const ARP_ORDER = [0, 1, 2, 3, 2, 1, 2, 1];

interface Section {
  kick: boolean;
  clap: boolean;
  hats: boolean;
  bass: boolean;
  arp: boolean;
  lead: boolean;
  /** The lead doubled an octave up, for the last and biggest section */
  soar: boolean;
  pad: boolean;
}

const quiet: Section = {
  kick: false,
  clap: false,
  hats: false,
  bass: false,
  arp: false,
  lead: false,
  soar: false,
  pad: true,
};
const INTRO: Section = { ...quiet, arp: true };
const GROOVE: Section = {
  ...quiet,
  kick: true,
  clap: true,
  hats: true,
  bass: true,
  arp: true,
};
const MELODY: Section = { ...GROOVE, lead: true };
const BREAKDOWN: Section = { ...quiet, lead: true };
const DROP: Section = { ...MELODY, soar: true };
/** The loop after the intro, and how many bars each part of it lasts */
const LOOP: { section: Section; bars: number }[] = [
  { section: GROOVE, bars: 8 },
  { section: MELODY, bars: 8 },
  { section: BREAKDOWN, bars: 4 },
  { section: DROP, bars: 8 },
];
const LOOP_BARS = LOOP.reduce((sum, part) => sum + part.bars, 0);
const INTRO_BARS = 4;

function sectionAt(bar: number): {
  section: Section;
  barIn: number;
  bars: number;
} {
  if (bar < INTRO_BARS) {
    return { section: INTRO, barIn: bar, bars: INTRO_BARS };
  }
  let barIn = (bar - INTRO_BARS) % LOOP_BARS;
  for (const part of LOOP) {
    if (barIn < part.bars) return { ...part, barIn };
    barIn -= part.bars;
  }
  return { ...LOOP[0], barIn: 0 };
}

let bus: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextAt = 0;
let step = 0;
let wanted = false;

function tone(
  c: AudioContext,
  out: AudioNode,
  at: number,
  freq: number,
  length: number,
  type: OscillatorType,
  loudness: number,
  cutoff?: number,
  attack = 0.006,
): void {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(loudness, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  let node: AudioNode = osc;
  if (cutoff) {
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, at);
    filter.frequency.exponentialRampToValueAtTime(cutoff * 0.35, at + length);
    filter.Q.value = 6;
    osc.connect(filter);
    node = filter;
  }
  node.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + length + 0.02);
}

function kick(c: AudioContext, out: AudioNode, at: number): void {
  const osc = c.createOscillator();
  osc.frequency.setValueAtTime(190, at);
  osc.frequency.exponentialRampToValueAtTime(42, at + 0.08);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.85, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.3);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + 0.32);
}

/** A tom that drops in pitch as it rings, for fills */
function tom(c: AudioContext, out: AudioNode, at: number, freq: number): void {
  const osc = c.createOscillator();
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.55, at + 0.22);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.5, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.26);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + 0.28);
}

/** Overdrive for the bass and lead, one per output */
const drives = new WeakMap<AudioNode, WaveShaperNode>();
function grit(c: AudioContext, out: AudioNode): AudioNode {
  let drive = drives.get(out);
  if (!drive) {
    drive = c.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 3) / Math.tanh(3);
    }
    drive.curve = curve;
    drive.oversample = "2x";
    drive.connect(out);
    drives.set(out, drive);
  }
  return drive;
}

function noiseHit(
  c: AudioContext,
  out: AudioNode,
  at: number,
  type: BiquadFilterType,
  freq: number,
  length: number,
  loudness: number,
): void {
  const src = noiseSource(c);
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(loudness, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + length);
  src.connect(filter).connect(gain).connect(out);
  src.start(at, Math.random() * 0.5);
  src.stop(at + length + 0.02);
}

/** How long a lead note starting on this sixteenth holds, in sixteenths */
function heldFor(line: (number | null)[], from: number): number {
  const next = line.findIndex((note, i) => i > from && note !== null);
  return (next === -1 ? line.length : next) - from;
}

/** Where the kick lands in a bar: a broken beat, with more of them in the drop */
const KICKS = [0, 10];
const DROP_KICKS = [0, 6, 10];
/** Quiet snare hits between the backbeats, so the drums never sit still */
const GHOSTS = [7, 9, 15];

/** Everything that sounds on one sixteenth of the track */
function playStep(
  c: AudioContext,
  out: AudioNode,
  n: number,
  at: number,
): void {
  const inBar = n % STEPS_PER_BAR;
  const bar = Math.floor(n / STEPS_PER_BAR);
  const chord = CHORDS[bar % CHORDS.length];
  const { section, barIn, bars } = sectionAt(bar);
  const lastBar = barIn === bars - 1;
  const dirty = grit(c, out);

  // A crash marks the start of every part after the intro
  if (section !== INTRO && barIn === 0 && inBar === 0) {
    noiseHit(c, out, at, "highpass", 4000, 1.6, 0.18);
  }
  // The intro pounds on toms until the drums come in halfway through
  if (section === INTRO && barIn < 2 && inBar % 4 === 0) {
    tom(c, out, at, inBar === 12 ? 110 : 85);
  }
  const drumming = section.kick || (section === INTRO && barIn >= 2);
  if (drumming && (section.soar ? DROP_KICKS : KICKS).includes(inBar)) {
    kick(c, out, at);
  }
  if (section.clap && (inBar === 4 || inBar === 12)) {
    noiseHit(c, out, at, "bandpass", 1800, 0.2, 0.42);
    noiseHit(c, out, at, "highpass", 3000, 0.12, 0.2);
    tone(c, out, at, 210, 0.1, "triangle", 0.3);
  }
  if (section.clap && GHOSTS.includes(inBar)) {
    noiseHit(c, out, at, "bandpass", 2000, 0.06, 0.09);
  }
  // Each part ends on a tom run down into the next
  if (section.clap && lastBar && inBar >= 12) {
    tom(c, out, at, [220, 170, 130, 95][inBar - 12]);
  }
  // Sixteenth hats all the way, leaning on the offbeats, with a shaker
  // underneath and a roll of thirty-seconds closing every fourth bar
  if (drumming) {
    const accent = inBar % 4 === 2 ? 0.16 : inBar % 2 ? 0.06 : 0.1;
    const open = inBar === 14;
    noiseHit(
      c,
      out,
      at,
      "highpass",
      open ? 7000 : 9500,
      open ? 0.14 : 0.03,
      open ? 0.15 : accent,
    );
    noiseHit(c, out, at + STEP * 0.5, "bandpass", 6000, 0.025, 0.04);
    if (barIn % 4 === 3 && inBar >= 12) {
      noiseHit(c, out, at + STEP * 0.5, "highpass", 9500, 0.025, 0.08);
    }
  }
  // The breakdown winds back up: a rising wash and a snare roll into the drop
  if (section === BREAKDOWN && lastBar) {
    noiseHit(
      c,
      out,
      at,
      "highpass",
      1500 + inBar * 450,
      0.1,
      0.06 + inBar * 0.02,
    );
    noiseHit(c, out, at, "bandpass", 1800, 0.07, 0.14 + inBar * 0.02);
  }
  // A steady bass in eighths, up an octave on the offbeat
  const bassline = section.bass || (section === INTRO && barIn >= 2);
  if (bassline && inBar % 2 === 0) {
    const octave = inBar % 4 === 2 ? 12 : 0;
    tone(
      c,
      dirty,
      at,
      midi(chord.root + octave),
      STEP * 1.7,
      "sawtooth",
      0.1,
      900,
    );
    tone(c, out, at, midi(chord.root - 12), STEP * 1.8, "sine", 0.2);
  }
  // A soft arpeggio in the background, only once the melody is in
  if (section.arp && section.lead && section !== BREAKDOWN) {
    const pick = ARP_ORDER[inBar % ARP_ORDER.length];
    const interval = pick === 3 ? 12 : chord.tones[pick];
    tone(
      c,
      out,
      at,
      midi(chord.root + 36 + interval),
      STEP * 0.7,
      "triangle",
      0.05,
      3200,
    );
  }
  // A slow, smooth melody that swells into each note
  if (section.lead) {
    const line = LEAD[barIn % LEAD.length];
    const note = line[inBar];
    if (note !== null) {
      const length = heldFor(line, inBar) * STEP;
      tone(c, out, at, midi(note), length, "sawtooth", 0.13, 2800, 0.06);
      tone(c, out, at, midi(note) * 1.006, length, "sawtooth", 0.1, 2800, 0.06);
      tone(
        c,
        out,
        at,
        midi(note - 12),
        length,
        "triangle",
        0.12,
        undefined,
        0.04,
      );
      if (section.soar) {
        tone(
          c,
          out,
          at,
          midi(note + 12),
          length,
          "sine",
          0.09,
          undefined,
          0.08,
        );
      }
    }
  }
  // Held chords under everything, changing once a bar
  if (section.pad && inBar === 0) {
    for (const interval of chord.tones) {
      const freq = midi(chord.root + 24 + interval);
      tone(c, out, at, freq, STEP * 15.8, "sawtooth", 0.065, 1700, 0.25);
      tone(
        c,
        out,
        at,
        freq * 1.007,
        STEP * 15.8,
        "sawtooth",
        0.065,
        1700,
        0.25,
      );
    }
  }
}

function startPlaying(): void {
  const a = audio();
  if (!a || timer) return;
  const { ctx: c, out } = a;
  bus = c.createGain();
  bus.gain.setValueAtTime(0.0001, c.currentTime);
  bus.gain.exponentialRampToValueAtTime(VOLUME, c.currentTime + 1.2);
  bus.connect(out);
  step = 0;
  nextAt = c.currentTime + 0.1;
  timer = setInterval(() => {
    const target = bus;
    if (!target) return;
    while (nextAt < c.currentTime + LOOKAHEAD_S) {
      playStep(c, target, step, nextAt);
      nextAt += STEP;
      step++;
    }
  }, TICK_MS);
}

function stopPlaying(): void {
  if (timer) clearInterval(timer);
  timer = null;
  const old = bus;
  bus = null;
  const a = audio();
  if (old && a) {
    old.gain.setTargetAtTime(0.0001, a.ctx.currentTime, 0.15);
    setTimeout(() => old.disconnect(), 800);
  }
}

// The music follows the sound button
sfx.subscribe(() => {
  if (!sfx.isEnabled()) stopPlaying();
  else if (wanted) startPlaying();
});

export const music = {
  /** Plays while `on`, and only while sound is turned on */
  set(on: boolean): void {
    wanted = on;
    if (on && sfx.isEnabled()) startPlaying();
    if (!on) stopPlaying();
  },
};
