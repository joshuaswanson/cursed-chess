import { Color, PieceType } from "../types";
import type { Piece } from "../types";
export { Color, PieceType };
export type { Piece };
export { GameStatus } from "../types";

export { opponent } from "../moves";

export interface HexCoord {
  readonly q: number;
  readonly r: number;
}

export function hexKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function coordKey(c: HexCoord): string {
  return `${c.q},${c.r}`;
}

export function parseHexKey(key: string): HexCoord {
  const i = key.indexOf(",");
  return { q: +key.slice(0, i), r: +key.slice(i + 1) };
}

export function isValidHex(q: number, r: number): boolean {
  return Math.abs(q) <= 5 && Math.abs(r) <= 5 && Math.abs(q + r) <= 5;
}

/** 3-coloring of the hex grid (0, 1, 2). Diagonal moves preserve color. */
export function hexColor(q: number, r: number): 0 | 1 | 2 {
  return ((((q - r) % 3) + 3) % 3) as 0 | 1 | 2;
}

// 6 orthogonal (edge-adjacent) directions - rook movement
export const ORTHO: readonly HexCoord[] = [
  { q: 0, r: -1 }, // N  (White forward)
  { q: 1, r: -1 }, // NE
  { q: 1, r: 0 }, // SE
  { q: 0, r: 1 }, // S  (Black forward)
  { q: -1, r: 1 }, // SW
  { q: -1, r: 0 }, // NW
];

// 6 diagonal (vertex-adjacent) directions - bishop movement
export const DIAG: readonly HexCoord[] = [
  { q: 2, r: -1 },
  { q: 1, r: -2 },
  { q: -1, r: -1 },
  { q: -2, r: 1 },
  { q: -1, r: 2 },
  { q: 1, r: 1 },
];

// 12 knight offsets (2 orthogonal + 1 at 60 degrees)
export const KNIGHT_OFFSETS: readonly HexCoord[] = [
  { q: 3, r: -1 },
  { q: 2, r: 1 },
  { q: 3, r: -2 },
  { q: 2, r: -3 },
  { q: 1, r: -3 },
  { q: -1, r: -2 },
  { q: -2, r: -1 },
  { q: -3, r: 1 },
  { q: -3, r: 2 },
  { q: -2, r: 3 },
  { q: -1, r: 3 },
  { q: 1, r: 2 },
];

export interface HexMove {
  from: HexCoord;
  to: HexCoord;
  piece: Piece;
  captured?: Piece;
  promotion?: PieceType;
  isEnPassant?: boolean;
  isDoublePush?: boolean;
}

// Pawn movement directions per color
export const PAWN_FORWARD: Record<Color, HexCoord> = {
  [Color.White]: { q: 0, r: -1 },
  [Color.Black]: { q: 0, r: 1 },
};

// Pawn capture directions (the two orthogonal directions flanking forward)
export const PAWN_CAPTURES: Record<Color, readonly HexCoord[]> = {
  [Color.White]: [
    { q: -1, r: 0 },
    { q: 1, r: -1 },
  ],
  [Color.Black]: [
    { q: 1, r: 0 },
    { q: -1, r: 1 },
  ],
};

// Starting pawn positions for double-step eligibility
export const PAWN_STARTS: Record<Color, ReadonlySet<string>> = {
  [Color.White]: new Set([
    hexKey(-4, 5),
    hexKey(-3, 4),
    hexKey(-2, 4),
    hexKey(-1, 4),
    hexKey(0, 4),
    hexKey(1, 3),
    hexKey(2, 2),
    hexKey(3, 1),
    hexKey(4, 1),
  ]),
  [Color.Black]: new Set([
    hexKey(4, -5),
    hexKey(3, -4),
    hexKey(2, -4),
    hexKey(1, -4),
    hexKey(0, -4),
    hexKey(-1, -3),
    hexKey(-2, -2),
    hexKey(-3, -1),
    hexKey(-4, -1),
  ]),
};
