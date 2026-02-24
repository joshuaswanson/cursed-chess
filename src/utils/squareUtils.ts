import type { SquareIndex } from "../engine/types";

const FILES = "abcdefgh";

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
  return (sq & 0x88) === 0;
}

/** Convert algebraic notation (e.g. "e4") to 0x88 index */
export function algebraicToIndex(algebraic: string): SquareIndex {
  const file = algebraic.charCodeAt(0) - 97; // 'a' = 0
  const rank = parseInt(algebraic[1]) - 1; // '1' = 0
  return toIndex(file, rank);
}

/** Convert 0x88 index to algebraic notation (e.g. "e4") */
export function indexToAlgebraic(sq: SquareIndex): string {
  return FILES[fileOf(sq)] + (rankOf(sq) + 1);
}

/** Convert 0x88 index to row/col for rendering (row 0 = rank 8, col 0 = file a) */
export function indexToRowCol(sq: SquareIndex): { row: number; col: number } {
  return { row: 7 - rankOf(sq), col: fileOf(sq) };
}

/** Convert row/col (rendering coordinates) to 0x88 index */
export function rowColToIndex(row: number, col: number): SquareIndex {
  return toIndex(col, 7 - row);
}
