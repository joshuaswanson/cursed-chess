import type { SquareIndex } from "../../engine";
import type { Checker } from "../../utils/checkers";
import { boardFiles, boardRanks } from "../../utils/squareUtils";
import { visualCol, visualRow } from "./boardGeometry";
import "./CheckLines.css";

/** Square size in the drawing's own units */
const UNIT = 100;
const HEAD_LENGTH = 30;
const HEAD_WIDTH = 26;

/** Arrows from each piece giving check to the king, drawn one after another when it is mate */
export function CheckLines({
  king,
  checkers,
  flipped,
  mate,
}: {
  king: SquareIndex;
  checkers: Checker[];
  flipped: boolean;
  mate: boolean;
}) {
  const center = (sq: SquareIndex) => [
    (visualCol(sq, flipped) + 0.5) * UNIT,
    (visualRow(sq, flipped) + 0.5) * UNIT,
  ];
  const [kx, ky] = center(king);
  return (
    <svg
      className={`check-lines${mate ? " mate" : ""}`}
      viewBox={`0 0 ${boardFiles() * UNIT} ${boardRanks() * UNIT}`}
      aria-hidden
    >
      {checkers
        .filter((checker) => checker.straight)
        .map(({ sq }, i) => {
          const [x, y] = center(sq);
          const length = Math.hypot(kx - x, ky - y);
          const ux = (kx - x) / length;
          const uy = (ky - y) / length;
          const tip = [kx - ux * 26, ky - uy * 26];
          const base = [tip[0] - ux * HEAD_LENGTH, tip[1] - uy * HEAD_LENGTH];
          const start = [x + ux * 30, y + uy * 30];
          const side = [-uy * (HEAD_WIDTH / 2), ux * (HEAD_WIDTH / 2)];
          const shaft = `M${start[0]} ${start[1]} L${base[0]} ${base[1]}`;
          const head = `M${tip[0]} ${tip[1]} L${base[0] + side[0]} ${base[1] + side[1]} L${base[0] - side[0]} ${base[1] - side[1]} Z`;
          return (
            <g
              key={sq}
              className="check-line"
              style={{ "--i": i } as React.CSSProperties}
            >
              <path className="check-line-ink" d={shaft} pathLength={1} />
              <path className="check-line-head-ink" d={head} />
              <path className="check-line-red" d={shaft} pathLength={1} />
              <path className="check-line-head" d={head} />
            </g>
          );
        })}
    </svg>
  );
}
