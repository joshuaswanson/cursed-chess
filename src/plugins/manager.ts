import type { Color, Move, SquareIndex, GameStatus } from "../engine/types";
import type { Game } from "../engine/game";
import type {
  ModePlugin,
  PluginContext,
  BoardOverlay,
  SquareModifier,
} from "./types";

export class PluginManager {
  private plugins: ModePlugin[] = [];
  private context: PluginContext | null = null;

  setContext(game: Game): void {
    this.context = { game, board: game.board };
  }

  register(plugin: ModePlugin): void {
    this.plugins.push(plugin);
  }

  unregister(pluginId: string): void {
    this.plugins = this.plugins.filter((p) => p.id !== pluginId);
  }

  clear(): void {
    this.plugins = [];
  }

  private get ctx(): PluginContext {
    if (!this.context) throw new Error("PluginManager: context not set");
    return this.context;
  }

  invokeOnGameStart(): void {
    for (const p of this.plugins) p.onGameStart?.(this.ctx);
  }

  invokeOnTimeUp(): Color | null {
    for (const p of this.plugins) {
      const winner = p.onTimeUp?.(this.ctx);
      if (winner != null) return winner;
    }
    return null;
  }

  invokeOnIntroEnd(): void {
    for (const p of this.plugins) p.onIntroEnd?.(this.ctx);
  }

  invokeOnTurnStart(color: Color): void {
    for (const p of this.plugins) p.onTurnStart?.(this.ctx, color);
  }

  invokeOnBeforeMove(move: Move): Move | null {
    let current: Move | null = move;
    for (const p of this.plugins) {
      if (!current) break;
      if (p.onBeforeMove) {
        current = p.onBeforeMove(this.ctx, current);
      }
    }
    return current;
  }

  invokeOnAfterMove(move: Move): void {
    for (const p of this.plugins) p.onAfterMove?.(this.ctx, move);
  }

  invokeOnTurnEnd(color: Color): void {
    for (const p of this.plugins) p.onTurnEnd?.(this.ctx, color);
  }

  invokeOnGameEnd(status: GameStatus): void {
    for (const p of this.plugins) p.onGameEnd?.(this.ctx, status);
  }

  invokeModifyLegalMoves(moves: Move[], color: Color): Move[] {
    let current = moves;
    for (const p of this.plugins) {
      if (p.modifyLegalMoves) {
        current = p.modifyLegalMoves(this.ctx, current, color);
      }
    }
    return current;
  }

  invokeModifyBoard(): void {
    for (const p of this.plugins) p.modifyBoard?.(this.ctx);
  }

  invokeModifyGameStatus(status: GameStatus): GameStatus {
    let current = status;
    for (const p of this.plugins) {
      if (p.modifyGameStatus) {
        current = p.modifyGameStatus(this.ctx, current);
      }
    }
    return current;
  }

  getWinner(): Color | null {
    for (const p of this.plugins) {
      const winner = p.getWinner?.(this.ctx);
      if (winner) return winner;
    }
    return null;
  }

  getAllOverlays(): BoardOverlay[] {
    const overlays: BoardOverlay[] = [];
    for (const p of this.plugins) {
      if (p.getBoardOverlays) {
        overlays.push(...p.getBoardOverlays(this.ctx));
      }
    }
    return overlays;
  }

  getSquareModifiers(square: SquareIndex): SquareModifier[] {
    const mods: SquareModifier[] = [];
    for (const p of this.plugins) {
      if (p.getSquareModifiers) {
        mods.push(...p.getSquareModifiers(this.ctx, square));
      }
    }
    return mods;
  }

  getPlugins(): ModePlugin[] {
    return this.plugins;
  }

  find<T extends ModePlugin>(id: string): T | undefined {
    return this.plugins.find((p) => p.id === id) as T | undefined;
  }

  isAutonomous(): boolean {
    return this.plugins.some((p) => p.isAutonomous);
  }

  invokeTickAutonomous(tickMs: number): Color | null {
    let winner: Color | null = null;
    for (const p of this.plugins) {
      winner = p.tickAutonomous?.(this.ctx, tickMs) ?? winner;
    }
    return winner;
  }
}
