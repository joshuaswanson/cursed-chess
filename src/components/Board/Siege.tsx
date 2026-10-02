import { useEffect, useState } from "react";
import { Color } from "../../engine";
import type { SquareIndex } from "../../engine";
import { COURTYARD, GATES, TOWERS } from "../../plugins/siege";
import type { SiegeView, Strike } from "../../plugins/siege";
import { visualCol, visualRow } from "./boardGeometry";
import { sfx } from "../../audio/sfx";
import "./Siege.css";

/** How long a catapult stone is in the air */
export const BOULDER_FLIGHT_MS = 950;
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

const flagColor = (defender: Color) =>
  defender === Color.White ? "#3b6fe0" : "#c8283a";

/** Sides of a square that face out of the castle, in screen terms */
function outerSides(col: number, row: number) {
  return {
    left: col === 1,
    right: col === 6,
    top: row === 1,
    bottom: row === 6,
  };
}

/** Battlements along one edge of a wall square, in the square's 0 to 100 space */
function Merlons({ side, missing }: { side: string; missing: number }) {
  const blocks = [6, 31, 56, 81];
  return (
    <>
      {blocks.map((at, i) => {
        if (i === missing) return null;
        const horizontal = side === "top" || side === "bottom";
        const x = horizontal ? at : side === "left" ? 2 : 82;
        const y = horizontal ? (side === "top" ? 2 : 82) : at;
        return (
          <g key={i}>
            <rect
              x={x + 2}
              y={y + 3}
              width="16"
              height="16"
              rx="2"
              className="merlon-shadow"
            />
            <rect
              x={x}
              y={y}
              width="16"
              height="16"
              rx="2"
              className="merlon"
            />
            <rect
              x={x + 2}
              y={y + 2}
              width="12"
              height="4"
              className="merlon-lit"
            />
          </g>
        );
      })}
    </>
  );
}

function Cracks({ seed }: { seed: number }) {
  const rand = seeded(seed);
  const crack = () => {
    let x = 20 + rand() * 60;
    let y = 15 + rand() * 20;
    let d = `M${x.toFixed(0)} ${y.toFixed(0)}`;
    for (let i = 0; i < 5; i++) {
      x += (rand() - 0.5) * 22;
      y += 10 + rand() * 8;
      d += ` L${x.toFixed(0)} ${y.toFixed(0)}`;
    }
    return d;
  };
  return (
    <g className="wall-cracks">
      <path d={crack()} />
      <path d={crack()} />
    </g>
  );
}

function Rubble({ seed }: { seed: number }) {
  const rand = seeded(seed + 101);
  return (
    <g className="rubble">
      <ellipse cx="50" cy="55" rx="46" ry="38" className="rubble-dust" />
      {Array.from({ length: 16 }, (_, i) => {
        const x = 10 + rand() * 80;
        const y = 12 + rand() * 76;
        const w = 7 + rand() * 13;
        const h = 6 + rand() * 9;
        return (
          <g
            key={i}
            transform={`rotate(${(rand() * 70 - 35).toFixed(0)} ${x} ${y})`}
          >
            <rect
              x={x - w / 2 + 1.5}
              y={y - h / 2 + 2}
              width={w}
              height={h}
              rx="2"
              className="rubble-shadow"
            />
            <rect
              x={x - w / 2}
              y={y - h / 2}
              width={w}
              height={h}
              rx="2"
              className={`rubble-stone tone-${i % 3}`}
            />
          </g>
        );
      })}
    </g>
  );
}

type Sides = ReturnType<typeof outerSides>;

/** The wall's height casts a shadow onto the courtyard on its inner side */
function WallShadow({ sides }: { sides: Sides }) {
  if (sides.left)
    return (
      <rect x="100" y="0" width="14" height="100" fill="url(#wall-shade-r)" />
    );
  if (sides.right)
    return (
      <rect x="-14" y="0" width="14" height="100" fill="url(#wall-shade-l)" />
    );
  if (sides.top)
    return (
      <rect x="0" y="100" width="100" height="14" fill="url(#wall-shade-d)" />
    );
  return (
    <rect x="0" y="-14" width="100" height="14" fill="url(#wall-shade-u)" />
  );
}

/** Dark lines along the outer and inner faces, so neighboring squares join into one wall */
function WallEdges({ sides }: { sides: Sides }) {
  const vertical = sides.left || sides.right;
  return vertical ? (
    <path d="M1 0 V100 M99 0 V100" className="wall-edge" />
  ) : (
    <path d="M0 1 H100 M0 99 H100" className="wall-edge" />
  );
}

