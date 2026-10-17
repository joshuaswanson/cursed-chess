import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Piece } from "../../engine/types";
import type { Strike } from "../../plugins/thunderstorm";
import { pieceImage } from "../../utils/pieceImages";
import { visualCol, visualRow } from "./boardGeometry";
import {
  burnStrokes,
  craterEdge,
  seededRandom,
  sootSpecks,
} from "./lightningShapes";
import type { Point } from "./lightningShapes";
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
  return (
    <span className="storm-current" style={shapeOf(image)}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {arcs(seededRandom(seed)).map((d, i) => (
          <g key={i} style={{ animationDelay: `${delayOf(i)}ms` }}>
            <path className="storm-arc-glow" d={d} />
            <path d={d} />
          </g>
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
/** How far a burn reaches from where the bolt hit, in squares */
const BURN_REACH = 2.1;

/**
 * One burn, drawn once when it strikes into images of its own: the
 * scorching, and its seams glowing white-hot and glowing red. Each frame only
 * fades these in and out.
 */
interface Burn {
  strike: Strike;
  born: number;
  scorch: HTMLCanvasElement;
  hot: HTMLCanvasElement;
  cooled: HTMLCanvasElement;
}

/** How dark the scorching is as time passes, as the flash shows it and the dark takes it back */
const scorchAt = (t: number) =>
  t < 25
    ? t / 25
    : t < 760
      ? 1 - (0.15 * (t - 25)) / 735
      : Math.max(0, 0.85 * (1 - (t - 760) / 330));

/** A canvas `size` CSS pixels across, drawn at `res` pixels to each, centred on the origin */
function sheet(size: number, res: number) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.ceil(size * res);
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(res, 0, 0, res, (size * res) / 2, (size * res) / 2);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  return { canvas, ctx };
}

function drawBurn(strike: Strike, square: number): Omit<Burn, "born"> {
  const rand = seededRandom(strike.id * 313 + strike.sq);
  const veins = burnStrokes(rand, square);
  const pit = craterEdge(rand, square);
  const soot = sootSpecks(rand);
  const size = square * BURN_REACH * 2;

  // Scorching is soft, so it is drawn at half resolution and blurs as it is scaled up
  const dark = sheet(size, 0.5);
  for (const [x, y, r] of soot) {
    const blot = dark.ctx.createRadialGradient(
      x * square,
      y * square,
      0,
      x * square,
      y * square,
      r * square * 1.6,
    );
    blot.addColorStop(0, "rgba(14, 8, 4, 0.3)");
    blot.addColorStop(1, "rgba(14, 8, 4, 0)");
    dark.ctx.fillStyle = blot;
    dark.ctx.fillRect(
      (x - r * 1.6) * square,
      (y - r * 1.6) * square,
      r * 3.2 * square,
      r * 3.2 * square,
    );
  }
  dark.ctx.strokeStyle = "rgba(22, 13, 7, 0.55)";
  for (const vein of veins) {
    dark.ctx.lineWidth = vein.width * 2.6;
    trace(dark.ctx, vein.points, 0);
    dark.ctx.stroke();
  }
  dark.ctx.fillStyle = "rgba(6, 4, 3, 0.95)";
  trace(dark.ctx, pit, 0);
  dark.ctx.closePath();
  dark.ctx.fill();

  const seams = (color: string, glow: string) => {
    const { canvas, ctx } = sheet(size, 1);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 5;
    ctx.strokeStyle = color;
    for (const vein of veins) {
      ctx.globalAlpha = vein.bright;
      ctx.lineWidth = Math.max(0.5, vein.width * 0.45);
      trace(ctx, vein.points, 0);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.2;
    trace(ctx, pit, 0);
    ctx.closePath();
    ctx.stroke();
    return canvas;
  };
  return {
    strike,
    scorch: dark.canvas,
    hot: seams("rgb(255, 236, 170)", "rgba(255, 140, 20, 1)"),
    cooled: seams("rgb(225, 70, 10)", "rgba(200, 30, 0, 1)"),
  };
}

/**
 * The burns the bolts leave, drawn on the board under the pieces standing
 * on it and never past its edge: soot blown out round a charred pit, the
 * ground scorched along the channels the strike forked through, and the
 * thinnest seams glowing white-hot and cooling to red
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
  /** Every strike drawn so far, so one that has faded out is not drawn again */
  const drawnIds = useRef(new Set<number>());
  const view = useRef({ flipped });
  useEffect(() => {
    view.current = { flipped };
  });

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const square = el.clientWidth / 8;
    for (const strike of fresh) {
      if (drawnIds.current.has(strike.id)) continue;
      drawnIds.current.add(strike.id);
      burns.current.push({
        ...drawBurn(strike, square),
        born: performance.now(),
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
      const scale = Math.min(1.5, window.devicePixelRatio || 1);
      const size = Math.round(el.clientWidth * scale);
      if (el.width !== size) {
        el.width = size;
        el.height = size;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, size, size);
      drawn = burns.current.length > 0;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      const square = el.clientWidth / 8;
      const reach = square * BURN_REACH;
      const { flipped } = view.current;
      for (const burn of burns.current) {
        const t = now - burn.born;
        const cool = Math.min(1, t / 1000);
        const heat = Math.max(0, 1 - cool) ** 1.2;
        const x = (visualCol(burn.strike.sq, flipped) + 0.5) * square - reach;
        const y = (visualRow(burn.strike.sq, flipped) + 0.5) * square - reach;
        ctx.globalAlpha = scorchAt(t);
        ctx.drawImage(burn.scorch, x, y, reach * 2, reach * 2);
        // White-hot giving way to red as the seams cool
        const red = Math.min(1, cool * 2.5);
        ctx.globalAlpha = heat * (1 - red);
        ctx.drawImage(burn.hot, x, y, reach * 2, reach * 2);
        ctx.globalAlpha = heat * red;
        ctx.drawImage(burn.cooled, x, y, reach * 2, reach * 2);
      }
      ctx.globalAlpha = 1;
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
  imageOf = pieceImage,
}: {
  strikes: Strike[];
  flipped: boolean;
  /** The artwork for a piece, where it is not the game's own */
  imageOf?: (piece: Piece) => string;
}) {
  const fresh = useFreshStrikes(strikes);
  return (
    <>
      {fresh.map((strike) => (
        <Bolt
          key={strike.id}
          strike={strike}
          flipped={flipped}
          imageOf={imageOf}
        />
      ))}
    </>
  );
}

function Bolt({
  strike,
  flipped,
  imageOf,
}: {
  strike: Strike;
  flipped: boolean;
  imageOf: (piece: Piece) => string;
}) {
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
                src={imageOf(piece)}
                draggable={false}
                alt=""
                style={{
                  animation: `storm-lit-piece ${lasts.toFixed(2)}s ${start}ms linear both`,
                }}
              />
              <img
                className="storm-lit-piece storm-lit-flash"
                src={imageOf(piece)}
                draggable={false}
                alt=""
                style={{
                  animation: `storm-lit-flash ${lasts.toFixed(2)}s ${start}ms linear both`,
                }}
              />
              <Current
                image={imageOf(piece)}
                seed={strike.id * 53 + sq}
                delayOf={(i) =>
                  start + 20 + i * Math.round(((lasts - 0.25) * 1000) / 12)
                }
              />
            </span>
          </span>
        );
      })}
      {strike.killed && (
        <Annihilation strike={strike} flipped={flipped} imageOf={imageOf} />
      )}
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
  imageOf,
}: {
  strike: Strike;
  flipped: boolean;
  imageOf: (piece: Piece) => string;
}) {
  if (!strike.killed) return null;
  const rand = seededRandom(strike.id * 977 + strike.sq * 7);
  const image = imageOf(strike.killed);
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
