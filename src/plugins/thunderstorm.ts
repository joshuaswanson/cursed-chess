import { Color, PieceType } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import { isSquareAttacked } from "../engine/moves";
import type { BoardOverlay, ModePlugin, PluginContext } from "./types";
import { ALL_SQUARES } from "../utils/squareUtils";
import { DarkMemory } from "./darkMemory";

/** Where the lightning came down, and the piece it killed if it hit one */
export interface Strike {
  id: number;
  sq: SquareIndex;
  killed: Piece | null;
}

export interface StormView {
  strike: Strike | null;
}

/** How long after play begins the first bolt comes down, so the board is seen early */
const FIRST_STRIKE_MS = 1500;
/** The shortest and longest wait between bolts */
const STRIKE_GAP_MS: [number, number] = [2600, 5200];
/** The share of bolts that hit a piece, the rest hitting an empty square */
const KILL_CHANCE = 0.3;
/** How long a flash lights the board well enough for Chessbot to take it in */
export const FLASH_MS = 1000;

const ALL_LIT = new Set(ALL_SQUARES);
const NOTHING_LIT = new Set<SquareIndex>();

const pick = <T>(items: T[]): T | null =>
  items.length > 0 ? items[Math.floor(Math.random() * items.length)] : null;

/**
 * The board is dark in a thunderstorm. Every few seconds lightning comes
 * down on a random square, lighting the whole board for a moment. Now and
 * then it hits a piece, which is killed. It never hits a king.
 */
export class ThunderstormPlugin implements ModePlugin {
  id = "thunderstorm";
  name = "Thunderstorm";
  description =
    "The board is dark. Lightning lights it up now and then, and sometimes kills a piece.";

  private untilStrike = FIRST_STRIKE_MS;
  private sinceStrike = Infinity;
  private strike: Strike | null = null;
  private seen = new DarkMemory();

  onGameStart(ctx: PluginContext): void {
    this.untilStrike = FIRST_STRIKE_MS;
    this.sinceStrike = Infinity;
    this.strike = null;
    this.seen.reset(ctx.board);
  }

  private lit(): Set<SquareIndex> {
    return this.sinceStrike < FLASH_MS ? ALL_LIT : NOTHING_LIT;
  }

  /** Your pieces as Chessbot remembers them from the last flash */
  memory(): ReadonlyMap<SquareIndex, Piece> {
    return this.seen.pieces();
  }

  look(board: Board): void {
    this.seen.look(board, this.lit());
  }

  onAfterMove(ctx: PluginContext, move: Move): void {
    this.seen.notice(ctx.board, move, this.lit());
  }

  lastStrike(): Strike | null {
    return this.strike;
  }

  /**
   * Pieces the lightning may kill: anyone but a king, as long as losing them
   * does not leave the side that has just moved with its king open to capture
   */
  private victims(board: Board, toMove: Color): SquareIndex[] {
    const waiting = toMove === Color.White ? Color.Black : Color.White;
    const waitingKing = board.findKing(waiting);
    return ALL_SQUARES.filter((sq) => {
      const piece = board.get(sq);
      if (!piece || piece.type === PieceType.King) return false;
      if (waitingKing === null) return true;
      board.remove(sq);
      const exposed = isSquareAttacked(board, waitingKing, toMove);
      board.put(sq, piece);
      return !exposed;
    });
  }

  /** Moves the storm on by `ms`, and brings the next bolt down once it is due */
  advance(ctx: PluginContext, ms: number): Strike | null {
    this.sinceStrike += ms;
    this.untilStrike -= ms;
    if (this.untilStrike > 0) return null;
    const [shortest, longest] = STRIKE_GAP_MS;
    this.untilStrike = shortest + Math.random() * (longest - shortest);
    this.sinceStrike = 0;

    const victim =
      Math.random() < KILL_CHANCE
        ? pick(this.victims(ctx.board, ctx.game.turn))
        : null;
    const sq =
      victim ?? pick(ALL_SQUARES.filter((s) => !ctx.board.get(s))) ?? 0;
    const killed = victim === null ? null : ctx.board.remove(victim);
    this.strike = { id: (this.strike?.id ?? 0) + 1, sq, killed };
    this.look(ctx.board);
    return this.strike;
  }

  getBoardOverlays(): BoardOverlay[] {
    const view: StormView = { strike: this.strike };
    return [
      {
        type: "thunderstorm",
        squares: this.strike ? [this.strike.sq] : [],
        data: view,
      },
    ];
  }
}
