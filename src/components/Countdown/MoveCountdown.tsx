import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGameStore } from "../../stores/gameStore";
import { Color } from "../../engine";
import { useTheme } from "../../theme/useTheme";
import { sfx } from "../../audio/sfx";
import "./MoveCountdown.css";

const COUNTDOWN_FROM = 5;

/** The last seconds of your move, dressed for the channel that is on air */
export function MoveCountdown() {
  const theme = useTheme();
  const cursed = useGameStore((s) => s.cursed);
  const turn = useGameStore((s) => s.turn);
  const timeWhite = useGameStore((s) => s.timeWhite);
  const autonomous = useGameStore((s) => s.pluginManager.isAutonomous());

  const seconds =
    cursed && !autonomous && turn === Color.White && timeWhite > 0
      ? Math.ceil(timeWhite)
      : null;
  const showing = seconds !== null && seconds <= COUNTDOWN_FROM;

  useEffect(() => {
    if (showing) sfx.tick(seconds, theme.id === "mines");
  }, [showing, seconds, theme.id]);

  // Drawn on the page itself, over the board, so nothing drifting across the
  // board, like the fog, can hide it
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [box, setBox] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (!showing) return;
    const measure = () =>
      setBox(anchorRef.current?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [showing]);

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
            aria-label={`${seconds} seconds left to move`}
            style={{
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
            }}
          >
            <div className="countdown-stage" key={seconds}>
              <span className="countdown-prop" aria-hidden />
              <span className="countdown-digit">{seconds}</span>
            </div>
          </div>,
          page,
        )}
    </>
  );
}
