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
};
