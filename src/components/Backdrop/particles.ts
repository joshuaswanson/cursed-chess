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
  /** Seconds to fade in from nothing; one second when unset */
  fadeInSeconds?: number;
  draw: (ctx: CanvasRenderingContext2D, p: Particle, t: number) => void;
  step?: (p: Particle, dt: number, w: number, h: number, t: number) => void;
}

export interface Preset {
  /** Particles kept alive at once */
  count: number;
  spawn: (w: number, h: number, initial: boolean) => Particle;
  /** Rare events, like shooting stars or a meteor shower, each with its chance per second */
  extras?: { rate: number; spawn: (w: number, h: number) => Particle[] }[];
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
  extras: [
    { rate: 0.5, spawn: (w, h) => [shootingStar(w, h)] },
    { rate: 0.14, spawn: (w, h) => [comet(w, h)] },
    { rate: 0.07, spawn: meteorShower },
    { rate: 0.18, spawn: (w, h) => [asteroid(w, h)] },
  ],
};

function shootingStar(w: number, h: number): Particle {
  return {
    x: rand(w * 0.2, w * 1.1),
    y: rand(-20, h * 0.4),
    vx: rand(-900, -600),
    vy: rand(250, 420),
    size: 2,
    age: 0,
    life: 0.9,
    phase: 0,
    color: "255,255,255",
    draw: drawStreak(0.08, 2),
  };
}

/** A glowing streak whose tail trails behind its motion */
function drawStreak(tail: number, width: number) {
  return (ctx: CanvasRenderingContext2D, p: Particle) => {
    if (p.age < 0) return;
    const tx = p.x - p.vx * tail;
    const ty = p.y - p.vy * tail;
    const grad = ctx.createLinearGradient(p.x, p.y, tx, ty);
    grad.addColorStop(0, `rgba(${p.color},0.95)`);
    grad.addColorStop(1, `rgba(${p.color},0)`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  };
}

/** A slow comet with a glowing head and a long two-tone tail */
function comet(w: number, h: number): Particle {
  const fromRight = Math.random() < 0.5;
  const speed = rand(220, 360);
  const vy = rand(40, 130);
  return {
    x: fromRight ? w + 60 : -60,
    y: rand(h * 0.05, h * 0.55),
    vx: fromRight ? -speed : speed,
    vy,
    size: rand(3, 5),
    age: 0,
    life: (w + 400) / speed,
    phase: 0,
    color: pick(["160,240,255", "255,170,240", "255,225,150"]),
    draw: (ctx, p) => {
      const tx = p.x - p.vx * 0.9;
      const ty = p.y - p.vy * 0.9;
      const glow = ctx.createLinearGradient(p.x, p.y, tx, ty);
      glow.addColorStop(0, `rgba(${p.color},0.45)`);
      glow.addColorStop(1, `rgba(${p.color},0)`);
      ctx.strokeStyle = glow;
      ctx.lineCap = "round";
      ctx.lineWidth = p.size * 4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      const core = ctx.createLinearGradient(p.x, p.y, tx, ty);
      core.addColorStop(0, "rgba(255,255,255,0.95)");
      core.addColorStop(0.5, `rgba(${p.color},0.3)`);
      core.addColorStop(1, `rgba(${p.color},0)`);
      ctx.strokeStyle = core;
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      const head = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 5);
      head.addColorStop(0, "rgba(255,255,255,1)");
      head.addColorStop(0.3, `rgba(${p.color},0.8)`);
      head.addColorStop(1, `rgba(${p.color},0)`);
      ctx.fillStyle = head;
      dot(ctx, p.x, p.y, p.size * 5);
    },
  };
}

/** Meteor colors from the head back: white-hot core, burning body, cooling tail */
const METEOR_COLORS = [
  ["255,246,220", "255,170,70", "230,70,30"],
  ["255,246,220", "255,170,70", "230,70,30"],
  ["255,246,220", "255,170,70", "230,70,30"],
  ["235,255,240", "120,255,170", "30,170,120"],
  ["235,245,255", "140,200,255", "70,90,235"],
];

