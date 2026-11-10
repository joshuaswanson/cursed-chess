import { Color, GameStatus, MoveFlag, PieceType } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import { Game } from "../engine/game";
import type { BoardOverlay, ModePlugin, PluginContext } from "./types";
import { ALL_SQUARES, fileOf, rankOf, toIndex } from "../utils/squareUtils";

/** How many moves of its own side go by between each square a snail crawls */
export const SNAIL_EVERY = 3;
/** How long a crawl to the next square takes to play out */
export const SNAIL_CRAWL_MS = 1400;
/** How many squares of slime a snail leaves behind it before the oldest dries */
const TRAIL_LENGTH = 6;
/** Where each side's snail starts, on the a-file either side of the middle */
const SNAIL_START: Record<Color, SquareIndex> = {
  [Color.White]: toIndex(0, 3),
  [Color.Black]: toIndex(0, 4),
};

export interface Snail {
  /** The side it belongs to: it hunts the other side's king */
  color: Color;
  sq: SquareIndex;
  /** Counts up with each square it crawls, so each crawl is drawn afresh */
  crawls: number;
  /** The squares it has slimed, most recent last */
  trail: SquareIndex[];
  /** How many more moves of its side until it crawls again */
  movesLeft: number;
  /** The king it is after, where that king is now */
  prey: SquareIndex | null;
  /** The piece it ate with its last crawl, if any */
  ate: { sq: SquareIndex; piece: Piece; crawl: number } | null;
}

export interface SnailView {
  snails: Snail[];
}

const other = (color: Color) =>
  color === Color.White ? Color.Black : Color.White;

const distance = (a: SquareIndex, b: SquareIndex) =>
  Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));

/**
 * Immortal Snail Chess. Chess, with an immortal snail on each side that
 * hunts the other side's king. After every third move of its side, a snail
 * crawls one square along the most direct way to that king and eats
 * whatever is on the square it crawls onto. Nothing can take a snail, land
 * on one, or pass through one, though knights jump over them. A snail that
 * gets a king wins the game for its side, and checkmate still wins too.
 */
export class ImmortalSnailPlugin implements ModePlugin {
  id = "immortal-snail";
  name = "Immortal Snail";
  description =
    "Each side's immortal snail hunts the other king, a square every three moves. Nothing stops it.";

  private snails: Snail[] = [];
  private moves: Record<Color, number> = { w: 0, b: 0 };
  private winner: Color | "draw" | null = null;
  /** The legal moves for the last position asked about */
  private found: { key: string; moves: Move[] } | null = null;
  /** Whether the last turn ended with a crawl, which the game waits to see */
  private crawled = false;

  holdAfterMoveMs(): number {
    return this.crawled ? SNAIL_CRAWL_MS : 0;
  }

  onGameStart(ctx: PluginContext): void {
    this.snails = [Color.White, Color.Black].map((color) => {
      const sq = SNAIL_START[color];
      ctx.board.remove(sq);
      return {
        color,
        sq,
        crawls: 0,
        trail: [],
        movesLeft: SNAIL_EVERY,
        prey: null,
        ate: null,
      };
    });
    this.moves = { w: 0, b: 0 };
    this.winner = null;
    this.found = null;
    this.crawled = false;
  }

  /**
   * The game as the side to move sees it, with each snail standing in as a
   * piece of its own side: one it can neither land on nor see past, and
   * that shields its king like any other piece would
   */
  private walled(game: Game): Game {
    const copy = new Game(game.toFen());
    copy.pawnRules = game.pawnRules;
    for (const { sq } of this.snails) {
      copy.board.put(sq, { type: PieceType.Pawn, color: game.turn });
    }
    return copy;
  }

  private legal(game: Game): Move[] {
    const key = `${game.toFen()} ${this.snails.map((s) => s.sq).join(",")}`;
    if (this.found?.key === key) return this.found.moves;
    const snailSquares = new Set(this.snails.map((s) => s.sq));
    const moves = this.walled(game)
      .getLegalMoves()
      .filter((move) => !snailSquares.has(move.from))
      // Played as they stand: the plain board does not know a snail can shield a king
      .map((move) => ({ ...move, flags: move.flags | MoveFlag.ModeMove }));
    this.found = { key, moves };
    return moves;
  }

