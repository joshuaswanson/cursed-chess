import { Color, PieceType } from "../engine/types";
import type { SquareIndex } from "../engine/types";
import type { ModePlugin, PluginContext, BoardOverlay } from "./types";
import {
  fileOf,
  rankOf,
  toIndex,
  promotionRank,
  ALL_SQUARES,
} from "../utils/squareUtils";

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

  onGameStart(): void {
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

  getBoardOverlays(): BoardOverlay[] {
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

    // Pieces nearest the wall they fall toward move first
    const projection = (sq: SquareIndex) => rankOf(sq) * dr + fileOf(sq) * df;
    const occupied = ALL_SQUARES.filter((sq) => ctx.board.get(sq)).sort(
      (a, b) => projection(b) - projection(a),
    );

    for (const sq of occupied) {
      const piece = ctx.board.get(sq)!;
      let current = sq;
      let next = this.stepSquare(current, df, dr);
      while (next !== null && !ctx.board.get(next)) {
        current = next;
        next = this.stepSquare(current, df, dr);
      }
      if (current === sq) continue;

      const promotes =
        piece.type === PieceType.Pawn &&
        rankOf(current) === promotionRank(piece.color);
      ctx.board.remove(sq);
      ctx.board.put(
        current,
        promotes ? { type: PieceType.Queen, color: piece.color } : piece,
      );
      this.lastGravityMoves.push({ from: sq, to: current });
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
    return toIndex(newFile, newRank);
  }
}