/** A fireball: glowing head, tapered tail that cools as it trails off, and shed sparks */
function drawMeteor(ctx: CanvasRenderingContext2D, p: Particle, t: number) {
  if (p.age < 0) return;
  const [core, body, tail] = METEOR_COLORS[Number(p.color)];
  const speed = Math.hypot(p.vx, p.vy) || 1;
  const ux = p.vx / speed;
  const uy = p.vy / speed;
  const nx = -uy;
  const ny = ux;
  const length = p.size * 46;
  const tx = p.x - ux * length;
  const ty = p.y - uy * length;
  ctx.globalCompositeOperation = "lighter";

  const taper = (width: number, fill: CanvasGradient) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(p.x + nx * width, p.y + ny * width);
    ctx.lineTo(tx, ty);
    ctx.lineTo(p.x - nx * width, p.y - ny * width);
    ctx.arc(p.x, p.y, width, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
    ctx.fill();
  };
  const glow = ctx.createLinearGradient(p.x, p.y, tx, ty);
  glow.addColorStop(0, `rgba(${body},0.35)`);
  glow.addColorStop(0.5, `rgba(${tail},0.12)`);
  glow.addColorStop(1, `rgba(${tail},0)`);
  taper(p.size * 3.2, glow);
  const flame = ctx.createLinearGradient(p.x, p.y, tx, ty);
  flame.addColorStop(0, `rgba(${core},1)`);
  flame.addColorStop(0.12, `rgba(${body},0.9)`);
  flame.addColorStop(0.55, `rgba(${tail},0.35)`);
  flame.addColorStop(1, `rgba(${tail},0)`);
  taper(p.size * 1.1, flame);

  for (let k = 0; k < 6; k++) {
    const along = (t * 2.6 + k / 6 + p.phase) % 1;
    const drift =
      Math.sin(t * 9 + k * 2.1 + p.phase * 7) * p.size * 2.2 * along;
    const sx = p.x - ux * length * along * 0.85 + nx * drift;
    const sy = p.y - uy * length * along * 0.85 + ny * drift;
    ctx.fillStyle = `rgba(${body},${0.85 * (1 - along)})`;
    dot(ctx, sx, sy, p.size * 0.45 * (1 - along * 0.6));
  }

  const head = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 5);
  head.addColorStop(0, `rgba(${core},1)`);
  head.addColorStop(0.25, `rgba(${body},0.7)`);
  head.addColorStop(1, `rgba(${body},0)`);
  ctx.fillStyle = head;
  dot(ctx, p.x, p.y, p.size * 5);
}

/** A burst of fireballs raining down on parallel paths */
function meteorShower(w: number, h: number): Particle[] {
  const angle = rand(0.45, 0.75);
  const fromRight = Math.random() < 0.5;
  return Array.from({ length: Math.floor(rand(14, 26)) }, () => {
    const fireball = Math.random() < 0.15;
    const speed = rand(700, 1100) * (fireball ? 0.7 : 1);
    const vx = (fromRight ? -1 : 1) * Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    const delay = rand(0, 1.6);
    const x = rand(-0.2 * w, 1.2 * w);
    const y = rand(-0.3 * h, 0.1 * h);
    return {
      x: x - vx * delay,
      y: y - vy * delay,
      vx,
      vy,
      size: fireball ? rand(3.6, 5.2) : rand(1.4, 2.8),
      age: -delay,
      life: rand(0.9, 1.5) * (fireball ? 1.4 : 1),
      fadeInSeconds: 0.06,
      phase: Math.random(),
      color: String(Math.floor(Math.random() * METEOR_COLORS.length)),
      draw: drawMeteor,
    };
  });
}

/** Sunlight falls on every rock from the upper left, whichever way it is turned */
const LIGHT = { x: -0.6, y: -0.8 };

const ROCK_TONES = [
  { base: "#6f6259", lit: "255,236,214", dark: "#1c1418" },
  { base: "#5f5a66", lit: "226,232,255", dark: "#121019" },
  { base: "#7a5e4a", lit: "255,224,190", dark: "#1e120c" },
];

