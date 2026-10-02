import "./Logo.css";

/** CURSED as a leaning, glitching gradient wordmark; CHESS in shaded block letters */
export function Logo() {
  return (
    <div className="logo" aria-label="Cursed Chess">
      <span className="logo-cursed" data-text="CURSED" aria-hidden>
        CURSED
      </span>
      <span className="logo-chess" aria-hidden>
        CHESS
      </span>
    </div>
  );
}
