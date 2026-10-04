import { Color, PieceType, MoveFlag } from "./types";
import type { Piece, SquareIndex, Move, PawnRule, PawnRules } from "./types";
import type { Board } from "./board";
import { toIndex, rankOf, isValidSquare } from "../utils/squareUtils";

// Direction offsets in 0x88
const NORTH = 16;
const SOUTH = -16;
const EAST = 1;
const WEST = -1;
const NE = 17;
const NW = 15;
const SE = -15;
const SW = -17;

export const ROOK_DIRECTIONS = [NORTH, SOUTH, EAST, WEST];
export const BISHOP_DIRECTIONS = [NE, NW, SE, SW];
export const QUEEN_DIRECTIONS = [...ROOK_DIRECTIONS, ...BISHOP_DIRECTIONS];
const KNIGHT_OFFSETS = [
  NORTH + NE, // +2 rank, +1 file = 33
  NORTH + NW, // +2 rank, -1 file = 31
  SOUTH + SE, // -2 rank, +1 file = -31
  SOUTH + SW, // -2 rank, -1 file = -33
  EAST + NE, // +1 rank, +2 file = 18
  EAST + SE, // -1 rank, +2 file = -14
  WEST + NW, // +1 rank, -2 file = 14
  WEST + SW, // -1 rank, -2 file = -18
];
const KING_OFFSETS = QUEEN_DIRECTIONS;

export function opponent(color: Color): Color {
  return color === Color.White ? Color.Black : Color.White;
}

function makeMove(
  from: SquareIndex,
  to: SquareIndex,
  piece: Piece,
  flags: number,
  captured?: Piece,
  promotion?: PieceType,
): Move {
  return { from, to, piece, flags, captured, promotion };
}

function generatePawnMoves(
  board: Board,
  sq: SquareIndex,
  piece: Piece,
  enPassant: SquareIndex | null,
): Move[] {
  const moves: Move[] = [];
  const color = piece.color;
  const direction = color === Color.White ? NORTH : SOUTH;
  const startRank = color === Color.White ? 1 : 6;
  const promoRank = color === Color.White ? 7 : 0;

  // Single push
  const oneStep = sq + direction;
  if (isValidSquare(oneStep) && !board.get(oneStep)) {
    if (rankOf(oneStep) === promoRank) {
      // Promotion
      for (const promo of [
        PieceType.Queen,
        PieceType.Rook,
        PieceType.Bishop,
        PieceType.Knight,
      ]) {
        moves.push(
          makeMove(sq, oneStep, piece, MoveFlag.Promotion, undefined, promo),
        );
      }
    } else {
      moves.push(makeMove(sq, oneStep, piece, MoveFlag.Normal));
    }

    // Double push from starting rank
    if (rankOf(sq) === startRank) {
      const twoStep = sq + direction * 2;
      if (isValidSquare(twoStep) && !board.get(twoStep)) {
        moves.push(makeMove(sq, twoStep, piece, MoveFlag.DoublePawnPush));
      }
    }
  }

  // Captures
  const captureOffsets = color === Color.White ? [NE, NW] : [SE, SW];
  for (const offset of captureOffsets) {
    const target = sq + offset;
    if (!isValidSquare(target)) continue;

    const targetPiece = board.get(target);

    if (targetPiece && targetPiece.color !== color) {
      if (rankOf(target) === promoRank) {
        for (const promo of [
          PieceType.Queen,
          PieceType.Rook,
          PieceType.Bishop,
          PieceType.Knight,
        ]) {
          moves.push(
            makeMove(
              sq,
              target,
              piece,
              MoveFlag.Capture | MoveFlag.Promotion,
              targetPiece,
              promo,
            ),
          );
        }
      } else {
        moves.push(makeMove(sq, target, piece, MoveFlag.Capture, targetPiece));
      }
    }

    // En passant
    if (target === enPassant) {
      const capturedPawnSq = target - direction;
      const capturedPawn = board.get(capturedPawnSq);
      if (capturedPawn) {
        moves.push(
          makeMove(
            sq,
            target,
            piece,
            MoveFlag.Capture | MoveFlag.EnPassant,
            capturedPawn,
          ),
        );
      }
    }
  }

  return moves;
}

const PROMOTION_TYPES = [
  PieceType.Queen,
  PieceType.Rook,
  PieceType.Bishop,
  PieceType.Knight,
];

/**
 * Pawns on a turned board: one step toward their forward direction and
 * captures on the two directions beside it. They promote on reaching the edge
 * they are heading for; double steps and en passant do not apply.
 */
function generateTurnedPawnMoves(
  board: Board,
  sq: SquareIndex,
  piece: Piece,
  rule: PawnRule,
): Move[] {
  const moves: Move[] = [];
  const add = (to: SquareIndex, flags: number, captured?: Piece) => {
    if (isValidSquare(to + rule.forward)) {
      moves.push(makeMove(sq, to, piece, flags, captured));
      return;
    }
    for (const promo of PROMOTION_TYPES) {
      moves.push(
        makeMove(sq, to, piece, flags | MoveFlag.Promotion, captured, promo),
      );
    }
  };
  const ahead = sq + rule.forward;
  if (isValidSquare(ahead) && !board.get(ahead)) add(ahead, MoveFlag.Normal);
  for (const dir of rule.captures) {
    const target = sq + dir;
    if (!isValidSquare(target)) continue;
    const victim = board.get(target);
    if (victim && victim.color !== piece.color) {
      add(target, MoveFlag.Capture, victim);
    }
  }
  return moves;
}

