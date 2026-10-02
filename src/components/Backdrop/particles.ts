import type { ThemeId } from "../../theme/themes";

/** One drifting thing in the backdrop. Coordinates are in CSS pixels. */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  /** Seconds lived so far */
  age: number;
  /** Seconds until it disappears; Infinity for particles that live until the channel changes */
  life: number;
  phase: number;
  color: string;
  /** Set when the channel changes; the particle fades out over a second */
  fading?: number;
  draw: (ctx: CanvasRenderingContext2D, p: Particle, t: number) => void;
  step?: (p: Particle, dt: number, w: number, h: number, t: number) => void;
}

export interface Preset {
  /** Particles kept alive at once */
  count: number;
  spawn: (w: number, h: number, initial: boolean) => Particle;
  /** Rare extra particles, like shooting stars, spawned with this chance per second */
  extra?: { rate: number; spawn: (w: number, h: number) => Particle };
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(items: T[]) => items[Math.floor(Math.random() * items.length)];

function fadeIn(p: Particle, seconds = 1): number {
  return Math.min(1, p.age / seconds);
}

function lifeFade(p: Particle): number {
  if (!Number.isFinite(p.life)) return 1;
  const left = p.life - p.age;
  return Math.max(0, Math.min(1, left / Math.min(1, p.life / 3)));
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

const stars: Preset = {
  count: 170,
  spawn: (w, h) => ({
    x: rand(0, w),
    y: rand(0, h),
    vx: rand(-4, -1),
    vy: 0,
    size: Math.random() < 0.08 ? rand(1.6, 2.4) : rand(0.4, 1.3),
    age: 0,
    life: Infinity,
    phase: rand(0, Math.PI * 2),
    color: pick(["#ffffff", "#cfe0ff", "#ffd9f2", "#fff1c4"]),
    draw: (ctx, p, t) => {
      ctx.globalAlpha *= 0.55 + 0.45 * Math.sin(t * 2.2 + p.phase);
      ctx.fillStyle = p.color;
      dot(ctx, p.x, p.y, p.size);
      if (p.size > 1.5) {
        ctx.globalAlpha *= 0.35;
        ctx.fillRect(p.x - p.size * 4, p.y - 0.4, p.size * 8, 0.8);
        ctx.fillRect(p.x - 0.4, p.y - p.size * 4, 0.8, p.size * 8);
      }
    },
  }),
  extra: {
    rate: 0.35,
    spawn: (w, h) => ({
      x: rand(w * 0.2, w * 1.1),
      y: rand(-20, h * 0.4),
      vx: rand(-900, -600),
      vy: rand(250, 420),
      size: 2,
      age: 0,
      life: 0.9,
      phase: 0,
      color: "#ffffff",
      draw: (ctx, p) => {
        const tail = 0.08;
        const grad = ctx.createLinearGradient(
          p.x,
          p.y,
          p.x - p.vx * tail,
          p.y - p.vy * tail,
        );
        grad.addColorStop(0, "rgba(255,255,255,0.95)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * tail, p.y - p.vy * tail);
        ctx.stroke();
      },
    }),
  },
};

const wisps: Preset = {
  count: 26,
  spawn: (w, h) => ({
    x: rand(-200, w),
    y: rand(h * 0.2, h),
    vx: rand(8, 22),
    vy: rand(-2, 2),
    size: rand(120, 280),
    age: 0,
    life: Infinity,
    phase: rand(0, Math.PI * 2),
    color: pick(["200,225,220", "170,200,200", "230,240,235"]),
    draw: (ctx, p, t) => {
      const r = p.size * (1 + 0.08 * Math.sin(t * 0.4 + p.phase));
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grad.addColorStop(0, `rgba(${p.color},0.13)`);
      grad.addColorStop(1, `rgba(${p.color},0)`);
      ctx.fillStyle = grad;
      dot(ctx, p.x, p.y, r);
    },
    step: (p, _dt, w) => {
      if (p.x - p.size > w) p.x = -p.size;
    },
  }),
};

const embers: Preset = {
  count: 110,
  spawn: (w, h, initial) => ({
    x: rand(0, w),
    y: initial ? rand(0, h) : h + 10,
    vx: rand(-10, 10),
    vy: rand(-90, -35),
    size: rand(0.8, 2.6),
    age: 0,
    life: rand(4, 9),
    phase: rand(0, Math.PI * 2),
    color: "",
    draw: (ctx, p, t) => {
      const heat = 1 - p.age / p.life;
      const flicker = 0.7 + 0.3 * Math.sin(t * 13 + p.phase);
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255,${Math.round(90 + 140 * heat)},${Math.round(30 * heat)},${0.25 * flicker})`;
      dot(ctx, p.x, p.y, p.size * 3.2);
      ctx.fillStyle = `rgba(255,${Math.round(150 + 100 * heat)},80,${flicker})`;
      dot(ctx, p.x, p.y, p.size);
    },
    step: (p, dt, _w, _h, t) => {
      p.x += Math.sin(t * 1.4 + p.phase) * 18 * dt;
    },
  }),
};

const confetti: Preset = {
  count: 70,
  spawn: (w, h, initial) => ({
    x: rand(0, w),
    y: initial ? rand(-h, h) : rand(-60, -10),
    vx: rand(-15, 15),
    vy: rand(30, 75),
    size: rand(5, 10),
    age: 0,
    life: Infinity,
    phase: rand(0, Math.PI * 2),
    color: pick(["#ffd23f", "#2c7bff", "#ff3b5c", "#ffffff", "#3ee6b0"]),
    draw: (ctx, p, t) => {
      const flip = Math.cos(t * 3 + p.phase);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(t * 1.5 + p.phase);
      ctx.scale(1, flip);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    },
    step: (p, dt, w, h, t) => {
      p.x += Math.sin(t + p.phase) * 25 * dt;
      if (p.y > h + 20) {
        p.y = -20;
        p.x = rand(0, w);
      }
    },
  }),
};

const blips: Preset = {
  count: 9,
  spawn: (w, h) => ({
    x: rand(0, w),
    y: rand(0, h),
    vx: 0,
    vy: 0,
    size: rand(2, 4),
    age: rand(-3, 0),
    life: rand(2, 3.5),
    phase: 0,
    color: pick(["120,255,120", "255,210,60"]),
    draw: (ctx, p) => {
      if (p.age < 0) return;
      const f = p.age / p.life;
      ctx.strokeStyle = `rgba(${p.color},${0.6 * (1 - f)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size + f * 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(${p.color},${1 - f})`;
      dot(ctx, p.x, p.y, p.size);
    },
  }),
};

const glitter: Preset = {
  count: 60,
  spawn: (w, h) => ({
    x: rand(0, w),
    y: rand(0, h),
    vx: rand(-6, 6),
    vy: rand(6, 18),
    size: rand(3, 9),
    age: 0,
    life: rand(2.5, 6),
    phase: rand(0, Math.PI * 2),
    color: pick(["#ffffff", "#fff4b0", "#ffd23f"]),
    draw: (ctx, p, t) => {
      const twinkle = Math.max(0, Math.sin(t * 4 + p.phase));
      const r = p.size * twinkle;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - r);
      ctx.quadraticCurveTo(p.x, p.y, p.x + r, p.y);
      ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + r);
      ctx.quadraticCurveTo(p.x, p.y, p.x - r, p.y);
      ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - r);
      ctx.fill();
    },
  }),
};

const vortex: Preset = {
  count: 140,
  spawn: (w, h) => {
    const maxR = Math.hypot(w, h) / 2;
    return {
      x: 0,
      y: 0,
      vx: rand(0.25, 0.6),
      vy: 0,
      size: rand(1, 2.6),
      age: 0,
      life: Infinity,
      phase: rand(0, Math.PI * 2),
      color: pick(["#3ee6b0", "#ff4fa3", "#ffffff", "#9b7bff"]),
      // vy holds the current orbit radius
      draw: (ctx, p) => {
        ctx.fillStyle = p.color;
        dot(ctx, p.x, p.y, p.size * Math.min(1, p.vy / 120));
      },
      step: (p, dt, cw, ch) => {
        if (p.vy <= 0) p.vy = rand(maxR * 0.3, maxR);
        p.vy -= dt * (18 + 2400 / p.vy);
        p.phase += dt * p.vx * (1 + 300 / p.vy);
        if (p.vy < 8) p.vy = maxR;
        p.x = cw / 2 + Math.cos(p.phase) * p.vy;
        p.y = ch / 2 + Math.sin(p.phase) * p.vy * 0.75;
      },
    };
  },
};

const neon: Preset = {
  count: 60,
  spawn: (w, h, initial) => ({
    x: rand(0, w),
    y: initial ? rand(0, h) : h + 10,
    vx: 0,
    vy: rand(-40, -15),
    size: rand(3, 10),
    age: 0,
    life: rand(5, 10),
    phase: rand(0, Math.PI * 2),
    color: pick(["#ff2e88", "#21e6ff", "#fdf500"]),
    draw: (ctx, p, t) => {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha *= 0.5 + 0.5 * Math.sin(t * 3 + p.phase);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(p.x, p.y, p.size, p.size);
    },
  }),
};

const bubbles: Preset = {
  count: 55,
  spawn: (w, h, initial) => ({
    x: rand(0, w),
    y: initial ? rand(0, h) : h + 20,
    vx: 0,
    vy: rand(-45, -18),
    size: rand(2, 9),
    age: 0,
    life: rand(8, 16),
    phase: rand(0, Math.PI * 2),
    color: "",
    draw: (ctx, p) => {
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      dot(ctx, p.x - p.size * 0.35, p.y - p.size * 0.35, p.size * 0.22);
    },
    step: (p, dt, _w, _h, t) => {
      p.x += Math.sin(t * 2 + p.phase) * 14 * dt;
    },
  }),
};

export const PRESETS: Partial<Record<ThemeId, Preset>> = {
  portals: stars,
  fog: wisps,
  royale: embers,
  clash: confetti,
  mines: blips,
  hill: glitter,
  gravity: vortex,
  hex: neon,
  stratego: bubbles,
};

/** Advance and draw one frame. Returns the particles still alive. */
export function stepParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  dt: number,
  t: number,
  w: number,
  h: number,
): Particle[] {
  const alive: Particle[] = [];
  for (const p of particles) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.step?.(p, dt, w, h, t);
    if (p.fading !== undefined) p.fading -= dt;
    if (p.age > p.life || (p.fading !== undefined && p.fading <= 0)) continue;

    ctx.save();
    ctx.globalAlpha =
      fadeIn(p) * lifeFade(p) * (p.fading !== undefined ? p.fading : 1);
    p.draw(ctx, p, t);
    ctx.restore();
    alive.push(p);
  }
  return alive;
}
