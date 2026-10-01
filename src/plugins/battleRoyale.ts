import { Color, PieceType } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type {
  ModePlugin,
  PluginContext,
  BoardOverlay,
  SquareModifier,
} from "./types";
import { fileOf, rankOf, ALL_SQUARES } from "../utils/squareUtils";

/** Rings removed before the board stops shrinking (1 ring leaves 6x6) */
export const MAX_SHRINK_RING = 1;
const SHRINK_EVERY_ROUNDS = 3;

/** What fell away the last time a ring collapsed, for the board to animate */
export interface RingCollapse {
  /** Increments with every collapse so the board can tell them apart */
  id: number;
  squares: SquareIndex[];
  fallen: { sq: SquareIndex; piece: Piece }[];
  kingLeaps: { from: SquareIndex; to: SquareIndex }[];
}

export interface BattleRoyaleOverlay {
  shrinkRing: number;
  /** 0 just after a collapse, approaching 1 as the next one nears */
  dangerProgress: number;
  /** Squares of the ring that will collapse next */
  doomed: SquareIndex[];
  lastCollapse: RingCollapse | null;
}

function isInRing(sq: SquareIndex, ring: number): boolean {
  const file = fileOf(sq);
  const rank = rankOf(sq);
  return file < ring || file >= 8 - ring || rank < ring || rank >= 8 - ring;
}

export class BattleRoyalePlugin implements ModePlugin {
  id = "battle-royale";
  name = "Battle Royale";
  description =
    "The board shrinks over time. Pieces on removed squares are eliminated.";

  private deadSquares = new Set<SquareIndex>();
  private shrinkRing = 0;
  private roundCount = 0;
  private lastCollapse: RingCollapse | null = null;

  get fullyShrunk(): boolean {
    return this.shrinkRing >= MAX_SHRINK_RING;
  }

  onGameStart(): void {
    this.deadSquares.clear();
    this.shrinkRing = 0;
    this.roundCount = 0;
    this.lastCollapse = null;
  }

  onTurnEnd(ctx: PluginContext, color: Color): void {
    if (color !== Color.Black) return;
    this.roundCount++;
    if (
      this.roundCount % SHRINK_EVERY_ROUNDS === 0 &&
      this.shrinkRing < MAX_SHRINK_RING
    ) {
      this.shrinkRing++;
      this.applyRing(ctx);
    }
  }

  modifyLegalMoves(_ctx: PluginContext, moves: Move[]): Move[] {
    return moves.filter((m) => !this.deadSquares.has(m.to));
  }

  getSquareModifiers(
    _ctx: PluginContext,
    square: SquareIndex,
  ): SquareModifier[] {
    if (this.deadSquares.has(square)) {
      return [{ className: "dead-square" }];
    }
    if (this.doomedSquares().includes(square)) {
      return [{ className: "danger-square" }];
    }
    return [];
  }

  getBoardOverlays(): BoardOverlay[] {
    const data: BattleRoyaleOverlay = {
      shrinkRing: this.shrinkRing,
      dangerProgress: this.fullyShrunk
        ? 0
        : (this.roundCount % SHRINK_EVERY_ROUNDS) / SHRINK_EVERY_ROUNDS,
      doomed: this.doomedSquares(),
      lastCollapse: this.lastCollapse,
    };
    return [{ type: "battle-royale", squares: [], data }];
  }

  private doomedSquares(): SquareIndex[] {
    if (this.fullyShrunk) return [];
    return ALL_SQUARES.filter(
      (sq) => isInRing(sq, this.shrinkRing + 1) && !this.deadSquares.has(sq),
    );
  }

  private applyRing(ctx: PluginContext): void {
    const squaresToRemove = ALL_SQUARES.filter(
      (sq) => isInRing(sq, this.shrinkRing) && !this.deadSquares.has(sq),
    );
    const kingLeaps: RingCollapse["kingLeaps"] = [];
    const fallen: RingCollapse["fallen"] = [];

    // Kings leap to the nearest safe square, sacrificing a friendly piece if needed
    for (const sq of squaresToRemove) {
      const piece = ctx.board.get(sq);
      if (piece?.type !== PieceType.King) continue;
      const safeSq = this.findNearestSafe(ctx, sq);
      if (safeSq === null) continue;
      ctx.board.remove(sq);
      ctx.board.remove(safeSq);
      ctx.board.put(safeSq, piece);
      kingLeaps.push({ from: sq, to: safeSq });
    }

    for (const sq of squaresToRemove) {
      this.deadSquares.add(sq);
      const piece = ctx.board.remove(sq);
      if (piece) fallen.push({ sq, piece });
    }

    this.lastCollapse = {
      id: (this.lastCollapse?.id ?? 0) + 1,
      squares: squaresToRemove,
      fallen,
      kingLeaps,
    };
  }

  private findNearestSafe(
    ctx: PluginContext,
    from: SquareIndex,
  ): SquareIndex | null {
    const kingColor = ctx.board.get(from)?.color;
    const distance = (sq: SquareIndex) =>
      Math.abs(fileOf(sq) - fileOf(from)) + Math.abs(rankOf(sq) - rankOf(from));

    let bestEmpty: SquareIndex | null = null;
    let bestSwap: SquareIndex | null = null;
    for (const sq of ALL_SQUARES) {
      if (sq === from || isInRing(sq, this.shrinkRing)) continue;
      const occupant = ctx.board.get(sq);
      if (!occupant) {
        if (bestEmpty === null || distance(sq) < distance(bestEmpty))
          bestEmpty = sq;
      } else if (
        occupant.color === kingColor &&
        occupant.type !== PieceType.King &&
        (bestSwap === null || distance(sq) < distance(bestSwap))
      ) {
        bestSwap = sq;
      }
    }
    return bestEmpty ?? bestSwap;
  }
}
