import { audio, noiseSource, sfx } from "./sfx";

// A looping chiptune techno track, sequenced and synthesized live like the sound effects.

const BPM = 140;
const STEP = 60 / BPM / 4;
const STEPS_PER_BAR = 16;
/** Schedule notes this far ahead, so the beat stays tight when the page is busy */
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;
const VOLUME = 0.32;

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** A minor: Am, F, C, G, as bass roots with their chord tones above */
const CHORDS = [
  { root: 45, tones: [0, 3, 7] },
  { root: 41, tones: [0, 4, 7] },
  { root: 48, tones: [0, 4, 7] },
  { root: 43, tones: [0, 4, 7] },
];

const _ = null;
/** The lead line, one bar per chord, a note or a rest on every sixteenth */
const LEAD: (number | null)[][] = [
  [76, _, 74, _, 72, _, 74, _, 76, _, _, 79, _, 76, _, _],
  [77, _, 76, _, 72, _, _, 69, _, 72, _, 74, _, 72, _, _],
  [72, _, 74, _, 76, _, 79, _, 81, _, 79, _, 76, _, 74, _],
  [74, _, _, 71, _, 74, _, 79, _, _, 78, _, 79, _, _, _],
];
const ARP_ORDER = [0, 1, 2, 3, 2, 1, 2, 3];

/** What plays in each four-bar section of the sixteen-bar loop */
const SECTIONS = [
  { kick: true, hats: true, bass: true, arp: false, lead: false, pad: false },
  { kick: true, hats: true, bass: true, arp: true, lead: false, pad: false },
  { kick: true, hats: true, bass: true, arp: true, lead: true, pad: false },
  { kick: false, hats: true, bass: false, arp: true, lead: false, pad: true },
];

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
  osc.frequency.setValueAtTime(160, at);
  osc.frequency.exponentialRampToValueAtTime(42, at + 0.12);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.9, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.28);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + 0.3);
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

/** Everything that sounds on one sixteenth of the loop */
function playStep(
  c: AudioContext,
  out: AudioNode,
  n: number,
  at: number,
): void {
  const inBar = n % STEPS_PER_BAR;
  const bar = Math.floor(n / STEPS_PER_BAR);
  const chord = CHORDS[bar % CHORDS.length];
  const section = SECTIONS[Math.floor(bar / 4) % SECTIONS.length];

  if (section.kick && inBar % 4 === 0) kick(c, out, at);
  if (inBar === 4 || inBar === 12) {
    noiseHit(c, out, at, "bandpass", 1500, 0.16, 0.5);
    tone(c, out, at, 190, 0.08, "triangle", 0.25);
  }
  if (section.hats) {
    const open = inBar % 4 === 2;
    noiseHit(
      c,
      out,
      at,
      "highpass",
      8000,
      open ? 0.12 : 0.035,
      open ? 0.22 : 0.12,
    );
  }
  // A rolling bass on every sixteenth the kick leaves free
  if (section.bass && inBar % 4 !== 0) {
    const octave = inBar % 4 === 2 ? 12 : 0;
    tone(
      c,
      out,
      at,
      midi(chord.root + octave),
      STEP * 0.9,
      "sawtooth",
      0.22,
      900,
    );
  }
  if (section.arp) {
    const pick = ARP_ORDER[inBar % ARP_ORDER.length];
    const interval = pick === 3 ? 12 : chord.tones[pick];
    tone(
      c,
      out,
      at,
      midi(chord.root + 24 + interval),
      STEP * 0.8,
      "square",
      0.07,
      3200,
    );
  }
  if (section.lead) {
    const note = LEAD[bar % LEAD.length][inBar];
    if (note !== null)
      tone(c, out, at, midi(note), STEP * 1.8, "square", 0.1, 4200);
  }
  if (section.pad && inBar === 0) {
    for (const interval of chord.tones) {
      tone(
        c,
        out,
        at,
        midi(chord.root + 12 + interval),
        STEP * 15,
        "sawtooth",
        0.05,
        1400,
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
