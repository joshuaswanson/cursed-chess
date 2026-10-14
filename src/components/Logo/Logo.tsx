import { Chessbot } from "../Chessbot/Chessbot";
import "./Logo.css";

/**
 * CURSED as a leaning, glitching gradient wordmark; CHESS in plain block
 * letters with the same outline and shadow, and Chessbot perched on its end
 */
export function Logo() {
  return (
    <div className="logo" aria-label="Cursed Chess">
      <span className="logo-cursed" data-text="CURSED" aria-hidden>
        CURSED
      </span>
      <span className="logo-chess" aria-hidden>
        CHESS
        <span className="logo-bot">
          <Chessbot mood="smug" grounded={false} />
        </span>
      </span>
    </div>
  );
}