function generateSlidingMoves(
  board: Board,
  sq: SquareIndex,
  piece: Piece,
  directions: number[],
): Move[] {
  const moves: Move[] = [];
  const color = piece.color;

  for (const dir of directions) {
    let target = sq + dir;
    while (isValidSquare(target)) {
      const targetPiece = board.get(target);
      if (targetPiece) {
        if (targetPiece.color !== color) {
          moves.push(
            makeMove(sq, target, piece, MoveFlag.Capture, targetPiece),
          );
        }
        break; // blocked
      }
      moves.push(makeMove(sq, target, piece, MoveFlag.Normal));
      target += dir;
    }
  }

  return moves;
}

function generateKnightMoves(
  board: Board,
  sq: SquareIndex,
  piece: Piece,
): Move[] {
  const moves: Move[] = [];
  const color = piece.color;

  for (const offset of KNIGHT_OFFSETS) {
    const target = sq + offset;
    if (!isValidSquare(target)) continue;

    const targetPiece = board.get(target);
    if (targetPiece) {
      if (targetPiece.color !== color) {
        moves.push(makeMove(sq, target, piece, MoveFlag.Capture, targetPiece));
      }
    } else {
      moves.push(makeMove(sq, target, piece, MoveFlag.Normal));
    }
  }

  return moves;
}

function generateKingMoves(
  board: Board,
  sq: SquareIndex,
  piece: Piece,
): Move[] {
  const moves: Move[] = [];
  const color = piece.color;

  for (const offset of KING_OFFSETS) {
    const target = sq + offset;
    if (!isValidSquare(target)) continue;

    const targetPiece = board.get(target);
    if (targetPiece) {
      if (targetPiece.color !== color) {
        moves.push(makeMove(sq, target, piece, MoveFlag.Capture, targetPiece));
      }
    } else {
      moves.push(makeMove(sq, target, piece, MoveFlag.Normal));
    }
  }

  return moves;
}

/** Generate all pseudo-legal moves for a given color (ignores check) */
export function generatePseudoLegalMoves(
  board: Board,
  color: Color,
  enPassant: SquareIndex | null,
  pawnRules: PawnRules = null,
): Move[] {
  const moves: Move[] = [];

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const sq = toIndex(file, rank);
      const piece = board.get(sq);
      if (!piece || piece.color !== color) continue;

      switch (piece.type) {
        case PieceType.Pawn:
          moves.push(
            ...(pawnRules
              ? generateTurnedPawnMoves(board, sq, piece, pawnRules[color])
              : generatePawnMoves(board, sq, piece, enPassant)),
          );
          break;
        case PieceType.Knight:
          moves.push(...generateKnightMoves(board, sq, piece));
          break;
        case PieceType.Bishop:
          moves.push(
            ...generateSlidingMoves(board, sq, piece, BISHOP_DIRECTIONS),
          );
          break;
        case PieceType.Rook:
          moves.push(
            ...generateSlidingMoves(board, sq, piece, ROOK_DIRECTIONS),
          );
          break;
        case PieceType.Queen:
          moves.push(
            ...generateSlidingMoves(board, sq, piece, QUEEN_DIRECTIONS),
          );
          break;
        case PieceType.King:
          moves.push(...generateKingMoves(board, sq, piece));
          break;
      }
    }
  }

  return moves;
}

/** Check if a square is attacked by a given color */
export function isSquareAttacked(
  board: Board,
  sq: SquareIndex,
  byColor: Color,
  pawnRules: PawnRules = null,
): boolean {
  // Knight attacks
  for (const offset of KNIGHT_OFFSETS) {
    const target = sq + offset;
    if (!isValidSquare(target)) continue;
    const piece = board.get(target);
    if (piece && piece.color === byColor && piece.type === PieceType.Knight) {
      return true;
    }
  }

  // Sliding attacks (bishop/rook/queen)
  for (const dir of BISHOP_DIRECTIONS) {
    let target = sq + dir;
    while (isValidSquare(target)) {
      const piece = board.get(target);
      if (piece) {
        if (
          piece.color === byColor &&
          (piece.type === PieceType.Bishop || piece.type === PieceType.Queen)
        ) {
          return true;
        }
        break;
      }
      target += dir;
    }
  }

  for (const dir of ROOK_DIRECTIONS) {
    let target = sq + dir;
    while (isValidSquare(target)) {
      const piece = board.get(target);
      if (piece) {
        if (
          piece.color === byColor &&
          (piece.type === PieceType.Rook || piece.type === PieceType.Queen)
        ) {
          return true;
        }
        break;
      }
      target += dir;
    }
  }

  // Pawn attacks: an attacking pawn sits one capture step behind the square
  const pawnDir = byColor === Color.White ? SOUTH : NORTH;
  const pawnAttacks = pawnRules
    ? pawnRules[byColor].captures.map((dir) => sq - dir)
    : [sq + pawnDir + EAST, sq + pawnDir + WEST];
  for (const target of pawnAttacks) {
    if (!isValidSquare(target)) continue;
    const piece = board.get(target);
    if (piece && piece.color === byColor && piece.type === PieceType.Pawn) {
      return true;
    }
  }

  // King attacks
  for (const offset of KING_OFFSETS) {
    const target = sq + offset;
    if (!isValidSquare(target)) continue;
    const piece = board.get(target);
    if (piece && piece.color === byColor && piece.type === PieceType.King) {
      return true;
    }
  }

  return false;
}
