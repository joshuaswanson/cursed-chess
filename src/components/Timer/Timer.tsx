import { useGameStore } from "../../stores/gameStore";
import { Color } from "../../engine";
import "./Timer.css";

export function Timer() {
  const timeWhite = useGameStore((s) => s.timeWhite);
  const turn = useGameStore((s) => s.turn);
  const isAutonomous = useGameStore((s) => s.pluginManager.isAutonomous());
  const isNormalChess = useGameStore((s) => s.currentModeIndex < 0);

  if (isAutonomous || isNormalChess) {
    return <div className="timer-container" />;
  }

  const isWhiteTurn = turn === Color.White;
  const urgent = isWhiteTurn && timeWhite <= 3;

  return (
    <div className="timer-container">
      <div
        className={`timer-clock ${isWhiteTurn ? "active" : ""} ${urgent ? "urgent" : ""}`}
      >
        <span className="timer-label">YOUR MOVE</span>
        <span className="timer-value">{Math.ceil(timeWhite)}</span>
      </div>
    </div>
  );
}
