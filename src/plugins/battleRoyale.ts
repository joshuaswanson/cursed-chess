import { Color, PieceType } from "../engine/types";
import type { SquareIndex } from "../engine/types";
import type {
  ModePlugin,
  PluginContext,
  BoardOverlay,
  SquareModifier,
} from "./types";
import { fileOf, rankOf, isValidSquare } from "../utils/squareUtils";

export class BattleRoyalePlugin implements ModePlugin {
  id = "battle-royale";
  name = "Battle Royale";
  description =
    "The board shrinks over time. Pieces on removed squares are eliminated.";

  private deadSquares = new Set<number>();
  private shrinkRing = 0;
  private turnCount = 0;
  private shrinkInterval = 3;

  onGameStart(_ctx: PluginContext): void {
    this.deadSquares.clear();
    this.shrinkRing = 0;
    this.turnCount = 0;
  }

  onTurnEnd(ctx: PluginContext, color: Color): void {
    if (color === Color.Black) {
      this.turnCount++;
      if (this.turnCount % this.shrinkInterval === 0 && this.shrinkRing < 1) {
        this.shrinkRing++;
        this.applyRing(ctx);
      }
    }
  }

  modifyLegalMoves(
    _ctx: PluginContext,
    moves: import("../engine/types").Move[],
    _color: Color,
  ): import("../engine/types").Move[] {
    return moves.filter((m) => !this.deadSquares.has(m.to));
  }

  getSquareModifiers(
    _ctx: PluginContext,
    square: SquareIndex,
  ): SquareModifier[] {
    if (this.deadSquares.has(square)) {
      return [{ className: "dead-square" }];
    }
    if (this.shrinkRing < 2 && this.isInRing(square, this.shrinkRing + 1)) {
      return [{ className: "danger-square" }];
    }
    return [];
  }

  getBoardOverlays(_ctx: PluginContext): BoardOverlay[] {
    // Progress toward next shrink (0 = just shrunk, 1 = about to shrink)
    const progress =
      this.shrinkRing < 1
        ? (this.turnCount % this.shrinkInterval) / this.shrinkInterval
        : 0;
    return [
      {
        type: "battle-royale",
        squares: [],
        data: { shrinkRing: this.shrinkRing, dangerProgress: progress },
      },
    ];
  }

  private isInRing(sq: number, ring: number): boolean {
    if (!isValidSquare(sq)) return false;
    const file = fileOf(sq as SquareIndex);
    const rank = rankOf(sq as SquareIndex);
    return file < ring || file >= 8 - ring || rank < ring || rank >= 8 - ring;
  }

  private applyRing(ctx: PluginContext): void {
    // Collect squares about to be removed
    const squaresToRemove: SquareIndex[] = [];
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const sq = ((rank << 4) | file) as SquareIndex;
        if (this.isInRing(sq, this.shrinkRing) && !this.deadSquares.has(sq)) {
          squaresToRemove.push(sq);
        }
      }
    }

    // Auto-save kings: jump to nearest safe square, or swap with own piece
    for (const sq of squaresToRemove) {
      const piece = ctx.board.get(sq);
      if (piece && piece.type === PieceType.King) {
        const safeSq = this.findNearestSafe(ctx, sq);
        if (safeSq !== null) {
          const occupant = ctx.board.get(safeSq);
          if (occupant) {
            // Swap: king takes the safe square, occupant sacrifices itself
            ctx.board.remove(sq);
            ctx.board.remove(safeSq);
            ctx.board.put(safeSq, piece);
          } else {
            ctx.board.remove(sq);
            ctx.board.put(safeSq, piece);
          }
        }
      }
    }

    // Remove the ring squares
    for (const sq of squaresToRemove) {
      this.deadSquares.add(sq);
      const piece = ctx.board.get(sq);
      if (piece) {
        ctx.board.remove(sq);
      }
    }
  }

  private findNearestSafe(
    ctx: PluginContext,
    from: SquareIndex,
  ): SquareIndex | null {
    const fromFile = fileOf(from);
    const fromRank = rankOf(from);

    // First try: find nearest empty safe square
    let bestEmpty: SquareIndex | null = null;
    let bestEmptyDist = Infinity;
    // Also track nearest friendly piece to swap with
    let bestSwap: SquareIndex | null = null;
    let bestSwapDist = Infinity;
    const kingColor = ctx.board.get(from)?.color;

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const sq = ((rank << 4) | file) as SquareIndex;
        if (sq === from) continue;
        if (this.deadSquares.has(sq)) continue;
        if (this.isInRing(sq, this.shrinkRing)) continue;

        const dist = Math.abs(file - fromFile) + Math.abs(rank - fromRank);
        const occupant = ctx.board.get(sq);

        if (!occupant && dist < bestEmptyDist) {
          bestEmptyDist = dist;
          bestEmpty = sq;
        } else if (
          occupant &&
          occupant.color === kingColor &&
          occupant.type !== PieceType.King &&
          dist < bestSwapDist
        ) {
          bestSwapDist = dist;
          bestSwap = sq;
        }
      }
    }

    return bestEmpty ?? bestSwap;
  }
}
