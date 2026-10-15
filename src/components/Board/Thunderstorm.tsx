import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Strike } from "../../plugins/thunderstorm";
import { pieceImage } from "../../utils/pieceImages";
import { visualCol, visualRow } from "./boardGeometry";
import {
  burnStrokes,
  craterEdge,
  seededRandom,
  sootSpecks,
} from "./lightningShapes";
import type { Point, Stroke } from "./lightningShapes";
import "./Thunderstorm.css";

/**
 * A jagged line from `a` to `b`: the middle is pushed aside at random, then
 * the middle of each half, and so on, each time by half as much
 */
function crooked(
  rand: () => number,
  a: Point,
  b: Point,
  spread: number,
  depth: number,
): Point[] {
  if (depth === 0) return [a, b];
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  const push = (rand() - 0.5) * spread;
  const mid: Point = [
    (a[0] + b[0]) / 2 - (dy / length) * push,
    (a[1] + b[1]) / 2 + (dx / length) * push,
  ];
  return [
    ...crooked(rand, a, mid, spread / 2, depth - 1).slice(0, -1),
    ...crooked(rand, mid, b, spread / 2, depth - 1),
  ];
}

/** Knocks every point a little off line, for the sharp kinks electricity has all along it */
const kinked = (rand: () => number, points: Point[], by: number): Point[] =>
  points.map(([x, y], i) =>
    i === 0 || i === points.length - 1
      ? [x, y]
      : [x + (rand() - 0.5) * by, y + (rand() - 0.5) * by],
  );

const pathOf = (points: Point[]) =>
  `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}`;

/** Arcs of electricity crawling over a piece's body, from one part of it to another */
function arcs(rand: () => number): string[] {
  return Array.from({ length: 12 }, () =>
    pathOf(
      kinked(
        rand,
        crooked(
          rand,
          [20 + rand() * 60, 8 + rand() * 40],
          [20 + rand() * 60, 50 + rand() * 45],
          45,
          5,
        ),
        5,
      ),
    ),
  );
}

/** The image of a piece as a mask, for drawing on it and nowhere else */
const shapeOf = (image: string) =>
  ({
    maskImage: `url("${image}")`,
    WebkitMaskImage: `url("${image}")`,
  }) as CSSProperties;

