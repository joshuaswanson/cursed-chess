import { describe, expect, it } from "vitest";
import { Color } from "../engine";
import { FinalePlugin } from "./finale";
import type { FinaleAct, FinaleView } from "./finale";
import type { LanternView } from "./lanterns";
import type { TugView } from "./tugOfWar";
import { Table, nameOf } from "../test/harness";

/** A final battle with one of its modes started at once */
function battleWith(act: FinaleAct, fen?: string) {
  const finale = new FinalePlugin();
  const table = new Table([finale], fen);
  finale.attach(table.manager);
  const inner = finale as unknown as {
    live: FinaleAct[];
    start(ctx: unknown, act: FinaleAct): void;
  };
  inner.start({ game: table.game, board: table.game.board }, act);
  inner.live.push(act);
  const overlay = <T>(type: string) =>
    table.manager.getAllOverlays().find((o) => o.type === type)?.data as T;
  return { table, finale, overlay };
}

describe("Final battle", () => {
  it("leaves the ball where it lies until a piece carries it off", () => {
    const { table, overlay } = battleWith(
      "fifa",
      "4k3/8/8/8/8/8/8/R3K3 w - - 0 1",
    );
    const start = overlay<FinaleView>("finale").ball;
    expect(nameOf(start)[1]).toBe("6");
    table.move("e1", "e2");
    table.move("e8", "d8");
    expect(overlay<FinaleView>("finale").ball).toBe(start);
  });

  it("counts a goal when the player carries the ball into the goal", () => {
    const { table, finale, overlay } = battleWith(
      "fifa",
      "k7/8/8/8/8/8/8/3RK3 w - - 0 1",
    );
    const ball = nameOf(overlay<FinaleView>("finale").ball);
    expect(ball).toBe("d6");
    const before = finale.progress;
    table.move("d1", "d6");
    expect(nameOf(overlay<FinaleView>("finale").ball)).toBe("d6");
    table.move("a8", "a7");
    table.move("d6", "d8");
    const view = overlay<FinaleView>("finale");
    expect(view.goals).toBe(1);
    expect(nameOf(view.ball)[1]).toBe("6");
    expect(finale.progress).toBeGreaterThan(before);
  });

  it("runs Lanterns as the mode itself, two carriers a side", () => {
    const { table, overlay } = battleWith("lanterns");
    const view = overlay<LanternView>("lanterns");
    expect(view.lanterns).toHaveLength(4);
    const carriers = view.lanterns.map(
      (l) => table.game.board.get(l.sq)?.color,
    );
    expect(carriers.filter((c) => c === Color.White)).toHaveLength(2);
    expect(carriers.filter((c) => c === Color.Black)).toHaveLength(2);
  });

  it("lays the rope the whole length of the board", () => {
    const { overlay } = battleWith("tug");
    const { rope } = overlay<TugView>("tug-of-war");
    expect(rope?.ranks).toEqual([0, 7]);
    expect(rope!.files[1]).toBeLessThan(7);
  });
});