/** One stretch of castle wall seen from above: stone walkway with battlements on the outer side */
function WallSquare({
  sq,
  hp,
  col,
  row,
  delay,
  defender,
}: {
  sq: SquareIndex;
  hp: number;
  col: number;
  row: number;
  delay: number;
  defender: Color;
}) {
  const sides = outerSides(col, row);
  const tower = TOWERS.includes(sq);
  const missing = hp === 1 ? sq % 4 : -1;
  return (
    <g
      className={`wall-square${hp === 1 ? " cracked" : ""}`}
      transform={`translate(${col * 100} ${row * 100})`}
      style={{ animationDelay: `${delay}ms` } as Style}
    >
      {tower ? (
        <>
          <circle cx="53" cy="55" r="49" className="wall-cast" />
          <circle
            cx="50"
            cy="50"
            r="49"
            fill="url(#siege-stone)"
            className="wall-body"
          />
          <circle cx="50" cy="50" r="49" fill="url(#siege-light)" />
          <circle cx="50" cy="50" r="31" className="tower-floor" />
          {Array.from({ length: 12 }, (_, i) =>
            i === missing * 3 ? null : (
              <rect
                key={i}
                x="45"
                y="3"
                width="10"
                height="13"
                rx="2"
                className="merlon"
                transform={`rotate(${i * 30} 50 50)`}
              />
            ),
          )}
          <line x1="50" y1="50" x2="50" y2="20" className="flag-pole" />
          <path
            d="M50 21 L78 27 L50 34 Z"
            fill={flagColor(defender)}
            className="flag"
          />
        </>
      ) : (
        <>
          <WallShadow sides={sides} />
          <rect width="100" height="100" fill="url(#siege-stone)" />
          <rect width="100" height="100" fill="url(#siege-light)" />
          <WallEdges sides={sides} />
          {Object.entries(sides).map(
            ([side, outer]) =>
              outer && <Merlons key={side} side={side} missing={missing} />,
          )}
        </>
      )}
      {hp === 1 && <Cracks seed={sq} />}
    </g>
  );
}

