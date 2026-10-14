import { Color, MoveFlag, PieceType } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import type { BoardOverlay, ModePlugin, PluginContext } from "./types";
import { ALL_SQUARES, fileOf, rankOf, toIndex } from "../utils/squareUtils";

/** One of the lanterns on the board, and the square of whoever carries it */
export interface Lantern {
  id: number;
  sq: SquareIndex;
}

export interface LanternView {
  lanterns: Lantern[];
}

/** How many lanterns each side starts with */
const LANTERNS_EACH = 2;
/** The files their first carriers are picked from, in order of preference: b and g first */
const CARRIER_FILES = [1, 6, 2, 5, 0, 7, 3, 4];

/**
 * The board is dark. Two pawns on each side carry a lantern, and only the
 * three by three squares round a lantern can be seen. Whoever takes a piece
 * carrying one carries it from then on, so there are always four alight.
 */
export class LanternsPlugin implements ModePlugin {
  id = "lanterns";
  name = "Lanterns";
  description =
    "The board is dark. Each lantern lights the squares round its carrier. Take a piece carrying one to carry it yourself.";

  private lanterns: Lantern[] = [];
  /**
   * Where Chessbot believes your pieces are: wherever he last saw them,
   * until the light shows him otherwise
   */
  private recalled = new Map<SquareIndex, Piece>();

  onGameStart(ctx: PluginContext): void {
    this.lanterns = [Color.White, Color.Black]
      .flatMap((color) => this.firstCarriers(ctx.board, color))
      .map((sq, id) => ({ id, sq }));
    // He saw the whole board before the lights went out
    this.recalled = new Map(
      ALL_SQUARES.flatMap((sq) => {
        const piece = ctx.board.get(sq);
        return piece?.color === Color.White
          ? [[sq, { ...piece }] as const]
          : [];
      }),
    );
  }

  /** Your pieces as Chessbot remembers them */
  memory(): ReadonlyMap<SquareIndex, Piece> {
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

  /** Updates what he remembers from what the lanterns show, and from what has just happened to his own pieces */
  private notice(board: Board, move: Move): void {
    const lit = this.litSquares();
    // A square he has just moved onto was empty, and one of his pieces taken
    // in the dark tells him something of yours stands there
    if (move.piece.color === Color.Black) this.recalled.delete(move.to);
    else if (move.captured && !this.recalled.has(move.to)) {
      this.forgetNearest(move.piece, move.to, lit);
      this.recalled.set(move.to, { ...move.piece });
    }
    this.look(board);
  }

  /** Brings what he remembers up to date with whatever the lanterns light now */
  look(board: Board): void {
    const lit = this.litSquares();
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

  /** The pieces that start with a lantern: pawns where there are any, anyone but the king where there are not */
  private firstCarriers(board: Board, color: Color): SquareIndex[] {
    const byFile = (a: SquareIndex, b: SquareIndex) =>
      CARRIER_FILES.indexOf(fileOf(a)) - CARRIER_FILES.indexOf(fileOf(b));
    const mine = ALL_SQUARES.filter((sq) => board.get(sq)?.color === color);
    const pawns = mine
      .filter((sq) => board.get(sq)?.type === PieceType.Pawn)
      .sort(byFile);
    const others = mine
      .filter((sq) => {
        const type = board.get(sq)?.type;
        return type !== PieceType.Pawn && type !== PieceType.King;
      })
      .sort(byFile);
    return [...pawns, ...others].slice(0, LANTERNS_EACH);
  }

  onAfterMove(ctx: PluginContext, move: Move): void {
    // A pawn taken in passing stood beside the square the taker lands on
    const taken =
      move.flags & MoveFlag.EnPassant
        ? toIndex(fileOf(move.to), rankOf(move.from))
        : move.to;
    const rank = rankOf(move.from);
    // A rook that castles carries its lantern over the king with it
    const rookHop =
      move.flags & MoveFlag.KingsideCastle
        ? { from: toIndex(7, rank), to: toIndex(5, rank) }
        : move.flags & MoveFlag.QueensideCastle
          ? { from: toIndex(0, rank), to: toIndex(3, rank) }
          : null;
    for (const lantern of this.lanterns) {
      if (move.captured && lantern.sq === taken) lantern.sq = move.to;
      else if (lantern.sq === move.from) lantern.sq = move.to;
      else if (rookHop && lantern.sq === rookHop.from) lantern.sq = rookHop.to;
    }
    this.notice(ctx.board, move);
  }

  /** The squares the lanterns light: each carrier's and the eight round it */
  litSquares(): Set<SquareIndex> {
    const lit = new Set<SquareIndex>();
    for (const { sq } of this.lanterns) {
      for (let df = -1; df <= 1; df++) {
        for (let dr = -1; dr <= 1; dr++) {
          const file = fileOf(sq) + df;
          const rank = rankOf(sq) + dr;
          if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
            lit.add(toIndex(file, rank));
          }
        }
      }
    }
    return lit;
  }

  getBoardOverlays(): BoardOverlay[] {
    const view: LanternView = {
      lanterns: this.lanterns.map((lantern) => ({ ...lantern })),
    };
    return [
      {
        type: "lanterns",
        squares: this.lanterns.map((lantern) => lantern.sq),
        data: view,
      },
    ];
  }
}
