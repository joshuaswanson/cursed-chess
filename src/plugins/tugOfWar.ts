import { Color, GameStatus, PieceType } from "../engine/types";
import type { Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import { isSquareAttacked } from "../engine/moves";
import type {
  ModePlugin,
  PluginContext,
  BoardOverlay,
  SquareModifier,
} from "./types";
import {
  ALL_SQUARES,
  fileOf,
  isValidSquare,
  rankOf,
} from "../utils/squareUtils";

/** The rope runs up the line between these two files */
export const ROPE_FILES = [3, 4];
/** Drag the flag this many squares into your half to win */
export const WIN_LINE = 3;

export interface TugView {
  /** Where the flag is, in squares from the center line; positive is toward White's end */
  flag: number;
  /** Hands each side has on the rope */
  white: number;
  black: number;
  /** Counts up with every heave, so each one can be animated */
  heave: number;
  /** Which way the last heave went: 1 toward White, -1 toward Black */
  heaveDir: number;
  /** Pieces the last heave moved */
  dragged: Haul[];
}

/** What the computer reckons one hand on the rope is worth, in pawns, with the flag at the centre */
const HAND_WORTH = 3.2;

/** How much of a hand's worth is lost by putting it where the other side can take it */
const SHAKY_GRIP = 0.6;

const onRope = (sq: SquareIndex) => ROPE_FILES.includes(fileOf(sq));

/** A pawn is never hauled onto the first or last rank, where it would promote or be stuck */
const canStand = (piece: Piece, sq: SquareIndex) =>
  piece.type !== PieceType.Pawn || (rankOf(sq) !== 0 && rankOf(sq) !== 7);

/** A piece the rope moved: hauled a square along it, or hopping off it to make way */
export interface Haul {
  from: SquareIndex;
  to: SquareIndex;
  hop: boolean;
}

/**
 * Tug of war on a chessboard. A rope runs up the middle of the board and any
 * piece on the two center files has hold of it. After every round the side
 * with more hands on the rope hauls the flag toward itself. Drag it three
 * squares into your half to win.
 */
export class TugOfWarPlugin implements ModePlugin {
  id = "tug-of-war";
  name = "Tug of War";
  description =
    "Pieces on the two center files hold the rope. More hands hauls the flag your way.";

  /** Where the flag is, in squares from the center line; positive is toward White's end */
  flag = 0;
  /** Counts up with every heave */
  heave = 0;
  /** Which way the last heave went: 1 toward White, -1 toward Black */
  heaveDir = 0;
  private dragged: Haul[] = [];
  private winner: Color | null = null;

  onGameStart(): void {
    this.flag = 0;
    this.heave = 0;
    this.heaveDir = 0;
    this.dragged = [];
    this.winner = null;
  }

  /** Pieces of a color holding the rope */
  hands(board: Board, color: Color): number {
    return ALL_SQUARES.filter(
      (sq) => onRope(sq) && board.get(sq)?.color === color,
    ).length;
  }

  onTurnEnd(ctx: PluginContext, color: Color): void {
    if (color !== Color.Black) return;
    const white = this.hands(ctx.board, Color.White);
    const black = this.hands(ctx.board, Color.Black);
    if (white === black) return;
    const pull = white > black ? 1 : -1;
    this.flag = Math.max(-WIN_LINE, Math.min(WIN_LINE, this.flag + pull));
    this.heave++;
    this.heaveDir = pull;
    this.dragged = this.dragAlong(ctx.board, pull);
    if (this.flag >= WIN_LINE) this.winner = Color.White;
    if (this.flag <= -WIN_LINE) this.winner = Color.Black;
  }

  /**
   * Everyone on the rope is hauled a square the way it went: toward White's
   * end is down the ranks. Whoever is jammed at the end of the line, against
   * the board's edge, or a pawn that would land on the first or last rank,
   * hops off the rope to the nearest free square so the rest can come.
   */
  private dragAlong(board: Board, pull: number): Haul[] {
    const step = pull > 0 ? -16 : 16;
    // Those nearest the end they are hauled toward go first, clearing the way
    const holders = ALL_SQUARES.filter(
      (sq) => onRope(sq) && board.get(sq),
    ).sort((a, b) => (pull > 0 ? a - b : b - a));
    const moves: Haul[] = [];
    for (const from of holders) {
      const piece = board.get(from)!;
      const to = from + step;
      const fits = isValidSquare(to) && !board.get(to) && canStand(piece, to);
      const dest = fits ? to : this.stepAside(board, from, piece);
      if (dest === null) continue;
      board.remove(from);
      board.put(dest, piece);
      moves.push({ from, to: dest, hop: !fits });
    }
    return moves;
  }

  /** The nearest free square off the rope, on the piece's own side of it if there is a tie */
  private stepAside(
    board: Board,
    from: SquareIndex,
    piece: Piece,
  ): SquareIndex | null {
    const side = fileOf(from) === ROPE_FILES[0] ? -1 : 1;
    const score = (sq: SquareIndex) => {
      const df = fileOf(sq) - fileOf(from);
      const dr = rankOf(sq) - rankOf(from);
      return (
        Math.max(Math.abs(df), Math.abs(dr)) * 100 +
        Math.abs(dr) * 10 +
        Math.abs(df) * 2 +
        (Math.sign(df) === side ? 0 : 1)
      );
    };
    const free = ALL_SQUARES.filter(
      (sq) => !onRope(sq) && !board.get(sq) && canStand(piece, sq),
    ).sort((a, b) => score(a) - score(b));
    return free[0] ?? null;
  }

  modifyGameStatus(_ctx: PluginContext, status: GameStatus): GameStatus {
    return this.winner !== null ? GameStatus.Checkmate : status;
  }

  getWinner(): Color | null {
    return this.winner;
  }

  getSquareModifiers(
    ctx: PluginContext,
    square: SquareIndex,
  ): SquareModifier[] {
    if (!onRope(square)) return [];
    const side = fileOf(square) === ROPE_FILES[0] ? "rope-d" : "rope-e";
    const team =
      ctx.board.get(square)?.color === Color.Black ? " rope-black" : "";
    return [{ className: `rope-square ${side}${team}` }];
  }

  /**
   * What a move is worth to the computer for the sake of the rope: a hand
   * put on it, a hand of the other side's taken off it by a capture, and
   * a heavy cost for letting go. All of it counts for more the nearer the
   * flag is to being lost, or to being won.
   */
  squareBonus(
    board: Board,
    to: SquareIndex,
    piece: Piece,
    from: SquareIndex,
  ): number {
    const toward = piece.color === Color.White ? this.flag : -this.flag;
    const stakes = 1 + Math.abs(toward) * 0.6;
    let hands = 0;
    if (onRope(to) && !onRope(from)) hands += 1;
    if (!onRope(to) && onRope(from)) hands -= 1;
    const taken = board.get(to);
    if (taken && taken.color !== piece.color && onRope(to)) hands += 1;
    // A hand put where it can be taken straight off again is worth little
    const foe = piece.color === Color.White ? Color.Black : Color.White;
    const shaky =
      onRope(to) && isSquareAttacked(board, to, foe) ? SHAKY_GRIP : 0;
    return (hands - shaky) * HAND_WORTH * stakes;
  }

  getBoardOverlays(ctx: PluginContext): BoardOverlay[] {
    const view: TugView = {
      flag: this.flag,
      white: this.hands(ctx.board, Color.White),
      black: this.hands(ctx.board, Color.Black),
      heave: this.heave,
      heaveDir: this.heaveDir,
      dragged: this.dragged,
    };
    return [{ type: "tug-of-war", squares: [], data: view }];
  }
}
