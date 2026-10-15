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

const pathOf = (points: Point[]) =>
  `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}`;

/** A branch splitting off a line at `from`, heading away from it at an angle */
function branchOff(
  rand: () => number,
  from: Point,
  heading: number,
  length: number,
  depth: number,
): Point[] {
  const turn = (rand() < 0.5 ? -1 : 1) * (0.35 + rand() * 0.55);
  const angle = heading + turn;
  const to: Point = [
    from[0] + Math.cos(angle) * length,
    from[1] + Math.sin(angle) * length,
  ];
  return crooked(rand, from, to, length * 0.35, depth);
}

interface Fork {
  d: string;
  /** How far down the main bolt it splits off, 0 to 1, which is when it is drawn */
  at: number;
  /** 1 for the main bolt, less for each branch off it */
  weight: number;
}

/** The bolt: a main channel down from the sky and the branches splitting off it */
function boltForks(rand: () => number, target: Point): Fork[] {
  const start: Point = [target[0] + (rand() - 0.5) * 4 * UNIT, BOLT_TOP];
  const main = crooked(
    rand,
    start,
    target,
    Math.hypot(target[0] - start[0], target[1] - start[1]) * 0.16,
    8,
  );
  const forks: Fork[] = [{ d: pathOf(main), at: 0, weight: 1 }];
  // Branches split off where they can be seen, from just above the board down to near where it lands
  const seen = main
    .map((point, k) => ({ point, k }))
    .filter(({ point, k }) => k < main.length - 2 && point[1] > -2.5 * UNIT)
    .filter(({ point }) => point[1] < target[1] - UNIT * 0.4);
  const branches = seen.length > 0 ? 5 + Math.floor(rand() * 4) : 0;
  for (let i = 0; i < branches; i++) {
    const { k } = seen[Math.floor(rand() * seen.length)];
    const at = k / (main.length - 1);
    const [x0, y0] = main[k];
    const [x1, y1] = main[k + 1];
    const heading = Math.atan2(y1 - y0, x1 - x0);
    const reach = UNIT * (0.9 + rand() * 1.8);
    const branch = branchOff(rand, main[k], heading, reach, 5);
    forks.push({ d: pathOf(branch), at, weight: 0.5 });
    if (rand() < 0.6) {
      const j = Math.floor(branch.length * (0.3 + rand() * 0.4));
      const [bx0, by0] = branch[j];
      const [bx1, by1] = branch[j + 1] ?? branch[j];
      forks.push({
        d: pathOf(
          branchOff(
            rand,
            branch[j],
            Math.atan2(by1 - by0, bx1 - bx0),
            reach * 0.45,
            4,
          ),
        ),
        at: at + (1 - at) * 0.3,
        weight: 0.28,
      });
    }
  }
  return forks;
}

/** The burn scar a strike leaves: branching like a fern out from where it hit */
function burnScar(rand: () => number): { d: string; weight: number }[] {
  const veins: { d: string; weight: number }[] = [];
  const arms = 7 + Math.floor(rand() * 4);
  for (let i = 0; i < arms; i++) {
    const angle = (i / arms) * Math.PI * 2 + rand() * 0.5;
    const reach = UNIT * (0.7 + rand() * 0.9);
    const arm = crooked(
      rand,
      [0, 0],
      [Math.cos(angle) * reach, Math.sin(angle) * reach],
      reach * 0.45,
      5,
    );
    veins.push({ d: pathOf(arm), weight: 1 });
    for (let b = 0; b < 3; b++) {
      const k = Math.floor(arm.length * (0.25 + rand() * 0.55));
      veins.push({
        d: pathOf(branchOff(rand, arm[k], angle, reach * 0.4, 4)),
        weight: 0.55,
      });
    }
  }
  return veins;
}

/** The crater's ragged edge, round the point it was struck */
function crater(rand: () => number): string {
  const points: Point[] = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    const r = UNIT * (0.2 + rand() * 0.13);
    return [Math.cos(angle) * r, Math.sin(angle) * r];
  });
  return `${pathOf(points)} Z`;
}

/** Arcs of electricity crawling over a piece as it is struck */
function arcs(rand: () => number): string[] {
  return Array.from({ length: 5 }, () => {
    const a = rand() * Math.PI * 2;
    const b = a + 1.2 + rand() * 2;
    const r = 30 + rand() * 14;
    return pathOf(
      crooked(
        rand,
        [50 + Math.cos(a) * r, 50 + Math.sin(a) * r],
        [50 + Math.cos(b) * r, 50 + Math.sin(b) * r],
        40,
        4,
      ),
    );
  });
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
function useFreshStrike(strike: Strike | null): Strike | null {
  const [before] = useState(strike?.id ?? null);
  return strike && strike.id !== before ? strike : null;
}

/**
 * The bolt coming down out of the sky onto its square, branching as it
 * goes, with the flash, shock wave, and sparks where it lands, and the burn
 * it leaves behind. Drawn over the dark, since it lights itself.
 */
export function StormBolt({
  strike,
  flipped,
}: {
  strike: Strike | null;
  flipped: boolean;
}) {
  const fresh = useFreshStrike(strike);
  if (!fresh) return null;
  const rand = seededRandom(fresh.id * 131 + fresh.sq);
  const target: Point = [
    (visualCol(fresh.sq, flipped) + 0.5) * UNIT,
    (visualRow(fresh.sq, flipped) + 0.5) * UNIT,
  ];
  const forks = boltForks(rand, target);
  const scar = burnScar(rand);
  const pit = crater(rand);
  const middle = middleOf(fresh.sq, flipped);
  return (
    <div className="storm-strike" key={fresh.id} aria-hidden>
      <svg
        className="storm-scar"
        viewBox={`-${UNIT * 1.6} -${UNIT * 1.6} ${UNIT * 3.2} ${UNIT * 3.2}`}
        style={middle}
      >
        {scar.map(({ d, weight }, i) => (
          <path
            key={`c${i}`}
            className="storm-scar-char"
            d={d}
            style={{ strokeWidth: 9 * weight }}
          />
        ))}
        <path className="storm-crater" d={pit} />
        {scar.map(({ d, weight }, i) => (
          <path
            key={`e${i}`}
            className="storm-scar-ember"
            d={d}
            style={{ strokeWidth: 3.2 * weight }}
          />
        ))}
        <path className="storm-crater-rim" d={pit} />
      </svg>
      <svg
        className="storm-bolt"
        viewBox={`0 0 ${8 * UNIT} ${8 * UNIT}`}
        preserveAspectRatio="none"
      >
        {(["haze", "glow", "core"] as const).map((layer) => (
          <g key={layer} className={`storm-bolt-${layer}`}>
            {forks.map(({ d, at, weight }, i) => (
              <path
                key={i}
                d={d}
                pathLength={1}
                style={
                  {
                    "--weight": weight,
                    animationDelay: `${Math.round(at * 70)}ms`,
                  } as CSSProperties
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
        {sparks(rand, 18).map((style, i) => (
          <i key={i} className="storm-spark" style={style} />
        ))}
      </span>
      {fresh.killed && <Annihilation strike={fresh} flipped={flipped} />}
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
  const silhouette = {
    maskImage: `url("${image}")`,
    WebkitMaskImage: `url("${image}")`,
  } as CSSProperties;
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
        <svg className="storm-arcs" viewBox="0 0 100 100">
          {arcs(rand).map((d, i) => (
            <path
              key={i}
              d={d}
              style={{ animationDelay: `${90 + i * 45}ms` }}
            />
          ))}
        </svg>
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
