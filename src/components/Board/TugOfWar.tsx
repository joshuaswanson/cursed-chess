import { useEffect } from "react";
import { WIN_LINE } from "../../plugins/tugOfWar";
import type { TugView } from "../../plugins/tugOfWar";
import { sfx } from "../../audio/sfx";
import "./TugOfWar.css";

type Style = React.CSSProperties & Record<`--${string}`, string | number>;

/** How far down the board, in squares, a spot `toWhite` squares from the center line toward White sits */
const fromTop = (toWhite: number, flipped: boolean) =>
  4 + (flipped ? -toWhite : toWhite);

/**
 * The tug of war: a rope up the middle of the board with the flag tied on it,
 * a mud pit at the center line, and chalk win lines three squares into each
 * half. Every heave yanks the rope and slides the flag toward the stronger side.
 */
export function TugLayer({
  view,
  flipped,
}: {
  view: TugView;
  flipped: boolean;
}) {
  useEffect(() => {
    if (view.heave > 0) sfx.heave();
  }, [view.heave]);

  const flagTop = fromTop(view.flag, flipped);
  // Which way the last heave went on screen: down is positive
  const yank = view.heaveDir * (flipped ? -1 : 1);
  const lines = [
    { toWhite: WIN_LINE, team: "white" },
    { toWhite: -WIN_LINE, team: "black" },
  ];

  return (
    <div className="tug-layer" aria-hidden>
      <span className="tug-mud" />
      <span className="tug-center-line" />
      {lines.map(({ toWhite, team }) => (
        <span
          key={team}
          className={`tug-win-line win-${team}`}
          style={{ top: `${fromTop(toWhite, flipped) * 12.5}%` }}
        >
          <span className="tug-win-label">
            {team === "white" ? "Your win line" : "Their win line"}
          </span>
        </span>
      ))}
      <div
        key={view.heave}
        className={`tug-rope-wrap${view.heave > 0 ? " heaving" : ""}`}
        style={{ "--yank": yank } as Style}
      >
        <svg
          className="tug-rope"
          viewBox="0 0 20 1000"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern
              id="tug-braid"
              width="20"
              height="14"
              patternUnits="userSpaceOnUse"
            >
              <rect width="20" height="14" fill="#d9b277" />
              <path
                d="M-2 0 L22 10 M-2 7 L22 17 M-2 -7 L22 3"
                stroke="#a87a3f"
                strokeWidth="3.5"
              />
              <path d="M-2 2 L22 12" stroke="#f1d6a4" strokeWidth="1.2" />
            </pattern>
          </defs>
          <rect
            x="3"
            y="0"
            width="14"
            height="1000"
            rx="7"
            fill="url(#tug-braid)"
            stroke="#5a3a1a"
            strokeWidth="2.4"
          />
        </svg>
      </div>
      <div className="tug-flag" style={{ top: `${flagTop * 12.5}%` }}>
        <div
          key={view.heave}
          className={`tug-flag-body${view.heave > 0 ? " heaving" : ""}`}
          style={{ "--yank": yank } as Style}
        >
          <svg viewBox="0 0 60 40" className="tug-flag-cloth">
            <path
              d="M30 6 Q14 0 4 8 Q12 20 4 32 Q16 26 30 30 Z"
              fill="#e8402f"
              stroke="#2a1a10"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <path
              d="M30 6 Q46 0 56 8 Q48 20 56 32 Q44 26 30 30 Z"
              fill="#c42c1d"
              stroke="#2a1a10"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            <circle
              cx="30"
              cy="18"
              r="7"
              fill="#e8402f"
              stroke="#2a1a10"
              strokeWidth="2.5"
            />
          </svg>
          <span className="tug-score">
            <b className="you">{view.white}</b> vs{" "}
            <b className="foe">{view.black}</b>
          </span>
        </div>
      </div>
    </div>
  );
}
