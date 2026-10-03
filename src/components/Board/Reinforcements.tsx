import { useEffect } from "react";
import { Color, PieceType } from "../../engine";
import { ARRIVAL_MS, KING_DEPART_MS } from "../../stores/gameStore";
import type { ArrivalStyle, Reinforcement } from "../../stores/reinforcements";
import { pieceImage } from "../../utils/pieceImages";
import { visualCol } from "./boardGeometry";
import { sfx } from "../../audio/sfx";
import "./Reinforcements.css";

type Style = React.CSSProperties & Record<`--${string}`, string>;

/** Where in the arrival the piece touches down */
const LANDS_AT = { parachute: 0.88, sprint: 0.76 };

function Parachute({ color }: { color: Color }) {
  const [main, stripe] =
    color === Color.White ? ["#fff6e6", "#2f8cff"] : ["#3a2560", "#ff3b4e"];
  return (
    <svg className="parachute" viewBox="0 0 100 100" aria-hidden>
      <g className="chute-lines">
        {[6, 28, 50, 72, 94].map((x) => (
          <path key={x} d={`M${x} 40 L50 98`} />
        ))}
      </g>
      <path
        d="M4 40 Q50 -22 96 40 Q84 31 72 40 Q61 31 50 40 Q39 31 28 40 Q16 31 4 40 Z"
        fill={main}
        stroke="#1b1033"
        strokeWidth="3"
      />
      <path
        d="M28 40 Q31 6 50 3 Q38 12 39 36 Z M72 40 Q69 6 50 3 Q62 12 61 36 Z"
        fill={stripe}
      />
    </svg>
  );
}

/** A newcomer floating down under a parachute or sprinting in from the side */
export function ArrivingPiece({
  arrival,
  style,
  flipped,
  squareSize,
}: {
  arrival: Reinforcement;
  style: ArrivalStyle;
  flipped: boolean;
  squareSize: number;
}) {
  const { piece, delayMs, sq } = arrival;
  const fromLeft = visualCol(sq, flipped) < 4;

  useEffect(() => {
    const land = setTimeout(
      () => sfx.thud(),
      delayMs + ARRIVAL_MS * LANDS_AT[style],
    );
    return () => clearTimeout(land);
  }, [delayMs, style]);

  const col = visualCol(sq, flipped);
  const timing: Style = {
    "--delay": `${delayMs}ms`,
    "--dur": `${ARRIVAL_MS}ms`,
  };
  const wrapperStyle: Style =
    style === "parachute"
      ? { ...timing, "--drop": `${Math.round(squareSize * 7)}px` }
      : {
          ...timing,
          "--from-x": `${Math.round((fromLeft ? -(col + 1.3) : 8.3 - col) * squareSize)}px`,
          "--lean": fromLeft ? "14deg" : "-14deg",
        };

  return (
    <div
      className={`arrival arrival-${style}${style === "sprint" ? (fromLeft ? " from-left" : " from-right") : ""}`}
      style={wrapperStyle}
    >
      {style === "parachute" && <Parachute color={piece.color} />}
      {style === "sprint" && <span className="speed-lines" />}
      <img
        src={pieceImage(piece)}
        alt={`${piece.color}${piece.type}`}
        className="piece-img"
        draggable={false}
      />
      <span className="arrival-dust" />
    </div>
  );
}

/** The shout that goes up when a side gets fresh pieces */
export function ReinforcementBanner({
  arrivals,
  style,
}: {
  arrivals: Reinforcement[];
  style: ArrivalStyle;
}) {
  const startMs = arrivals[0].delayMs;
  useEffect(() => {
    const bugle = setTimeout(() => sfx.bugle(), startMs - 200);
    return () => clearTimeout(bugle);
  }, [startMs]);

  const onlyKings = arrivals.every((a) => a.piece.type === PieceType.King);
  const sides = new Set(arrivals.map((a) => a.piece.color));
  const who =
    sides.size === 2
      ? "Both sides!"
      : sides.has(Color.White)
        ? "For you!"
        : "For the foe!";
  return (
    <div
      className="reinforce-banner"
      style={{ animationDelay: `${startMs - 250}ms` }}
      role="status"
    >
      {onlyKings ? (
        <>
          <span className="reinforce-title">Kings are back!</span>
          <span className="reinforce-sub">Protect them again.</span>
        </>
      ) : (
        <>
          <span className="reinforce-title">Reinforcements!</span>
          <span className="reinforce-sub">
            {style === "parachute" ? "Airdrop incoming." : "Here they come."}{" "}
            {who}
          </span>
        </>
      )}
    </div>
  );
}

/** A king strolling off the side of the board, nose in the air, for a mode he sits out */
export function DepartingKing({
  departure,
  flipped,
  squareSize,
}: {
  departure: Reinforcement;
  flipped: boolean;
  squareSize: number;
}) {
  const col = visualCol(departure.sq, flipped);
  const toLeft = col < 4;
  const style: Style = {
    "--delay": `${departure.delayMs}ms`,
    "--dur": `${KING_DEPART_MS}ms`,
    "--to-x": `${Math.round((toLeft ? -(col + 1.3) : 8.3 - col) * squareSize)}px`,
    "--face": toLeft ? "-1" : "1",
  };
  return (
    <div className="king-departure" style={style} aria-hidden>
      <img
        src={pieceImage(departure.piece)}
        alt=""
        className="piece-img"
        draggable={false}
      />
    </div>
  );
}

/** The announcement that both kings are leaving the board to the troops */
export function KingsLeaveBanner({ startMs }: { startMs: number }) {
  return (
    <div
      className="reinforce-banner"
      style={{ animationDelay: `${startMs - 250}ms` }}
      role="status"
    >
      <span className="reinforce-title">Kings out!</span>
      <span className="reinforce-sub">
        No checkmates here. Win it the other way.
      </span>
    </div>
  );
}
