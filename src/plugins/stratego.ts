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

  /** Squares with revealed Black pieces (persist until captured or game ends) */
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
    // Track revealed pieces when Black moves a revealed piece
    if (move.piece.color === Color.Black && this.revealed.has(move.from)) {
      this.revealed.delete(move.from);
      this.revealed.add(move.to);
    }

    // Reveal enemy pieces when they capture (their identity becomes known)
    if (move.captured && move.piece.color === Color.Black) {
      this.revealed.add(move.to);
    }

    // Reveal enemy pieces when captured (briefly visible before removal)
    if (move.captured && move.captured.color === Color.Black) {
      this.revealed.delete(move.to);
    }
  }

  modifyGameStatus(_ctx: PluginContext, status: GameStatus): GameStatus {
    // Suppress check display (you can't see what's attacking you)
    if (status === GameStatus.Check) return GameStatus.Active;
    return status;
  }

  getBoardOverlays(ctx: PluginContext): BoardOverlay[] {
    const hiddenSquares: SquareIndex[] = [];
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const sq = toIndex(file, rank) as SquareIndex;
        const piece = ctx.board.get(sq);
        if (piece && piece.color === Color.Black && !this.revealed.has(sq)) {
          hiddenSquares.push(sq);
        }
      }
    }

    return [
      { type: "stratego-hidden", squares: hiddenSquares },
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
