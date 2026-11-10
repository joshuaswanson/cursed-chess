import { describe, expect, it } from "vitest";
import { Board, Color } from "../engine";
import { TugOfWarPlugin } from "./tugOfWar";
import type { PluginContext } from "./types";

const EVEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
const WHITE_AHEAD = "rnbqkbnr/ppp1pppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
const BLACK_AHEAD = "rnbqkbnr/pppppppp/8/8/8/8/PPP1PPPP/RNBQKBNR";

function position(placement: string): PluginContext {
  const board = new Board();
  board.loadFen(`${placement} w - - 0 1`);
  return { board } as PluginContext;
}

describe("Tug of War", () => {
  it("hauls only once a lead has outlasted the other side's reply", () => {
    const tug = new TugOfWarPlugin();
    tug.onGameStart();

    tug.onTurnEnd(position(WHITE_AHEAD), Color.White);
    expect(tug.heaved).toBe(false);
    tug.onTurnEnd(position(EVEN), Color.Black);
    expect(tug.heaved).toBe(false);
    expect(tug.flag).toBe(0);

    tug.onTurnEnd(position(WHITE_AHEAD), Color.White);
    tug.onTurnEnd(position(WHITE_AHEAD), Color.Black);
    expect(tug.heaved).toBe(true);
    expect(tug.flag).toBe(1);
  });

  it("treats both sides alike", () => {
    const tug = new TugOfWarPlugin();
    tug.onGameStart();
    tug.onTurnEnd(position(BLACK_AHEAD), Color.Black);
    expect(tug.heaved).toBe(false);
    tug.onTurnEnd(position(BLACK_AHEAD), Color.White);
    expect(tug.heaved).toBe(true);
    expect(tug.flag).toBe(-1);
  });
});