/** The current crawling over a piece, kept to its own shape */
function Current({
  image,
  seed,
  delayOf,
}: {
  image: string;
  seed: number;
  delayOf: (i: number) => number;
}) {
  const glow = `storm-arc-glow-${seed}`;
  return (
    <span className="storm-current" style={shapeOf(image)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <filter id={glow} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.6" result="soft" />
            <feMerge>
              <feMergeNode in="soft" />
              <feMergeNode in="soft" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {arcs(seededRandom(seed)).map((d, i) => (
          <path
            key={i}
            d={d}
            filter={`url(#${glow})`}
            style={{ animationDelay: `${delayOf(i)}ms` }}
          />
        ))}
      </svg>
    </span>
  );
}

/** The wedges a piece bursts into, each cut from its middle out to its edge */
const SHARDS = 9;
function shards(rand: () => number) {
  return Array.from({ length: SHARDS }, (_, i) => {
    const a0 = (i / SHARDS) * Math.PI * 2;
    const a1 = ((i + 1) / SHARDS) * Math.PI * 2;
    const edge = (a: number) =>
      `${50 + Math.cos(a) * 80}% ${55 + Math.sin(a) * 80}%`;
    const mid = (a0 + a1) / 2;
    const fling = 120 + rand() * 160;
    return {
      clip: `polygon(50% 55%, ${edge(a0)}, ${edge(a1)})`,
      style: {
        "--fly-x": `${Math.cos(mid) * fling}%`,
        "--fly-y": `${Math.sin(mid) * fling - 60}%`,
        "--fall": `${140 + rand() * 120}%`,
        "--spin": `${(rand() - 0.5) * 900}deg`,
      } as CSSProperties,
    };
  });
}

/** Sparks and embers flung out from where it hit */
function sparks(rand: () => number, count: number) {
  return Array.from(
    { length: count },
    (_, i) =>
      ({
        "--a": `${(i / count) * 360 + rand() * 30}deg`,
        "--d": `${80 + rand() * 170}%`,
        "--late": `${Math.round(rand() * 120)}ms`,
      }) as CSSProperties,
  );
}

/** Where a strike is shown, as the percentages of the board to its middle */
const middleOf = (sq: Strike["sq"], flipped: boolean) => ({
  left: `${(visualCol(sq, flipped) + 0.5) * 12.5}%`,
  top: `${(visualRow(sq, flipped) + 0.5) * 12.5}%`,
});

/**
 * Strikes from before the board was drawn have already been and gone, so
 * only the ones after it show
 */
function useFreshStrikes(strikes: Strike[]): Strike[] {
  const [before] = useState(strikes[strikes.length - 1]?.id ?? 0);
  return strikes.filter((strike) => strike.id > before);
}

/** How long a burn shows: it fades out as the dark comes back */
const BURN_MS = 1150;

/** The shape of one burn, the same each time it is drawn */
interface Burn {
  strike: Strike;
  born: number;
  veins: Stroke[];
  pit: Point[];
  soot: [number, number, number][];
}

/** How dark the scorching is as time passes, as the flash shows it and the dark takes it back */
const scorchAt = (t: number) =>
  t < 25
    ? t / 25
    : t < 760
      ? 1 - (0.15 * (t - 25)) / 735
      : Math.max(0, 0.85 * (1 - (t - 760) / 330));

/** The glow of the hottest seams as they cool: white, yellow, orange, red, gone */
const COOLING: [number, [number, number, number]][] = [
  [0, [255, 250, 235]],
  [0.1, [255, 200, 90]],
  [0.3, [255, 110, 30]],
  [0.65, [176, 30, 0]],
  [1, [58, 8, 0]],
];
function emberColor(k: number): [number, number, number] {
  const i = Math.max(
    1,
    COOLING.findIndex(([at]) => at >= k),
  );
  const [k0, c0] = COOLING[i - 1];
  const [k1, c1] = COOLING[Math.min(i, COOLING.length - 1)];
  const f = k1 === k0 ? 0 : Math.min(1, Math.max(0, (k - k0) / (k1 - k0)));
  return [0, 1, 2].map((j) => Math.round(c0[j] + (c1[j] - c0[j]) * f)) as [
    number,
    number,
    number,
  ];
}

/** Far enough off the canvas that a shape drawn there shows only by its blurred shadow */
const OFFSTAGE = 10000;

/**
 * The burns the bolts leave, drawn on the board under the pieces standing
 * on it and never past its edge: soot blown out round a charred pit, the
 * ground scorched along the channels the strike forked through, and the
 * thinnest seams glowing white-hot and cooling
 */
export function StormScars({
  strikes,
  flipped,
}: {
  strikes: Strike[];
  flipped: boolean;
}) {
  const fresh = useFreshStrikes(strikes);
  const canvas = useRef<HTMLCanvasElement>(null);
  const burns = useRef<Burn[]>([]);
  const view = useRef({ flipped });
  useEffect(() => {
    view.current = { flipped };
  });

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const known = new Set(burns.current.map((b) => b.strike.id));
    const square = el.clientWidth / 8;
    for (const strike of fresh) {
      if (known.has(strike.id)) continue;
      const rand = seededRandom(strike.id * 313 + strike.sq);
      burns.current.push({
        strike,
        born: performance.now(),
        veins: burnStrokes(rand, square),
        pit: craterEdge(rand, square),
        soot: sootSpecks(rand),
      });
    }
  }, [fresh]);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    let frame = 0;
    let drawn = false;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      burns.current = burns.current.filter((b) => now - b.born < BURN_MS);
      if (burns.current.length === 0 && !drawn) return;
      const scale = Math.min(2, window.devicePixelRatio || 1);
      const size = Math.round(el.clientWidth * scale);
      if (el.width !== size) {
        el.width = size;
        el.height = size;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, size, size);
      drawn = burns.current.length > 0;
      const square = el.clientWidth / 8;
      const { flipped } = view.current;
      for (const burn of burns.current) {
        const t = now - burn.born;
        const dark = scorchAt(t);
        const cool = Math.min(1, t / 1000);
        const heat = Math.max(0, 1 - cool) ** 1.2;
        const cx = (visualCol(burn.strike.sq, flipped) + 0.5) * square;
        const cy = (visualRow(burn.strike.sq, flipped) + 0.5) * square;
        ctx.setTransform(scale, 0, 0, scale, cx * scale, cy * scale);

        // Scorching, drawn off the canvas so only its soft shadow lands on it
        ctx.shadowOffsetX = OFFSTAGE * scale;
        ctx.shadowOffsetY = 0;
        ctx.fillStyle = "#000";
        ctx.strokeStyle = "#000";
        ctx.shadowColor = `rgba(14, 8, 4, ${0.24 * dark})`;
        ctx.shadowBlur = 9 * scale;
        for (const [x, y, r] of burn.soot) {
          ctx.beginPath();
          ctx.arc(
            x * square - OFFSTAGE,
            y * square,
            r * square,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.shadowColor = `rgba(22, 13, 7, ${0.6 * dark})`;
        ctx.shadowBlur = 3 * scale;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (const vein of burn.veins) {
          ctx.lineWidth = vein.width * 2.4;
          trace(ctx, vein.points, -OFFSTAGE);
          ctx.stroke();
        }
        ctx.shadowColor = `rgba(6, 4, 3, ${0.95 * dark})`;
        ctx.shadowBlur = 2 * scale;
        trace(ctx, burn.pit, -OFFSTAGE);
        ctx.closePath();
        ctx.fill();

        // The seams glowing as they cool
        ctx.shadowOffsetX = 0;
        if (heat > 0.01) {
          const [r, g, b] = emberColor(cool);
          ctx.shadowColor = `rgba(255, 90, 0, ${heat})`;
          ctx.shadowBlur = 5 * scale;
          for (const vein of burn.veins) {
            ctx.lineWidth = Math.max(0.5, vein.width * 0.45);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${heat * vein.bright})`;
            trace(ctx, vein.points, 0);
            ctx.stroke();
          }
          ctx.lineWidth = 1.2;
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${heat})`;
          trace(ctx, burn.pit, 0);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.shadowBlur = 0;
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvas} className="storm-scar-canvas" aria-hidden />;
}

function trace(ctx: CanvasRenderingContext2D, points: Point[], dx: number) {
  ctx.beginPath();
  ctx.moveTo(points[0][0] + dx, points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0] + dx, points[i][1]);
  }
}

