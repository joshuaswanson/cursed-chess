import { Color, PieceType, isSquareAttacked, opponent } from "../engine";
import type { Board, Piece, SquareIndex } from "../engine";
import { ALL_SQUARES, fileOf, rankOf } from "../utils/squareUtils";

/** Pieces besides the king that every side gets to start a mode with */
export const MIN_TROOPS = 6;
/** Who comes first when a side is short */
const SQUAD: PieceType[] = [
  PieceType.Knight,
  PieceType.Pawn,
  PieceType.Pawn,
  PieceType.Bishop,
  PieceType.Pawn,
  PieceType.Rook,
];

export type ArrivalStyle = "parachute" | "sprint";

/** A king off the board for a mode, walking from `sq` after `delayMs`, or already off it when `sq` is null */
export interface BenchedKing {
  sq: SquareIndex | null;
  piece: Piece;
  delayMs: number;
}

/** A captured piece watching from the touchline, with the square it was taken on */
export interface BenchedPlayer {
  piece: Piece;
  takenOn: SquareIndex;
}

export interface Reinforcement {
  sq: SquareIndex;
  piece: Piece;
  delayMs: number;
}

/** Ranks counted from a side's own back rank */
const ownRank = (color: Color, n: number) =>
  color === Color.White ? n : 7 - n;

/** Empty squares on the given ranks, nearest the back rank first, then nearest the center file */
function openSquares(board: Board, color: Color, ranks: number[]) {
  const depth = (sq: SquareIndex) => Math.abs(rankOf(sq) - ownRank(color, 0));
  const spread = (sq: SquareIndex) => Math.abs(fileOf(sq) - 3.5);
  return ALL_SQUARES.filter(
    (sq) =>
      !board.get(sq) && ranks.some((n) => rankOf(sq) === ownRank(color, n)),
  ).sort((a, b) => depth(a) - depth(b) || spread(a) - spread(b));
}

/** Puts a piece on the first square where it does not check the enemy king */
function placeSafely(
  board: Board,
  piece: Piece,
  squares: SquareIndex[],
): SquareIndex | null {
  const enemyKing = board.findKing(opponent(piece.color));
  for (const sq of squares) {
    board.put(sq, piece);
    const checks =
      enemyKing !== null && isSquareAttacked(board, enemyKing, piece.color);
    if (!checks) return sq;
    board.remove(sq);
  }
  return null;
}

/** Tops up a side that is short of pieces, placing newcomers on its own back ranks */
export function reinforce(
  board: Board,
  color: Color,
): { sq: SquareIndex; piece: Piece }[] {
  const troops = ALL_SQUARES.filter((sq) => {
    const piece = board.get(sq);
    return piece?.color === color && piece.type !== PieceType.King;
  }).length;
  const arrivals: { sq: SquareIndex; piece: Piece }[] = [];
  for (const type of SQUAD.slice(0, Math.max(0, MIN_TROOPS - troops))) {
    const piece = { type, color };
    const ranks = type === PieceType.Pawn ? [1, 2] : [0, 1, 2, 3];
    const sq = placeSafely(board, piece, openSquares(board, color, ranks));
    if (sq !== null) arrivals.push({ sq, piece });
  }
  return arrivals;
}

/** Brings back a side's king if he sat out, on the nearest safe square to his own back rank */
export function returnKing(board: Board, color: Color): SquareIndex | null {
  if (board.findKing(color) !== null) return null;
  const enemy = opponent(color);
  for (const sq of openSquares(board, color, [0, 1, 2, 3])) {
    if (!isSquareAttacked(board, sq, enemy)) {
      board.put(sq, { type: PieceType.King, color });
      return sq;
    }
  }
  return null;
}

/**
 * Takes both kings off the board for a mode they sit out, each walking off
 * after `delayMs`. A king already off from the mode before stays off.
 */
export function benchKings(board: Board, delayMs: number): BenchedKing[] {
  return [Color.White, Color.Black].map((color) => {
    const sq = board.findKing(color);
    if (sq === null) {
      return { sq: null, piece: { type: PieceType.King, color }, delayMs: 0 };
    }
    const piece = board.get(sq)!;
    board.remove(sq);
    return { sq, piece, delayMs };
  });
}
