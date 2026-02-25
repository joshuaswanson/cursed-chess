import { useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import { Color, GameStatus } from "../../engine";
import { PortalChessPlugin } from "../../plugins/portalChess";
import "./GameControls.css";

function statusText(status: GameStatus, turn: Color): string {
  switch (status) {
    case GameStatus.Active:
    case GameStatus.Check:
      return `${turn === Color.White ? "White" : "Black"} to move${status === GameStatus.Check ? " (Check!)" : ""}`;
    case GameStatus.Checkmate:
      return `Checkmate! ${turn === Color.White ? "Black" : "White"} wins!`;
    case GameStatus.Stalemate:
      return "Stalemate - Draw!";
    case GameStatus.DrawFiftyMove:
      return "Draw by fifty-move rule";
    case GameStatus.DrawInsufficientMaterial:
      return "Draw by insufficient material";
    default:
      return "";
  }
}

function startPortalGame() {
  const { newGame, showAnnouncement } = useGameStore.getState();
  newGame(undefined, [new PortalChessPlugin()]);
  showAnnouncement("PORTAL CHESS");
}

export function GameControls() {
  const { status, turn, undoMove, flipBoard, moveHistory } = useGameStore();

  // Start first game on mount
  useEffect(() => {
    startPortalGame();
  }, []);

  const isGameOver =
    status === GameStatus.Checkmate ||
    status === GameStatus.Stalemate ||
    status === GameStatus.DrawFiftyMove ||
    status === GameStatus.DrawInsufficientMaterial;

  return (
    <div className="game-controls">
      <div
        className={`status-text ${isGameOver ? "game-over" : ""} ${status === GameStatus.Check ? "in-check" : ""}`}
      >
        {statusText(status, turn)}
      </div>
      <div className="controls-row">
        <button onClick={startPortalGame} className="control-btn">
          New Game
        </button>
        <button
          onClick={undoMove}
          disabled={moveHistory.length === 0}
          className="control-btn"
        >
          Undo
        </button>
        <button onClick={flipBoard} className="control-btn">
          Flip
        </button>
      </div>
    </div>
  );
}
