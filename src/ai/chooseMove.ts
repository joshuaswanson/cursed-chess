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
import { pickBySkill } from "./skill";

export const PIECE_VALUE: Record<PieceType, number> = {
  [PieceType.Pawn]: 1,
  [PieceType.Knight]: 3,
  [PieceType.Bishop]: 3.2,
  [PieceType.Rook]: 5,
  [PieceType.Queen]: 9,
  [PieceType.King]: 1000,
};

/** A mode's own change to the board once a move is played, like the belts of Conveyor running */
export type Settle = (board: Board) => void;

/** A mode's own reading of check and mate, where the engine's would be wrong */
export type Judge = (game: Game) => GameStatus;

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
/** How much of what a move leaves hanging the least skilled Chessbot still notices */
const MIN_CAUTION = 0.2;
/** From this skill on, he looks one reply further for a mate against him */
const MATE_GUARD_SKILL = 0.7;
/** How many of his best moves he checks for a mate in reply */
const MATE_GUARD_MOVES = 6;
const MATE_GUARD_PENALTY = 500;

export interface MoveSense {
  settle?: Settle;
  judge?: Judge;
  /** How well to play, from 0 to 1, where Story Mode sets it; left out, he plays as he always does */
  skill?: number;
}

/**
 * Greedy one-move search: material won, minus the best capture it leaves the
 * opponent, plus small positional and mode-specific terms.
 */
export function chooseMove(
  game: Game,
  moves: Move[],
  squareBonus: SquareBonus,
  { settle, judge, skill }: MoveSense = {},
): Move {
  const caution =
    skill === undefined ? 1 : MIN_CAUTION + (1 - MIN_CAUTION) * skill;
  const scored = moves.map((move) => ({
    choice: move,
    score:
      scoreMove(game, move, squareBonus, caution, settle, judge) +
      Math.random() * NOISE,
  }));
  if (skill === undefined) return pickBySkill(scored, 1);
  if (skill >= MATE_GUARD_SKILL) guardAgainstMate(game, scored, settle, judge);
  return pickBySkill(scored, skill);
}

/** Marks down the best few moves that would let the opponent mate at once */
function guardAgainstMate(
  game: Game,
  scored: { choice: Move; score: number }[],
  settle?: Settle,
  judge?: Judge,
): void {
  const best = [...scored]
    .filter(({ score }) => score < CHECKMATE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MATE_GUARD_MOVES);
  for (const entry of best) {
    if (allowsMate(game, entry.choice, settle, judge)) {
      entry.score -= MATE_GUARD_PENALTY;
    }
  }
}

function allowsMate(
  game: Game,
  move: Move,
  settle?: Settle,
  judge?: Judge,
): boolean {
  if (move.flags & MoveFlag.Portal) return false;
  const after = copyOf(game);
  if (move.flags & MoveFlag.ModeMove) after.executeTrustedMove(move);
  else if (!after.makeMove(move)) return false;
  if (settle) {
    settle(after.board);
    after.enPassant = null;
  }
  return after.getLegalMoves().some((reply) => {
    const next = copyOf(after);
    if (!next.makeMove(reply)) return false;
    if (settle) {
      settle(next.board);
      next.enPassant = null;
    }
    return (judge ? judge(next) : next.getStatus()) === GameStatus.Checkmate;
  });
}

function copyOf(game: Game): Game {
  const copy = new Game(game.toFen());
  copy.pawnRules = game.pawnRules;
  return copy;
}

function scoreMove(
  game: Game,
  move: Move,
  squareBonus: SquareBonus,
  caution: number,
  settle?: Settle,
  judge?: Judge,
): number {
  const captured = move.captured ? PIECE_VALUE[move.captured.type] : 0;

  // Where a portal move lands is only decided when it is played
  if (move.flags & MoveFlag.Portal) return captured + PORTAL_BONUS;

  const after = copyOf(game);
  // Moves a mode allows beyond the engine's own rules, like a pawn taking a zombie
  if (move.flags & MoveFlag.ModeMove) after.executeTrustedMove(move);
  else if (!after.makeMove(move)) return -Infinity;
  if (settle) {
    settle(after.board);
    after.enPassant = null;
  }

  const status = judge ? judge(after) : after.getStatus();
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

  score -=
    caution *
    bestReplyGain(
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
