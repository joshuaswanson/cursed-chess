import { Color } from "../../engine";
import type { SquareIndex } from "../../engine";
import type { Kick } from "../../plugins/football";
import type { BenchedPlayer, Reinforcement } from "../../stores/reinforcements";
import { KING_DEPART_MS } from "../../stores/gameStore";
import { pieceImage } from "../../utils/pieceImages";
import { visualCol, visualRow } from "./boardGeometry";
import "./Sideline.css";

type Style = React.CSSProperties & Record<`--${string}`, string | number>;

/** Where along the left touchline each team gathers, in squares from the board's top left */
const COACH_SPOT = {
  near: { col: -1.45, row: 5.3 },
  far: { col: -1.45, row: 1.7 },
};
const BENCH_COLS = [-2.4, -3.35];
const BENCH_ROWS = {
  near: [4.15, 5.1, 6.05, 7.0],
  far: [0.15, 1.1, 2.05, 3.0],
};
const BENCH_WALK_MS = 1100;

const CAP_COLOR = { [Color.White]: "#2f6bff", [Color.Black]: "#e2304a" };

/** A cap, a whistle on a lanyard, and a clipboard, drawn over the king */
function CoachKit({ color }: { color: Color }) {
  const team = CAP_COLOR[color];
  return (
    <svg className="coach-kit" viewBox="0 0 45 45" aria-hidden>
      <g stroke="#1b1033" strokeLinejoin="round" strokeLinecap="round">
        <path
          d="M17 16 Q22.5 27 28 16"
          fill="none"
          stroke={team}
          strokeWidth="1.3"
        />
        <rect
          x="20.6"
          y="22.6"
          width="5.4"
          height="3.4"
          rx="1.6"
          fill="#d6dde8"
          strokeWidth="1"
        />
        <rect
          x="19"
          y="23.4"
          width="2.4"
          height="1.6"
          rx="0.5"
          fill="#aab4c3"
          strokeWidth="0.8"
        />
        <path
          d="M15.4 12.2 Q15.6 4.2 22.5 4.2 Q29.4 4.2 29.6 12.2 Z"
          fill={team}
          strokeWidth="1.5"
        />
        <path
          d="M18.5 6.5 Q22.5 5 26.5 6.5"
          fill="none"
          stroke="#fff"
          strokeOpacity="0.55"
          strokeWidth="1"
        />
        <path
          d="M21.5 11.6 L35.5 12.4 Q36 14.6 33.4 14.4 L21.5 13.8 Z"
          fill={team}
          strokeWidth="1.4"
        />
        <circle cx="22.5" cy="4.4" r="1.1" fill={team} strokeWidth="0.9" />
        <g transform="rotate(14 36 28)">
          <rect
            x="31"
            y="21"
            width="10"
            height="13"
            rx="1"
            fill="#b5793f"
            strokeWidth="1.3"
          />
          <rect
            x="32.4"
            y="23"
            width="7.2"
            height="9.6"
            fill="#fffdf6"
            strokeWidth="0.6"
          />
          <rect
            x="34"
            y="20"
            width="4"
            height="2.6"
            rx="0.6"
            fill="#c9d1dc"
            strokeWidth="0.9"
          />
          <path
            d="M33.6 25.4 H38.4 M33.6 27.6 H37.6 M33.6 29.8 H38"
            stroke="#7a8496"
            strokeWidth="0.7"
          />
        </g>
      </g>
    </svg>
  );
}

/** Which way a team takes a goal: cheering if it was theirs, slumping if not */
function reactionTo(kick: Kick | null, color: Color): string {
  if (kick?.outcome !== "goal") return "";
  return kick.color === color ? " cheering" : " sulking";
}

/**
 * The left touchline: each side's king coaching in cap and whistle, and in
 * FIFA the players taken off the pitch watching beside them
 */
export function Sideline({
  coaches,
  bench,
  lastKick,
  flipped,
  squareSize,
}: {
  coaches: Reinforcement[];
  bench: BenchedPlayer[];
  lastKick: Kick | null;
  flipped: boolean;
  squareSize: number;
}) {
  const nearColor = flipped ? Color.Black : Color.White;
  const half = (color: Color) => (color === nearColor ? "near" : "far");
  const walkFrom = (sq: SquareIndex, spot: { col: number; row: number }) => ({
    "--from-x": `${Math.round((visualCol(sq, flipped) - spot.col) * squareSize)}px`,
    "--from-y": `${Math.round((visualRow(sq, flipped) - spot.row) * squareSize)}px`,
  });
  const place = (spot: { col: number; row: number }) => ({
    left: `${spot.col * 12.5}%`,
    top: `${spot.row * 12.5}%`,
  });
  const seats = { near: 0, far: 0 };

  return (
    <div className="sideline" aria-hidden>
      {coaches.map(({ sq, piece, delayMs }) => {
        const spot = COACH_SPOT[half(piece.color)];
        const style: Style = {
          ...place(spot),
          ...walkFrom(sq, spot),
          "--delay": `${delayMs}ms`,
          "--dur": `${KING_DEPART_MS}ms`,
        };
        return (
          <div
            key={piece.color}
            className="sideline-member sideline-coach"
            style={style}
          >
            <div
              className={`sideline-reaction${reactionTo(lastKick, piece.color)}`}
            >
              <img src={pieceImage(piece)} alt="" draggable={false} />
              <CoachKit color={piece.color} />
            </div>
          </div>
        );
      })}
      {bench.map(({ piece, takenOn }, i) => {
        const side = half(piece.color);
        const seat = seats[side]++;
        const spot = {
          col: BENCH_COLS[Math.floor(seat / 4) % BENCH_COLS.length],
          row: BENCH_ROWS[side][seat % 4],
        };
        const style: Style = {
          ...place(spot),
          ...walkFrom(takenOn, spot),
          "--delay": "250ms",
          "--dur": `${BENCH_WALK_MS}ms`,
          "--beat": `${(i % 3) * 120}ms`,
        };
        return (
          <div
            key={i}
            className="sideline-member sideline-player"
            style={style}
          >
            <div
              className={`sideline-reaction${reactionTo(lastKick, piece.color)}`}
            >
              <img src={pieceImage(piece)} alt="" draggable={false} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
