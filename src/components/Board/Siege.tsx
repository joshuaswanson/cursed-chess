import { useEffect, useState } from "react";
import type { SquareIndex } from "../../engine";
import { COURTYARD } from "../../plugins/siege";
import type { SiegeView, Strike } from "../../plugins/siege";
import { visualCol, visualRow } from "./boardGeometry";
import { sfx } from "../../audio/sfx";
import { Castle, COURT_REACH } from "./Castle";
import "./Siege.css";

/** When a battering piece's blow lands */
const RAM_HIT_MS = 170;

type Style = React.CSSProperties & Record<`--${string}`, string | number>;

function seeded(seed: number) {
  let s = seed * 7919 + 13;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Paving stones laid across a 50 by 50 tile: x, y, width, height, tone */
const FLAGSTONES = [
  [0, 0, 30, 22, "#a7a49c"],
  [30, 0, 20, 30, "#99968e"],
  [0, 22, 18, 28, "#9e9b93"],
  [18, 22, 12, 28, "#aeaba2"],
  [30, 30, 20, 20, "#a29f97"],
] as const;

/** The courtyard is paved in grey stone, set apart from the mud outside the walls */
function Courtyard({
  squares,
  flipped,
}: {
  squares: SquareIndex[];
  flipped: boolean;
}) {
  const cols = squares.map((sq) => visualCol(sq, flipped));
  const rows = squares.map((sq) => visualRow(sq, flipped));
  const x = Math.min(...cols) * 100 - COURT_REACH;
  const y = Math.min(...rows) * 100 - COURT_REACH;
  const size = 400 + COURT_REACH * 2;
  return (
    <g className="courtyard">
      <rect x={x} y={y} width={size} height={size} className="court-grout" />
      <rect x={x} y={y} width={size} height={size} fill="url(#siege-flags)" />
      {squares
        .filter((sq) => ((sq & 7) + (sq >> 4)) % 2 === 0)
        .map((sq) => (
          <rect
            key={sq}
            x={visualCol(sq, flipped) * 100}
            y={visualRow(sq, flipped) * 100}
            width="100"
            height="100"
            className="court-dark"
          />
        ))}
      <rect
        x={x}
        y={y}
        width={size}
        height={size}
        fill="url(#siege-court-shade)"
      />
    </g>
  );
}

/**
 * The castle on the board: walls, towers, gates and rubble under the pieces,
 * plus the dust and chips where a battering blow lands.
 */
export function SiegeLayer({
  view,
  flipped,
  squareSize,
  ramTargets,
  rising,
}: {
  view: SiegeView;
  flipped: boolean;
  squareSize: number;
  ramTargets: SquareIndex[];
  /** The walls are rising out of the ground as the mode begins */
  rising: boolean;
}) {
  const ram = useFreshStrike(view.lastRam, RAM_HIT_MS);

  // A blow still on its way has not hit its wall yet, so show the wall as it was
  const landing = ram.flying ? ram.strike : null;
  const shownHp = (sq: SquareIndex) =>
    landing?.target === sq ? landing.hpAfter + 1 : view.walls[sq];
  const stillStanding = landing?.hpAfter === 0 ? [landing.target] : [];

  const placed = (sq: SquareIndex) => ({
    col: visualCol(sq, flipped),
    row: visualRow(sq, flipped),
  });
  // Walls rise in a sweep around the ring
  const riseDelay = (sq: SquareIndex) => {
    const { col, row } = placed(sq);
    const angle = Math.atan2(row - 3.5, col - 3.5) + Math.PI;
    return Math.round((angle / (Math.PI * 2)) * 700);
  };

  const pct = (n: number) => `${n * 12.5}%`;
  return (
    <div
      className={`siege-layer${rising ? " rising" : ""}`}
      style={{ "--sq": `${squareSize}px` } as Style}
    >
      <svg className="siege-castle" viewBox="0 0 800 800" aria-hidden>
        <defs>
          <pattern
            id="siege-flags"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            {FLAGSTONES.map(([sx, sy, w, h, tone]) => (
              <g key={`${sx},${sy}`}>
                <rect
                  x={sx + 0.9}
                  y={sy + 0.9}
                  width={w - 1.8}
                  height={h - 1.8}
                  rx="2"
                  fill={tone}
                />
                <rect
                  x={sx + 1.5}
                  y={sy + 1.2}
                  width={w - 3}
                  height="1.5"
                  rx="0.75"
                  fill="#fff"
                  opacity="0.25"
                />
              </g>
            ))}
          </pattern>
          <radialGradient id="siege-court-shade">
            <stop offset="0.6" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.3" />
          </radialGradient>
        </defs>

        <Courtyard squares={COURTYARD} flipped={flipped} />
        <Castle
          walls={Object.keys(view.walls).map(Number).concat(stillStanding)}
          rubble={view.rubble.filter((sq) => !stillStanding.includes(sq))}
          hpOf={(sq) => shownHp(sq) ?? 1}
          flipped={flipped}
          defender={view.defender}
          riseDelay={riseDelay}
        />
      </svg>

      {ramTargets.map((sq) => {
        const { col, row } = placed(sq);
        return (
          <span
            key={`t${sq}`}
            className="ram-target"
            style={{ left: pct(col), top: pct(row) }}
            aria-hidden
          />
        );
      })}

      {ram.strike && (
        <Impact
          key={`ram${ram.strike.id}`}
          strike={ram.strike}
          flipped={flipped}
          delayMs={RAM_HIT_MS}
        />
      )}
    </div>
  );
}

/** Tracks the newest strike: whether it is still on its way, and keeps it around for its effects */
function useFreshStrike(strike: Strike | null, travelMs: number) {
  const [seen, setSeen] = useState(strike?.id ?? 0);
  const [current, setCurrent] = useState<Strike | null>(null);
  const [flying, setFlying] = useState(false);
  if (strike && strike.id !== seen) {
    setSeen(strike.id);
    setCurrent(strike);
    setFlying(true);
  }
  useEffect(() => {
    if (!current) return;
    const timers = [
      setTimeout(() => setFlying(false), travelMs),
      setTimeout(() => setCurrent(null), travelMs + 1400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [current, travelMs]);
  return { strike: current, flying };
}

/** Dust, flying stone chips, and a flash where a blow lands; a bigger cloud when a wall falls */
function Impact({
  strike,
  flipped,
  delayMs,
}: {
  strike: Strike;
  flipped: boolean;
  delayMs: number;
}) {
  const rand = seeded(strike.id);
  const col = visualCol(strike.target, flipped);
  const row = visualRow(strike.target, flipped);
  const fell = strike.hpAfter === 0;
  useEffect(() => {
    const hit = setTimeout(() => sfx.stoneHit(fell), delayMs);
    return () => clearTimeout(hit);
  }, [fell, delayMs]);
  return (
    <span
      className={`siege-impact${fell ? " fell" : ""}`}
      style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%` }}
    >
      <span
        className="impact-flash"
        style={{ animationDelay: `${delayMs}ms` }}
      />
      <span
        className="impact-dust"
        style={{ animationDelay: `${delayMs}ms` }}
      />
      {Array.from({ length: fell ? 14 : 8 }, (_, i) => {
        const angle = (i / (fell ? 14 : 8)) * Math.PI * 2 + rand();
        const reach = (fell ? 1.1 : 0.7) + rand() * 0.6;
        return (
          <i
            key={i}
            className="impact-chip"
            style={
              {
                "--cx": Math.cos(angle) * reach,
                "--cy": Math.sin(angle) * reach - 0.3,
                "--spin": `${(rand() - 0.5) * 720}deg`,
                "--size": `${5 + rand() * (fell ? 9 : 5)}%`,
                animationDelay: `${delayMs}ms`,
              } as Style
            }
          />
        );
      })}
    </span>
  );
}
