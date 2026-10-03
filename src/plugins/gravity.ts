import { Color } from "../engine/types";
import type { PawnRules, SquareIndex } from "../engine/types";
import type { ModePlugin, PluginContext, BoardOverlay } from "./types";
import { fileOf, rankOf, toIndex, ALL_SQUARES } from "../utils/squareUtils";

type GravityDirection =
  "south" | "north" | "east" | "west" | "se" | "sw" | "ne" | "nw";

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

/** How fast the board turns, in degrees per second */
const SPIN_RATE = 5;
/** Gravity changes direction each time the board has turned this far */
const SHIFT_STEP = 45;
/** How long play stops while the pieces come loose and fall */
export const GRAVITY_SHIFT_MS = 2000;

/**
 * Pawns keep heading up the screen whichever way the board is turned: White
 * moves toward the top of the screen and Black toward the bottom, capturing on
 * the directions 45 degrees either side.
 */
function pawnRulesForAngle(angle: number): PawnRules {
  const turned = ((angle % 360) + 360) % 360;
  if (turned === 0) return null;
  const t = (turned * Math.PI) / 180;
  // A screen direction (x right, y down) as a 0x88 offset on the turned board
  const boardDir = (x: number, y: number) => {
    const vx = x * Math.cos(t) + y * Math.sin(t);
    const vy = -x * Math.sin(t) + y * Math.cos(t);
    const df = Math.abs(vx) < 0.3 ? 0 : Math.sign(vx);
    const dr = Math.abs(vy) < 0.3 ? 0 : -Math.sign(vy);
    return dr * 16 + df;
  };
  return {
    [Color.White]: {
      forward: boardDir(0, -1),
      captures: [boardDir(-1, -1), boardDir(1, -1)],
    },
    [Color.Black]: {
      forward: boardDir(0, 1),
      captures: [boardDir(-1, 1), boardDir(1, 1)],
    },
  };
}

export class GravityPlugin implements ModePlugin {
  id = "gravity";
  name = "Gravity";
  description =
    "The board keeps turning. Every eighth of a turn, everything falls the new way down.";

  private direction: GravityDirection = "south";
  /** The angle gravity last settled at, a multiple of SHIFT_STEP */
  private angle = 0;
  /** Where the board had turned to when it last stopped or started turning */
  private spinBase = 0;
  /** When the board started turning from `spinBase`, or null while it is held still */
  private spinSince: number | null = null;
  private spinDir: 1 | -1 = 1;
  lastGravityMoves: { from: SquareIndex; to: SquareIndex }[] = [];

  private angleToDirection(angle: number): GravityDirection {
    const normalized = ((angle % 360) + 360) % 360;
    return ANGLE_TO_DIR[normalized] ?? "south";
  }

  onGameStart(ctx: PluginContext): void {
    ctx.game.pawnRules = null;
    this.direction = "south";
    this.angle = 0;
    this.spinBase = 0;
    this.spinSince = null;
    this.spinDir = Math.random() < 0.5 ? 1 : -1;
    this.lastGravityMoves = [];
  }

  /** How far the board has turned at time `now`, in degrees */
  spinAt(now: number): number {
    if (this.spinSince === null) return this.spinBase;
    return (
      this.spinBase + (this.spinDir * SPIN_RATE * (now - this.spinSince)) / 1000
    );
  }

  holdSpin(now: number): void {
    this.spinBase = this.spinAt(now);
    this.spinSince = null;
  }

  resumeSpin(now: number): void {
    this.spinSince ??= now;
  }

  /**
   * Once the turning board passes the next step, gravity takes the new
   * direction, the pieces fall, and the board holds still. Returns whether
   * that happened.
   */
  shiftIfDue(ctx: PluginContext, now: number): boolean {
    const next = this.angle + this.spinDir * SHIFT_STEP;
    if ((this.spinAt(now) - next) * this.spinDir < 0) return false;
    this.angle = next;
    this.spinBase = next;
    this.spinSince = null;
    this.direction = this.angleToDirection(next);
    ctx.game.pawnRules = pawnRulesForAngle(next);
    this.applyGravity(ctx);
    return true;
  }

  getBoardOverlays(): BoardOverlay[] {
    return [
      {
        type: "gravity",
        squares: [],
        data: {
          direction: this.direction,
          angle: this.angle,
          arrow: DIR_ARROWS[this.direction],
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

      ctx.board.remove(sq);
      ctx.board.put(current, piece);
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
