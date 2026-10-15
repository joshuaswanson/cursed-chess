import { useState } from "react";
import type { CSSProperties } from "react";
import type { Strike } from "../../plugins/thunderstorm";
import { pieceImage } from "../../utils/pieceImages";
import { visualCol, visualRow } from "./boardGeometry";
import "./Thunderstorm.css";

/** One square in the drawing units of the bolt and the burn */
const UNIT = 100;
/** How far above the board the bolt starts, well up in the sky */
const BOLT_TOP = -1400;

type Point = [number, number];

function seededRandom(seed: number): () => number {
  let state = (seed * 7919 + 13) % 2147483647;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

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

/** Knocks every point a little off line, for the sharp kinks lightning has all along it */
const kinked = (rand: () => number, points: Point[], by: number): Point[] =>
  points.map(([x, y], i) =>
    i === 0 || i === points.length - 1
      ? [x, y]
      : [x + (rand() - 0.5) * by, y + (rand() - 0.5) * by],
  );

const pathOf = (points: Point[]) =>
  `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}`;

/** Roughly normal noise, mostly small, now and then large */
const wobble = (rand: () => number) => (rand() + rand() + rand() - 1.5) / 1.5;

/** One straight piece of a channel, as wide and as bright as that part of it */
interface Segment {
  a: Point;
  b: Point;
  width: number;
  bright: number;
}

interface Channel {
  from: Point;
  heading: number;
  /** How far it grows, in drawing units */
  length: number;
  width: number;
  /** Where it is drawn to, for the main channel coming down onto its square */
  toward?: Point;
  /** How many more times it can fork */
  forks: number;
}

/**
 * A channel grown a short step at a time, as lightning is: each step turns
 * a little at random from the way it was going, while it keeps to its
 * heading overall. Branches grow off it the same way, thinner, and fading
 * toward their tips.
 */
function grow(
  rand: () => number,
  channel: Channel,
  out: Segment[],
  forkChance: number,
  canFork: (at: Point) => boolean,
) {
  let at = channel.from;
  let drift = 0;
  let grown = 0;
  const main = channel.toward !== undefined;
  for (let i = 0; i < 400; i++) {
    const step = 8 + rand() * 18;
    const [x, y] = at;
    const aim = channel.toward
      ? Math.atan2(channel.toward[1] - y, channel.toward[0] - x)
      : channel.heading;
    drift = drift * 0.82 + wobble(rand) * 0.55;
    const angle = aim + drift;
    const left = main ? 1 : 1 - grown / channel.length;
    const near =
      channel.toward &&
      Math.hypot(channel.toward[0] - x, channel.toward[1] - y) < step * 1.2;
    const next: Point = near
      ? channel.toward!
      : [x + Math.cos(angle) * step, y + Math.sin(angle) * step];
    out.push({
      a: at,
      b: next,
      width: channel.width * (0.3 + 0.7 * left),
      bright: main ? 1 : 0.3 + 0.7 * left,
    });
    if (near) return;
    if (channel.forks > 0 && rand() < forkChance && canFork(next)) {
      const side = rand() < 0.5 ? -1 : 1;
      grow(
        rand,
        {
          from: next,
          heading: angle + side * (0.35 + rand() * 0.6),
          length:
            (main ? 110 + rand() * 230 : channel.length - grown) *
            (0.35 + rand() * 0.35),
          width: channel.width * (0.3 + 0.7 * left) * 0.55,
          forks: channel.forks - 1,
        },
        out,
        forkChance * 0.9,
        canFork,
      );
    }
    at = next;
    grown += step;
    if (!main && grown >= channel.length) return;
  }
}

/**
 * Segments gathered into one path for each width and brightness they come
 * in, so a bolt of hundreds of pieces is drawn with a handful of paths
 */
function bundle(segments: Segment[]) {
  const bundles = new Map<
    string,
    { width: number; bright: number; d: string[] }
  >();
  for (const { a, b, width, bright } of segments) {
    const w = Math.max(0.25, Math.round(width * 4) / 4);
    const o = Math.round(bright * 5) / 5;
    const key = `${w} ${o}`;
    const found = bundles.get(key) ?? { width: w, bright: o, d: [] };
    found.d.push(
      `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`,
    );
    bundles.set(key, found);
  }
  return [...bundles.values()].map(({ width, bright, d }) => ({
    width,
    bright,
    d: d.join(""),
  }));
}

/** The bolt: a main channel wandering down out of the sky onto its square, branching where it can be seen */
function bolt(rand: () => number, target: Point) {
  const segments: Segment[] = [];
  grow(
    rand,
    {
      from: [target[0] + (rand() - 0.5) * 3 * UNIT, BOLT_TOP],
      heading: Math.PI / 2,
      length: Infinity,
      width: 3.2,
      toward: target,
      forks: 3,
    },
    segments,
    0.17,
    ([, y]) => y > -2.5 * UNIT && y < target[1] - UNIT * 0.3,
  );
  return bundle(segments);
}

/** The burn it leaves: channels fanning out over the ground from where it hit, the way a strike burns a fern into it */
function burn(rand: () => number) {
  const segments: Segment[] = [];
  const arms = 10 + Math.floor(rand() * 5);
  for (let i = 0; i < arms; i++) {
    grow(
      rand,
      {
        from: [0, 0],
        heading: (i / arms) * Math.PI * 2 + wobble(rand) * 0.4,
        length: UNIT * (0.8 + rand() * 1.05),
        width: 3.6,
        forks: 3,
      },
      segments,
      0.3,
      () => true,
    );
  }
  return bundle(segments);
}

/** The pit at the middle, its edge ragged */
function crater(rand: () => number): string {
  const corners = 18;
  const points: Point[] = Array.from({ length: corners }, (_, i) => {
    const angle = (i / corners) * Math.PI * 2;
    const r = UNIT * (0.11 + rand() * 0.07);
    return [Math.cos(angle) * r, Math.sin(angle) * r];
  });
  return `${pathOf(points)} Z`;
}

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
          <path key={i} d={d} style={{ animationDelay: `${delayOf(i)}ms` }} />
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

/**
 * The burns the bolts leave, drawn on the board under the pieces standing
 * on it. The scorching of every burn is drawn first and the glow of every
 * burn after, each blended so that burns side by side run together into one.
 */
export function StormScars({
  strikes,
  flipped,
}: {
  strikes: Strike[];
  flipped: boolean;
}) {
  const fresh = useFreshStrikes(strikes);
  return (
    <div className="storm-scars" aria-hidden>
      {fresh.map((strike) => (
        <Scorch key={strike.id} strike={strike} flipped={flipped} />
      ))}
      {fresh.map((strike) => (
        <Embers key={strike.id} strike={strike} flipped={flipped} />
      ))}
    </div>
  );
}

/** How far a burn can reach from where the bolt hit, in squares */
const BURN_REACH = 2;

/** The shape of one burn, the same each time it is drawn */
function burnShape(strike: Strike) {
  const rand = seededRandom(strike.id * 313 + strike.sq);
  return { veins: burn(rand), pit: crater(rand) };
}

function BurnSvg({
  strike,
  flipped,
  className,
  children,
}: {
  strike: Strike;
  flipped: boolean;
  className: string;
  children: React.ReactNode;
}) {
  const r = UNIT * BURN_REACH;
  return (
    <svg
      className={`storm-scar ${className}`}
      viewBox={`-${r} -${r} ${r * 2} ${r * 2}`}
      style={middleOf(strike.sq, flipped)}
    >
      {children}
    </svg>
  );
}

/** Where it burnt: soot blown out over the ground, scorched along the channels it forked through, round a charred pit */
function Scorch({ strike, flipped }: { strike: Strike; flipped: boolean }) {
  const { veins, pit } = burnShape(strike);
  const soot = `storm-soot-${strike.id}`;
  return (
    <BurnSvg strike={strike} flipped={flipped} className="storm-scorch">
      <defs>
        <filter id={soot} x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.05"
            numOctaves="3"
            seed={strike.id}
          />
          <feDisplacementMap in="SourceGraphic" scale="46" />
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <radialGradient id={`${soot}-fill`}>
          <stop offset="0" stopColor="#0a0604" stopOpacity="0.9" />
          <stop offset="0.5" stopColor="#1a0f08" stopOpacity="0.6" />
          <stop offset="1" stopColor="#24160c" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle
        className="storm-soot"
        r={UNIT * 0.62}
        fill={`url(#${soot}-fill)`}
        filter={`url(#${soot})`}
      />
      {veins.map(({ width, d }, i) => (
        <path
          key={i}
          className="storm-scar-char"
          d={d}
          style={{ strokeWidth: width * 3 }}
        />
      ))}
      <path className="storm-crater" d={pit} />
    </BurnSvg>
  );
}

/** The thinnest seams of the burn, glowing white-hot and cooling */
function Embers({ strike, flipped }: { strike: Strike; flipped: boolean }) {
  const { veins, pit } = burnShape(strike);
  return (
    <BurnSvg strike={strike} flipped={flipped} className="storm-glow">
      {veins.map(({ width, bright, d }, i) => (
        <path
          key={i}
          className="storm-scar-ember"
          d={d}
          style={{ strokeWidth: width * 0.45, opacity: bright }}
        />
      ))}
      <path className="storm-crater-rim" d={pit} />
    </BurnSvg>
  );
}

/**
 * The bolts coming down out of the sky onto their squares, branching as
 * they go, with the flash, shock wave, and sparks where each lands, the
 * current crackling over the pieces next to it, and any piece it hits
 * destroyed. Drawn over the dark, since they light themselves.
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
  const target: Point = [
    (visualCol(strike.sq, flipped) + 0.5) * UNIT,
    (visualRow(strike.sq, flipped) + 0.5) * UNIT,
  ];
  const channels = bolt(rand, target);
  const middle = middleOf(strike.sq, flipped);
  return (
    <div className="storm-strike" aria-hidden>
      <svg
        className="storm-bolt"
        viewBox={`0 0 ${8 * UNIT} ${8 * UNIT}`}
        preserveAspectRatio="none"
      >
        {(["haze", "glow", "core"] as const).map((layer) => (
          <g key={layer} className={`storm-bolt-${layer}`}>
            {channels.map(({ width, bright, d }, i) => (
              <path
                key={i}
                d={d}
                style={
                  { "--width": width, "--bright": bright } as CSSProperties
                }
              />
            ))}
          </g>
        ))}
      </svg>
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
      {strike.shocked.map(({ sq, piece }) => (
        <span key={sq} className="storm-crackle" style={middleOf(sq, flipped)}>
          <span className="storm-jolt">
            <img
              className="storm-lit-piece"
              src={pieceImage(piece)}
              draggable={false}
              alt=""
            />
            <Current
              image={pieceImage(piece)}
              seed={strike.id * 53 + sq}
              delayOf={(i) => 110 + i * 115}
            />
          </span>
        </span>
      ))}
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
