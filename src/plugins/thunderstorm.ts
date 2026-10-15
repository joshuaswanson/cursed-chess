import { Color, PieceType } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import { isSquareAttacked } from "../engine/moves";
import type { BoardOverlay, ModePlugin, PluginContext } from "./types";
import { ALL_SQUARES, fileOf, rankOf } from "../utils/squareUtils";
import { DarkMemory } from "./darkMemory";

/** Where the lightning came down, and the piece it killed if it hit one */
export interface Strike {
  /** Counts up across every storm, so no two bolts share one */
  id: number;
  sq: SquareIndex;
  killed: Piece | null;
  /** The pieces standing next to it, which the current crackles over */
  shocked: SquareIndex[];
}

let boltsEver = 0;

export interface StormView {
  strike: Strike | null;
  /** The last few bolts, newest last, whose marks may still be fading */
  recent: Strike[];
}

/** How long after play begins the first bolt comes down, so the board is seen early */
const FIRST_STRIKE_MS = 1500;
/** The shortest and longest wait between bolts */
const STRIKE_GAP_MS: [number, number] = [2600, 5200];
/** The share of bolts that hit a piece, the rest hitting an empty square */
const KILL_CHANCE = 0.06;
/** The share of bolts followed by one or two more in quick succession */
const BURST_CHANCE = 0.35;
/** The shortest and longest wait between the bolts of a burst */
const BURST_GAP_MS: [number, number] = [380, 750];
/** How many bolts are kept for their marks to finish fading */
const RECENT = 4;
/** How tightly the bolts gather round the middle of the board, in squares */
const SPREAD = 1.4;
/** How long a flash lights the board well enough for Chessbot to take it in */
export const FLASH_MS = 1000;

const ALL_LIT = new Set(ALL_SQUARES);
const NOTHING_LIT = new Set<SquareIndex>();

/** One of the squares at random, those nearer the middle of the board more likely */
const pickNearMiddle = (squares: SquareIndex[]): SquareIndex | null => {
  const weights = squares.map((sq) =>
    Math.exp(
      -((fileOf(sq) - 3.5) ** 2 + (rankOf(sq) - 3.5) ** 2) / (2 * SPREAD ** 2),
    ),
  );
  let roll = Math.random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < squares.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return squares[i];
  }
  return squares[squares.length - 1] ?? null;
};

const between = ([shortest, longest]: [number, number]) =>
  shortest + Math.random() * (longest - shortest);

/**
 * The board is dark in a thunderstorm. Every few seconds lightning comes
 * down, mostly near the middle of the board and sometimes two or three
 * bolts in quick succession, lighting the whole board for a moment. Most
 * bolts hit an empty square; now and then one hits a piece, which is
 * killed. It never hits a king.
 */
export class ThunderstormPlugin implements ModePlugin {
  id = "thunderstorm";
  name = "Thunderstorm";
  description =
    "The board is dark. Lightning lights it up now and then, and sometimes kills a piece.";

  private untilStrike = FIRST_STRIKE_MS;
  private sinceStrike = Infinity;
  private strike: Strike | null = null;
  private recent: Strike[] = [];
  /** Bolts still to come in the burst under way */
  private burstLeft = 0;
  private seen = new DarkMemory();

  onGameStart(ctx: PluginContext): void {
    this.untilStrike = FIRST_STRIKE_MS;
    this.sinceStrike = Infinity;
    this.strike = null;
    this.recent = [];
    this.burstLeft = 0;
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
    if (this.burstLeft > 0) this.burstLeft--;
    else if (Math.random() < BURST_CHANCE) {
      this.burstLeft = 1 + Math.floor(Math.random() * 2);
    }
    this.untilStrike = between(
      this.burstLeft > 0 ? BURST_GAP_MS : STRIKE_GAP_MS,
    );
    this.sinceStrike = 0;

    const victim =
      Math.random() < KILL_CHANCE
        ? pickNearMiddle(this.victims(ctx.board, ctx.game.turn))
        : null;
    const sq =
      victim ??
      pickNearMiddle(ALL_SQUARES.filter((s) => !ctx.board.get(s))) ??
      0;
    const killed = victim === null ? null : ctx.board.remove(victim);
    const shocked = ALL_SQUARES.filter(
      (s) =>
        s !== sq &&
        ctx.board.get(s) &&
        Math.abs(fileOf(s) - fileOf(sq)) <= 1 &&
        Math.abs(rankOf(s) - rankOf(sq)) <= 1,
    );
    this.strike = { id: ++boltsEver, sq, killed, shocked };
    this.recent = [...this.recent, this.strike].slice(-RECENT);
    this.look(ctx.board);
    return this.strike;
  }

  getBoardOverlays(): BoardOverlay[] {
    const view: StormView = { strike: this.strike, recent: this.recent };
    return [
      {
        type: "thunderstorm",
        squares: this.strike ? [this.strike.sq] : [],
        data: view,
      },
    ];
  }
}
