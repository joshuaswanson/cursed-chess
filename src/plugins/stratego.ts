import { Color, PieceType, GameStatus } from "../engine";
import type { SquareIndex, Move } from "../engine";
import type {
  ModePlugin,
  PluginContext,
  BoardOverlay,
  SquareModifier,
} from "./types";
import { toIndex, fileOf, rankOf, ALL_SQUARES } from "../utils/squareUtils";

// Lakes at c4, c5, f4, f5 — creates three 2-file bridges
const LAKE_SQUARES = new Set<SquareIndex>([
  toIndex(2, 3) as SquareIndex,
  toIndex(2, 4) as SquareIndex,
  toIndex(5, 3) as SquareIndex,
  toIndex(5, 4) as SquareIndex,
]);

export class StrategoPlugin implements ModePlugin {
  id = "stratego";
  name = "Stratego";
  description = "Hidden enemy pieces, lakes block the center";

  /** Squares whose pieces have given themselves away by taking something, for as long as they live */
  private revealed = new Set<SquareIndex>();

  onGameStart(ctx: PluginContext): void {
    this.revealed.clear();
    // Pieces carried over from the last mode can't start out in the river
    for (const lake of LAKE_SQUARES) {
      const piece = ctx.board.get(lake);
      if (!piece) continue;
      const dry = ALL_SQUARES.filter(
        (sq) => !LAKE_SQUARES.has(sq) && !ctx.board.get(sq),
      ).sort(
        (a, b) =>
          Math.abs(fileOf(a) - fileOf(lake)) +
          Math.abs(rankOf(a) - rankOf(lake)) -
          (Math.abs(fileOf(b) - fileOf(lake)) +
            Math.abs(rankOf(b) - rankOf(lake))),
      )[0];
      ctx.board.remove(lake);
      if (dry !== undefined) ctx.board.put(dry, piece);
    }
  }

  modifyLegalMoves(_ctx: PluginContext, moves: Move[], _color: Color): Move[] {
    return moves.filter((move) => {
      // No moving to lakes
      if (LAKE_SQUARES.has(move.to)) return false;

      // Sliding pieces can't pass through lakes
      const pt = move.piece.type;
      if (
        pt === PieceType.Bishop ||
        pt === PieceType.Rook ||
        pt === PieceType.Queen
      ) {
        const ff = fileOf(move.from);
        const rf = rankOf(move.from);
        const ft = fileOf(move.to);
        const rt = rankOf(move.to);
        const df = Math.sign(ft - ff);
        const dr = Math.sign(rt - rf);
        let cf = ff + df;
        let cr = rf + dr;
        while (cf !== ft || cr !== rt) {
          if (LAKE_SQUARES.has(toIndex(cf, cr) as SquareIndex)) return false;
          cf += df;
          cr += dr;
        }
      }

      return true;
    });
  }

  onAfterMove(_ctx: PluginContext, move: Move): void {
    // Whatever stood on the square taken is gone, known or not
    if (move.captured) this.revealed.delete(move.to);
    // A piece that is known stays known wherever it goes
    if (this.revealed.has(move.from)) {
      this.revealed.delete(move.from);
      this.revealed.add(move.to);
    }
    // Taking a piece gives the taker away
    if (move.captured) this.revealed.add(move.to);
  }

  modifyGameStatus(_ctx: PluginContext, status: GameStatus): GameStatus {
    // Suppress check display (you can't see what's attacking you)
    if (status === GameStatus.Check) return GameStatus.Active;
    return status;
  }

  /** The squares whose pieces this side cannot make out: the other side's, until they give themselves away */
  hiddenFrom(ctx: PluginContext, viewer: Color): SquareIndex[] {
    return ALL_SQUARES.filter((sq) => {
      const piece = ctx.board.get(sq);
      return piece && piece.color !== viewer && !this.revealed.has(sq);
    });
  }

  getBoardOverlays(ctx: PluginContext): BoardOverlay[] {
    return [
      { type: "stratego-hidden", squares: this.hiddenFrom(ctx, Color.White) },
      { type: "stratego-lake", squares: [...LAKE_SQUARES] },
    ];
  }

  getSquareModifiers(
    _ctx: PluginContext,
    square: SquareIndex,
  ): SquareModifier[] {
    if (LAKE_SQUARES.has(square)) {
      return [{ className: "stratego-lake" }];
    }
    return [];
  }
}
