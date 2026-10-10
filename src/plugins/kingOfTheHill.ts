import { Color, GameStatus } from "../engine/types";
import type { Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import { isSquareAttacked } from "../engine/moves";
import type {
  ModePlugin,
  PluginContext,
  BoardOverlay,
  SquareModifier,
} from "./types";

// Center 4 squares: d4, e4, d5, e5 in 0x88
const HILL_SQUARES: SquareIndex[] = [
  ((3 << 4) | 3) as SquareIndex, // d4
  ((3 << 4) | 4) as SquareIndex, // e4
  ((4 << 4) | 3) as SquareIndex, // d5
  ((4 << 4) | 4) as SquareIndex, // e5
];

/** What the computer reckons these are worth, in pawns: a piece on the hill, ending a turn on top of it, breaking the other side's streak, and what a piece that can be taken off loses */
const PIECE_ON_HILL = 1.6;
const HOLDING = 1.2;
const BREAKING = 4;
const SHAKY = 1;

/** Turns in a row a side must end holding the hill to win */
const DOMINATION_TURNS = 3;

export class KingOfTheHillPlugin implements ModePlugin {
  id = "king-of-hill";
  name = "King of the Hill";
  description =
    "Control the center by having more pieces on it than the foe. Hold it for 3 turns in a row to win!";

  private whiteControl = 0;
  private blackControl = 0;
  private whiteDomination = 0;
  private blackDomination = 0;
  private winner: Color | null = null;

  onGameStart(): void {
    this.whiteControl = 0;
    this.blackControl = 0;
    this.whiteDomination = 0;
    this.blackDomination = 0;
    this.winner = null;
  }

  /**
   * Checked after every turn. A side's streak grows each time it ends its own
   * turn holding the hill, and is lost the moment any turn ends without it on
   * top, so it has to hold on through the foe's turns in between as well.
   */
  onTurnEnd(ctx: PluginContext, color: Color): void {
    // Count who controls the hill
    let white = 0;
    let black = 0;
    for (const sq of HILL_SQUARES) {
      const piece = ctx.board.get(sq);
      if (!piece) continue;
      if (piece.color === Color.White) white++;
      else black++;
    }

    this.whiteControl = white;
    this.blackControl = black;

    // Whoever has more pieces on the hill controls it; a tie breaks both streaks
    if (white > black) {
      if (color === Color.White) this.whiteDomination++;
      this.blackDomination = 0;
    } else if (black > white) {
      if (color === Color.Black) this.blackDomination++;
      this.whiteDomination = 0;
    } else {
      this.whiteDomination = 0;
      this.blackDomination = 0;
    }

    // Check for win
    if (this.whiteDomination >= DOMINATION_TURNS) {
      this.winner = Color.White;
    } else if (this.blackDomination >= DOMINATION_TURNS) {
      this.winner = Color.Black;
    }
  }

  modifyGameStatus(_ctx: PluginContext, status: GameStatus): GameStatus {
    return this.winner !== null ? GameStatus.Checkmate : status;
  }

  getWinner(): Color | null {
    return this.winner;
  }

  /**
   * What a move is worth to the computer for the sake of the hill: every
   * piece it puts on, keeps off, or takes off the hill, more for a move
   * that leaves it on top, and most of all for one that keeps its own
   * streak going or breaks the other side's
   */
  squareBonus(
    board: Board,
    to: SquareIndex,
    piece: Piece,
    from: SquareIndex,
  ): number {
    const me = piece.color;
    const onHill = (sq: SquareIndex) => HILL_SQUARES.includes(sq);
    let mine = 0;
    let theirs = 0;
    for (const sq of HILL_SQUARES) {
      const there = board.get(sq);
      if (!there) continue;
      if (there.color === me) mine++;
      else theirs++;
    }
    const before = mine - theirs;
    const taken = board.get(to);
    const after =
      before +
      (onHill(to) && !onHill(from) ? 1 : 0) -
      (onHill(from) && !onHill(to) ? 1 : 0) +
      (taken && taken.color !== me && onHill(to) ? 1 : 0);
    const myStreak =
      me === Color.White ? this.whiteDomination : this.blackDomination;
    const theirStreak =
      me === Color.White ? this.blackDomination : this.whiteDomination;
    let bonus = (after - before) * PIECE_ON_HILL;
    // Ending the turn on top counts toward the win, and more with each turn already banked
    if (after > 0) bonus += HOLDING * (1 + myStreak * 2);
    // A turn from winning: nothing matters more than staying on top, or knocking them off it
    if (after > 0 && myStreak === DOMINATION_TURNS - 1) bonus += 400;
    if (theirStreak > 0 && after >= 0 && before < 0) {
      bonus += BREAKING * theirStreak * theirStreak;
    }
    // A piece put where it can be taken straight off again does not hold much
    const foe = me === Color.White ? Color.Black : Color.White;
    if (onHill(to) && isSquareAttacked(board, to, foe)) bonus -= SHAKY;
    return bonus;
  }

  getSquareModifiers(
    ctx: PluginContext,
    square: SquareIndex,
  ): SquareModifier[] {
    if (!HILL_SQUARES.includes(square)) return [];

    const piece = ctx.board.get(square);
    if (piece && piece.color === Color.White) {
      return [{ className: "hill-square hill-white" }];
    }
    if (piece && piece.color === Color.Black) {
      return [{ className: "hill-square hill-black" }];
    }
    return [{ className: "hill-square" }];
  }

  getBoardOverlays(): BoardOverlay[] {
    return [
      {
        type: "king-of-hill",
        squares: HILL_SQUARES,
        data: {
          whiteControl: this.whiteControl,
          blackControl: this.blackControl,
          whiteDomination: this.whiteDomination,
          blackDomination: this.blackDomination,
          dominationNeeded: DOMINATION_TURNS,
        },
      },
    ];
  }
}
