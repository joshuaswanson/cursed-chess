import { useGameStore, GAME_MODES } from "../../stores/gameStore";
import "./ModePanel.css";

export function ModePanel() {
  const currentModeIndex = useGameStore((s) => s.currentModeIndex);
  const modeTimeRemaining = useGameStore((s) => s.modeTimeRemaining);
  const scoreWhite = useGameStore((s) => s.scoreWhite);
  const scoreBlack = useGameStore((s) => s.scoreBlack);

  const isNormalChess = currentModeIndex < 0;
  const currentName = isNormalChess
    ? "NORMAL CHESS"
    : GAME_MODES[currentModeIndex].name;
  const nextMode = GAME_MODES[(currentModeIndex + 1) % GAME_MODES.length];

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
        {!isNormalChess && (
          <span className="mode-countdown">{modeTimeRemaining}s</span>
        )}
      </div>
      <div className="mode-next">
        <span className="mode-label">UP NEXT</span>
        <span className="mode-name-next">{nextMode.name}</span>
      </div>
    </div>
  );
}
