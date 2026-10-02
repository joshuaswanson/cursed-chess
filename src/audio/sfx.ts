// Every sound is synthesized with the Web Audio API, so there are no audio assets.

const STORAGE_KEY = "cursed-chess-sound";
const MASTER_VOLUME = 0.6;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let enabled = localStorage.getItem(STORAGE_KEY) !== "off";
const listeners = new Set<() => void>();

interface Hum {
  oscillators: OscillatorNode[];
  filter: BiquadFilterNode;
  gain: GainNode;
}
let hum: Hum | null = null;

/** The audio context, created on first use and resumed after the user interacts */
function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (!enabled) return null;
  if (!ctx || !master) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = MASTER_VOLUME;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx, out: master };
}

// Browsers keep audio suspended until the page receives a user gesture
for (const event of ["pointerdown", "keydown"]) {
  window.addEventListener(event, () => void ctx?.resume(), { capture: true });
}

function noise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function noiseSource(c: AudioContext): AudioBufferSourceNode {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  return src;
}

/** A single electric snap: a very short burst of band-passed noise */
function crackle(c: AudioContext, out: AudioNode, loudness: number): void {
  const t = c.currentTime;
  const src = noiseSource(c);
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1800 + Math.random() * 5000;
  band.Q.value = 3;
  const gain = c.createGain();
  const length = 0.02 + Math.random() * 0.06;
  gain.gain.setValueAtTime(0.3 * loudness * (0.5 + Math.random()), t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + length);
  src.connect(band).connect(gain).connect(out);
  src.start(t, Math.random() * 0.9);
  src.stop(t + length + 0.02);
}

/** A stone grinding or chunk breaking off: low band-passed noise with a quick decay */
function creak(
  c: AudioContext,
  out: AudioNode,
  at: number,
  loudness: number,
): void {
  const src = noiseSource(c);
  const band = c.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 250 + Math.random() * 900;
  band.Q.value = 5;
  const gain = c.createGain();
  const length = 0.05 + Math.random() * 0.15;
  gain.gain.setValueAtTime(0.001, at);
  gain.gain.exponentialRampToValueAtTime(0.5 * loudness, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, at + length);
  src.connect(band).connect(gain).connect(out);
  src.start(at, Math.random() * 0.9);
  src.stop(at + length + 0.02);
}

/** Several notes at once with a quick attack and a decay */
function chord(
  c: AudioContext,
  out: AudioNode,
  at: number,
  frequencies: number[],
  length: number,
  type: OscillatorType,
  loudness: number,
): void {
  for (const f of frequencies) {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(loudness, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, at + length);
    osc.connect(gain).connect(out);
    osc.start(at);
    osc.stop(at + length + 0.05);
  }
}

function stopHum(): void {
  if (!hum || !ctx) return;
  const { oscillators, gain } = hum;
  gain.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
  for (const osc of oscillators) osc.stop(ctx.currentTime + 0.4);
  hum = null;
}

