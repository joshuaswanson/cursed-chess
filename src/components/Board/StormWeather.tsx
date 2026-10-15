import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import type { ThunderstormPlugin } from "../../plugins/thunderstorm";
import { sfx } from "../../audio/sfx";
import { lightningAt } from "./lightning";
import { boltStrokes, seededRandom } from "./lightningShapes";
import type { Point, Stroke } from "./lightningShapes";
import "./Thunderstorm.css";

/** How long after a bolt starts down it hits */
const HIT_MS = 70;
/** When a struck piece bursts */
const BURST_MS = 880;
/** One raindrop for this many square pixels of window */
const PIXELS_PER_DROP = 2200;
/** Splashes landing each second on every 100,000 square pixels of window */
const SPLASHES_PER_SECOND = 9;
const SPLASH_MS = 320;

interface Drop {
  x: number;
  y: number;
  /** 0 far off, 1 close: nearer drops are longer, faster, thicker, and brighter */
  near: number;
}

/** A bolt on its way down, or flickering where it struck */
interface Bolt {
  strokes: Stroke[];
  target: Point;
  born: number;
}

/** How long the bolt takes to step down from the sky before it strikes */
const LEADER_MS = 70;
/** How long a bolt lasts, flickers and all */
const BOLT_MS = 950;

/**
 * Draws a bolt as a photograph shows one: a hair-thin white-hot core, a
 * glow round it, and a wide soft bloom, all added onto what is behind so
 * the brightest parts burn out to white
 */
function drawBolt(
  ctx: CanvasRenderingContext2D,
  bolt: Bolt,
  now: number,
  scale: number,
) {
  const t = now - bolt.born;
  const light = t < LEADER_MS + 5 ? 0.45 : lightningAt(t);
  if (light <= 0) return;
  // As the leader steps down, only what it has reached so far shows
  const reached = t < LEADER_MS ? Math.ceil((t / LEADER_MS) * 6) / 6 : 1;
  // The branches die away before the main channel does
  const branchFade = t < 260 ? 1 : Math.max(0, 1 - (t - 260) / 380);
  const trace = (stroke: Stroke) => {
    let points = stroke.points;
    if (stroke.main && reached < 1) {
      points = points.slice(0, Math.max(2, Math.ceil(points.length * reached)));
    }
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i][0], points[i][1]);
    }
  };
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const stroke of bolt.strokes) {
    if (!stroke.main && stroke.at > reached) continue;
    const a = light * stroke.bright * (stroke.main ? 1 : branchFade);
    if (a <= 0.01) continue;
    const w = stroke.width;
    trace(stroke);
    // A wide soft bloom, a bright halo hugging the channel, then the core
    ctx.shadowColor = `rgba(120, 140, 255, ${0.9 * a})`;
    ctx.shadowBlur = 48 * scale;
    ctx.lineWidth = w * 2.6;
    ctx.strokeStyle = `rgba(130, 150, 255, ${0.25 * a})`;
    ctx.stroke();
    ctx.shadowColor = `rgba(190, 210, 255, ${a})`;
    ctx.shadowBlur = 16 * scale;
    ctx.lineWidth = w * 1.5;
    ctx.strokeStyle = `rgba(215, 228, 255, ${0.85 * a})`;
    ctx.stroke();
    ctx.shadowColor = `rgba(255, 255, 255, ${a})`;
    ctx.shadowBlur = 5 * scale;
    ctx.lineWidth = w * 0.8;
    ctx.strokeStyle = `rgba(255, 255, 255, ${a})`;
    ctx.stroke();
  }
  // The ground where it lands lights up round it
  if (reached === 1) {
    const [x, y] = bolt.target;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 130);
    glow.addColorStop(0, `rgba(200, 215, 255, ${0.5 * light})`);
    glow.addColorStop(1, "rgba(120, 140, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - 130, y - 130, 260, 260);
  }
  ctx.restore();
}

interface Splash {
  x: number;
  y: number;
  born: number;
  size: number;
}

const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Shakes the whole game, hardest at first and settling */
function shake(strength: number, delayMs: number) {
  if (reducedMotion()) return;
  const app = document.querySelector<HTMLElement>(".app");
  if (!app) return;
  const steps = 14;
  const frames = Array.from({ length: steps + 1 }, (_, i) => {
    const left = i === steps ? 0 : strength * (1 - i / steps) ** 1.6;
    const x = (Math.random() - 0.5) * 2 * left;
    const y = (Math.random() - 0.5) * 2 * left;
    return {
      translate: `${x.toFixed(1)}px ${y.toFixed(1)}px`,
      rotate: `${((Math.random() - 0.5) * left * 0.08).toFixed(2)}deg`,
    };
  });
  app.animate(frames, { duration: 620, delay: delayMs, easing: "linear" });
}

/**
 * Rain driving down over the whole window, at every depth, blown about by
 * the wind and splashing where it lands, lit up by each bolt, and the bolts
 * themselves
 */
