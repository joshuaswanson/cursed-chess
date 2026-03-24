import { Color } from "../engine/types";
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

// Map board rotation angle to the gravity direction that produces
// screen-downward movement. When the board rotates θ° CW, "screen down"
// in board-local coords is (sin(θ), cos(θ)) → pieces fall that way.
const ANGLE_TO_DIR: Record<number, GravityDirection> = {
  0: "south",
  45: "se",
  90: "east",
  135: "ne",
  180: "north",
  225: "nw",
  270: "west",
  315: "sw",
};

export class GravityPlugin implements ModePlugin {
  id = "gravity";
  name = "Gravity";
  description =
    "Gravity pulls all pieces in one direction. It shifts every few turns.";

  private direction: GravityDirection = "south";
  private angle = 0;
  private turnCount = 0;
  private shiftCount = 0;
  private shiftInterval = 4;
  lastGravityMoves: { from: SquareIndex; to: SquareIndex }[] = [];

  private angleToDirection(angle: number): GravityDirection {
    const normalized = ((angle % 360) + 360) % 360;
    return ANGLE_TO_DIR[normalized] ?? "south";
  }

  onGameStart(_ctx: PluginContext): void {
    this.direction = "south";
    this.angle = 0;
    this.turnCount = 0;
    this.shiftCount = 0;
  }

  onTurnEnd(ctx: PluginContext, color: Color): void {
    // Gravity only applies when the board rotates — otherwise it's normal chess
    if (color === Color.Black) {
      this.turnCount++;
      if (this.turnCount % this.shiftInterval === 0) {
        // First 2 shifts: 90°, then a 45°, then random 45/90
        let step: number;
        if (this.shiftCount < 2) {
          step = 90;
        } else if (this.shiftCount === 2) {
          step = 45;
        } else {
          step = Math.random() < 0.5 ? 45 : 90;
        }
        const sign = Math.random() < 0.5 ? 1 : -1;
        this.shiftCount++;
        this.angle += step * sign;
        this.direction = this.angleToDirection(this.angle);
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
          angle: this.angle,
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
      return projB - projA;
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
