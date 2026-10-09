import { Color } from "../engine/types";
import type { SquareIndex } from "../engine/types";

const FILES = "abcdefgh";

/** A board is eight files wide and, unless a mode says otherwise, eight ranks deep */
const STANDARD_RANKS = 8;
/** The deepest board the square numbering has room for */
export const MAX_RANKS = 16;
let ranks = STANDARD_RANKS;

/** How many ranks deep the board is */
export function boardRanks(): number {
  return ranks;
}

/** The rank furthest from White's own */
export function lastRank(): number {
  return ranks - 1;
}

/** Convert file (0-7) and rank (0-7) to 0x88 index */
export function toIndex(file: number, rank: number): SquareIndex {
  return rank * 16 + file;
}

/** Extract file (0-7) from 0x88 index */
export function fileOf(sq: SquareIndex): number {
  return sq & 0x07;
}

/** Extract rank (0-7) from 0x88 index */
export function rankOf(sq: SquareIndex): number {
  return sq >> 4;
}

/** Check if a 0x88 index is a valid board square */
export function isValidSquare(sq: SquareIndex): boolean {
  return sq >= 0 && (sq & 0x08) === 0 && sq >> 4 < ranks;
}

/** Convert algebraic notation (e.g. "e4") to 0x88 index */
export function algebraicToIndex(algebraic: string): SquareIndex {
  const file = algebraic.charCodeAt(0) - 97; // 'a' = 0
  const rank = parseInt(algebraic.slice(1)) - 1; // '1' = 0
  return toIndex(file, rank);
}

/** Convert 0x88 index to algebraic notation (e.g. "e4") */
export function indexToAlgebraic(sq: SquareIndex): string {
  return FILES[fileOf(sq)] + (rankOf(sq) + 1);
}

/** Convert 0x88 index to row/col for rendering (row 0 = rank 8, col 0 = file a) */
export function indexToRowCol(sq: SquareIndex): { row: number; col: number } {
  return { row: lastRank() - rankOf(sq), col: fileOf(sq) };
}

/** Convert row/col (rendering coordinates) to 0x88 index */
export function rowColToIndex(row: number, col: number): SquareIndex {
  return toIndex(col, lastRank() - row);
}

const everySquare = (): SquareIndex[] =>
  Array.from({ length: 8 * ranks }, (_, i) =>
    toIndex(i % 8, Math.floor(i / 8)),
  );

/** Every square of the board, rank 1 first. Refilled when the board changes depth. */
const squares: SquareIndex[] = everySquare();
export const ALL_SQUARES: readonly SquareIndex[] = squares;

/**
 * Makes the board this many ranks deep, for a mode played on a longer one.
 * Whatever game is in progress has to be set up again afterward.
 */
export function setBoardRanks(depth: number = STANDARD_RANKS): void {
  ranks = Math.min(MAX_RANKS, Math.max(1, depth));
  squares.splice(0, squares.length, ...everySquare());
}

/** Promotion rank for a pawn of the given color */
export function promotionRank(color: Color): number {
  return color === Color.White ? lastRank() : 0;
}