function useRain(
  struckAt: React.RefObject<number>,
  bolts: React.RefObject<Bolt[]>,
) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const still = reducedMotion();
    let drops: Drop[] = [];
    let splashes: Splash[] = [];
    let width = 0;
    let height = 0;
    let scale = 1;
    let frame = 0;
    let last = performance.now();
    let gust = 0;
    let gustGoal = 0;
    let nextGust = 0;

    const resize = () => {
      scale = Math.min(1.5, window.devicePixelRatio || 1);
      width = window.innerWidth;
      height = window.innerHeight;
      el.width = Math.round(width * scale);
      el.height = Math.round(height * scale);
      const count = Math.round((width * height) / PIXELS_PER_DROP);
      drops = Array.from({ length: count }, () => ({
        x: Math.random() * width * 1.4 - width * 0.2,
        y: Math.random() * height,
        near: Math.random() ** 1.8,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const dt = Math.min(50, now - last) / 1000;
      last = now;
      if (now > nextGust) {
        gustGoal = (Math.random() - 0.3) * 0.5;
        nextGust = now + 2500 + Math.random() * 4000;
      }
      gust += (gustGoal - gust) * Math.min(1, dt * 0.8);
      const wind = 0.22 + gust + 0.05 * Math.sin(now / 1700);
      const light = lightningAt(now - struckAt.current);

      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";

      // Three passes, far to near, so each depth is drawn with one stroke
      for (const [lo, hi] of [
        [0, 0.35],
        [0.35, 0.7],
        [0.7, 1.01],
      ]) {
        const near = (lo + hi) / 2;
        // Barely there in the dark, and bright in a flash
        const alpha = Math.min(0.9, (0.05 + near * 0.16) * (1 + light * 4));
        const shade = Math.round(175 + light * 80);
        ctx.strokeStyle = `rgba(${shade}, ${shade}, ${Math.min(255, shade + 30)}, ${alpha})`;
        ctx.lineWidth = 0.6 + near * 1.3;
        ctx.beginPath();
        for (const drop of drops) {
          if (drop.near < lo || drop.near >= hi) continue;
          const speed = 900 + drop.near * 1300;
          const length = 10 + drop.near * 26;
          if (!still) {
            drop.y += speed * dt;
            drop.x += speed * wind * dt;
          }
          if (drop.y > height + length) {
            drop.y = -length - Math.random() * 60;
            drop.x = Math.random() * width * 1.4 - width * 0.2;
          }
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x - length * wind, drop.y - length);
        }
        ctx.stroke();
      }

      if (!still) {
        const due =
          ((width * height) / 100_000) * SPLASHES_PER_SECOND * dt +
          Math.random();
        for (let i = 1; i < due; i++) {
          // Anywhere in the window, so the splashes give away no edge of the board
          const x = Math.random() * width;
          const y = Math.random() * height;
          splashes.push({ x, y, born: now, size: 0.6 + Math.random() * 0.8 });
        }
      }
      splashes = splashes.filter((s) => now - s.born < SPLASH_MS);
      for (const s of splashes) {
        const t = (now - s.born) / SPLASH_MS;
        const fade = (1 - t) * (0.12 + light * 0.6);
        ctx.strokeStyle = `rgba(205, 220, 245, ${fade})`;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.ellipse(
          s.x,
          s.y,
          7 * t * s.size,
          2.2 * t * s.size,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
        // Two droplets thrown up and falling back
        ctx.fillStyle = `rgba(215, 228, 250, ${fade})`;
        for (const side of [-1, 1]) {
          const dx = side * 6 * t * s.size;
          const dy = -20 * s.size * t * (1 - t);
          ctx.fillRect(s.x + dx, s.y + dy, 1.4, 1.4);
        }
      }

      bolts.current = bolts.current.filter((b) => now - b.born < BOLT_MS);
      for (const bolt of bolts.current) drawBolt(ctx, bolt, now, scale);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [struckAt, bolts]);
  return canvas;
}

/**
 * The storm over the whole window in Thunderstorm: rain, the sky lit
 * white by each bolt, the thunder right on top of it, and the whole game
 * shaken by it, hardest when it blows a piece apart
 */
export function StormWeather() {
  const strike = useGameStore((s) => s.stormStrike);
  const [first] = useState(strike);
  const struckAt = useRef(-Infinity);
  const bolts = useRef<Bolt[]>([]);
  const canvas = useRain(struckAt, bolts);

  useEffect(() => {
    sfx.rain(true);
    return () => sfx.rain(false);
  }, []);

  useEffect(() => {
    if (strike === first) return;
    struckAt.current = performance.now();
    const bolt = useGameStore
      .getState()
      .pluginManager.find<ThunderstormPlugin>("thunderstorm")
      ?.lastStrike();
    const square = bolt
      ? document
          .querySelector(`[data-sq="${bolt.sq}"]`)
          ?.getBoundingClientRect()
      : null;
    if (bolt && square) {
      const rand = seededRandom(bolt.id * 131 + bolt.sq);
      const target: Point = [
        square.left + square.width / 2,
        square.top + square.height / 2,
      ];
      const sway = Math.min(window.innerWidth * 0.3, 420);
      bolts.current = [
        ...bolts.current,
        {
          strokes: boltStrokes(
            rand,
            [target[0] + (rand() - 0.5) * sway, -30],
            target,
          ),
          target,
          born: struckAt.current,
        },
      ];
    }
    const timers = [window.setTimeout(() => sfx.thunder(true), HIT_MS)];
    if (bolt?.killed) {
      shake(16, HIT_MS);
      sfx.zap();
      shake(12, BURST_MS);
      timers.push(window.setTimeout(() => sfx.boom(), BURST_MS));
    } else {
      shake(8, HIT_MS);
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [strike, first]);

  return (
    <div className="storm-weather" aria-hidden>
      {strike !== first && <div key={strike} className="storm-flash" />}
      <canvas ref={canvas} className="storm-rain" />
    </div>
  );
}
