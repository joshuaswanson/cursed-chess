import { audio, noiseSource, sfx } from "./sfx";

// A dark, driving synth track, sequenced and synthesized live like the
// sound effects: a four-bar intro, then a loop that builds, drops out
// briefly, and comes back harder.

const BPM = 140;
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
/** The lead line, eight bars over two turns of the chords, a note or a rest on every sixteenth */
const LEAD: (number | null)[][] = [
  [76, _, 76, _, 74, _, 71, _, 72, _, 71, _, 67, _, 69, _],
  [72, _, _, 71, 72, _, 76, _, 79, _, _, 76, _, 72, _, _],
  [74, _, 74, _, 78, _, 74, _, 69, _, 74, _, 78, _, 81, _],
  [78, _, _, 75, _, 71, _, 75, 78, _, _, _, 75, _, 71, _],
  [79, _, 79, _, 78, _, 76, _, 71, _, 76, _, 79, _, 83, _],
  [84, _, _, 83, 79, _, 76, _, 72, _, 76, _, 79, _, _, _],
  [81, _, 78, _, 74, _, 78, _, 81, _, _, 83, _, 81, _, 78],
  [75, _, _, _, 78, _, _, _, 83, _, _, _, 75, _, _, _],
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
): void {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(loudness, at + 0.006);
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
    noiseHit(c, out, at, "highpass", 4000, 1.6, 0.2);
  }
  // The intro pounds on toms until the kick takes over halfway through
  if (section === INTRO && barIn < 2 && inBar % 4 === 0) {
    tom(c, out, at, inBar === 12 ? 110 : 85);
  }
  const kicking = section.kick || (section === INTRO && barIn >= 2);
  // The drop adds a kick just before each bar comes round
  const pushed = section.soar && (inBar === 14 || inBar === 7);
  if (kicking && (inBar % 4 === 0 || pushed)) kick(c, out, at);
  if (section.clap && (inBar === 4 || inBar === 12)) {
    noiseHit(c, out, at, "bandpass", 1800, 0.2, 0.42);
    noiseHit(c, out, at, "highpass", 3000, 0.12, 0.2);
    tone(c, out, at, 210, 0.1, "triangle", 0.3);
  }
  // Each part ends on a tom run down into the next
  if (section.clap && lastBar && inBar >= 12) {
    tom(c, out, at, [220, 170, 130, 95][inBar - 12]);
  }
  if (section.hats) {
    const open = inBar % 4 === 2;
    noiseHit(
      c,
      out,
      at,
      "highpass",
      open ? 7000 : 9500,
      open ? 0.1 : 0.03,
      open ? 0.14 : inBar % 2 ? 0.06 : 0.09,
    );
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
  // A driven bass on every sixteenth the kick leaves free
  const bassline = section.bass || (section === INTRO && barIn >= 2);
  if (bassline && inBar % 4 !== 0) {
    const octave = inBar % 4 === 2 ? 12 : 0;
    tone(
      c,
      dirty,
      at,
      midi(chord.root + octave),
      STEP * 0.85,
      "sawtooth",
      0.13,
      1300,
    );
    tone(c, out, at, midi(chord.root - 12), STEP * 0.9, "sine", 0.18);
  }
  if (section.arp) {
    const pick = ARP_ORDER[inBar % ARP_ORDER.length];
    const interval = pick === 3 ? 12 : chord.tones[pick];
    // The intro's arpeggio opens up bar by bar
    const cutoff = section === INTRO ? 1500 + barIn * 1200 : 5500;
    tone(
      c,
      out,
      at,
      midi(chord.root + 36 + interval),
      STEP * 0.7,
      "sawtooth",
      0.07,
      cutoff,
    );
  }
  if (section.lead) {
    const note = LEAD[barIn % LEAD.length][inBar];
    if (note !== null) {
      const soft = section === BREAKDOWN;
      tone(
        c,
        soft ? out : dirty,
        at,
        midi(note),
        STEP * 1.9,
        "sawtooth",
        soft ? 0.09 : 0.11,
        soft ? 2600 : 5000,
      );
      tone(
        c,
        out,
        at,
        midi(note - 12),
        STEP * 1.9,
        "square",
        soft ? 0.05 : 0.07,
        3000,
      );
      if (section.soar) {
        tone(c, out, at, midi(note + 12), STEP * 1.6, "square", 0.06, 7000);
      }
    }
  }
  // Offbeat minor stabs drive the groove; the intro and breakdown hold their chords
  if (section.pad) {
    const held = section === BREAKDOWN || section === INTRO;
    const stab = !held && section.kick && inBar % 4 === 2;
    if ((held && inBar === 0) || stab) {
      const length = held ? STEP * 15.5 : STEP * 1.4;
      for (const interval of chord.tones) {
        const freq = midi(chord.root + 24 + interval);
        tone(c, out, at, freq, length, "sawtooth", 0.05, held ? 1800 : 3200);
        tone(
          c,
          out,
          at,
          freq * 1.007,
          length,
          "sawtooth",
          0.05,
          held ? 1800 : 3200,
        );
      }
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
