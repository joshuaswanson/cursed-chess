import { useState } from "react";
import type { Strike } from "../../plugins/thunderstorm";
import { pieceImage } from "../../utils/pieceImages";
import { visualCol, visualRow } from "./boardGeometry";
import "./Thunderstorm.css";

/** One square in the bolt's drawing units */
const UNIT = 100;
/** How far above the board the bolt starts, so it comes down out of the sky */
const BOLT_TOP = -320;

function seededRandom(seed: number): () => number {
  let state = seed * 7919 + 13;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** A jagged line from one point to another, wandering less the nearer it gets */
function jagged(
  rand: () => number,
  from: [number, number],
  to: [number, number],
  steps: number,
  wander: number,
): [number, number][] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const sway = i === 0 || i === steps ? 0 : (rand() - 0.5) * wander;
    return [
      from[0] + (to[0] - from[0]) * t + sway * (1 - t * 0.6),
      from[1] + (to[1] - from[1]) * t,
    ];
  });
}

const pathOf = (points: [number, number][]) =>
  `M${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")}`;

/** Where a strike is shown, as the percentages of the board to its top left corner */
const placeOf = (sq: Strike["sq"], flipped: boolean) => ({
  left: `${visualCol(sq, flipped) * 12.5}%`,
  top: `${visualRow(sq, flipped) * 12.5}%`,
});

/**
 * Strikes from before the board was drawn have already been and gone, so
 * only the ones after it show
 */
function useFreshStrike(strike: Strike | null): Strike | null {
  const [before] = useState(strike?.id ?? null);
  return strike && strike.id !== before ? strike : null;
}

/** The bolt coming down on its square, forking as it goes, and the burst where it lands. Drawn over the dark. */
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
  const x = (visualCol(fresh.sq, flipped) + 0.5) * UNIT;
  const y = (visualRow(fresh.sq, flipped) + 0.5) * UNIT;
  const main = jagged(
    rand,
    [x + (rand() - 0.5) * 3 * UNIT, BOLT_TOP],
    [x, y],
    14,
    UNIT * 0.9,
  );
  const forks = [3, 6, 9].flatMap((at) => {
    if (rand() < 0.35) return [];
    const [fx, fy] = main[at];
    const side = rand() < 0.5 ? -1 : 1;
    const reach = UNIT * (0.8 + rand() * 1.2);
    return [
      jagged(rand, [fx, fy], [fx + side * reach, fy + reach * 0.9], 5, 40),
    ];
  });
  const d = [main, ...forks].map(pathOf).join(" ");
  return (
    <div className="storm-strike" key={fresh.id} aria-hidden>
      <svg className="storm-bolt" viewBox={`0 0 ${8 * UNIT} ${8 * UNIT}`}>
        <path className="storm-bolt-glow" d={d} />
        <path className="storm-bolt-core" d={d} />
      </svg>
      <span className="storm-impact" style={placeOf(fresh.sq, flipped)} />
    </div>
  );
}

/** Where the bolt came down: a scorch mark, and whatever it hit burnt black and crumbling to ash. Drawn under the dark. */
export function StormGround({
  strike,
  flipped,
}: {
  strike: Strike | null;
  flipped: boolean;
}) {
  const fresh = useFreshStrike(strike);
  if (!fresh) return null;
  const place = placeOf(fresh.sq, flipped);
  return (
    <div className="storm-ground" key={fresh.id} aria-hidden>
      <span className="storm-scorch" style={place} />
      {fresh.killed && (
        <span className="storm-fried" style={place}>
          <img src={pieceImage(fresh.killed)} draggable={false} alt="" />
          <span className="storm-smoke" />
          <span className="storm-smoke storm-smoke-late" />
        </span>
      )}
    </div>
  );
}
