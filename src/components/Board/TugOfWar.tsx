import { useEffect } from "react";
import { WIN_LINE } from "../../plugins/tugOfWar";
import type { TugView } from "../../plugins/tugOfWar";
import { sfx } from "../../audio/sfx";
import { ROPE_TILE } from "./ropeTexture";
import "./TugOfWar.css";

type Style = React.CSSProperties & Record<`--${string}`, string | number>;

/** The flag's outline at the two ends of its ripple, flying off the rope to the right */
const FLAG_WAVES = [
  "M9 6 C24 2 38 10 52 6 C58 4 64 5 66 6 L66 34 C58 31 52 36 40 36 C28 36 20 30 9 34 Z",
  "M9 6 C22 10 36 2 50 7 C57 9 63 4 66 8 L66 36 C60 32 50 40 38 35 C26 31 18 37 9 34 Z",
];
/** A white band across the cloth that ripples with it */
const FLAG_STRIPE = [
  "M9 17 C24 13 38 21 52 17 C58 15 64 16 66 17 L66 23 C58 22 52 25 40 25 C28 25 20 21 9 23 Z",
  "M9 17 C22 21 36 13 50 18 C57 20 63 15 66 19 L66 25 C60 22 50 28 38 24 C26 20 18 26 9 23 Z",
];
/** Shadowed folds running down the cloth */
const FLAG_FOLDS = [
  "M26 5 C27 15 25 25 27 35 M46 7 C47 17 45 27 47 36",
  "M24 8 C22 18 26 26 24 34 M44 5 C46 15 42 27 45 36",
];

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

  // The struggle only plays out when both teams have someone on the rope
  const contested = view.white > 0 && view.black > 0;

  return (
    <>
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
      </div>
      <div
        className={`tug-layer tug-rope-layer${contested ? " contested" : ""}`}
        aria-hidden
      >
        <div
          key={view.heave}
          className={`tug-rope-wrap${view.heave > 0 ? " heaving" : ""}`}
          style={{ "--yank": yank } as Style}
        >
          <div className="tug-rope" style={{ "--rope": ROPE_TILE } as Style} />
        </div>
        <div className="tug-flag" style={{ top: `${flagTop * 12.5}%` }}>
          <div
            key={view.heave}
            className={`tug-flag-body${view.heave > 0 ? " heaving" : ""}`}
            style={{ "--yank": yank } as Style}
          >
            <svg viewBox="0 0 70 44" className="tug-flag-cloth">
              {/* The cloth ripples between two shapes as it flies off the rope */}
              <path
                d={FLAG_WAVES[0]}
                fill="#e8402f"
                stroke="#2a1a10"
                strokeWidth="2.4"
                strokeLinejoin="round"
              >
                <animate
                  attributeName="d"
                  values={`${FLAG_WAVES[0]};${FLAG_WAVES[1]};${FLAG_WAVES[0]}`}
                  dur="1.1s"
                  repeatCount="indefinite"
                />
              </path>
              <path d={FLAG_STRIPE[0]} fill="#ffffff">
                <animate
                  attributeName="d"
                  values={`${FLAG_STRIPE[0]};${FLAG_STRIPE[1]};${FLAG_STRIPE[0]}`}
                  dur="1.1s"
                  repeatCount="indefinite"
                />
              </path>
              <path
                d={FLAG_FOLDS[0]}
                fill="none"
                stroke="#000"
                strokeOpacity="0.22"
                strokeWidth="3"
              >
                <animate
                  attributeName="d"
                  values={`${FLAG_FOLDS[0]};${FLAG_FOLDS[1]};${FLAG_FOLDS[0]}`}
                  dur="1.1s"
                  repeatCount="indefinite"
                />
              </path>
              {[8, 32].map((y) => (
                <g key={y}>
                  <ellipse
                    cx="9"
                    cy={y}
                    rx="7"
                    ry="3.4"
                    fill="#e8402f"
                    stroke="#2a1a10"
                    strokeWidth="2"
                  />
                  <path
                    d={`M9 ${y} l-4 6 M9 ${y} l3 6`}
                    stroke="#2a1a10"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </g>
              ))}
            </svg>
            <span className="tug-score">
              <b className="you">{view.white}</b> vs{" "}
              <b className="foe">{view.black}</b>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
