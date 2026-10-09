import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGameStore } from "../../stores/gameStore";
import { Color } from "../../engine";
import { useTheme } from "../../theme/useTheme";
import { sfx } from "../../audio/sfx";
import "./MoveCountdown.css";

const COUNTDOWN_FROM = 5;
/** FIFA's board is held up on the touchline, this many squares wide, half of it over the board's frame and half off it */
const TOUCHLINE_BOARD_SQUARES = 1.5;
const FRAME_SQUARES = 0.35;
const EDGE_PX = 4;

/** The seven bars of a scoreboard digit, each drawn in a cell 60 wide and 100 tall */
const SEGMENTS = {
  top: "10,5 50,5 44,13 16,13",
  upperRight: "55,9 55,45 52,48 47,43 47,17",
  lowerRight: "55,91 47,83 47,57 52,52 55,55",
  bottom: "10,95 50,95 44,87 16,87",
  lowerLeft: "5,91 5,55 8,52 13,57 13,83",
  upperLeft: "5,9 13,17 13,43 8,48 5,45",
  middle: "12,50 17,45 43,45 48,50 43,55 17,55",
};
type Segment = keyof typeof SEGMENTS;
const ALL_SEGMENTS = Object.keys(SEGMENTS) as Segment[];

/** Which bars light up for each character the board can show */
const LIT: Record<string, Segment[]> = {
  "0": ["top", "upperRight", "lowerRight", "bottom", "lowerLeft", "upperLeft"],
  "1": ["upperRight", "lowerRight"],
  "2": ["top", "upperRight", "middle", "lowerLeft", "bottom"],
  "3": ["top", "upperRight", "middle", "lowerRight", "bottom"],
  "4": ["upperLeft", "middle", "upperRight", "lowerRight"],
  "5": ["top", "upperLeft", "middle", "lowerRight", "bottom"],
  "6": ["top", "upperLeft", "middle", "lowerLeft", "lowerRight", "bottom"],
  "7": ["top", "upperRight", "lowerRight"],
  "8": ALL_SEGMENTS,
  "9": ["top", "upperLeft", "upperRight", "middle", "lowerRight", "bottom"],
  "-": ["middle"],
  " ": [],
};

/**
 * A two-digit scoreboard readout: every bar is there, dark, and the ones
 * that make up the number are lit. With no number, it shows two dashes.
 */
function Scoreboard({ seconds }: { seconds: number | null }) {
  const shown = seconds === null ? "--" : String(seconds).padStart(2, " ");
  return (
    <span className="countdown-digit led-readout">
      {[...shown].map((character, place) => (
        <svg key={place} viewBox="0 0 60 100" aria-hidden>
          {ALL_SEGMENTS.map((segment) => (
            <polygon
              key={segment}
              points={SEGMENTS[segment]}
              className={
                LIT[character].includes(segment) ? "led-bar lit" : "led-bar"
              }
            />
          ))}
        </svg>
      ))}
    </span>
  );
}

/**
 * Where the countdown stands: over the board, or for FIFA held up by the
 * fourth official on the left touchline at halfway, centred on the outer
 * edge of the board's frame
 */
function placeCountdown(anchor: DOMRect, themeId: string): DOMRect {
  if (themeId !== "fifa") return anchor;
  const squares = document.querySelector(".board")?.getBoundingClientRect();
  if (!squares) return anchor;
  const square = squares.width / 8;
  const width = square * TOUCHLINE_BOARD_SQUARES;
  const left = Math.max(
    EDGE_PX,
    squares.left - square * FRAME_SQUARES - width / 2,
  );
  return new DOMRect(left, squares.top, width, squares.height);
}

/** The last seconds of your move, dressed for the channel that is on air */
export function MoveCountdown() {
  const theme = useTheme();
  const cursed = useGameStore((s) => s.cursed);
  const turn = useGameStore((s) => s.turn);
  const timeWhite = useGameStore((s) => s.timeWhite);
  const autonomous = useGameStore((s) => s.pluginManager.isAutonomous());
  const introDone = useGameStore((s) => s.introDone);

  const seconds =
    cursed && !autonomous && turn === Color.White && timeWhite > 0
      ? Math.ceil(timeWhite)
      : null;
  const counting = seconds !== null && seconds <= COUNTDOWN_FROM;
  // FIFA's fourth official holds his board up the whole match: your seconds
  // while you are on the ball, and blank while they are
  const fixture = cursed && !autonomous && theme.id === "fifa" && introDone;
  const showing = counting || fixture;

  useEffect(() => {
    if (counting) sfx.tick(seconds, theme.id === "mines");
  }, [counting, seconds, theme.id]);

  // Drawn on the page itself, over the board, so nothing drifting across the
  // board, like the fog, can hide it
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!showing) return;
    const measure = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      setBox(anchor ? placeCountdown(anchor, theme.id) : null);
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [showing, theme.id]);

  const page = document.querySelector(".app");
  return (
    <>
      <span ref={anchorRef} className="countdown-anchor" aria-hidden />
      {showing &&
        box &&
        page &&
        createPortal(
          <div
            className="move-countdown"
            data-countdown={theme.id}
            role="timer"
            data-held={fixture && !counting ? "" : undefined}
            aria-label={
              seconds === null
                ? "Waiting for the other side to move"
                : `${seconds} seconds left to move`
            }
            style={{
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
            }}
          >
            <div className="countdown-stage" key={seconds}>
              <span className="countdown-prop" aria-hidden />
              {theme.id === "fifa" ? (
                <Scoreboard seconds={seconds} />
              ) : (
                <span className="countdown-digit">{seconds}</span>
              )}
            </div>
          </div>,
          page,
        )}
    </>
  );
}