/** A lumpy rock tumbling slowly past, lit from one side with cratered, gritty skin */
function asteroid(w: number, h: number, big = false): Particle {
  const fromLeft = Math.random() < 0.5;
  const speed = big ? rand(90, 180) : rand(30, 80);
  const size = big ? rand(26, 60) : rand(6, 22);
  const tone = pick(ROCK_TONES);

  // A smooth, lopsided outline: a few broad bulges with small lumps on top
  const stretch = rand(0.72, 0.95);
  const lobes = [rand(0, 6), rand(0, 6)];
  const outline = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    const r =
      1 +
      0.12 * Math.sin(2 * a + lobes[0]) +
      0.07 * Math.sin(3 * a + lobes[1]) +
      rand(-0.05, 0.05);
    return [Math.cos(a) * r, Math.sin(a) * r * stretch];
  });
  const craters = Array.from({ length: big ? 6 : 3 }, () => {
    const a = rand(0, Math.PI * 2);
    const d = Math.sqrt(Math.random()) * 0.6;
    return {
      x: Math.cos(a) * d,
      y: Math.sin(a) * d * stretch,
      r: rand(0.08, 0.24),
    };
  });
  const grit = Array.from({ length: big ? 40 : 14 }, () => ({
    x: rand(-1, 1),
    y: rand(-1, 1) * stretch,
    r: rand(0.015, 0.045),
    light: Math.random() < 0.5,
  }));
  const spin = rand(-0.6, 0.6);

  return {
    x: fromLeft ? -size * 2 : w + size * 2,
    y: rand(h * 0.1, h * 0.9),
    vx: fromLeft ? speed : -speed,
    vy: rand(-15, 15),
    size,
    age: 0,
    life: (w + size * 4) / speed,
    phase: rand(0, Math.PI * 2),
    color: tone.base,
    draw: (ctx, p, t) => {
      const s = p.size;
      const turn = p.phase + t * spin;
      // The light, seen from the rock's own turning frame
      const lx = LIGHT.x * Math.cos(-turn) - LIGHT.y * Math.sin(-turn);
      const ly = LIGHT.x * Math.sin(-turn) + LIGHT.y * Math.cos(-turn);

      ctx.translate(p.x, p.y);
      ctx.rotate(turn);
      ctx.beginPath();
      const mid = (k: number) => {
        const [x1, y1] = outline[k % outline.length];
        const [x2, y2] = outline[(k + 1) % outline.length];
        return [((x1 + x2) / 2) * s, ((y1 + y2) / 2) * s];
      };
      const [sx, sy] = mid(0);
      ctx.moveTo(sx, sy);
      for (let k = 1; k <= outline.length; k++) {
        const [cx, cy] = outline[k % outline.length];
        const [mx, my] = mid(k);
        ctx.quadraticCurveTo(cx * s, cy * s, mx, my);
      }
      ctx.closePath();
      ctx.fillStyle = tone.base;
      ctx.fill();
      ctx.save();
      ctx.clip();

      for (const g of grit) {
        ctx.fillStyle = g.light ? "rgba(255,245,230,0.12)" : "rgba(0,0,0,0.18)";
        dot(ctx, g.x * s, g.y * s, g.r * s);
      }
      for (const c of craters) {
        const cx = c.x * s;
        const cy = c.y * s;
        const r = c.r * s;
        // The bowl's wall nearest the light is in shadow; the far wall catches it
        const bowl = ctx.createRadialGradient(
          cx + lx * r * 0.45,
          cy + ly * r * 0.45,
          0,
          cx,
          cy,
          r,
        );
        bowl.addColorStop(0, "rgba(0,0,0,0.5)");
        bowl.addColorStop(0.7, "rgba(0,0,0,0.25)");
        bowl.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = bowl;
        dot(ctx, cx, cy, r);
        const far = Math.atan2(-ly, -lx);
        ctx.strokeStyle = `rgba(${tone.lit},0.35)`;
        ctx.lineWidth = Math.max(0.6, r * 0.22);
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.82, far - 1.1, far + 1.1);
        ctx.stroke();
      }

      // Lighting is applied in the world's frame, so it does not turn with the rock
      ctx.rotate(-turn);
      const lit = ctx.createRadialGradient(
        LIGHT.x * s * 0.55,
        LIGHT.y * s * 0.55,
        0,
        LIGHT.x * s * 0.55,
        LIGHT.y * s * 0.55,
        s * 1.3,
      );
      lit.addColorStop(0, `rgba(${tone.lit},0.42)`);
      lit.addColorStop(0.5, `rgba(${tone.lit},0.08)`);
      lit.addColorStop(1, `rgba(${tone.lit},0)`);
      ctx.fillStyle = lit;
      ctx.fillRect(-s * 1.5, -s * 1.5, s * 3, s * 3);
      const shade = ctx.createRadialGradient(
        -LIGHT.x * s * 0.9,
        -LIGHT.y * s * 0.9,
        s * 0.2,
        -LIGHT.x * s * 0.9,
        -LIGHT.y * s * 0.9,
        s * 1.6,
      );
      shade.addColorStop(0, tone.dark);
      shade.addColorStop(0.45, `${tone.dark}cc`);
      shade.addColorStop(1, `${tone.dark}00`);
      ctx.fillStyle = shade;
      ctx.fillRect(-s * 1.5, -s * 1.5, s * 3, s * 3);
      ctx.restore();
    },
  };
}

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

