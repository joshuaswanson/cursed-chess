import { Color, PieceType } from "../engine/types";
import type { SquareIndex } from "../engine/types";
import type {
  ModePlugin,
  PluginContext,
  BoardOverlay,
  SquareModifier,
} from "./types";
import { fileOf, rankOf, isValidSquare } from "../utils/squareUtils";

type GravityDirection =
  | "south"
  | "north"
  | "east"
  | "west"
  | "se"
  | "sw"
  | "ne"
  | "nw";

const DIR_OFFSETS: Record<GravityDirection, { df: number; dr: number }> = {
  south: { df: 0, dr: -1 },
  north: { df: 0, dr: 1 },
  east: { df: 1, dr: 0 },
  west: { df: -1, dr: 0 },
  se: { df: 1, dr: -1 },
  sw: { df: -1, dr: -1 },
  ne: { df: 1, dr: 1 },
  nw: { df: -1, dr: 1 },
};

// 45-degree neighbors (clockwise, counter-clockwise)
const ADJACENT_DIRS: Record<
  GravityDirection,
  [GravityDirection, GravityDirection]
> = {
  south: ["sw", "se"],
  se: ["south", "east"],
  east: ["se", "ne"],
  ne: ["east", "north"],
  north: ["ne", "nw"],
  nw: ["north", "west"],
  west: ["nw", "sw"],
  sw: ["west", "south"],
};

const DIR_ARROWS: Record<GravityDirection, string> = {
  south: "\u2193",
  north: "\u2191",
  east: "\u2192",
  west: "\u2190",
  se: "\u2198",
  sw: "\u2199",
  ne: "\u2197",
  nw: "\u2196",
};

export class GravityPlugin implements ModePlugin {
  id = "gravity";
  name = "Gravity";
  description =
    "Gravity pulls all pieces in one direction. It shifts every few turns.";

  private direction: GravityDirection = "south";
  private turnCount = 0;
  private shiftInterval = 4;
  lastGravityMoves: { from: SquareIndex; to: SquareIndex }[] = [];

  onGameStart(_ctx: PluginContext): void {
    this.direction = "south";
    this.turnCount = 0;
  }

  onTurnEnd(ctx: PluginContext, color: Color): void {
    // Apply gravity after every move
    this.applyGravity(ctx);

    if (color === Color.Black) {
      this.turnCount++;
      if (this.turnCount % this.shiftInterval === 0) {
        // Rotate 90 degrees clockwise or counter-clockwise
        const adj = ADJACENT_DIRS[this.direction];
        this.direction = adj[Math.floor(Math.random() * 2)];
        // Apply gravity in the new direction immediately
        this.applyGravity(ctx);
      }
    }
  }

  getSquareModifiers(
    _ctx: PluginContext,
    _square: SquareIndex,
  ): SquareModifier[] {
    return [];
  }

  getBoardOverlays(_ctx: PluginContext): BoardOverlay[] {
    const progress = (this.turnCount % this.shiftInterval) / this.shiftInterval;
    return [
      {
        type: "gravity",
        squares: [],
        data: {
          direction: this.direction,
          arrow: DIR_ARROWS[this.direction],
          shiftProgress: progress,
          moves: this.lastGravityMoves,
        },
      },
    ];
  }

  private applyGravity(ctx: PluginContext): void {
    const { df, dr } = DIR_OFFSETS[this.direction];
    this.lastGravityMoves = [];

    // Collect all pieces
    const pieces: {
      sq: SquareIndex;
      piece: { type: string; color: string };
    }[] = [];
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const sq = ((rank << 4) | file) as SquareIndex;
        const piece = ctx.board.get(sq);
        if (piece) {
          pieces.push({ sq, piece });
        }
      }
    }

    // Sort pieces so we process them in gravity direction order
    // (pieces closest to the "wall" they're falling toward should move first)
    pieces.sort((a, b) => {
      // Project each piece onto the gravity axis and sort by distance to wall
      const projA = rankOf(a.sq) * dr + fileOf(a.sq) * df;
      const projB = rankOf(b.sq) * dr + fileOf(b.sq) * df;
      return projA - projB;
    });

    // Slide each piece in the gravity direction until it hits something
    for (const { sq, piece } of pieces) {
      let current = sq;
      let next = this.stepSquare(current, df, dr);

      while (next !== null && !ctx.board.get(next)) {
        current = next;
        next = this.stepSquare(current, df, dr);
      }

      if (current !== sq) {
        ctx.board.remove(sq);
        ctx.board.put(current, piece as any);
        this.lastGravityMoves.push({ from: sq, to: current as SquareIndex });
      }
    }
  }

  private stepSquare(
    sq: SquareIndex,
    df: number,
    dr: number,
  ): SquareIndex | null {
    const newFile = fileOf(sq) + df;
    const newRank = rankOf(sq) + dr;
    if (newFile < 0 || newFile > 7 || newRank < 0 || newRank > 7) return null;
    const newSq = ((newRank << 4) | newFile) as SquareIndex;
    return isValidSquare(newSq) ? newSq : null;
  }
}
