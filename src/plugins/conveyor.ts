import { Color, PieceType } from "../engine/types";
import type { Move, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import type {
  ModePlugin,
  PluginContext,
  BoardOverlay,
  SquareModifier,
} from "./types";
import { ALL_SQUARES, fileOf, rankOf, toIndex } from "../utils/squareUtils";

/** How long a move's slide and the belts' run after it take to play out */
export const BELT_RUN_MS = 1100;

/** Square belts, from the board's edge in to the four squares at its middle */
export const BELTS = 4;

/** Which belt a square is on: 0 at the edge, 3 at the middle */
export const beltOf = (sq: SquareIndex): number =>
  Math.min(fileOf(sq), 7 - fileOf(sq), rankOf(sq), 7 - rankOf(sq));

/** 1 for clockwise, seen from White's side, and -1 for anticlockwise. Each belt runs against the next. */
export const beltDirection = (belt: number): number =>
  belt % 2 === 0 ? 1 : -1;

/** A belt's squares in clockwise order, seen from White's side: up its left side, along its top, down its right, back along its bottom */
function beltPath(belt: number): SquareIndex[] {
  const lo = belt;
  const hi = 7 - belt;
  const path: SquareIndex[] = [];
  for (let r = lo; r < hi; r++) path.push(toIndex(lo, r));
  for (let f = lo; f < hi; f++) path.push(toIndex(f, hi));
  for (let r = hi; r > lo; r--) path.push(toIndex(hi, r));
  for (let f = hi; f > lo; f--) path.push(toIndex(f, lo));
  return path;
}

const PATHS = Array.from({ length: BELTS }, (_, belt) => beltPath(belt));

/** Where the belts' next run carries whatever stands on a square */
export function carried(sq: SquareIndex): SquareIndex {
  const belt = beltOf(sq);
  const path = PATHS[belt];
  const i = path.indexOf(sq);
  return path[(i + beltDirection(belt) + path.length) % path.length];
}

/** A piece carried along by its belt */
export interface BeltRide {
  from: SquareIndex;
  to: SquareIndex;
}

/**
 * Runs every belt on one place. A pawn carried onto its last rank becomes a
 * queen. Returns where everything went, and which squares now hold a newly
 * crowned queen.
 */
export function runBelts(board: Board): {
  rides: BeltRide[];
  crowned: SquareIndex[];
} {
  const riders = ALL_SQUARES.flatMap((sq) => {
    const piece = board.get(sq);
    return piece ? [{ sq, piece }] : [];
  });
  for (const { sq } of riders) board.remove(sq);
  const rides: BeltRide[] = [];
  const crowned: SquareIndex[] = [];
  for (const { sq, piece } of riders) {
    const to = carried(sq);
    const lastRank = piece.color === Color.White ? 7 : 0;
    const crowns = piece.type === PieceType.Pawn && rankOf(to) === lastRank;
    board.put(
      to,
      crowns ? { type: PieceType.Queen, color: piece.color } : piece,
    );
    rides.push({ from: sq, to });
    if (crowns) crowned.push(to);
  }
  return { rides, crowned };
}

export interface ConveyorView {
  /** Counts up with every run of the belts, so each one can be animated */
  run: number;
  rides: BeltRide[];
  crowned: SquareIndex[];
  /** The move played just before the belts ran, which slides in first */
  move: { from: SquareIndex; to: SquareIndex } | null;
}

const NO_CASTLING = { kingSide: false, queenSide: false };

/**
 * The board is four looping conveyor belts, each running the opposite way to
 * the next. After every move, every belt runs on one place and carries
 * whatever stands on it along.
 */
export class ConveyorPlugin implements ModePlugin {
  id = "conveyor";
  name = "Conveyor";
  description =
    "After every move each belt carries its pieces one place along, the opposite way to the next belt.";

  private run = 0;
  private rides: BeltRide[] = [];
  private crowned: SquareIndex[] = [];
  private move: ConveyorView["move"] = null;
  /** The move of the turn being played, until the turn ends; a skipped turn has none */
  private played: ConveyorView["move"] = null;

  /** The belts carry the kings and rooks off their squares at once, so nobody castles */
  private noCastling(ctx: PluginContext): void {
    ctx.game.castling = {
      [Color.White]: { ...NO_CASTLING },
      [Color.Black]: { ...NO_CASTLING },
    };
  }

  onGameStart(ctx: PluginContext): void {
    this.run = 0;
    this.rides = [];
    this.crowned = [];
    this.move = null;
    this.played = null;
    this.noCastling(ctx);
  }

  onAfterMove(_ctx: PluginContext, move: Move): void {
    this.played = { from: move.from, to: move.to };
  }

  onTurnEnd(ctx: PluginContext): void {
    this.move = this.played;
    this.played = null;
    const { rides, crowned } = runBelts(ctx.board);
    this.rides = rides;
    this.crowned = crowned;
    this.run++;
    // A pawn that has just pushed two is carried off the square it could be taken on
    ctx.game.enPassant = null;
    this.noCastling(ctx);
  }

  getSquareModifiers(
    _ctx: PluginContext,
    square: SquareIndex,
  ): SquareModifier[] {
    return [{ className: `belt belt-${beltOf(square)}` }];
  }

  getBoardOverlays(): BoardOverlay[] {
    const view: ConveyorView = {
      run: this.run,
      rides: this.rides,
      crowned: this.crowned,
      move: this.move,
    };
    return [{ type: "conveyor", squares: [], data: view }];
  }
}
