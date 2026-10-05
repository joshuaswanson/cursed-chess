import { Color, GameStatus } from "../engine/types";
import type { SquareIndex } from "../engine/types";
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

/** Rounds in a row a side must control the hill to win */
const DOMINATION_TURNS = 3;

export class KingOfTheHillPlugin implements ModePlugin {
  id = "king-of-hill";
  name = "King of the Hill";
  description =
    "Control the center by having more pieces on it than the foe. Hold it for 3 rounds in a row to win!";

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

  onTurnEnd(ctx: PluginContext, color: Color): void {
    if (color !== Color.Black) return;

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
      this.whiteDomination++;
      this.blackDomination = 0;
    } else if (black > white) {
      this.blackDomination++;
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
