import { useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import { Color, GameStatus } from "../../engine";
import "./Timer.css";

export function Timer() {
  const {
    timeWhite,
    turn,
    moveTimerActive,
    status,
    tickTimer,
    tickModeTimer,
    tickAutonomous,
    pluginManager,
  } = useGameStore();

  const isGameOver =
    status === GameStatus.Checkmate ||
    status === GameStatus.Stalemate ||
    status === GameStatus.DrawFiftyMove ||
    status === GameStatus.DrawInsufficientMaterial;

  const isAutonomous = pluginManager.isAutonomous();

  // Move timer (100ms ticks) — disabled during autonomous mode
  useEffect(() => {
    if (!moveTimerActive || isGameOver || isAutonomous) return;
    const interval = setInterval(tickTimer, 100);
    return () => clearInterval(interval);
  }, [moveTimerActive, isGameOver, isAutonomous, tickTimer]);

  // Autonomous movement tick (200ms)
  useEffect(() => {
    if (!isAutonomous || isGameOver) return;
    const interval = setInterval(tickAutonomous, 200);
    return () => clearInterval(interval);
  }, [isAutonomous, isGameOver, tickAutonomous]);

  // Mode timer (1s ticks)
  useEffect(() => {
    if (isGameOver) return;
    const interval = setInterval(tickModeTimer, 1000);
    return () => clearInterval(interval);
  }, [isGameOver, tickModeTimer]);

  const whiteUrgent = turn === Color.White && timeWhite <= 3;

  return (
    <div className="timer-container">
      <div
        className={`timer-clock ${turn === Color.White ? "active" : ""} ${whiteUrgent ? "urgent" : ""}`}
      >
        <span className="timer-label">YOUR MOVE</span>
        <span className="timer-value">{Math.ceil(timeWhite)}</span>
      </div>
    </div>
  );
}
