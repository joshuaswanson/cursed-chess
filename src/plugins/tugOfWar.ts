import { Color, GameStatus, PieceType } from "../engine/types";
import type { Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import type {
  ModePlugin,
  PluginContext,
  BoardOverlay,
  SquareModifier,
} from "./types";
import { ALL_SQUARES, fileOf } from "../utils/squareUtils";

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
  /** Pieces the last heave dragged a square along with the rope */
  dragged: { from: SquareIndex; to: SquareIndex }[];
}

const onRope = (sq: SquareIndex) => ROPE_FILES.includes(fileOf(sq));

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

  private flag = 0;
  private heave = 0;
  private heaveDir = 0;
  private dragged: { from: SquareIndex; to: SquareIndex }[] = [];
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
   * end is down the ranks. A piece only goes if the square is free, and a
   * pawn is never hauled onto the first or last rank.
   */
  private dragAlong(
    board: Board,
    pull: number,
  ): { from: SquareIndex; to: SquareIndex }[] {
    const step = pull > 0 ? -16 : 16;
    // Those nearest the end they are hauled toward go first, clearing the way
    const holders = ALL_SQUARES.filter(
      (sq) => onRope(sq) && board.get(sq),
    ).sort((a, b) => (pull > 0 ? a - b : b - a));
    const moves: { from: SquareIndex; to: SquareIndex }[] = [];
    for (const from of holders) {
      const to = from + step;
      const piece = board.get(from)!;
      const rank = to >> 4;
      if (to < 0 || to > 0x77 || board.get(to)) continue;
      if (piece.type === PieceType.Pawn && (rank === 0 || rank === 7)) continue;
      board.remove(from);
      board.put(to, piece);
      moves.push({ from, to });
    }
    return moves;
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

  /** The computer wants its pieces on the rope, and more so the closer the flag is to its own end */
  squareBonus(square: SquareIndex, piece: Piece): number {
    if (!onRope(square)) return 0;
    const losing = piece.color === Color.White ? -this.flag : this.flag;
    return 0.6 + Math.max(0, losing) * 0.3;
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
