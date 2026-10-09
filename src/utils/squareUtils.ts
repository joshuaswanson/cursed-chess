import { Color } from "../engine/types";
import type { SquareIndex } from "../engine/types";

const FILES = "abcdefghijklmnop";

/** A board is eight files wide and eight ranks deep, unless a mode says otherwise */
const STANDARD_SIZE = 8;
/** The biggest board the square numbering has room for, either way */
export const MAX_RANKS = 16;
/** A knight's two-file step must never carry it round onto the far edge */
const MAX_FILES = 14;
let ranks = STANDARD_SIZE;
let files = STANDARD_SIZE;

/** How many ranks deep the board is */
export function boardRanks(): number {
  return ranks;
}

/** How many files wide the board is */
export function boardFiles(): number {
  return files;
}

/** The rank furthest from White's own */
export function lastRank(): number {
  return ranks - 1;
}

/** The file furthest from the a-file */
export function lastFile(): number {
  return files - 1;
}

/** Convert file (0-7) and rank (0-7) to 0x88 index */
export function toIndex(file: number, rank: number): SquareIndex {
  return rank * 16 + file;
}

/** Extract file (0-7) from 0x88 index */
export function fileOf(sq: SquareIndex): number {
  return sq & 0x0f;
}

/** Extract rank (0-7) from 0x88 index */
export function rankOf(sq: SquareIndex): number {
  return sq >> 4;
}

/** Check if a 0x88 index is a valid board square */
export function isValidSquare(sq: SquareIndex): boolean {
  return sq >= 0 && (sq & 0x0f) < files && sq >> 4 < ranks;
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
  Array.from({ length: files * ranks }, (_, i) =>
    toIndex(i % files, Math.floor(i / files)),
  );

/** Every square of the board, rank 1 first. Refilled when the board changes size. */
const squares: SquareIndex[] = everySquare();
export const ALL_SQUARES: readonly SquareIndex[] = squares;

/**
 * Makes the board this many ranks deep and files wide, for a mode played
 * on a bigger one. Whatever game is in progress has to be set up again
 * afterward.
 */
export function setBoardSize(
  depth: number = STANDARD_SIZE,
  width: number = STANDARD_SIZE,
): void {
  ranks = Math.min(MAX_RANKS, Math.max(1, depth));
  files = Math.min(MAX_FILES, Math.max(1, width));
  squares.splice(0, squares.length, ...everySquare());
}

/** Promotion rank for a pawn of the given color */
export function promotionRank(color: Color): number {
  return color === Color.White ? lastRank() : 0;
}