export const sfx = {
  isEnabled: () => enabled,

  setEnabled(on: boolean): void {
    enabled = on;
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
    if (!on) stopHum();
    for (const listener of listeners) listener();
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Called every frame of a drag with how strongly a portal is pulling the
   * piece: a growling hum that brightens, and crackles that grow more frequent.
   */
  portalProximity(strength: number): void {
    if (strength < 0.02) {
      stopHum();
      return;
    }
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;

    if (!hum) {
      const filter = c.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 6;
      const gain = c.createGain();
      gain.gain.value = 0;
      const oscillators = [55, 82.5, 110.7].map((freq) => {
        const osc = c.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.value = freq;
        osc.connect(filter);
        osc.start();
        return osc;
      });
      filter.connect(gain).connect(out);
      hum = { oscillators, filter, gain };
    }

    const t = c.currentTime;
    hum.gain.gain.setTargetAtTime(0.08 * strength, t, 0.05);
    hum.filter.frequency.setTargetAtTime(180 + 1500 * strength, t, 0.05);
    if (Math.random() < strength * 0.22) crackle(c, out, strength);
  },

  /** A piece is swallowed: a sweep that drains downward into the vortex */
  portalEnter(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const duration = 0.42;

    const src = noiseSource(c);
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 4;
    band.frequency.setValueAtTime(3200, t);
    band.frequency.exponentialRampToValueAtTime(140, t + duration);
    const noiseGain = c.createGain();
    noiseGain.gain.setValueAtTime(0.001, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.5, t + 0.08);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(band).connect(noiseGain).connect(out);
    src.start(t);
    src.stop(t + duration + 0.05);

    const tone = c.createOscillator();
    tone.type = "sine";
    tone.frequency.setValueAtTime(720, t);
    tone.frequency.exponentialRampToValueAtTime(48, t + duration);
    const toneGain = c.createGain();
    toneGain.gain.setValueAtTime(0.18, t);
    toneGain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    tone.connect(toneGain).connect(out);
    tone.start(t);
    tone.stop(t + duration + 0.05);

    for (let i = 0; i < 3; i++) crackle(c, out, 0.8);
  },

  /** A piece is flung out of a portal: a zap, then a whoosh as it flies */
  portalExit(durationMs: number): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const duration = durationMs / 1000;

    const src = noiseSource(c);
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1.4;
    band.frequency.setValueAtTime(260, t);
    band.frequency.exponentialRampToValueAtTime(2800, t + duration * 0.35);
    band.frequency.exponentialRampToValueAtTime(500, t + duration);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.55, t + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(band).connect(gain).connect(out);
    src.start(t);
    src.stop(t + duration + 0.05);

    const pop = c.createOscillator();
    pop.type = "triangle";
    pop.frequency.setValueAtTime(90, t);
    pop.frequency.exponentialRampToValueAtTime(420, t + 0.12);
    const popGain = c.createGain();
    popGain.gain.setValueAtTime(0.25, t);
    popGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    pop.connect(popGain).connect(out);
    pop.start(t);
    pop.stop(t + 0.2);

    for (let i = 0; i < 4; i++) crackle(c, out, 1);
  },

  /** The ground groans: low rumble and creaks, heavier as the collapse nears */
  rumble(intensity: number): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const duration = 1.4;

    const src = noiseSource(c);
    const low = c.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 90 + 120 * intensity;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.exponentialRampToValueAtTime(0.9 * intensity + 0.2, t + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(low).connect(gain).connect(out);
    src.start(t);
    src.stop(t + duration + 0.05);

    for (let i = 0; i < 2 + intensity * 4; i++) {
      creak(c, out, t + 0.1 + Math.random() * (duration - 0.3), intensity);
    }
  },

  /** A ring of the board gives way: a deep boom, then rubble pouring down */
  collapse(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;

    const boom = c.createOscillator();
    boom.type = "sine";
    boom.frequency.setValueAtTime(70, t);
    boom.frequency.exponentialRampToValueAtTime(28, t + 1.2);
    const boomGain = c.createGain();
    boomGain.gain.setValueAtTime(0.7, t);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    boom.connect(boomGain).connect(out);
    boom.start(t);
    boom.stop(t + 1.5);

    const src = noiseSource(c);
    const low = c.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.setValueAtTime(900, t);
    low.frequency.exponentialRampToValueAtTime(120, t + 1.8);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.9);
    src.connect(low).connect(gain).connect(out);
    src.start(t);
    src.stop(t + 2);

    for (let i = 0; i < 14; i++) {
      creak(c, out, t + Math.random() * 1.1, 1);
    }
  },

  /** Digital breakup: stuttering square-wave blips and static */
  glitch(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    for (let i = 0; i < 7; i++) {
      const at = t + i * 0.07 + Math.random() * 0.04;
      const osc = c.createOscillator();
      osc.type = "square";
      osc.frequency.value = 80 + Math.random() * 900;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.09, at);
      gain.gain.setValueAtTime(0.0001, at + 0.04 + Math.random() * 0.04);
      osc.connect(gain).connect(out);
      osc.start(at);
      osc.stop(at + 0.1);
    }
    const src = noiseSource(c);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(gain).connect(out);
    src.start(t);
    src.stop(t + 0.55);
  },

  /** The curse arrives: a deep impact, a rising whoosh, and a bright chord */
  boom(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;

    const hit = c.createOscillator();
    hit.type = "sine";
    hit.frequency.setValueAtTime(120, t);
    hit.frequency.exponentialRampToValueAtTime(32, t + 0.9);
    const hitGain = c.createGain();
    hitGain.gain.setValueAtTime(0.9, t);
    hitGain.gain.exponentialRampToValueAtTime(0.001, t + 1.1);
    hit.connect(hitGain).connect(out);
    hit.start(t);
    hit.stop(t + 1.2);

    const src = noiseSource(c);
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1;
    band.frequency.setValueAtTime(200, t);
    band.frequency.exponentialRampToValueAtTime(4000, t + 0.6);
    const whoosh = c.createGain();
    whoosh.gain.setValueAtTime(0.5, t);
    whoosh.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    src.connect(band).connect(whoosh).connect(out);
    src.start(t);
    src.stop(t + 0.85);

    chord(c, out, t + 0.35, [261.6, 329.6, 392, 523.3], 1.4, "sawtooth", 0.06);
  },

  /** A short sting as a new mode's title card lands, pitched per channel */
  modeSting(step: number): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const root = 220 * Math.pow(2, (step % 7) / 12);
    const src = noiseSource(c);
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1.2;
    band.frequency.setValueAtTime(300, t);
    band.frequency.exponentialRampToValueAtTime(3000, t + 0.25);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    src.connect(band).connect(gain).connect(out);
    src.start(t);
    src.stop(t + 0.32);
    chord(
      c,
      out,
      t + 0.12,
      [root, root * 1.26, root * 1.5],
      0.7,
      "triangle",
      0.12,
    );
  },

  win(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    [523.3, 659.3, 784, 1046.5].forEach((f, i) =>
      chord(c, out, t + i * 0.11, [f], 0.35, "square", 0.07),
    );
    chord(c, out, t + 0.48, [523.3, 659.3, 784, 1046.5], 1, "triangle", 0.1);
  },

  lose(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    [392, 370, 349.2, 329.6].forEach((f, i) => {
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      const at = t + i * 0.3;
      osc.frequency.setValueAtTime(f, at);
      if (i === 3)
        osc.frequency.exponentialRampToValueAtTime(f * 0.85, at + 0.9);
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.08, at + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, at + (i === 3 ? 1 : 0.28));
      osc.connect(gain).connect(out);
      osc.start(at);
      osc.stop(at + 1.05);
    });
  },

  draw(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    chord(c, out, c.currentTime, [392, 493.9], 0.6, "triangle", 0.12);
  },

  /** The square board breaks: a glassy crack and tinkling shards */
  shatter(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    crackle(c, out, 1.4);
    for (let i = 0; i < 18; i++) {
      const at = t + Math.random() * 0.7;
      const osc = c.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 1800 + Math.random() * 3200;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.06, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.12);
      osc.connect(gain).connect(out);
      osc.start(at);
      osc.stop(at + 0.14);
    }
  },

  /** Space folds into hexagons: a rising sweep with a shimmering tail */
  warp(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const sweep = c.createOscillator();
    sweep.type = "sawtooth";
    sweep.frequency.setValueAtTime(110, t);
    sweep.frequency.exponentialRampToValueAtTime(880, t + 0.6);
    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(5000, t + 0.6);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1);
    sweep.connect(filter).connect(gain).connect(out);
    sweep.start(t);
    sweep.stop(t + 1.05);
    chord(c, out, t + 0.5, [659.3, 830.6, 987.8], 0.9, "sine", 0.07);
  },

  /** One second of the move clock running out; a bomb beep in minefield */
  tick(secondsLeft: number, bomb: boolean): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = bomb ? "square" : "triangle";
    osc.frequency.value = bomb ? 1800 : 600 + (6 - secondsLeft) * 120;
    const gain = c.createGain();
    gain.gain.setValueAtTime(bomb ? 0.08 : 0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + (bomb ? 0.12 : 0.09));
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.15);
  },

  /** A mine primes under a piece: three beeps, each one quicker */
  mineArm(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    [0, 0.26, 0.44].forEach((at) => {
      const osc = c.createOscillator();
      osc.type = "square";
      osc.frequency.value = 2100;
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.09, t + at);
      gain.gain.exponentialRampToValueAtTime(0.001, t + at + 0.09);
      osc.connect(gain).connect(out);
      osc.start(t + at);
      osc.stop(t + at + 0.1);
    });
  },

  /** The mine goes off: a crack, a deep blast, and dirt raining back down */
  mineBlast(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    crackle(c, out, 2);

    const sub = c.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(90, t);
    sub.frequency.exponentialRampToValueAtTime(30, t + 0.9);
    const subGain = c.createGain();
    subGain.gain.setValueAtTime(0.9, t);
    subGain.gain.exponentialRampToValueAtTime(0.001, t + 1);
    sub.connect(subGain).connect(out);
    sub.start(t);
    sub.stop(t + 1.05);

    const src = noiseSource(c);
    const low = c.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.setValueAtTime(3000, t);
    low.frequency.exponentialRampToValueAtTime(200, t + 1.2);
    const gain = c.createGain();
    gain.gain.setValueAtTime(1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    src.connect(low).connect(gain).connect(out);
    src.start(t);
    src.stop(t + 1.35);

    for (let i = 0; i < 10; i++) {
      creak(c, out, t + 0.3 + Math.random() * 0.8, 0.5);
    }
  },

  /** A piece is taken: a punchy thump with a slap on top */
  capture(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const thump = c.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(180, t);
    thump.frequency.exponentialRampToValueAtTime(50, t + 0.18);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    thump.connect(gain).connect(out);
    thump.start(t);
    thump.stop(t + 0.25);
    crackle(c, out, 1.2);
  },

  /** Gravity turns: a wobbling whirr that winds up as the board spins */
  gravityShift(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(520, t + 1.2);
    const wobble = c.createOscillator();
    wobble.frequency.value = 9;
    const depth = c.createGain();
    depth.gain.value = 40;
    wobble.connect(depth).connect(osc.frequency);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    osc.connect(gain).connect(out);
    osc.start(t);
    wobble.start(t);
    osc.stop(t + 1.35);
    wobble.stop(t + 1.35);
  },

  /** A piece lands after falling */
  thud(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.18);
    creak(c, out, t, 0.4);
  },

  /** A sword swing: a whoosh with a ringing blade on top */
  swing(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const src = noiseSource(c);
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 2;
    band.frequency.setValueAtTime(600, t);
    band.frequency.exponentialRampToValueAtTime(2400, t + 0.14);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    src.connect(band).connect(gain).connect(out);
    src.start(t, Math.random() * 0.8);
    src.stop(t + 0.18);

    const ring = t + 0.08;
    const pitch = 2600 + Math.random() * 600;
    chord(c, out, ring, [pitch, pitch * 1.48], 0.25, "sine", 0.025);
  },

  /** A bow fires: a plucked string and the arrow hissing away */
  bowShot(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const string = c.createOscillator();
    string.type = "triangle";
    string.frequency.setValueAtTime(260 + Math.random() * 60, t);
    string.frequency.exponentialRampToValueAtTime(150, t + 0.12);
    const pluck = c.createGain();
    pluck.gain.setValueAtTime(0.18, t);
    pluck.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    string.connect(pluck).connect(out);
    string.start(t);
    string.stop(t + 0.16);

    const src = noiseSource(c);
    const high = c.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 3500;
    const hiss = c.createGain();
    hiss.gain.setValueAtTime(0.0001, t);
    hiss.gain.exponentialRampToValueAtTime(0.05, t + 0.03);
    hiss.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(high).connect(hiss).connect(out);
    src.start(t, Math.random() * 0.8);
    src.stop(t + 0.24);
  },

  /** A blow lands. A finishing blow hits harder. */
  hit(finishing: boolean): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(finishing ? 240 : 320 + Math.random() * 80, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.1);
    const gain = c.createGain();
    gain.gain.setValueAtTime(finishing ? 0.3 : 0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.14);
    crackle(c, out, finishing ? 0.9 : 0.5);
  },

  /** A unit is knocked out: a pop and a falling boing */
  knockout(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.35);
    const wobble = c.createOscillator();
    wobble.frequency.value = 18;
    const depth = c.createGain();
    depth.gain.value = 30;
    wobble.connect(depth).connect(osc.frequency);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc.connect(gain).connect(out);
    osc.start(t);
    wobble.start(t);
    osc.stop(t + 0.4);
    wobble.stop(t + 0.4);
    creak(c, out, t, 0.35);
  },

  /** A reinforcement whistles down and lands after `fallSeconds` */
  drop(fallSeconds: number): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const whistle = c.createOscillator();
    whistle.type = "sine";
    whistle.frequency.setValueAtTime(1800, t);
    whistle.frequency.exponentialRampToValueAtTime(500, t + fallSeconds);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.07, t + fallSeconds * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, t + fallSeconds);
    whistle.connect(gain).connect(out);
    whistle.start(t);
    whistle.stop(t + fallSeconds + 0.02);

    const land = t + fallSeconds;
    const thump = c.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(200, land);
    thump.frequency.exponentialRampToValueAtTime(50, land + 0.15);
    const thumpGain = c.createGain();
    thumpGain.gain.setValueAtTime(0.0001, t);
    thumpGain.gain.setValueAtTime(0.4, land);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, land + 0.2);
    thump.connect(thumpGain).connect(out);
    thump.start(land);
    thump.stop(land + 0.22);
    creak(c, out, land, 0.5);
  },

  /** A boot striking the ball. Shots hit harder. */
  kick(shot: boolean): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const thump = c.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(shot ? 150 : 210, t);
    thump.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const gain = c.createGain();
    gain.gain.setValueAtTime(shot ? 0.6 : 0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    thump.connect(gain).connect(out);
    thump.start(t);
    thump.stop(t + 0.17);

    const src = noiseSource(c);
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1400;
    band.Q.value = 1.5;
    const slap = c.createGain();
    slap.gain.setValueAtTime(shot ? 0.35 : 0.2, t);
    slap.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(band).connect(slap).connect(out);
    src.start(t, Math.random() * 0.8);
    src.stop(t + 0.06);
  },

  /** The referee's pea whistle: one short blast, or a long one for a goal */
  whistle(long: boolean): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const blasts = long
      ? [
          [0, 0.22],
          [0.3, 0.75],
        ]
      : [[0, 0.38]];
    for (const [at, length] of blasts) {
      const tone = c.createOscillator();
      tone.type = "sine";
      tone.frequency.value = 2900;
      const trill = c.createOscillator();
      trill.frequency.value = 34;
      const depth = c.createGain();
      depth.gain.value = 160;
      trill.connect(depth).connect(tone.frequency);
      const gain = c.createGain();
      gain.gain.setValueAtTime(0.0001, t + at);
      gain.gain.exponentialRampToValueAtTime(0.13, t + at + 0.02);
      gain.gain.setValueAtTime(0.13, t + at + length - 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t + at + length);
      tone.connect(gain).connect(out);
      tone.start(t + at);
      trill.start(t + at);
      tone.stop(t + at + length + 0.02);
      trill.stop(t + at + length + 0.02);
    }
  },

  /** The crowd: a disappointed ooh, or a roar for a goal */
  crowd(kind: "ooh" | "roar"): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const roar = kind === "roar";
    const length = roar ? 3 : 1.3;
    const src = noiseSource(c);
    const voice = c.createBiquadFilter();
    voice.type = "bandpass";
    voice.Q.value = roar ? 0.7 : 3;
    voice.frequency.setValueAtTime(roar ? 700 : 380, t);
    voice.frequency.linearRampToValueAtTime(
      roar ? 1100 : 520,
      t + length * 0.3,
    );
    voice.frequency.linearRampToValueAtTime(roar ? 800 : 300, t + length);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(roar ? 0.55 : 0.35, t + 0.25);
    gain.gain.setValueAtTime(roar ? 0.55 : 0.3, t + length * 0.55);
    gain.gain.exponentialRampToValueAtTime(0.001, t + length);
    src.connect(voice).connect(gain).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + length + 0.05);
    if (roar) {
      for (let i = 0; i < 14; i++) crackle(c, out, 0.25);
    }
  },

  /** A bugle sounding the charge as reinforcements arrive */
  bugle(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const notes: [number, number, number][] = [
      [392, 0, 0.12],
      [523, 0.14, 0.12],
      [659, 0.28, 0.12],
      [784, 0.42, 0.22],
      [659, 0.68, 0.12],
      [784, 0.82, 0.55],
    ];
    for (const [freq, at, length] of notes) {
      chord(c, out, t + at, [freq, freq * 2], length, "sawtooth", 0.035);
      chord(c, out, t + at, [freq], length, "square", 0.025);
    }
  },

  /** A portal rips open: a tearing crackle, a falling shriek, and a deep thump */
  portalOpen(): void {
    const a = audio();
    if (!a) return;
    const { ctx: c, out } = a;
    const t = c.currentTime;
    const src = noiseSource(c);
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 4;
    band.frequency.setValueAtTime(5000, t);
    band.frequency.exponentialRampToValueAtTime(300, t + 0.6);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    src.connect(band).connect(gain).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + 0.75);

    const boom = c.createOscillator();
    boom.type = "sine";
    boom.frequency.setValueAtTime(120, t + 0.2);
    boom.frequency.exponentialRampToValueAtTime(40, t + 0.8);
    const boomGain = c.createGain();
    boomGain.gain.setValueAtTime(0.0001, t);
    boomGain.gain.setValueAtTime(0.5, t + 0.2);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.85);
    boom.connect(boomGain).connect(out);
    boom.start(t + 0.2);
    boom.stop(t + 0.9);
    for (let i = 0; i < 6; i++) crackle(c, out, 1);
  },
};
