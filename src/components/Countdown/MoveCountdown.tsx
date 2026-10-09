import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGameStore } from "../../stores/gameStore";
import { Color } from "../../engine";
import { useTheme } from "../../theme/useTheme";
import { sfx } from "../../audio/sfx";
import "./MoveCountdown.css";

const COUNTDOWN_FROM = 5;
/** FIFA's board is held up on the touchline, this many squares wide, clear of the board's frame */
const TOUCHLINE_BOARD_SQUARES = 1.8;
const FRAME_SQUARES = 0.35;
const EDGE_PX = 4;

/**
 * Where the countdown stands: over the board, or for FIFA held up by the
 * fourth official on the left touchline at halfway, overlapping the pitch's
 * edge only when there is no room beside it
 */
function placeCountdown(anchor: DOMRect, themeId: string): DOMRect {
  if (themeId !== "fifa") return anchor;
  const squares = document.querySelector(".board")?.getBoundingClientRect();
  if (!squares) return anchor;
  const square = squares.width / 8;
  const width = square * TOUCHLINE_BOARD_SQUARES;
  const left = Math.max(EDGE_PX, squares.left - square * FRAME_SQUARES - width);
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
              <span className="countdown-digit">{seconds ?? "\u2013"}</span>
            </div>
          </div>,
          page,
        )}
    </>
  );
}
