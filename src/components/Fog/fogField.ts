// Procedural fog: soft puffs drawn into a low-resolution canvas, which the
// browser scales up so every edge comes out naturally blurred.

interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  age: number;
  life: number;
  tint: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function puffAlpha(p: Puff): number {
  const fadeIn = Math.min(1, p.age / (p.life * 0.25));
  const fadeOut = Math.min(1, (p.life - p.age) / (p.life * 0.3));
  return p.alpha * Math.max(0, Math.min(fadeIn, fadeOut));
}

function drawPuff(
  ctx: CanvasRenderingContext2D,
  p: Puff,
  scale: number,
  strength: number,
) {
  const a = puffAlpha(p) * strength;
  if (a <= 0.003) return;
  const x = p.x * scale;
  const y = p.y * scale;
  const r = p.r * scale;
  const c = Math.round(205 + p.tint * 25);
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgba(${c},${c + 8},${c + 4},${a})`);
  grad.addColorStop(0.55, `rgba(${c},${c + 8},${c + 4},${a * 0.55})`);
  grad.addColorStop(1, `rgba(${c},${c + 8},${c + 4},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

type Side = "left" | "right" | "bottom";

interface DriftPuff extends Puff {
  side: Side;
  /** Phase of the slow back-and-forth sway */
  sway: number;
}

/**
 * Heavy fog banks that slide in from the left and right of the window and roll
 * over the edges of `target`, with a low ribbon of fog along the bottom.
 */
export class SideFog {
  private puffs: DriftPuff[] = [];
  private time = 0;
  private readonly sideCount = 90;
  private readonly bottomCount = 40;

  private spawn(
    side: Side,
    w: number,
    h: number,
    target: Rect,
    scattered: boolean,
  ): DriftPuff {
    const base = {
      age: scattered ? rand(0, 12) : 0,
      life: rand(14, 26),
      tint: Math.random(),
      sway: rand(0, Math.PI * 2),
    };
    if (side === "bottom") {
      return {
        ...base,
        side,
        x: rand(-100, w + 100),
        y: h - Math.pow(Math.random(), 1.4) * h * 0.18 + 30,
        vx: rand(-14, 14),
        vy: rand(-2, 1),
        r: rand(100, 210),
        alpha: rand(0.2, 0.34),
      };
    }
    // Each bank reaches nearly halfway across the board from its side
    const reach =
      side === "left"
        ? target.x + target.w * 0.45
        : w - (target.x + target.w * 0.55);
    const depth = Math.pow(Math.random(), 1.1) * reach;
    const edgeWeight = 1 - depth / Math.max(1, reach);
    return {
      ...base,
      side,
      x: side === "left" ? depth - 60 : w - depth + 60,
      y: rand(-80, h + 80),
      vx: (side === "left" ? 1 : -1) * rand(2, 9),
      vy: rand(-6, 6),
      r: rand(130, 300),
      alpha: 0.14 + 0.26 * edgeWeight + rand(0, 0.08),
    };
  }

  step(
    ctx: CanvasRenderingContext2D,
    dt: number,
    w: number,
    h: number,
    target: Rect,
    scale: number,
    amount: number,
  ) {
    this.time += dt;
    if (this.puffs.length === 0) {
      for (let i = 0; i < this.sideCount; i++) {
        this.puffs.push(
          this.spawn(i % 2 ? "left" : "right", w, h, target, true),
        );
      }
      for (let i = 0; i < this.bottomCount; i++) {
        this.puffs.push(this.spawn("bottom", w, h, target, true));
      }
    }
    this.puffs = this.puffs.filter((p) => {
      p.age += dt;
      p.x += (p.vx + Math.sin(this.time * 0.25 + p.sway) * 6) * dt;
      p.y += p.vy * dt;
      return p.age < p.life;
    });
    const count = (side: Side) =>
      this.puffs.filter((p) => p.side === side).length;
    for (const side of ["left", "right"] as const) {
      for (let n = count(side); n < this.sideCount / 2; n++) {
        this.puffs.push(this.spawn(side, w, h, target, false));
      }
    }
    for (let n = count("bottom"); n < this.bottomCount; n++) {
      this.puffs.push(this.spawn("bottom", w, h, target, false));
    }

    // The banks slide in from off screen as the fog arrives
    const away = 1 - amount;
    for (const p of this.puffs) {
      const dx =
        p.side === "left"
          ? -away * w * 0.6
          : p.side === "right"
            ? away * w * 0.6
            : 0;
      const dy = p.side === "bottom" ? away * h * 0.3 : 0;
      drawPuff(
        ctx,
        { ...p, x: p.x + dx, y: p.y + dy },
        scale,
        Math.min(1, amount * 1.5),
      );
    }
  }
}

/**
 * A dense, opaque bank of fog over `core`, whose edges billow outward. `cover`
 * from 0 to 1 rolls it down from the top edge of the core.
 */
export class FogBank {
  private puffs: Puff[] = [];
  /** Thin patches drifting through the bank, where pieces briefly show through */
  private thinSpots: Puff[] = [];
  private time = 0;

  /** A slowly turning breeze that carries every puff and thin spot */
  private wind() {
    return {
      x: 9 + 7 * Math.sin(this.time * 0.07),
      y: 2.5 * Math.sin(this.time * 0.05 + 1),
    };
  }

  private spawn(core: Rect, cover: number, onEdge: boolean): Puff {
    const coveredH = core.h * cover;
    const wind = this.wind();
    let x: number;
    let y: number;
    if (onEdge) {
      // Billows along the outline keep the edge of the bank irregular
      const t = Math.random();
      const side = Math.floor(Math.random() * 3);
      if (side === 0) {
        x = core.x + t * core.w;
        y = core.y + rand(-20, 10);
      } else if (side === 1) {
        x = core.x + t * core.w;
        y = core.y + coveredH + rand(-25, 15);
      } else {
        x =
          Math.random() < 0.5
            ? core.x + rand(-15, 15)
            : core.x + core.w + rand(-15, 15);
        y = core.y + Math.random() * coveredH;
      }
    } else {
      x = core.x + Math.random() * core.w;
      y = core.y + Math.random() * coveredH;
    }
    return {
      x,
      y,
      vx: wind.x + rand(-5, 5),
      vy: wind.y + rand(-3, 4),
      r: onEdge ? rand(36, 80) : rand(50, 110),
      alpha: onEdge ? rand(0.4, 0.62) : rand(0.3, 0.5),
      age: 0,
      life: rand(5, 11),
      tint: Math.random(),
    };
  }

  private spawnThinSpot(core: Rect, cover: number): Puff {
    const wind = this.wind();
    // Mostly near the outline, where a thinning bank looks natural
    const nearEdge = Math.random() < 0.7;
    const x = nearEdge
      ? Math.random() < 0.5
        ? core.x + rand(0, core.w * 0.2)
        : core.x + core.w - rand(0, core.w * 0.2)
      : core.x + rand(0.2, 0.8) * core.w;
    const y = core.y + rand(0, core.h * cover);
    return {
      x,
      y,
      vx: wind.x * 1.4,
      vy: wind.y,
      r: rand(40, 85),
      alpha: rand(0.45, 0.8),
      age: 0,
      life: rand(7, 13),
      tint: 0,
    };
  }

  step(
    ctx: CanvasRenderingContext2D,
    dt: number,
    core: Rect,
    scale: number,
    cover: number,
  ) {
    this.time += dt;
    const target =
      Math.round(((core.w * core.h) / 4200) * Math.max(cover, 0.05)) + 50;
    const advance = (p: Puff) => {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return p.age < p.life;
    };
    this.puffs = this.puffs.filter(advance);
    this.thinSpots = this.thinSpots.filter(advance);
    while (this.puffs.length < target) {
      this.puffs.push(this.spawn(core, cover, this.puffs.length % 3 === 0));
    }
    while (cover > 0.8 && this.thinSpots.length < 4) {
      this.thinSpots.push(this.spawnThinSpot(core, cover));
    }

    if (cover > 0) {
      // Grown past the core, and past the middle of the board, so the wide
      // blurred falloff lands outside the hidden squares as a soft edge
      const grow = 20;
      const overhang = 26;
      // Softened by drawing only the rectangle's blurred shadow: the
      // rectangle itself is kept far off the canvas. Safari has no blur
      // filter for a canvas, and would draw it hard edged.
      const away = 20000;
      ctx.save();
      ctx.shadowColor = `rgba(212,222,219,${Math.min(0.96, cover * 1.4)})`;
      ctx.shadowBlur = 76 * scale;
      ctx.shadowOffsetX = away;
      ctx.fillStyle = "#000";
      ctx.fillRect(
        (core.x - grow) * scale - away,
        (core.y - grow) * scale,
        (core.w + grow * 2) * scale,
        (core.h * cover + grow + overhang * cover) * scale,
      );
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      for (const spot of this.thinSpots) {
        const a = puffAlpha(spot);
        const x = spot.x * scale;
        const y = spot.y * scale;
        const r = spot.r * scale;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(0,0,0,${a})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.restore();
    }
    for (const p of this.puffs)
      drawPuff(ctx, p, scale, Math.min(1, cover * 1.6));
  }
}
