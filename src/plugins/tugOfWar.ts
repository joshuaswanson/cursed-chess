import { Color, GameStatus } from "../engine/types";
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
/** How far the flag moves for each extra hand on the rope, in squares */
const PULL_PER_HAND = 0.5;
/** The most the flag can move in one heave */
const MAX_HEAVE = 1;
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
  private winner: Color | null = null;

  onGameStart(): void {
    this.flag = 0;
    this.heave = 0;
    this.heaveDir = 0;
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
    const pull = Math.max(
      -MAX_HEAVE,
      Math.min(MAX_HEAVE, (white - black) * PULL_PER_HAND),
    );
    if (pull === 0) return;
    this.flag = Math.max(-WIN_LINE, Math.min(WIN_LINE, this.flag + pull));
    this.heave++;
    this.heaveDir = Math.sign(pull);
    if (this.flag >= WIN_LINE) this.winner = Color.White;
    if (this.flag <= -WIN_LINE) this.winner = Color.Black;
  }

  modifyGameStatus(_ctx: PluginContext, status: GameStatus): GameStatus {
    return this.winner !== null ? GameStatus.Checkmate : status;
  }

  getWinner(): Color | null {
    return this.winner;
  }

  getSquareModifiers(
    _ctx: PluginContext,
    square: SquareIndex,
  ): SquareModifier[] {
    if (!onRope(square)) return [];
    const side = fileOf(square) === ROPE_FILES[0] ? "rope-d" : "rope-e";
    return [{ className: `rope-square ${side}` }];
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
    };
    return [{ type: "tug-of-war", squares: [], data: view }];
  }
}
