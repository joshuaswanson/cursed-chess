import { useGameStore, GAME_MODES } from "../../stores/gameStore";
import "./ModePanel.css";

export function ModePanel() {
  const { currentModeIndex, modeTimeRemaining, scoreWhite, scoreBlack } =
    useGameStore();

  // -1 = Normal Chess (initial mode, not in GAME_MODES)
  const isNormalChess = currentModeIndex < 0;
  const currentName = isNormalChess
    ? "NORMAL CHESS"
    : GAME_MODES[currentModeIndex].name;
  const nextIndex = isNormalChess
    ? 0
    : (currentModeIndex + 1) % GAME_MODES.length;
  const nextMode = GAME_MODES[nextIndex];

  return (
    <div className="mode-panel">
      <div className="scoreboard">
        <div className="score-player">
          <span className="score-label">YOU</span>
          <span className="score-value">{scoreWhite}</span>
        </div>
        <span className="score-divider">-</span>
        <div className="score-player">
          <span className="score-value">{scoreBlack}</span>
          <span className="score-label">FOE</span>
        </div>
      </div>
      <div className="mode-current">
        <span className="mode-label">NOW PLAYING</span>
        <span className="mode-name">{currentName}</span>
        <span className="mode-countdown">{modeTimeRemaining}s</span>
      </div>
      <div className="mode-next">
        <span className="mode-label">UP NEXT</span>
        <span className="mode-name-next">{nextMode.name}</span>
      </div>
    </div>
  );
}
