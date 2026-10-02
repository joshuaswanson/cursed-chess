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

/** Thin fog banks that creep in from every edge of an area and dissolve toward its middle */
export class EdgeFog {
  private puffs: Puff[] = [];

  private readonly count = 80;

  private spawn(w: number, h: number, scattered: boolean): Puff {
    const edge = Math.floor(Math.random() * 4);
    const depth = scattered ? rand(-80, 150) : rand(-160, -40);
    const along = Math.random();
    const speed = rand(4, 14);
    const drift = rand(-8, 8);
    const base = {
      r: rand(110, 260),
      alpha: rand(0.06, 0.15),
      age: scattered ? rand(0, 10) : 0,
      life: rand(14, 26),
      tint: Math.random(),
    };
    switch (edge) {
      case 0:
        return { ...base, x: along * w, y: depth, vx: drift, vy: speed };
      case 1:
        return { ...base, x: w - depth, y: along * h, vx: -speed, vy: drift };
      case 2:
        return { ...base, x: along * w, y: h - depth, vx: drift, vy: -speed };
      default:
        return { ...base, x: depth, y: along * h, vx: speed, vy: drift };
    }
  }

  step(
    ctx: CanvasRenderingContext2D,
    dt: number,
    w: number,
    h: number,
    scale: number,
    strength: number,
  ) {
    if (this.puffs.length === 0) {
      for (let i = 0; i < this.count; i++)
        this.puffs.push(this.spawn(w, h, true));
    }
    this.puffs = this.puffs.filter((p) => {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return p.age < p.life;
    });
    while (this.puffs.length < this.count)
      this.puffs.push(this.spawn(w, h, false));
    for (const p of this.puffs) drawPuff(ctx, p, scale, strength);
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
      // Grown past the core so its blurred falloff lands outside the hidden squares
      const grow = 20;
      ctx.save();
      ctx.filter = `blur(${22 * scale}px)`;
      ctx.fillStyle = `rgba(212,222,219,${Math.min(0.96, cover * 1.4)})`;
      ctx.fillRect(
        (core.x - grow) * scale,
        (core.y - grow) * scale,
        (core.w + grow * 2) * scale,
        (core.h * cover + grow) * scale,
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
