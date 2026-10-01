import { useEffect } from "react";
import { useGameStore, GAME_MODES } from "../../stores/gameStore";
import "./GameControls.css";

export function GameControls() {
  const userPaused = useGameStore((s) => s.userPaused);
  const currentModeIndex = useGameStore((s) => s.currentModeIndex);
  const devMode = useGameStore((s) => s.devMode);
  const { newGame, togglePause, switchMode, toggleDevMode } =
    useGameStore.getState();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        toggleDevMode();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleDevMode]);

  return (
    <div className="game-controls">
      <div className="controls-row">
        <button onClick={newGame} className="control-btn" title="Quit & Restart">
          QUIT
        </button>
        <button
          onClick={togglePause}
          className="control-btn"
          title={userPaused ? "Resume" : "Pause"}
        >
          {userPaused ? "▶" : "⏸"}
        </button>
        {currentModeIndex >= 0 && (
          <button
            onClick={() => switchMode()}
            className="control-btn"
            title="Skip Mode"
          >
            &#9197;
          </button>
        )}
        <button
          onClick={toggleDevMode}
          className={`control-btn${devMode ? " active" : ""}`}
          title="Toggle Dev Mode (Ctrl+Shift+D)"
        >
          DEV
        </button>
      </div>
      {devMode && (
        <div className="dev-panel">
          <div className="dev-label">DEV MODE</div>
          <div className="dev-modes">
            {GAME_MODES.map((mode, i) => (
              <button
                key={mode.name}
                onClick={() => switchMode(i)}
                className={`dev-mode-btn${i === currentModeIndex ? " active" : ""}`}
              >
                {mode.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
