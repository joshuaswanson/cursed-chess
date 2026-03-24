import { useEffect } from "react";
import { useGameStore, GAME_MODES } from "../../stores/gameStore";
import "./GameControls.css";

export function GameControls() {
  const {
    newGame,
    togglePause,
    paused,
    currentModeIndex,
    switchMode,
    devMode,
  } = useGameStore();

  // Start with normal chess on mount
  useEffect(() => {
    newGame();
  }, [newGame]);

  // Toggle dev mode with Ctrl+Shift+D
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        useGameStore.setState((s) => ({ devMode: !s.devMode }));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
          title="Quit & Restart"
        >
          QUIT
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
        <button
          onClick={() =>
            useGameStore.setState((s) => ({ devMode: !s.devMode }))
          }
          className={`control-btn${devMode ? " active" : ""}`}
          title="Toggle Dev Mode"
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
                onClick={() => {
                  useGameStore.setState({ currentModeIndex: i - 1 });
                  useGameStore.getState().switchMode();
                }}
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
