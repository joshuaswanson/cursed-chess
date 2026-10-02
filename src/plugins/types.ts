import type { Color, Move, SquareIndex, GameStatus } from "../engine/types";
import type { Game } from "../engine/game";
import type { Board } from "../engine/board";

export interface PluginContext {
  game: Game;
  board: Board;
}

export interface BoardOverlay {
  type: string;
  squares: SquareIndex[];
  data?: unknown;
}

export interface SquareModifier {
  className?: string;
  style?: React.CSSProperties;
  label?: string;
}

export interface ModePlugin {
  id: string;
  name: string;
  description: string;

  /** When true, pieces move autonomously (no player turns) */
  isAutonomous?: boolean;

  onGameStart?(ctx: PluginContext): void;
  /** Called once the mode's title cards have cleared and play is about to begin */
  onIntroEnd?(ctx: PluginContext): void;
  onTurnStart?(ctx: PluginContext, color: Color): void;
  onBeforeMove?(ctx: PluginContext, move: Move): Move | null;
  onAfterMove?(ctx: PluginContext, move: Move): void;
  onTurnEnd?(ctx: PluginContext, color: Color): void;
  onGameEnd?(ctx: PluginContext, status: GameStatus): void;

  /** Advances a real-time mode by `tickMs`. Returns the winner once the mode decides one. */
  tickAutonomous?(ctx: PluginContext, tickMs: number): Color | null;

  modifyLegalMoves?(ctx: PluginContext, moves: Move[], color: Color): Move[];
  modifyBoard?(ctx: PluginContext): void;
  modifyGameStatus?(ctx: PluginContext, status: GameStatus): GameStatus;
  /** Winner decided by mode rules, overriding the checkmate winner */
  getWinner?(ctx: PluginContext): Color | null;

  getBoardOverlays?(ctx: PluginContext): BoardOverlay[];
  getSquareModifiers?(
    ctx: PluginContext,
    square: SquareIndex,
  ): SquareModifier[];

  serialize?(): unknown;
  deserialize?(data: unknown): void;
}
