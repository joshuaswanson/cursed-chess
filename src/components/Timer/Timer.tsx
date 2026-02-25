import { useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import { Color, GameStatus } from "../../engine";
import "./Timer.css";

export function Timer() {
  const { timeWhite, timeBlack, turn, moveTimerActive, status, tickTimer } =
    useGameStore();

  const isGameOver =
    status === GameStatus.Checkmate ||
    status === GameStatus.Stalemate ||
    status === GameStatus.DrawFiftyMove ||
    status === GameStatus.DrawInsufficientMaterial;

  useEffect(() => {
    if (!moveTimerActive || isGameOver) return;
    const interval = setInterval(tickTimer, 100);
    return () => clearInterval(interval);
  }, [moveTimerActive, isGameOver, tickTimer]);

  const formatTime = (t: number) => {
    const seconds = Math.ceil(t);
    return `${seconds}`;
  };

  const whiteUrgent = turn === Color.White && timeWhite <= 3;
  const blackUrgent = turn === Color.Black && timeBlack <= 3;

  return (
    <div className="timer-container">
      <div
        className={`timer-clock ${turn === Color.Black ? "active" : ""} ${blackUrgent ? "urgent" : ""}`}
      >
        <span className="timer-label">B</span>
        <span className="timer-value">{formatTime(timeBlack)}</span>
      </div>
      <div
        className={`timer-clock ${turn === Color.White ? "active" : ""} ${whiteUrgent ? "urgent" : ""}`}
      >
        <span className="timer-label">W</span>
        <span className="timer-value">{formatTime(timeWhite)}</span>
      </div>
    </div>
  );
}
