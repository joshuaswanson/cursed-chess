import { useLayoutEffect, useRef, useState } from "react";
import { Color } from "../../engine";
import type { SquareIndex } from "../../engine";
import type { Kick } from "../../plugins/football";
import type { BenchedKing, BenchedPlayer } from "../../stores/reinforcements";
import { KING_DEPART_MS } from "../../stores/gameStore";
import { pieceImage } from "../../utils/pieceImages";
import { useKitImages } from "../../utils/kitImages";
import { visualCol, visualRow } from "./boardGeometry";
import "./Sideline.css";

type Style = React.CSSProperties & Record<`--${string}`, string | number>;

const BENCH_WALK_MS = 1100;
/** How much of a square each touchline spot takes */
const CELL = 0.72;
/** The board frame's width beyond the squares, kept clear of the touchline */
const FRAME = 0.32;
/** Breathing room left at the screen's edge */
const EDGE_PX = 6;

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

/** A team cheers when the goal was theirs */
function reactionTo(kick: Kick | null, color: Color): string {
  if (kick?.outcome !== "goal") return "";
  return kick.color === color ? " cheering" : "";
}

/**
 * The left touchline: each side's king coaching in cap and whistle, and in
 * FIFA the players taken off the pitch watching beside them
 */
export function Sideline({
  coaching,
  coaches,
  bench,
  lastKick,
  flipped,
  squareSize,
}: {
  /** FIFA's kings coach from the touchline; elsewhere they stand beside the board and watch */
  coaching: boolean;
  coaches: BenchedKing[];
  bench: BenchedPlayer[];
  lastKick: Kick | null;
  flipped: boolean;
  squareSize: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const kitFor = useKitImages(
    bench.flatMap(({ piece, number }) =>
      number === undefined ? [] : [{ piece, number }],
    ),
    pieceImage,
  );
  const room = useRoomOnLeft(ref);
  const nearColor = flipped ? Color.Black : Color.White;
  const half = (color: Color) => (color === nearColor ? "near" : "far");

  // Lay the touchline out in the room actually left of the board, so
  // everyone on it stays on screen however wide the window is
  const cell = squareSize * CELL;
  const gap = Math.min(squareSize * FRAME, Math.max(0, room - cell));
  const columns = Math.max(1, Math.floor((room - gap) / cell));
  const rows = Math.floor((4 * squareSize) / cell);
  const coachRow = Math.floor(rows / 2);
  // With no room at all, as on a phone, the touchline overlaps the board's edge
  const spotAt = (side: "near" | "far", column: number, row: number) => ({
    x: Math.max(-room, -gap - cell * (Math.min(column, columns - 1) + 1)),
    y:
      (side === "far" ? 0 : 4 * squareSize) +
      (4 * squareSize - rows * cell) / 2 +
      row * cell,
  });
  // Seats in the order they fill: down the column beside the coach, then the next one out
  const seat = (n: number) => {
    const perColumn = rows - 1;
    const column = Math.floor(n / perColumn);
    const row = n % perColumn;
    return { column, row: row >= coachRow ? row + 1 : row };
  };

  const walkFrom = (sq: SquareIndex, spot: { x: number; y: number }) => ({
    "--from-x": `${Math.round((visualCol(sq, flipped) + 0.5) * squareSize - (spot.x + cell / 2))}px`,
    "--from-y": `${Math.round((visualRow(sq, flipped) + 0.5) * squareSize - (spot.y + cell / 2))}px`,
  });
  const place = (spot: { x: number; y: number }) => ({
    left: `${Math.round(spot.x)}px`,
    top: `${Math.round(spot.y)}px`,
    width: `${Math.round(cell)}px`,
    height: `${Math.round(cell)}px`,
  });
  const seats = { near: 0, far: 0 };

  return (
    <div ref={ref} className="sideline" aria-hidden>
      {coaches.map(({ sq, piece, delayMs }) => {
        // FIFA's coaches take their place on the touchline; elsewhere a king
        // just walks straight off the side of the board along its own row
        const spot =
          coaching || sq === null
            ? spotAt(half(piece.color), 0, coachRow)
            : {
                x: Math.max(-room, -gap - cell),
                y:
                  visualRow(sq, flipped) * squareSize + (squareSize - cell) / 2,
              };
        // A king already off the board from the mode before is just there
        const style: Style = {
          ...place(spot),
          ...(sq === null
            ? { "--from-x": "0px", "--from-y": "0px" }
            : walkFrom(sq, spot)),
          "--delay": `${delayMs}ms`,
          "--dur": `${sq === null ? 0 : KING_DEPART_MS}ms`,
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
              {coaching && <CoachKit color={piece.color} />}
            </div>
          </div>
        );
      })}
      {bench.map(({ piece, takenOn, number }, i) => {
        const side = half(piece.color);
        const { column, row } = seat(seats[side]++);
        const spot = spotAt(side, column, row);
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
              <img src={kitFor(piece, number)} alt="" draggable={false} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** How many pixels there are between the board's left edge and the screen's */
function useRoomOnLeft(ref: React.RefObject<HTMLDivElement | null>): number {
  const [room, setRoom] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      const left = ref.current?.getBoundingClientRect().left ?? 0;
      setRoom(Math.max(0, left - EDGE_PX));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [ref]);
  return room;
}
