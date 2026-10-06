import { useEffect, useRef } from "react";
import "./RainRipples.css";

/** How many raindrops are ringing a pool at any moment */
const RAINDROPS = 26;
/** How far, in squares, the canvas reaches past the board on each side */
const SPAN = 14;
/** How often the pools are looked up again, as new shell holes open */
const RESURVEY_MS = 1000;

interface Drop {
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

interface Pool {
  cx: number;
  cy: number;
  span: number;
  squash: number;
  drops: Drop[];
}

/** A seeded random source, so a pool's raindrops keep their places */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dropsFor(seed: number): Drop[] {
  const rand = seeded(seed ^ 0x5bd1e995);
  return Array.from({ length: RAINDROPS }, () => {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * 0.72;
    return {
      x: Math.cos(a) * d * 0.5,
      y: Math.sin(a) * d * 0.5,
      size: 0.06 + rand() * 0.14,
      delay: rand() * 1.4,
      duration: 0.55 + rand() * 0.8,
    };
  });
}

/**
 * Raindrops ringing the water in every shell hole, all drawn on one canvas
 * laid over the craters, so hundreds of rings cost one layer
 */
export function RainRipples() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let pools: Pool[] = [];
    let frame = 0;
    let surveyed = 0;
    // The canvas covers only the part of the ground that is on screen
    let view = { left: 0, top: 0 };

    // Each shell hole that rings with rain marks itself; its pool lies in
    // the middle half of its box, flattened by the slant the ground is seen at
    const survey = () => {
      const area = canvas.parentElement!.getBoundingClientRect();
      const left = Math.max(area.left, 0);
      const top = Math.max(area.top, 0);
      const right = Math.min(area.right, window.innerWidth);
      const bottom = Math.min(area.bottom, window.innerHeight);
      const width = Math.max(0, Math.round(right - left));
      const height = Math.max(0, Math.round(bottom - top));
      canvas.style.left = `${left - area.left}px`;
      canvas.style.top = `${top - area.top}px`;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      // Thin rings read the same at one pixel to one, at a quarter of the cost
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      view = { left, top };
      pools = [...document.querySelectorAll<HTMLElement>("[data-ripples]")]
        .map((hole) => {
          const r = hole.getBoundingClientRect();
          return {
            cx: r.left + r.width / 2 - view.left,
            cy: r.top + r.height / 2 - view.top,
            span: r.width * 0.48,
            squash: Number(hole.dataset.squash) || 0.8,
            drops: dropsFor(Number(hole.dataset.ripples)),
          };
        })
        .filter(
          (p) =>
            p.cx + p.span > 0 &&
            p.cx - p.span < width &&
            p.cy + p.span > 0 &&
            p.cy - p.span < height,
        );
    };

    // Rings fading out, drawn in a handful of strengths, each strength in one stroke
    const LEVELS = 6;
    const shades = Array.from(
      { length: LEVELS },
      (_, i) =>
        `rgba(220, 228, 230, ${((0.7 * (i + 0.5)) / LEVELS).toFixed(3)})`,
    );
    const paths: Path2D[] = [];

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - surveyed > RESURVEY_MS) {
        surveyed = now;
        survey();
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.lineWidth = 1;
      for (let i = 0; i < LEVELS; i++) paths[i] = new Path2D();
      const t = now / 1000;
      for (const pool of pools) {
        for (const d of pool.drops) {
          const p = ((((t + d.delay) / d.duration) % 1) + 1) % 1;
          // Spreads fast then slows, fading as it goes
          const grow = 0.1 + 0.9 * (1 - (1 - p) ** 2);
          const radius = (d.size * pool.span * grow) / 2;
          const x = pool.cx + d.x * pool.span;
          const y = pool.cy + d.y * pool.span * pool.squash;
          const path =
            paths[Math.min(LEVELS - 1, Math.floor((1 - p) * LEVELS))];
          path.moveTo(x + radius, y);
          path.ellipse(x, y, radius, radius * pool.squash, 0, 0, Math.PI * 2);
        }
      }
      for (let i = 0; i < LEVELS; i++) {
        ctx.strokeStyle = shades[i];
        ctx.stroke(paths[i]);
      }
    };
    frame = requestAnimationFrame(draw);
    window.addEventListener("resize", survey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", survey);
    };
  }, []);

  return (
    <div
      className="rain-ripples"
      style={{ "--span": SPAN } as React.CSSProperties}
      aria-hidden
    >
      <canvas ref={ref} />
    </div>
  );
}
