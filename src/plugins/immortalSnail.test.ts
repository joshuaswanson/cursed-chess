import { describe, expect, it } from "vitest";
import { PieceType } from "../engine";
import { ALL_SQUARES } from "../utils/squareUtils";
import { ImmortalSnailPlugin } from "./immortalSnail";
import type { SnailView } from "./immortalSnail";
import { Table, nameOf, seeded } from "../test/harness";

function snailsOf(table: Table) {
  const view = table.manager.getAllOverlays()[0].data as SnailView;
  return Object.fromEntries(
    view.snails.map((snail) => [snail.color, nameOf(snail.sq)]),
  );
}

describe("Immortal Snail", () => {
  it("starts the snails on a4 and a5, where nothing can land", () => {
    const table = new Table([new ImmortalSnailPlugin()]);
    expect(snailsOf(table)).toEqual({ w: "a4", b: "a5" });
    expect(table.movesFrom("a2")).toEqual(["a3"]);
  });

  it("crawls a square toward the other king after its side's third move", () => {
    const table = new Table([new ImmortalSnailPlugin()]);
    table.move("e2", "e4");
    table.move("e7", "e5");
    table.move("g1", "f3");
    table.move("b8", "c6");
    expect(snailsOf(table).w).toBe("a4");
    table.move("f1", "c4");
    expect(snailsOf(table)).toEqual({ w: "b5", b: "a5" });
  });

  it("is a wall to a rook, and no obstacle to a knight", () => {
    const rook = new Table(
      [new ImmortalSnailPlugin()],
      "4k3/8/8/8/8/8/8/R3K1N1 w - - 0 1",
    );
    expect(rook.movesFrom("a1")).toEqual(["a2", "a3", "b1", "c1", "d1"]);
    const knight = new Table(
      [new ImmortalSnailPlugin()],
      "4k3/8/8/8/8/1N6/8/4K3 w - - 0 1",
    );
    expect(knight.movesFrom("b3")).toEqual(["a1", "c1", "c5", "d2", "d4"]);
  });

  it("never shares a square with a piece, and ends the game when it gets a king", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const plugin = new ImmortalSnailPlugin();
      const table = new Table([plugin]);
      const random = seeded(seed);
      for (let ply = 0; ply < 300 && !table.over; ply++) {
        const moves = table.moves();
        table.play(moves[Math.floor(random() * moves.length)]);
        const view = table.manager.getAllOverlays()[0].data as SnailView;
        for (const snail of view.snails) {
          expect(table.game.board.get(snail.sq)).toBeNull();
        }
      }
      const kings = ALL_SQUARES.filter(
        (square) => table.game.board.get(square)?.type === PieceType.King,
      ).length;
      if (kings < 2) expect(table.over).toBe(true);
    }
  });
});
