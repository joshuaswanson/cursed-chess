import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import type { FinalePlugin } from "../../plugins/finale";
import "./DevNote.css";

/** How often the bar catches up with the deletion */
const POLL_MS = 200;

/** Stephen's deletion of Chessbot, filling up through the final battle */
export function DeleteBar() {
  const done = useGameStore((s) => s.finaleStage === "deleting");
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const finale = useGameStore
        .getState()
        .pluginManager.find<FinalePlugin>("finale");
      if (finale) setProgress(finale.progress);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, []);
  const shown = done ? 1 : progress;
  const percent = Math.floor(shown * 100);
  return (
    <div
      className={`dev-note delete-bar${done ? " is-done" : ""}`}
      role="progressbar"
      aria-label="Deleting Chessbot"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="dev-note-head">
        <span className="dev-note-avatar" aria-hidden>
          S
        </span>
        <span className="dev-note-from">
          <b>Stephen</b>
          <small>Site Support</small>
        </span>
        <span className="delete-percent">{percent}%</span>
      </div>
      <p className="dev-note-text">
        {done ? "Deleting chessbot.exe... done!" : "Deleting chessbot.exe..."}
      </p>
      <div className="delete-track">
        <div className="delete-fill" style={{ scale: `${shown} 1` }} />
      </div>
    </div>
  );
}