/**
 * Where each bolt lands, drawn over the dark since it lights itself: the
 * flash, shock wave, and sparks, the current running through the pieces
 * next to it, and any piece it hits destroyed. The bolts themselves come
 * down over the whole window, in StormWeather.
 */
export function StormBolt({
  strikes,
  flipped,
}: {
  strikes: Strike[];
  flipped: boolean;
}) {
  const fresh = useFreshStrikes(strikes);
  return (
    <>
      {fresh.map((strike) => (
        <Bolt key={strike.id} strike={strike} flipped={flipped} />
      ))}
    </>
  );
}

function Bolt({ strike, flipped }: { strike: Strike; flipped: boolean }) {
  const rand = seededRandom(strike.id * 131 + strike.sq);
  const middle = middleOf(strike.sq, flipped);
  return (
    <div className="storm-strike" aria-hidden>
      <span className="storm-hit" style={middle}>
        <span className="storm-bloom" />
        <span className="storm-shock" />
        <span className="storm-shock storm-shock-late" />
        {[0, 1, 2].map((i) => (
          <i
            key={`w${i}`}
            className="storm-wisp"
            style={{ "--i": i } as CSSProperties}
          />
        ))}
        {sparks(rand, 18).map((style, i) => (
          <i key={i} className="storm-spark" style={style} />
        ))}
      </span>
      {strike.shocked.map(({ sq, piece }) => {
        // Each piece takes the current in its own time, so no two shake together
        const own = seededRandom(strike.id * 71 + sq);
        const start = 70 + Math.round(own() * 170);
        const shake = 0.08 + own() * 0.07;
        const lasts = 1.3 + own() * 0.45;
        return (
          <span
            key={sq}
            className="storm-crackle"
            style={middleOf(sq, flipped)}
          >
            <span
              className="storm-jolt"
              style={{
                animation: `storm-jolt ${shake.toFixed(3)}s ${start}ms linear ${Math.round(lasts / shake)} ${own() < 0.5 ? "alternate" : "alternate-reverse"} both`,
              }}
            >
              <img
                className="storm-lit-piece"
                src={pieceImage(piece)}
                draggable={false}
                alt=""
                style={{
                  animation: `storm-lit-piece ${lasts.toFixed(2)}s ${start}ms linear both`,
                }}
              />
              <Current
                image={pieceImage(piece)}
                seed={strike.id * 53 + sq}
                delayOf={(i) =>
                  start + 20 + i * Math.round(((lasts - 0.25) * 1000) / 12)
                }
              />
            </span>
          </span>
        );
      })}
      {strike.killed && <Annihilation strike={strike} flipped={flipped} />}
    </div>
  );
}

/**
 * A piece the lightning hits: electrocuted, burnt black with its cracks
 * glowing, swelling, then bursting into burning shards, embers, and smoke
 */
function Annihilation({
  strike,
  flipped,
}: {
  strike: Strike;
  flipped: boolean;
}) {
  if (!strike.killed) return null;
  const rand = seededRandom(strike.id * 977 + strike.sq * 7);
  const image = pieceImage(strike.killed);
  const silhouette = shapeOf(image);
  const cracks = Array.from({ length: 6 }, () =>
    pathOf(
      crooked(
        rand,
        [20 + rand() * 60, 10 + rand() * 20],
        [20 + rand() * 60, 75 + rand() * 20],
        50,
        4,
      ),
    ),
  );
  return (
    <span className="storm-doomed" style={middleOf(strike.sq, flipped)}>
      <span className="storm-smoke-plume">
        {[0, 1, 2, 3, 4].map((i) => (
          <i key={i} style={{ "--i": i } as CSSProperties} />
        ))}
      </span>
      <span className="storm-victim">
        <img src={image} draggable={false} alt="" />
        <span className="storm-char" style={silhouette}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            {cracks.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </svg>
        </span>
        <Current
          image={image}
          seed={strike.id * 61}
          delayOf={(i) => 70 + (i % 4) * 35 + Math.floor(i / 4) * 140}
        />
      </span>
      {shards(rand).map(({ clip, style }, i) => (
        <img
          key={i}
          className="storm-shard"
          src={image}
          draggable={false}
          alt=""
          style={{ ...style, clipPath: clip }}
        />
      ))}
      <span className="storm-blast" />
      {sparks(rand, 26).map((style, i) => (
        <i key={i} className="storm-ember" style={style} />
      ))}
    </span>
  );
}
