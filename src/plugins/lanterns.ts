import { Color, MoveFlag, PieceType } from "../engine/types";
import type { Move, SquareIndex } from "../engine/types";
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

/** How many lanterns each side's men start with, besides the one its king carries */
const LANTERNS_EACH = 2;
/** The files their first carriers are picked from, in order of preference: b and g first */
const CARRIER_FILES = [1, 6, 2, 5, 0, 7, 3, 4];

/**
 * The board is dark. Each side's king and two of its pawns carry a lantern,
 * and only the squares round a lantern can be seen. Whoever takes a piece
 * carrying one carries it from then on, so there are always six alight.
 */
export class LanternsPlugin implements ModePlugin {
  id = "lanterns";
  name = "Lanterns";
  description =
    "The board is dark. Each lantern lights the squares round its carrier. Take a piece carrying one to carry it yourself.";

  private lanterns: Lantern[] = [];

  onGameStart(ctx: PluginContext): void {
    this.lanterns = [Color.White, Color.Black]
      .flatMap((color) => this.firstCarriers(ctx.board, color))
      .map((sq, id) => ({ id, sq }));
  }

  /** The pieces that start with a lantern: the king, and two pawns where there are any, or two other pieces where there are not */
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
    const king = board.findKing(color);
    return [
      ...[...pawns, ...others].slice(0, LANTERNS_EACH),
      ...(king === null ? [] : [king]),
    ];
  }

  onAfterMove(_ctx: PluginContext, move: Move): void {
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
