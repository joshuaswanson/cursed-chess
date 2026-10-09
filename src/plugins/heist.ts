import { Color, GameStatus, MoveFlag, PieceType } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import { isSquareAttacked, opponent } from "../engine/moves";
import type {
  BoardOverlay,
  ModePlugin,
  PluginContext,
  SquareModifier,
} from "./types";
import { fileOf, isValidSquare, rankOf, toIndex } from "../utils/squareUtils";

export interface HeistView {
  /** Where the jewel is: on its plinth, or with whoever carries it */
  sq: SquareIndex;
  /** Whose piece carries it, or nobody while it still sits on its plinth */
  carrier: Color | null;
  /** The plinth it was lifted from */
  plinth: SquareIndex;
  /** How many times it has changed hands, counting the first lift */
  grabs: number;
}

/** The four middle squares, one of which the jewel is shown on */
const PLINTHS = [toIndex(3, 3), toIndex(4, 3), toIndex(3, 4), toIndex(4, 4)];
const STEPS = [-17, -16, -15, -1, 1, 15, 16, 17];
/**
 * How many rows at a side's own end count as home. Two, because the back
 * row alone starts full of that side's own pieces and stays that way.
 */
const HOME_ROWS = 2;
/** How many rows a rank is from a side's own end of the board */
const fromOwnEnd = (color: Color, rank: number) =>
  color === Color.White ? rank : 7 - rank;
/** Whether a rank is one a side has to get the jewel back to */
const isHome = (color: Color, rank: number) =>
  fromOwnEnd(color, rank) < HOME_ROWS;
/** How far apart two squares are, counted in king's steps */
const steps = (a: SquareIndex, b: SquareIndex) =>
  Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));

/**
 * A museum at night, and one jewel on a plinth in the middle of the floor.
 * Whoever moves onto it lifts it, and from then on can only creep a square
 * at a time, in any direction. Take the piece carrying it and the jewel is
 * yours. Carry it back to your own two home rows to win.
 */
export class HeistPlugin implements ModePlugin {
  id = "heist";
  name = "Heist";
  description =
    "Grab the jewel and carry it home to your own first two rows. Whoever holds it can only creep one square at a time.";

  private plinth: SquareIndex = PLINTHS[0];
  private sq: SquareIndex = PLINTHS[0];
  private carrier: Color | null = null;
  private grabs = 0;
  private winner: Color | null = null;

  onGameStart(ctx: PluginContext): void {
    const open = PLINTHS.filter((sq) => !ctx.board.get(sq));
    const choices = open.length > 0 ? open : PLINTHS;
    this.plinth = choices[Math.floor(Math.random() * choices.length)];
    this.sq = this.plinth;
    this.grabs = 0;
    this.winner = null;
    // A piece already standing there when the lights go down has it in hand
    this.carrier = ctx.board.get(this.sq)?.color ?? null;
  }

  /** The alarm has gone off: somebody has the jewel off its plinth */
  get alarm(): boolean {
    return this.carrier !== null;
  }

  /**
   * Whoever carries the jewel gives up their own way of moving for a creep:
   * one square in any direction, taking whatever stands there
   */
  modifyLegalMoves(ctx: PluginContext, moves: Move[], color: Color): Move[] {
    if (this.carrier !== color) return moves;
    const piece = ctx.board.get(this.sq);
    // A king creeps as it is
    if (!piece || piece.type === PieceType.King) return moves;
    const others = moves.filter((move) => move.from !== this.sq);
    const creeps = STEPS.map((step) => this.sq + step)
      .filter((to) => isValidSquare(to))
      .flatMap((to): Move[] => {
        const there = ctx.board.get(to);
        if (there?.color === color) return [];
        return [
          {
            from: this.sq,
            to,
            piece,
            captured: there ?? undefined,
            flags: MoveFlag.ModeMove | (there ? MoveFlag.Capture : 0),
          },
        ];
      })
      .filter((move) => this.leavesKingSafe(ctx.board, move, color));
    return [...others, ...creeps];
  }

  private leavesKingSafe(board: Board, move: Move, color: Color): boolean {
    const after = board.clone();
    after.remove(move.from);
    after.put(move.to, move.piece);
    const king = after.findKing(color);
    return king === null || !isSquareAttacked(after, king, opponent(color));
  }

  onAfterMove(_ctx: PluginContext, move: Move): void {
    // A pawn taken in passing stood beside the square the taker lands on
    const taken =
      move.flags & MoveFlag.EnPassant
        ? toIndex(fileOf(move.to), rankOf(move.from))
        : move.to;
    const mover = move.piece.color;
    if (this.sq === move.from && this.carrier === mover) {
      this.sq = move.to;
    } else if (
      (move.captured && this.sq === taken) ||
      (this.carrier === null && this.sq === move.to)
    ) {
      // Lifted from its plinth, or taken along with whoever had it
      this.sq = move.to;
      this.carrier = mover;
      this.grabs++;
    }
    if (this.carrier === mover && isHome(mover, rankOf(this.sq))) {
      this.winner = mover;
    }
  }

  modifyGameStatus(_ctx: PluginContext, status: GameStatus): GameStatus {
    return this.winner !== null ? GameStatus.Checkmate : status;
  }

  getWinner(): Color | null {
    return this.winner;
  }

  /** The carrier's own home rows are lit up as the way out */
  getSquareModifiers(
    _ctx: PluginContext,
    square: SquareIndex,
  ): SquareModifier[] {
    if (this.carrier === null) return [];
    return isHome(this.carrier, rankOf(square))
      ? [{ className: `heist-exit heist-exit-${this.carrier}` }]
      : [];
  }

  getBoardOverlays(): BoardOverlay[] {
    const view: HeistView = {
      sq: this.sq,
      carrier: this.carrier,
      plinth: this.plinth,
      grabs: this.grabs,
    };
    return [{ type: "heist", squares: [this.sq], data: view }];
  }

  /** How much the computer likes a move for the sake of the jewel */
  squareBonus(to: SquareIndex, piece: Piece, from: SquareIndex): number {
    const closer = steps(from, this.sq) - steps(to, this.sq);
    // Nobody has it: get there first
    if (this.carrier === null) return to === this.sq ? 5 : closer * 0.6;
    if (this.carrier === piece.color) {
      // Carrying it: head for home, and do not wander off without it
      if (from !== this.sq) return closer * 0.2;
      const nearer =
        fromOwnEnd(piece.color, rankOf(from)) -
        fromOwnEnd(piece.color, rankOf(to));
      return isHome(piece.color, rankOf(to)) ? 500 : nearer * 3;
    }
    // The other side has it: close in, and take it if it can be taken
    return to === this.sq ? 12 : closer * 0.8;
  }
}