  modifyLegalMoves(ctx: PluginContext): Move[] {
    return this.legal(ctx.game);
  }

  onTurnEnd(ctx: PluginContext, color: Color): void {
    this.crawled = false;
    this.found = null;
    if (this.winner !== null) return;
    this.moves[color]++;
    const snail = this.snails.find((s) => s.color === color)!;
    snail.movesLeft = SNAIL_EVERY - (this.moves[color] % SNAIL_EVERY);
    if (this.moves[color] % SNAIL_EVERY !== 0) return;
    const prey = ctx.board.findKing(other(color));
    if (prey === null) return;
    const to = this.nextStep(snail, prey);
    snail.trail = [...snail.trail, snail.sq].slice(-TRAIL_LENGTH);
    snail.sq = to;
    snail.crawls++;
    this.crawled = true;
    const eaten = ctx.board.get(to);
    snail.ate = eaten ? { sq: to, piece: eaten, crawl: snail.crawls } : null;
    if (!eaten) return;
    ctx.board.remove(to);
    if (eaten.type !== PieceType.King) return;
    const kingsLeft = [Color.White, Color.Black].filter(
      (side) => ctx.board.findKing(side) !== null,
    );
    this.winner = kingsLeft.length === 0 ? "draw" : kingsLeft[0];
  }

  /**
   * The square beside it on the most direct way to the king, the way a
   * king walks, and of those the one most nearly in line with him. It never
   * crawls onto the other snail.
   */
  private nextStep(snail: Snail, prey: SquareIndex): SquareIndex {
    const blocked = new Set(
      this.snails.filter((s) => s !== snail).map((s) => s.sq),
    );
    const options = ALL_SQUARES.filter(
      (sq) => distance(sq, snail.sq) === 1 && !blocked.has(sq),
    );
    if (options.length === 0) return snail.sq;
    const line = (sq: SquareIndex) =>
      Math.hypot(fileOf(sq) - fileOf(prey), rankOf(sq) - rankOf(prey));
    return options.reduce((best, sq) => {
      const gap = distance(sq, prey) - distance(best, prey);
      if (gap !== 0) return gap < 0 ? sq : best;
      return line(sq) < line(best) ? sq : best;
    });
  }

  modifyGameStatus(ctx: PluginContext, status: GameStatus): GameStatus {
    if (this.winner === "draw") return GameStatus.Stalemate;
    if (this.winner !== null) return GameStatus.Checkmate;
    if (status === GameStatus.DrawFiftyMove) return status;
    const checked = this.walled(ctx.game).isInCheck();
    if (this.legal(ctx.game).length > 0) {
      return checked ? GameStatus.Check : GameStatus.Active;
    }
    return checked ? GameStatus.Checkmate : GameStatus.Stalemate;
  }

  getWinner(): Color | null {
    return this.winner === "draw" ? null : this.winner;
  }

  /**
   * What a square is worth to Chessbot's pieces: his king keeps his
   * distance from the snail hunting it, and nothing of his waits in its way
   */
  squareBonus(
    board: Board,
    to: SquareIndex,
    piece: Piece,
    from: SquareIndex,
  ): number {
    const hunter = this.snails.find((s) => s.color !== piece.color);
    if (!hunter) return 0;
    if (piece.type === PieceType.King) {
      return (distance(to, hunter.sq) - distance(from, hunter.sq)) * 0.6;
    }
    const prey = board.findKing(piece.color);
    const inItsWay =
      prey !== null &&
      distance(to, hunter.sq) === 1 &&
      distance(to, prey) < distance(hunter.sq, prey);
    return inItsWay ? -1.5 : 0;
  }

  getBoardOverlays(ctx: PluginContext): BoardOverlay[] {
    const view: SnailView = {
      snails: this.snails.map((snail) => ({
        ...snail,
        prey: ctx.board.findKing(other(snail.color)),
      })),
    };
    return [
      {
        type: "immortal-snail",
        squares: this.snails.map((s) => s.sq),
        data: view,
      },
    ];
  }
}
