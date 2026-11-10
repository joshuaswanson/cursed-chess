import { describe, expect, it } from "vitest";
import { Color, PieceType } from "../engine";
import { ALL_SQUARES } from "../utils/squareUtils";
import { CELLS, SingularityPlugin, placeOf, squareOf } from "./singularity";
import { Table, seeded } from "../test/harness";

/** Where the pieces named can go from a board that holds only them and the two kings */
function reachOf(type: PieceType, c: number, r: number): string[] {
  const plugin = new SingularityPlugin();
  const table = new Table([plugin]);
  const { board } = table.game;
  for (const square of ALL_SQUARES) board.remove(square);
  board.put(squareOf(c, r), { type, color: Color.White });
  board.put(squareOf(6, 5), { type: PieceType.King, color: Color.White });
  board.put(squareOf(11, 0), { type: PieceType.King, color: Color.Black });
  return table
    .moves()
    .filter((move) => move.from === squareOf(c, r))
    .map((move) => {
      const cell = CELLS.find((x) => squareOf(x.c, x.r) === move.to)!;
      const { file, ring, half } = placeOf(cell);
      return `${"abcdefgh"[file]}${ring}${half ?? "="}`;
    });
}

describe("Singularity", () => {
  it("has the original board's 64 squares, file by file and ring by ring", () => {
    const files = Array<number>(8).fill(0);
    const rings = Array<number>(7).fill(0);
    for (const cell of CELLS) {
      const place = placeOf(cell);
      files[place.file]++;
      rings[place.ring]++;
    }
    expect(CELLS).toHaveLength(64);
    expect(files).toEqual([5, 7, 9, 11, 11, 9, 7, 5]);
    expect(rings.slice(1)).toEqual([2, 6, 10, 14, 16, 16]);
  });

  it("starts with both armies and twenty moves for White", () => {
    const table = new Table([new SingularityPlugin()]);
    expect(table.pieces()).toBe(32);
    expect(table.moves()).toHaveLength(20);
  });

  it("lets a rook loop round the middle and back to its own side", () => {
    const reach = reachOf(PieceType.Rook, 2, 5);
    expect(reach).toContain("h6w");
    expect(reach).toContain("d4b");
  });

  it("brings a bishop through the singularity onto the other colour", () => {
    const from = placeOf({ c: 3, r: 2 });
    const reach = reachOf(PieceType.Bishop, 3, 2);
    const shade = (name: string) =>
      ("abcdefgh".indexOf(name[0]) + Number(name[1])) % 2;
    const start = (from.file + from.ring) % 2;
    expect(reach.some((name) => shade(name) !== start)).toBe(true);
    expect(reach.some((name) => shade(name) === start)).toBe(true);
  });

  it("moves a knight off its home square as an ordinary knight would", () => {
    expect(reachOf(PieceType.Knight, 3, 5).sort()).toEqual([
      "a4=",
      "c4w",
      "d5w",
    ]);
  });

  it("plays Chessbot against himself to a finish with both kings kept", () => {
    const plugin = new SingularityPlugin();
    const table = new Table([plugin]);
    const random = seeded(7);
    const restore = Math.random;
    Math.random = random;
    try {
      for (let ply = 0; ply < 200 && !table.over; ply++) {
        const moves = table.moves();
        table.play(plugin.choose(table.game, moves));
        const kings = ALL_SQUARES.filter(
          (square) => table.game.board.get(square)?.type === PieceType.King,
        );
        expect(kings).toHaveLength(2);
      }
    } finally {
      Math.random = restore;
    }
  });

  it("has a Chessbot who beats random play, and takes back what is taken from him", () => {
    const restore = Math.random;
    let wins = 0;
    let slowest = 0;
    try {
      for (let seed = 1; seed <= 8; seed++) {
        const random = seeded(seed);
        Math.random = random;
        const plugin = new SingularityPlugin();
        const table = new Table([plugin]);
        for (let ply = 0; ply < 160 && !table.over; ply++) {
          const moves = table.moves();
          if (table.game.turn === Color.White) {
            table.play(moves[Math.floor(random() * moves.length)]);
            continue;
          }
          const began = performance.now();
          table.play(plugin.choose(table.game, moves));
          slowest = Math.max(slowest, performance.now() - began);
        }
        if (table.status === "checkmate" && table.game.turn === Color.White) {
          wins++;
        }
      }
    } finally {
      Math.random = restore;
    }
    expect(wins).toBeGreaterThanOrEqual(6);
    expect(slowest).toBeLessThan(1500);
  });
});
