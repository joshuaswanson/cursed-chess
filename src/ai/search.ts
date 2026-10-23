import {
  Color,
  MoveFlag,
  PieceType,
  generatePseudoLegalMoves,
  isSquareAttacked,
  opponent,
} from "../engine";
import type { Board, Move, PawnRules, Piece, SquareIndex } from "../engine";
import { lastRank, toIndex } from "../utils/squareUtils";

/** Larger than any material that can change hands, so a mate always outweighs it */
export const MATE = 1000;
/** How far captures are followed past the last full move, so no exchange is cut off halfway */
const CAPTURE_DEPTH = 4;
/** Positions looked at before he settles for the last depth he finished, which keeps a move to a blink */
const NODE_BUDGET = 60_000;

class OutOfTime extends Error {}

/** What a move changes on the board, to take it back again */
interface Played {
  move: Move;
  taken: Piece | null;
  takenOn: SquareIndex;
  rook?: [SquareIndex, SquareIndex];
}

/**
 * Looks `depth` moves ahead from each of `moves`, then follows the captures
 * until the board is quiet, and gives each move the material it wins or
 * loses for the side moving, a mate counting as {@link MATE}. The search
 * plays plain chess past the first move: what a mode changes about the
 * rules is only seen in the moves it was given. A deeper search that runs
 * over budget gives way to the deepest one that finished.
 */
export function lookAhead(
  board: Board,
  moves: Move[],
  values: Record<PieceType, number>,
  pawnRules: PawnRules,
  depth: number,
): Map<Move, number> {
  const search = new Search(board.clone(), values, pawnRules);
  let found = new Map<Move, number>();
  for (let d = 1; d <= depth; d += 2) {
    try {
      found = search.root(moves, d);
    } catch (error) {
      if (error instanceof OutOfTime) break;
      throw error;
    }
  }
  return found;
}

class Search {
  private nodes = 0;
  private board: Board;
  private values: Record<PieceType, number>;
  private pawnRules: PawnRules;

  constructor(
    board: Board,
    values: Record<PieceType, number>,
    pawnRules: PawnRules,
  ) {
    this.board = board;
    this.values = values;
    this.pawnRules = pawnRules;
  }

  root(moves: Move[], depth: number): Map<Move, number> {
    const scores = new Map<Move, number>();
    const color = moves[0]?.piece.color;
    if (color === undefined) return scores;
    // Each first move is searched in full, so every one gets its true score
    // and not just a bound, as he weighs them all against each other
    for (const move of moves) {
      const gain = this.gain(move);
      const played = this.play(move);
      const reply = this.best(
        opponent(color),
        depth - 1,
        -Infinity,
        Infinity,
        1,
      );
      this.unplay(played);
      scores.set(move, gain - reply);
    }
    return scores;
  }

  /** The best the side to move can do from here, in material it wins */
  private best(
    color: Color,
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
  ): number {
    if (++this.nodes > NODE_BUDGET) throw new OutOfTime();
    const moves = this.legal(color);
    if (moves.length === 0) {
      const king = this.board.findKing(color);
      const mated =
        king !== null &&
        isSquareAttacked(this.board, king, opponent(color), this.pawnRules);
      // A sooner mate is a better one for whoever gives it
      return mated ? -MATE + ply : 0;
    }
    if (depth <= 0) return this.quiet(color, alpha, beta, CAPTURE_DEPTH);
    let best = -Infinity;
    for (const move of this.ordered(moves)) {
      const gain = this.gain(move);
      const played = this.play(move);
      const score =
        gain -
        this.best(
          opponent(color),
          depth - 1,
          gain - beta,
          gain - alpha,
          ply + 1,
        );
      this.unplay(played);
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return best;
  }

  /** Captures only, until neither side has one worth making */
  private quiet(
    color: Color,
    alpha: number,
    beta: number,
    left: number,
  ): number {
    if (++this.nodes > NODE_BUDGET) throw new OutOfTime();
    // Standing still is always allowed here, so doing nothing is worth nothing
    let best = 0;
    if (best >= beta || left === 0) return best;
    alpha = Math.max(alpha, best);
    const captures = this.legal(color).filter((m) => m.captured || m.promotion);
    for (const move of this.ordered(captures)) {
      const gain = this.gain(move);
      const played = this.play(move);
      const score =
        gain - this.quiet(opponent(color), gain - beta, gain - alpha, left - 1);
      this.unplay(played);
      best = Math.max(best, score);
      alpha = Math.max(alpha, score);
      if (alpha >= beta) break;
    }
    return best;
  }

  private gain(move: Move): number {
    let gain = move.captured ? this.values[move.captured.type] : 0;
    if (move.promotion) gain += this.values[move.promotion] - 1;
    return Math.min(gain, MATE / 2);
  }

  /** Biggest captures first, made by the smallest pieces, so the search cuts off sooner */
  private ordered(moves: Move[]): Move[] {
    const rank = (m: Move) =>
      m.captured
        ? this.values[m.captured.type] * 10 - this.values[m.piece.type]
        : m.promotion
          ? 1
          : 0;
    return [...moves].sort((a, b) => rank(b) - rank(a));
  }

  private legal(color: Color): Move[] {
    return generatePseudoLegalMoves(
      this.board,
      color,
      null,
      this.pawnRules,
    ).filter((move) => {
      const played = this.play(move);
      const king = this.board.findKing(color);
      const safe =
        king === null ||
        !isSquareAttacked(this.board, king, opponent(color), this.pawnRules);
      this.unplay(played);
      return safe;
    });
  }

  private play(move: Move): Played {
    const { board } = this;
    const color = move.piece.color;
    const takenOn =
      move.flags & MoveFlag.EnPassant
        ? move.to + (color === Color.White ? -16 : 16)
        : move.to;
    const taken = board.remove(takenOn);
    board.remove(move.from);
    board.put(
      move.to,
      move.promotion ? { type: move.promotion, color } : move.piece,
    );
    const rank = color === Color.White ? 0 : lastRank();
    let rook: Played["rook"];
    if (move.flags & MoveFlag.KingsideCastle)
      rook = [toIndex(7, rank), toIndex(5, rank)];
    if (move.flags & MoveFlag.QueensideCastle)
      rook = [toIndex(0, rank), toIndex(3, rank)];
    if (rook) board.put(rook[1], board.remove(rook[0])!);
    return { move, taken, takenOn, rook };
  }

  private unplay({ move, taken, takenOn, rook }: Played): void {
    const { board } = this;
    if (rook) board.put(rook[0], board.remove(rook[1])!);
    board.remove(move.to);
    board.put(move.from, move.piece);
    if (taken) board.put(takenOn, taken);
  }
}
