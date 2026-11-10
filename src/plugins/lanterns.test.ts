import { describe, expect, it } from "vitest";
import { LanternsPlugin } from "./lanterns";
import type { LanternView } from "./lanterns";
import { Table, nameOf, sq } from "../test/harness";

/** A position with lanterns on the named squares, after the move between two squares */
function after(placement: string, lit: string[], from: string, to: string) {
  const plugin = new LanternsPlugin();
  const table = new Table([plugin], `${placement} w - - 0 1`);
  (plugin as unknown as { lanterns: { id: number; sq: number }[] }).lanterns =
    lit.map((name, id) => ({ id, sq: sq(name) }));
  table.move(from, to);
  const view = plugin.getBoardOverlays()[0].data as LanternView;
  return {
    lit: view.lanterns.map((lantern) => nameOf(lantern.sq)),
    flew: view.flights.map((flight) => nameOf(flight.to)),
    board: table.game.board,
  };
}

const RUNS = 60;
const KINGS = "4k3/8/8/8/8/8/8/4K3";

describe("Lanterns", () => {
  it("hands a taken lantern to a taker who has none", () => {
    const { lit, flew } = after("4k3/8/8/3p4/8/4N3/8/4K3", ["d5"], "e3", "d5");
    expect(lit).toEqual(["d5"]);
    expect(flew).toEqual([]);
  });

  it("never leaves two lanterns on one square", () => {
    for (let run = 0; run < RUNS; run++) {
      const { lit } = after(
        "4k3/8/8/3p4/8/4N3/8/4K3",
        ["d5", "e3"],
        "e3",
        "d5",
      );
      expect(new Set(lit).size).toBe(2);
    }
  });

  it("throws a second lantern onto an empty square beside the capture", () => {
    for (let run = 0; run < RUNS; run++) {
      const { flew, board } = after(
        "4k3/8/8/3p4/8/4N3/8/4K3",
        ["d5", "e3"],
        "e3",
        "d5",
      );
      expect(flew).toHaveLength(1);
      expect(board.get(sq(flew[0]))).toBeNull();
      expect(["c4", "c5", "c6", "d4", "d6", "e4", "e5", "e6"]).toContain(
        flew[0],
      );
    }
  });

  it("with no empty square beside it, lands on a piece of the captured side", () => {
    for (let run = 0; run < RUNS; run++) {
      const { flew } = after(
        "4k3/8/8/8/8/1N6/pp6/rN2K3",
        ["a1", "b3"],
        "b3",
        "a1",
      );
      expect(["a2", "b2"]).toContain(flew[0]);
    }
  });

  it("has a piece with no lantern pick up one lying loose", () => {
    const { lit, flew } = after(
      KINGS.replace("8/8/8/4K3", "3P4/8/8/4K3"),
      ["d5"],
      "d4",
      "d5",
    );
    expect(lit).toEqual(["d5"]);
    expect(flew).toEqual([]);
  });
});