/** A gatehouse: a lowered drawbridge with the portcullis raised above it */
function Gate({
  col,
  row,
  delay,
}: {
  col: number;
  row: number;
  delay: number;
}) {
  const vertical = row === 1 || row === 6;
  return (
    <g
      className="gate"
      transform={`translate(${col * 100} ${row * 100}) ${vertical ? "" : "rotate(90 50 50)"}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <rect
        x="0"
        width="12"
        height="100"
        fill="url(#siege-stone)"
        className="wall-body"
      />
      <rect
        x="88"
        width="12"
        height="100"
        fill="url(#siege-stone)"
        className="wall-body"
      />
      <rect x="12" width="76" height="100" className="drawbridge" />
      {Array.from({ length: 9 }, (_, i) => (
        <line
          key={i}
          x1="12"
          x2="88"
          y1={6 + i * 11}
          y2={6 + i * 11}
          className="plank-seam"
        />
      ))}
      <rect
        x="12"
        y={row === 1 ? 0 : 92}
        width="76"
        height="8"
        className="portcullis"
      />
    </g>
  );
}

/** Stone flags over the courtyard */
function Courtyard({
  squares,
  flipped,
}: {
  squares: SquareIndex[];
  flipped: boolean;
}) {
  const cols = squares.map((sq) => visualCol(sq, flipped));
  const rows = squares.map((sq) => visualRow(sq, flipped));
  const x = Math.min(...cols) * 100;
  const y = Math.min(...rows) * 100;
  return (
    <g className="courtyard">
      <rect x={x} y={y} width="400" height="400" fill="url(#siege-flags)" />
      <rect
        x={x}
        y={y}
        width="400"
        height="400"
        fill="url(#siege-court-shade)"
      />
    </g>
  );
}

/**
 * The castle on the board: walls, towers, gates and rubble under the pieces,
 * plus catapult stones and battering blows landing on the walls.
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
  const boulder = useFreshStrike(view.lastBoulder, BOULDER_FLIGHT_MS);
  const ram = useFreshStrike(view.lastRam, RAM_HIT_MS);

  // A stone in flight has not hit its wall yet, so show the wall as it was
  const shownHp = (sq: SquareIndex) => {
    const hp = view.walls[sq];
    if (boulder.flying && boulder.strike?.target === sq) {
      return boulder.strike.hpAfter + 1;
    }
    return hp;
  };
  const inFlight =
    boulder.flying && boulder.strike?.hpAfter === 0
      ? boulder.strike.target
      : null;

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
            id="siege-stone"
            width="40"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <rect width="40" height="22" fill="#8a8173" />
            <rect x="1" y="1" width="18" height="9" rx="1.5" fill="#9b9283" />
            <rect x="21" y="1" width="18" height="9" rx="1.5" fill="#857c6e" />
            <rect x="-9" y="12" width="18" height="9" rx="1.5" fill="#928a7b" />
            <rect x="11" y="12" width="18" height="9" rx="1.5" fill="#a0978a" />
            <rect x="31" y="12" width="18" height="9" rx="1.5" fill="#877e70" />
          </pattern>
          <radialGradient id="siege-light" cx="0.3" cy="0.25" r="0.9">
            <stop offset="0" stopColor="#fff2d8" stopOpacity="0.25" />
            <stop offset="0.6" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.35" />
          </radialGradient>
          {(
            [
              ["r", 0, 1],
              ["l", 1, 0],
              ["d", 0, 1],
              ["u", 1, 0],
            ] as const
          ).map(([dir, from, to]) => {
            const across = dir === "r" || dir === "l";
            return (
              <linearGradient
                key={dir}
                id={`wall-shade-${dir}`}
                x1={across ? from : 0}
                x2={across ? to : 0}
                y1={across ? 0 : from}
                y2={across ? 0 : to}
              >
                <stop offset="0" stopColor="#000" stopOpacity="0.5" />
                <stop offset="1" stopColor="#000" stopOpacity="0" />
              </linearGradient>
            );
          })}
          <pattern
            id="siege-flags"
            width="50"
            height="50"
            patternUnits="userSpaceOnUse"
          >
            <rect width="50" height="50" fill="#9c8e78" opacity="0.45" />
            <path
              d="M0 0 H30 V22 H0 Z M30 0 H50 V30 H30 Z M0 22 H18 V50 H0 Z M18 22 H30 V50 H18 Z M30 30 H50 V50 H30 Z"
              fill="none"
              stroke="#3d3226"
              strokeOpacity="0.35"
              strokeWidth="1.5"
            />
          </pattern>
          <radialGradient id="siege-court-shade">
            <stop offset="0.6" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.3" />
          </radialGradient>
        </defs>

        <Courtyard squares={COURTYARD} flipped={flipped} />
        {view.rubble.map((sq) => {
          const { col, row } = placed(sq);
          return (
            <g
              key={`r${sq}`}
              transform={`translate(${col * 100} ${row * 100})`}
              className="rubble-pile"
            >
              <Rubble seed={sq} />
            </g>
          );
        })}
        {GATES.map((sq) => {
          const { col, row } = placed(sq);
          return <Gate key={sq} col={col} row={row} delay={riseDelay(sq)} />;
        })}
        {Object.keys(view.walls)
          .map(Number)
          .concat(inFlight !== null ? [inFlight] : [])
          .map((sq) => {
            const { col, row } = placed(sq);
            return (
              <WallSquare
                key={sq}
                sq={sq}
                hp={shownHp(sq) ?? 1}
                col={col}
                row={row}
                delay={riseDelay(sq)}
                defender={view.defender}
              />
            );
          })}
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

      {boulder.strike && (
        <Boulder
          key={boulder.strike.id}
          strike={boulder.strike}
          flipped={flipped}
          squareSize={squareSize}
        />
      )}
      {ram.strike && (
        <Impact
          key={`ram${ram.strike.id}`}
          strike={ram.strike}
          flipped={flipped}
          delayMs={RAM_HIT_MS}
          small
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

/** A catapult stone arcing in from beyond the board's edge */
function Boulder({
  strike,
  flipped,
  squareSize,
}: {
  strike: Strike;
  flipped: boolean;
  squareSize: number;
}) {
  const col = visualCol(strike.target, flipped);
  const row = visualRow(strike.target, flipped);
  const fromLeft = col < 4;
  const startCol = fromLeft ? -3 : 11;
  const startRow = row - 2;

  useEffect(() => {
    sfx.catapult();
    const hit = setTimeout(
      () => sfx.stoneHit(strike.hpAfter === 0),
      BOULDER_FLIGHT_MS,
    );
    return () => clearTimeout(hit);
  }, [strike]);

  return (
    <>
      <span
        className="boulder-shadow"
        style={{
          left: `${col * 12.5}%`,
          top: `${row * 12.5}%`,
          animationDuration: `${BOULDER_FLIGHT_MS}ms`,
        }}
      />
      <span
        className="boulder"
        style={
          {
            left: `${col * 12.5}%`,
            top: `${row * 12.5}%`,
            "--from-x": `${(startCol - col) * squareSize}px`,
            "--from-y": `${(startRow - row) * squareSize}px`,
            "--lift": `${-squareSize * 2.2}px`,
            animationDuration: `${BOULDER_FLIGHT_MS}ms`,
          } as Style
        }
      >
        <span
          className="boulder-rock"
          style={{ animationDuration: `${BOULDER_FLIGHT_MS}ms` }}
        />
      </span>
      <Impact strike={strike} flipped={flipped} delayMs={BOULDER_FLIGHT_MS} />
    </>
  );
}

/** Dust, flying stone chips, and a flash where a blow lands; a bigger cloud when a wall falls */
function Impact({
  strike,
  flipped,
  delayMs,
  small = false,
}: {
  strike: Strike;
  flipped: boolean;
  delayMs: number;
  small?: boolean;
}) {
  const rand = seeded(strike.id);
  const col = visualCol(strike.target, flipped);
  const row = visualRow(strike.target, flipped);
  const fell = strike.hpAfter === 0;
  useEffect(() => {
    if (!small) return;
    const hit = setTimeout(() => sfx.stoneHit(fell), delayMs);
    return () => clearTimeout(hit);
  }, [small, fell, delayMs]);
  return (
    <span
      className={`siege-impact${fell ? " fell" : ""}${small ? " small" : ""}`}
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
