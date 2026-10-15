import { useEffect, useState } from "react";
import type { RefObject } from "react";
import type { Piece, SquareIndex } from "../../engine";
import {
  BELTS,
  BELT_RUN_MS,
  beltDirection,
  carried,
} from "../../plugins/conveyor";
import type { ConveyorView } from "../../plugins/conveyor";
import { pieceImage } from "../../utils/pieceImages";
import { offsetBetween, visualCol, visualRow } from "./boardGeometry";
import "./Conveyor.css";

type Offset = { x: number; y: number };

/** Where a piece starts the animation, and where it stands when the belts start to run */
export interface Ride {
  from: Offset;
  via: Offset;
}

/**
 * Each piece's ride for the belts' latest run, keyed by where it ended up.
 * The piece just moved first slides to the square it was moved to, then
 * every piece is carried one place along. A dropped piece is already where
 * it was moved to.
 */
export function useBeltRun(
  view: ConveyorView | null,
  flipped: boolean,
  squareSize: number,
  wasDropRef: RefObject<boolean>,
): Map<SquareIndex, Ride> {
  const run = view?.run ?? 0;
  const [seen, setSeen] = useState(run);
  const [rides, setRides] = useState<Map<SquareIndex, Ride>>(new Map());
  if (run !== seen) {
    setSeen(run);
    const move = view?.move ?? null;
    const dropped = wasDropRef.current;
    setRides(
      new Map(
        (view?.rides ?? []).map(({ from, to }): [SquareIndex, Ride] => {
          const via = offsetBetween(from, to, flipped, squareSize);
          const moved = move !== null && from === move.to && !dropped;
          return [
            to,
            {
              from: moved
                ? offsetBetween(move.from, to, flipped, squareSize)
                : via,
              via,
            },
          ];
        }),
      ),
    );
  }
  useEffect(() => {
    if (rides.size === 0) return;
    const done = setTimeout(() => setRides(new Map()), BELT_RUN_MS + 100);
    return () => clearTimeout(done);
  }, [rides]);
  return rides;
}

/** The belts' rollers and rails, with arrows showing which way each one runs */
export function BeltRails({ run }: { run: number }) {
  const arrows = Array.from({ length: BELTS }, (_, belt) => {
    const lo = belt * 100 + 50;
    const hi = 800 - lo;
    const mid = 400;
    // Clockwise is up the left, along the top, down the right, back along the bottom
    const spots: [number, number, number][] = [
      [lo, mid, -90],
      [mid, lo, 0],
      [hi, mid, 90],
      [mid, hi, 180],
    ];
    const turn = beltDirection(belt) > 0 ? 0 : 180;
    return spots.map(([x, y, angle], i) => (
      <path
        key={`${belt}-${i}`}
        className={`belt-arrow belt-arrow-${belt}`}
        d="M-9 -12 L5 0 L-9 12"
        transform={`translate(${x} ${y}) rotate(${angle + turn})`}
      />
    ));
  });
  return (
    <svg className="belt-rails" viewBox="0 0 800 800" aria-hidden>
      {[100, 200, 300].map((inset) => (
        <g key={inset}>
          <rect
            className="belt-rail"
            x={inset}
            y={inset}
            width={800 - inset * 2}
            height={800 - inset * 2}
          />
          <rect
            className="belt-rail-stripes"
            x={inset}
            y={inset}
            width={800 - inset * 2}
            height={800 - inset * 2}
          />
        </g>
      ))}
      <g key={run} className="belt-arrows">
        {arrows}
      </g>
    </svg>
  );
}

/** The square under the pointer on the board, while it is over one */
export function useHoveredSquare(
  boardRef: RefObject<HTMLElement | null>,
  active: boolean,
): SquareIndex | null {
  const [hovered, setHovered] = useState<SquareIndex | null>(null);
  useEffect(() => {
    const board = boardRef.current;
    if (!board || !active) return;
    const move = (e: PointerEvent) => {
      const el = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>("[data-sq]");
      setHovered(el && board.contains(el) ? Number(el.dataset.sq) : null);
    };
    const leave = () => setHovered(null);
    board.addEventListener("pointermove", move);
    board.addEventListener("pointerleave", leave);
    return () => {
      board.removeEventListener("pointermove", move);
      board.removeEventListener("pointerleave", leave);
      setHovered(null);
    };
  }, [boardRef, active]);
  return hovered;
}

/** Where a move to the hovered square would leave the piece once the belts have run */
export function BeltLanding({
  piece,
  target,
  flipped,
}: {
  piece: Piece;
  target: SquareIndex;
  flipped: boolean;
}) {
  const landing = carried(target);
  const at = (sq: SquareIndex) => ({
    x: (visualCol(sq, flipped) + 0.5) * 100,
    y: (visualRow(sq, flipped) + 0.5) * 100,
  });
  const a = at(target);
  const b = at(landing);
  return (
    <>
      <svg className="belt-landing-path" viewBox="0 0 800 800" aria-hidden>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      </svg>
      <div
        className="belt-landing"
        style={{
          left: `${visualCol(landing, flipped) * 12.5}%`,
          top: `${visualRow(landing, flipped) * 12.5}%`,
        }}
        aria-hidden
      >
        <img src={pieceImage(piece)} alt="" draggable={false} />
      </div>
    </>
  );
}
