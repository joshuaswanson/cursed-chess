import { audio, noiseSource, sfx } from "./sfx";

// A bright, driving synth track, sequenced and synthesized live like the
// sound effects: an eight-bar intro, then a thirty-two-bar loop that builds,
// drops out, and comes back bigger.

const BPM = 118;
const STEP = 60 / BPM / 4;
const STEPS_PER_BAR = 16;
/** Schedule notes this far ahead, so the beat stays tight when the page is busy */
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;
const VOLUME = 0.32;

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** F major: F, Am, Bb, C, as bass roots with their chord tones above */
const CHORDS = [
  { root: 41, tones: [0, 4, 7] },
  { root: 45, tones: [0, 3, 7] },
  { root: 46, tones: [0, 4, 7] },
  { root: 48, tones: [0, 4, 7] },
];

const _ = null;
/** The lead line, eight bars over two turns of the chords, a note or a rest on every sixteenth */
const LEAD: (number | null)[][] = [
  [72, _, _, 69, _, 72, _, 74, 72, _, 69, _, 65, _, _, _],
  [69, _, _, 72, _, 76, _, 74, 72, _, _, _, 69, _, 72, _],
  [74, _, _, 74, _, 72, _, 70, 69, _, 70, _, 74, _, _, _],
  [72, _, _, _, 67, _, _, 72, _, _, 76, _, 74, _, 72, _],
  [77, _, _, 76, _, 77, _, 72, 69, _, 72, _, 77, _, _, _],
  [76, _, _, 72, _, 69, _, 72, 76, _, _, 79, _, 76, _, _],
  [74, _, _, 70, _, 74, _, 77, 74, _, 72, _, 70, _, 69, _],
  [72, _, _, _, _, _, 67, _, 72, _, _, 74, _, 76, _, _],
];
const ARP_ORDER = [0, 1, 2, 1, 3, 2, 1, 2];

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
/** The loop after the intro, eight bars each: groove, melody, breakdown, drop */
const LOOP: Section[] = [
  { ...quiet, kick: true, clap: true, hats: true, bass: true, arp: true },
  {
    ...quiet,
    kick: true,
    clap: true,
    hats: true,
    bass: true,
    arp: true,
    lead: true,
  },
  { ...quiet, lead: true },
  {
    kick: true,
    clap: true,
    hats: true,
    bass: true,
    arp: true,
    lead: true,
    soar: true,
    pad: true,
  },
];
const INTRO_BARS = 8;
const SECTION_BARS = 8;

function sectionAt(bar: number): { section: Section; barIn: number } {
  if (bar < INTRO_BARS) return { section: INTRO, barIn: bar };
  const looped = (bar - INTRO_BARS) % (LOOP.length * SECTION_BARS);
  return {
    section: LOOP[Math.floor(looped / SECTION_BARS)],
    barIn: looped % SECTION_BARS,
  };
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
  osc.frequency.setValueAtTime(150, at);
  osc.frequency.exponentialRampToValueAtTime(45, at + 0.1);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.6, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.34);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + 0.36);
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
  const { section, barIn } = sectionAt(bar);
  const lastBar = barIn === SECTION_BARS - 1;

  // The kick comes in halfway through the intro
  const kicking = section.kick || (section === INTRO && barIn >= 4);
  if (kicking && inBar % 4 === 0) kick(c, out, at);
  if (section.clap && (inBar === 4 || inBar === 12)) {
    noiseHit(c, out, at, "bandpass", 1200, 0.18, 0.3);
    noiseHit(c, out, at + 0.012, "bandpass", 1800, 0.12, 0.18);
  }
  if (section.hats) {
    if (inBar % 4 === 2) noiseHit(c, out, at, "highpass", 7000, 0.14, 0.12);
    else if (section.soar) {
      noiseHit(c, out, at, "highpass", 9000, 0.03, 0.05);
    }
  }
  // The breakdown winds back up: a rising wash and a snare roll into the drop
  if (section === LOOP[2] && lastBar) {
    noiseHit(
      c,
      out,
      at,
      "highpass",
      1500 + inBar * 400,
      0.1,
      0.05 + inBar * 0.02,
    );
    if (inBar >= 8)
      noiseHit(c, out, at, "bandpass", 1400, 0.08, 0.2 + inBar * 0.02);
  }
  // An offbeat bass that lifts to the octave at the end of each bar
  if (section.bass && inBar % 4 === 2) {
    const octave = inBar === 14 ? 12 : 0;
    tone(
      c,
      out,
      at,
      midi(chord.root + octave),
      STEP * 1.6,
      "sawtooth",
      0.2,
      700,
    );
    tone(c, out, at, midi(chord.root - 12), STEP * 1.6, "sine", 0.22);
  }
  if (section.arp) {
    const pick = ARP_ORDER[inBar % ARP_ORDER.length];
    const interval = pick === 3 ? 12 : chord.tones[pick];
    // The intro's arpeggio opens up bar by bar
    const cutoff = section === INTRO ? 1400 + barIn * 450 : 5000;
    tone(
      c,
      out,
      at,
      midi(chord.root + 24 + interval),
      STEP * 0.85,
      "triangle",
      0.14,
      cutoff,
    );
  }
  if (section.lead) {
    const note = LEAD[barIn % LEAD.length][inBar];
    if (note !== null) {
      const soft = section === LOOP[2];
      tone(
        c,
        out,
        at,
        midi(note),
        STEP * 2.6,
        "square",
        soft ? 0.12 : 0.16,
        soft ? 3000 : 5500,
      );
      tone(
        c,
        out,
        at,
        midi(note) * 1.004,
        STEP * 2.6,
        "sawtooth",
        soft ? 0.06 : 0.09,
        4500,
      );
      if (section.soar) {
        tone(c, out, at, midi(note + 12), STEP * 2, "square", 0.08, 6000);
      }
    }
  }
  if (section.pad && inBar === 0) {
    for (const interval of chord.tones) {
      const freq = midi(chord.root + 12 + interval);
      tone(c, out, at, freq, STEP * 15.5, "sawtooth", 0.07, 2400);
      tone(c, out, at, freq * 1.006, STEP * 15.5, "sawtooth", 0.07, 2400);
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
