import { useEffect, useState } from "react";
import type { SquareIndex } from "../../engine";
import { BELT_RUN_MS } from "../../plugins/conveyor";
import type { ConveyorView } from "../../plugins/conveyor";
import { offsetBetween } from "./boardGeometry";
import type { DroppedMove } from "./usePieceDrag";

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
  lastDrop: DroppedMove | null,
): Map<SquareIndex, Ride> {
  const run = view?.run ?? 0;
  const [seen, setSeen] = useState(run);
  const [rides, setRides] = useState<Map<SquareIndex, Ride>>(new Map());
  if (run !== seen) {
    setSeen(run);
    const move = view?.move ?? null;
    const dropped =
      move !== null && lastDrop?.from === move.from && lastDrop.to === move.to;
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
