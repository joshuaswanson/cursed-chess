import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { SquareIndex } from "../../engine";
import { COURTYARD } from "../../plugins/siege";
import type { SiegeView, Strike } from "../../plugins/siege";
import { visualCol, visualRow } from "./boardGeometry";
import { sfx } from "../../audio/sfx";
import { Castle } from "./Castle";
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
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
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
      ref={setLayer}
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
        <Castle
          walls={Object.keys(view.walls)
            .map(Number)
            .concat(inFlight !== null ? [inFlight] : [])}
          rubble={view.rubble.filter((sq) => sq !== inFlight)}
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

      {boulder.strike && layer && (
        <Boulder
          key={boulder.strike.id}
          strike={boulder.strike}
          flipped={flipped}
          squareSize={squareSize}
          board={layer.getBoundingClientRect()}
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
  board,
}: {
  strike: Strike;
  flipped: boolean;
  squareSize: number;
  /** Where the board sits on screen, since the stone flies above the whole page */
  board: DOMRect;
}) {
  const col = visualCol(strike.target, flipped);
  const row = visualRow(strike.target, flipped);
  const fromLeft = col < 4;
  const startCol = fromLeft ? -3 : 11;
  const startRow = row - 1;
  // The arc peaks as high as it can while staying on screen
  const landY = board.top + row * squareSize;
  const lift = Math.max(
    0,
    Math.min(squareSize * 2.2, landY - squareSize * 0.8),
  );

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
      {createPortal(
        <span
          className="boulder"
          style={
            {
              left: board.left + col * squareSize,
              top: board.top + row * squareSize,
              width: squareSize,
              height: squareSize,
              "--from-x": `${(startCol - col) * squareSize}px`,
              "--from-y": `${(startRow - row) * squareSize}px`,
              "--lift": `${-lift}px`,
              animationDuration: `${BOULDER_FLIGHT_MS}ms`,
            } as Style
          }
        >
          <span
            className="boulder-rock"
            style={{ animationDuration: `${BOULDER_FLIGHT_MS}ms` }}
          />
        </span>,
        document.body,
      )}
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