const smoke: Preset = {
  count: 34,
  spawn: (w, h, initial) => ({
    x: rand(-100, w),
    y: initial ? rand(0, h) : h + 80,
    vx: rand(6, 18),
    vy: rand(-22, -8),
    size: rand(50, 130),
    age: 0,
    life: rand(14, 24),
    phase: rand(0, Math.PI * 2),
    color: pick(["60,52,40", "90,80,64", "40,34,26"]),
    draw: (ctx, p) => {
      const r = p.size * (1 + p.age / p.life);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
      grad.addColorStop(0, `rgba(${p.color},0.16)`);
      grad.addColorStop(1, `rgba(${p.color},0)`);
      ctx.fillStyle = grad;
      dot(ctx, p.x, p.y, r);
    },
  }),
};

/** Camera flashes popping in the stands */
const flashes: Preset = {
  count: 16,
  spawn: (w, h) => {
    const inUpperStand = Math.random() < 0.6;
    return {
      x: rand(0, w),
      y: inUpperStand ? rand(h * 0.02, h * 0.3) : rand(h * 0.78, h * 0.98),
      vx: 0,
      vy: 0,
      size: rand(1.5, 3.2),
      age: rand(-4, 0),
      life: rand(0.12, 0.28),
      phase: 0,
      color: "255,255,255",
      draw: (ctx, p) => {
        if (p.age < 0) return;
        const glow = 1 - p.age / p.life;
        ctx.fillStyle = `rgba(${p.color},${glow})`;
        dot(ctx, p.x, p.y, p.size);
        ctx.fillStyle = `rgba(${p.color},${glow * 0.25})`;
        dot(ctx, p.x, p.y, p.size * 5);
        ctx.fillRect(p.x - p.size * 7, p.y - 0.5, p.size * 14, 1);
      },
    };
  },
};

/** Things that fly in front of the board */
export const FRONT_PRESETS: Partial<Record<ThemeId, Preset>> = {
  portals: {
    count: 0,
    spawn: shootingStar,
    extras: [
      { rate: 0.08, spawn: (w, h) => [comet(w, h)] },
      { rate: 0.045, spawn: meteorShower },
      { rate: 0.12, spawn: (w, h) => [asteroid(w, h, true)] },
    ],
  },
};

export const PRESETS: Partial<Record<ThemeId, Preset>> = {
  portals: stars,
  fog: wisps,
  royale: embers,
  clash: confetti,
  mines: blips,
  hill: glitter,
  gravity: vortex,
  fifa: flashes,
  hex: neon,
  stratego: smoke,
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
      fadeIn(p, p.fadeInSeconds) *
      lifeFade(p) *
      (p.fading !== undefined ? p.fading : 1);
    p.draw(ctx, p, t);
    ctx.restore();
    alive.push(p);
  }
  return alive;
}
