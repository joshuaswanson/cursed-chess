import { Color, PieceType } from "../engine/types";
import type { Move, SquareIndex } from "../engine/types";
import type {
  ModePlugin,
  PluginContext,
  BoardOverlay,
  SquareModifier,
} from "./types";
import { isValidSquare, rankOf } from "../utils/squareUtils";
import { fortune, pickWeighted } from "../ai/luck";

const MINE_COUNT = 10;
const ADJACENT_DIRS = [16, -16, 1, -1, 17, 15, -15, -17];

export class MinefieldPlugin implements ModePlugin {
  id = "minefield";
  name = "Minefield";
  description =
    "Hidden mines are scattered across the board. Step on one and your piece is destroyed.";

  private mines = new Set<number>();
  private revealed = new Set<number>();
  private exploded = new Set<number>();
  /** Squares where a piece just landed on a mine — awaiting explosion animation */
  pendingExplosions = new Set<number>();
  private count: number;
  private within?: (sq: SquareIndex) => boolean;

  /** `count` mines, buried only where `within` allows, if it is given */
  constructor(count = MINE_COUNT, within?: (sq: SquareIndex) => boolean) {
    this.count = count;
    this.within = within;
  }

  onGameStart(ctx: PluginContext): void {
    this.mines.clear();
    this.revealed.clear();
    this.exploded.clear();
    this.pendingExplosions.clear();

    // Collect empty squares not on the back ranks (avoid starting positions)
    const candidates: SquareIndex[] = [];
    for (let rank = 1; rank < 7; rank++) {
      for (let file = 0; file < 8; file++) {
        const sq = ((rank << 4) | file) as SquareIndex;
        if (!ctx.board.get(sq) && (this.within?.(sq) ?? true)) {
          candidates.push(sq);
        }
      }
    }

    // A mine is worse luck for the side whose half it lies in
    const owner = (sq: SquareIndex) =>
      rankOf(sq) < 4 ? Color.White : Color.Black;
    const count = Math.min(this.count, candidates.length);
    for (let i = 0; i < count; i++) {
      const mine = pickWeighted(candidates, (sq) => 1 / fortune(owner(sq)))!;
      this.mines.add(mine);
      candidates.splice(candidates.indexOf(mine), 1);
    }
  }

  onAfterMove(ctx: PluginContext, move: Move): void {
    if (this.mines.has(move.to)) {
      // Mark for deferred explosion — piece stays on board for now
      this.mines.delete(move.to);
      this.exploded.add(move.to);

      const piece = ctx.board.get(move.to);
      // Kings survive mines
      if (piece && piece.type !== PieceType.King) {
        this.pendingExplosions.add(move.to);
      }
    }

    // Reveal mines adjacent to where the piece moved
    for (const dir of ADJACENT_DIRS) {
      const adj = move.to + dir;
      if (isValidSquare(adj) && this.mines.has(adj)) {
        this.revealed.add(adj);
      }
    }
  }

  /** Called after explosion animation finishes to remove the piece */
  resolveExplosion(ctx: PluginContext, sq: SquareIndex): void {
    this.pendingExplosions.delete(sq);
    const piece = ctx.board.get(sq);
    if (piece && piece.type !== PieceType.King) {
      ctx.board.remove(sq);
    }
  }

  getSquareModifiers(
    _ctx: PluginContext,
    square: SquareIndex,
  ): SquareModifier[] {
    if (this.exploded.has(square)) {
      return [{ className: "mine-exploded" }];
    }
    if (this.revealed.has(square)) {
      return [{ className: "mine-warning" }];
    }
    return [];
  }

  getBoardOverlays(_ctx: PluginContext): BoardOverlay[] {
    return [
      {
        type: "minefield",
        squares: [...this.pendingExplosions] as SquareIndex[],
        data: {
          minesRemaining: this.mines.size,
        },
      },
    ];
  }
}
