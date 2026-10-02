import { useEffect } from "react";
import { AUTONOMOUS_TICK_MS, useGameStore } from "../stores/gameStore";
import { isGameOver } from "../engine";

const MOVE_TICK_MS = 100;
const MODE_TICK_MS = 1000;

/** Drives the move clock, the autonomous-mode tick, and the mode countdown */
export function useGameLoop(): void {
  const moveTimerActive = useGameStore((s) => s.moveTimerActive);
  const gameOver = useGameStore((s) => isGameOver(s.status));
  const isAutonomous = useGameStore((s) => s.pluginManager.isAutonomous());
  const { tickTimer, tickAutonomous, tickModeTimer } = useGameStore.getState();

  useEffect(() => {
    if (!moveTimerActive || gameOver || isAutonomous) return;
    const interval = setInterval(tickTimer, MOVE_TICK_MS);
    return () => clearInterval(interval);
  }, [moveTimerActive, gameOver, isAutonomous, tickTimer]);

  useEffect(() => {
    if (!isAutonomous || gameOver) return;
    const interval = setInterval(tickAutonomous, AUTONOMOUS_TICK_MS);
    return () => clearInterval(interval);
  }, [isAutonomous, gameOver, tickAutonomous]);

  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(tickModeTimer, MODE_TICK_MS);
    return () => clearInterval(interval);
  }, [gameOver, tickModeTimer]);
}
