import { useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import "./GameControls.css";

export function GameControls() {
  const { newGame, togglePause, paused, currentModeIndex, switchMode } =
    useGameStore();

  // Start with normal chess on mount
  useEffect(() => {
    newGame();
  }, [newGame]);

  return (
    <div className="game-controls">
      <div className="controls-row">
        <button
          onClick={() => {
            useGameStore.setState({
              currentModeIndex: -1,
              scoreWhite: 0,
              scoreBlack: 0,
            });
            newGame();
          }}
          className="control-btn"
          title="New Game"
        >
          &#8635;
        </button>
        <button
          onClick={togglePause}
          className="control-btn"
          title={paused ? "Resume" : "Pause"}
        >
          {paused ? "\u25B6" : "\u23F8"}
        </button>
        {currentModeIndex >= 0 && (
          <button
            onClick={switchMode}
            className="control-btn"
            title="Skip Mode"
          >
            &#9197;
          </button>
        )}
      </div>
    </div>
  );
}
