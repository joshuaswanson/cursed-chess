import { useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import "./GameControls.css";

export function GameControls() {
  const { newGame, togglePause, paused } = useGameStore();

  // Start with normal chess on mount
  useEffect(() => {
    newGame();
  }, [newGame]);

  return (
    <div className="game-controls">
      <div className="controls-row">
        <button onClick={togglePause} className="control-btn">
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
    </div>
  );
}
