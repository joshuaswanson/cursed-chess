import { useEffect } from "react";
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

  if (!showing) return null;
  return (
    <div
      className="move-countdown"
      data-countdown={theme.id}
      role="timer"
      aria-label={`${seconds} seconds left to move`}
    >
      <div className="countdown-stage" key={seconds}>
        <span className="countdown-prop" aria-hidden />
        <span className="countdown-digit">{seconds}</span>
      </div>
    </div>
  );
}
