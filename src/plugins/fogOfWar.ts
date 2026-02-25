import type { SquareIndex } from "../engine/types";
import type {
  ModePlugin,
  PluginContext,
  BoardOverlay,
  SquareModifier,
} from "./types";

export class FogOfWarPlugin implements ModePlugin {
  id = "fog-of-war";
  name = "Fog of War";
  description = "Dense fog covers the enemy half of the board.";

  getBoardOverlays(ctx: PluginContext): BoardOverlay[] {
    return [
      { type: "fog-overlay", squares: [], data: { turn: ctx.game.turn } },
    ];
  }

  getSquareModifiers(
    _ctx: PluginContext,
    _square: SquareIndex,
  ): SquareModifier[] {
    return [];
  }
}
