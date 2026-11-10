import { describe, expect, it } from "vitest";
import { Color } from "../engine";
import { PacManPlugin } from "./pacman";
import type { PacView } from "./pacman";
import { Table, seeded } from "../test/harness";

/** A game with only the pieces placed, and the power pellets eaten if `powerEaten` */
function endgame(placement: string, powerEaten: boolean) {
  const plugin = new PacManPlugin();
  const table = new Table([plugin], `${placement} w - - 0 1`);
  if (powerEaten) {
    (plugin as unknown as { power: Set<number> }).power = new Set();
  }
  plugin.onTurnEnd({ game: table.game, board: table.game.board });
  return plugin.getWinner();
}

describe("Pac-Man", () => {
  it("is White's army alone, with dots on the light squares only", () => {
    const plugin = new PacManPlugin();
    const table = new Table([plugin]);
    const view = plugin.getBoardOverlays()[0].data as PacView;
    expect(table.pieces()).toBe(16);
    expect(view.pellets.every((s) => ((s & 7) + (s >> 4)) % 2 === 1)).toBe(
      true,
    );
    expect(view.total).toBe(24);
  });

  it("keeps the turn with White", () => {
    const table = new Table([new PacManPlugin()]);
    table.playRandomly(20, seeded(3));
    expect(table.game.turn).toBe(Color.White);
  });

  it("ends for the ghosts only once no piece left can reach a dot", () => {
    expect(endgame("8/8/8/8/8/8/8/2B5", false)).toBeNull();
    expect(endgame("8/8/8/8/8/8/8/2B5", true)).toBe(Color.Black);
    expect(endgame("8/8/8/8/8/8/8/5B2", true)).toBeNull();
    expect(endgame("8/8/8/8/8/8/8/1N6", true)).toBeNull();
    expect(endgame("8/8/8/8/8/8/8/8", true)).toBe(Color.Black);
  });
});
