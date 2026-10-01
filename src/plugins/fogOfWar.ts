import type { ModePlugin, BoardOverlay } from "./types";

export class FogOfWarPlugin implements ModePlugin {
  id = "fog-of-war";
  name = "Fog of War";
  description = "Dense fog covers the enemy half of the board.";

  getBoardOverlays(): BoardOverlay[] {
    return [{ type: "fog-overlay", squares: [] }];
  }
}
