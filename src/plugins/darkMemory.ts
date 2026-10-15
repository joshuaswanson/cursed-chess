import { Color } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import { ALL_SQUARES, fileOf, rankOf } from "../utils/squareUtils";

/**
 * Where Chessbot believes your pieces are on a dark board: wherever he last
 * saw them, until the light shows him otherwise
 */
export class DarkMemory {
  private recalled = new Map<SquareIndex, Piece>();

  /** He saw the whole board before the lights went out */
  reset(board: Board): void {
    this.recalled = new Map(
      ALL_SQUARES.flatMap((sq) => {
        const piece = board.get(sq);
        return piece?.color === Color.White
          ? [[sq, { ...piece }] as const]
          : [];
      }),
    );
  }

  /** Your pieces as he remembers them */
  pieces(): ReadonlyMap<SquareIndex, Piece> {
    return this.recalled;
  }

  /** A piece of yours turning up somewhere means it is no longer where he last saw it */
  private forgetNearest(piece: Piece, sq: SquareIndex, lit: Set<SquareIndex>) {
    const stale = [...this.recalled]
      .filter(([at, p]) => !lit.has(at) && at !== sq && p.type === piece.type)
      .sort(
        ([a], [b]) =>
          Math.max(
            Math.abs(fileOf(a) - fileOf(sq)),
            Math.abs(rankOf(a) - rankOf(sq)),
          ) -
          Math.max(
            Math.abs(fileOf(b) - fileOf(sq)),
            Math.abs(rankOf(b) - rankOf(sq)),
          ),
      )[0];
    if (stale) this.recalled.delete(stale[0]);
  }

  /** Updates what he remembers from what is lit, and from what has just happened to his own pieces */
  notice(board: Board, move: Move, lit: Set<SquareIndex>): void {
    // A square he has just moved onto was empty, and one of his pieces taken
    // in the dark tells him something of yours stands there
    if (move.piece.color === Color.Black) this.recalled.delete(move.to);
    else if (move.captured && !this.recalled.has(move.to)) {
      this.forgetNearest(move.piece, move.to, lit);
      this.recalled.set(move.to, { ...move.piece });
    }
    this.look(board, lit);
  }

  /** Brings what he remembers up to date with whatever is lit now */
  look(board: Board, lit: Set<SquareIndex>): void {
    for (const sq of lit) {
      const piece = board.get(sq);
      if (piece?.color !== Color.White) {
        this.recalled.delete(sq);
        continue;
      }
      if (this.recalled.get(sq)?.type !== piece.type) {
        this.forgetNearest(piece, sq, lit);
        this.recalled.set(sq, { ...piece });
      }
    }
  }
}
