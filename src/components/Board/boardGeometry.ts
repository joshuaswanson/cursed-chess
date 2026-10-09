import { fileOf, lastRank, rankOf } from "../../utils/squareUtils";
import type { SquareIndex } from "../../engine";

/** Column on screen, 0 at the left edge */
export function visualCol(sq: SquareIndex, flipped: boolean): number {
  return flipped ? 7 - fileOf(sq) : fileOf(sq);
}

/** Row on screen, 0 at the top edge */
export function visualRow(sq: SquareIndex, flipped: boolean): number {
  return flipped ? rankOf(sq) : lastRank() - rankOf(sq);
}

/** Pixel offset from `to` back to `from`, for animations that start at `from` */
export function offsetBetween(
  from: SquareIndex,
  to: SquareIndex,
  flipped: boolean,
  squareSize: number,
): { x: number; y: number } {
  return {
    x: (visualCol(from, flipped) - visualCol(to, flipped)) * squareSize,
    y: (visualRow(from, flipped) - visualRow(to, flipped)) * squareSize,
  };
}
