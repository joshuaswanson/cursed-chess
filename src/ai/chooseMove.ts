import {
  Game,
  GameStatus,
  MoveFlag,
  PieceType,
  generatePseudoLegalMoves,
  isSquareAttacked,
  opponent,
} from "../engine";
import type {
  Board,
  Color,
  Move,
  PawnRules,
  Piece,
  SquareIndex,
} from "../engine";
import { fileOf, rankOf } from "../utils/squareUtils";

export const PIECE_VALUE: Record<PieceType, number> = {
  [PieceType.Pawn]: 1,
  [PieceType.Knight]: 3,
  [PieceType.Bishop]: 3.2,
  [PieceType.Rook]: 5,
  [PieceType.Queen]: 9,
  [PieceType.King]: 1000,
};

/** Extra score (or penalty, if negative) the current mode gives a piece for moving from one square to another */
export type SquareBonus = (
  square: SquareIndex,
  piece: Piece,
  from: SquareIndex,
) => number;

const CHECKMATE_SCORE = 10_000;
const CHECK_BONUS = 0.4;
const DRAW_PENALTY = 2;
const PORTAL_BONUS = 0.6;
const CENTER_BONUS = 0.15;
/** Keeps equally scored moves from always resolving the same way */
const NOISE = 0.35;

/**
 * Greedy one-move search: material won, minus the best capture it leaves the
 * opponent, plus small positional and mode-specific terms.
 */
export function chooseMove(
  game: Game,
  moves: Move[],
  squareBonus: SquareBonus,
): Move {
  let best = moves[0];
  let bestScore = -Infinity;
  for (const move of moves) {
    const score = scoreMove(game, move, squareBonus) + Math.random() * NOISE;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}

function scoreMove(game: Game, move: Move, squareBonus: SquareBonus): number {
  const captured = move.captured ? PIECE_VALUE[move.captured.type] : 0;

  // Where a portal move lands is only decided when it is played
  if (move.flags & MoveFlag.Portal) return captured + PORTAL_BONUS;

  const after = new Game(game.toFen());
  after.pawnRules = game.pawnRules;
  // Moves a mode allows beyond the engine's own rules, like a pawn taking a zombie
  if (move.flags & MoveFlag.ModeMove) after.executeTrustedMove(move);
  else if (!after.makeMove(move)) return -Infinity;

  const status = after.getStatus();
  if (status === GameStatus.Checkmate) return CHECKMATE_SCORE;

  const landed: Piece = move.promotion
    ? { type: move.promotion, color: move.piece.color }
    : move.piece;
  let score = captured;
  if (move.promotion) score += PIECE_VALUE[move.promotion] - 1;
  if (status === GameStatus.Check) score += CHECK_BONUS;
  if (status !== GameStatus.Active && status !== GameStatus.Check) {
    score -= DRAW_PENALTY;
  }

  score -= bestReplyGain(
    after.board,
    move.piece.color,
    after.enPassant,
    after.pawnRules,
  );
  score +=
    centerBonus(move.to, landed) + squareBonus(move.to, landed, move.from);
  return score;
}

/** Material the opponent can win with its best single capture */
function bestReplyGain(
  board: Board,
  me: Color,
  enPassant: SquareIndex | null,
  pawnRules: PawnRules,
): number {
  let best = 0;
  for (const reply of generatePseudoLegalMoves(
    board,
    opponent(me),
    enPassant,
    pawnRules,
  )) {
    if (!reply.captured) continue;
    const victim = PIECE_VALUE[reply.captured.type];
    const recapture = isSquareAttacked(board, reply.to, me, pawnRules)
      ? PIECE_VALUE[reply.piece.type]
      : 0;
    best = Math.max(best, victim - recapture);
  }
  return best;
}

function centerBonus(square: SquareIndex, piece: Piece): number {
  if (piece.type === PieceType.King) return 0;
  const distance =
    Math.abs(fileOf(square) - 3.5) + Math.abs(rankOf(square) - 3.5);
  return CENTER_BONUS * (1 - distance / 7);
}
