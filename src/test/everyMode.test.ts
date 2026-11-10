import { afterEach, describe, expect, it } from "vitest";
import { GAME_MODES } from "../modes";
import { PieceType } from "../engine";
import { ALL_SQUARES, setBoardSize } from "../utils/squareUtils";
import { Table, seeded } from "./harness";

const GAMES = 25;
const PLIES = 120;

afterEach(() => setBoardSize());

describe.each(
  GAME_MODES.filter((mode) => !mode.isHex && !mode.finale).map(
    (mode) => [mode.name, mode] as const,
  ),
)("%s", (_name, mode) => {
  it("plays random games without breaking", () => {
    for (let seed = 1; seed <= GAMES; seed++) {
      setBoardSize(mode.ranks ?? 8, mode.files ?? 8);
      const random = seeded(seed);
      const table = new Table(mode.create());
      const autonomous = table.manager.isAutonomous();
      for (let ply = 0; ply < PLIES && !table.over; ply++) {
        if (autonomous) {
          table.manager.invokeTickAutonomous(100);
          continue;
        }
        const moves = table.moves();
        if (moves.length === 0) break;
        const move = moves[Math.floor(random() * moves.length)];
        expect(move.piece, `seed ${seed}, ply ${ply}`).toBeTruthy();
        table.play(move);
        const kings = ALL_SQUARES.filter(
          (square) => table.game.board.get(square)?.type === PieceType.King,
        ).length;
        expect(kings, `seed ${seed}, ply ${ply}`).toBeLessThanOrEqual(2);
        // Overlays are what the board draws from, so they must always build
        table.manager.getAllOverlays();
      }
    }
  });
});
