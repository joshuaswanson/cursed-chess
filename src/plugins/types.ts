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

  onGameStart?(ctx: PluginContext): void;
  onTurnStart?(ctx: PluginContext, color: Color): void;
  onBeforeMove?(ctx: PluginContext, move: Move): Move | null;
  onAfterMove?(ctx: PluginContext, move: Move): void;
  onTurnEnd?(ctx: PluginContext, color: Color): void;
  onGameEnd?(ctx: PluginContext, status: GameStatus): void;

  modifyLegalMoves?(ctx: PluginContext, moves: Move[], color: Color): Move[];
  modifyBoard?(ctx: PluginContext): void;
  modifyGameStatus?(ctx: PluginContext, status: GameStatus): GameStatus;

  getBoardOverlays?(ctx: PluginContext): BoardOverlay[];
  getSquareModifiers?(
    ctx: PluginContext,
    square: SquareIndex,
  ): SquareModifier[];

  serialize?(): unknown;
  deserialize?(data: unknown): void;
}
