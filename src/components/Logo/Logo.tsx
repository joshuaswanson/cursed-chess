import "./Logo.css";

const LETTER_COLORS = [
  "#ffd23f",
  "#ff4fa3",
  "#3ee6b0",
  "#7ab8ff",
  "#ff8a1a",
  "#c69bff",
];

/** CURSED in jittering party stickers, CHESS in shaded block letters */
export function Logo() {
  return (
    <div className="logo" aria-label="Cursed Chess">
      <span className="logo-word" aria-hidden>
        {"CURSED".split("").map((letter, i) => (
          <span
            key={i}
            className="logo-letter"
            style={
              {
                "--letter-color": LETTER_COLORS[i % LETTER_COLORS.length],
                "--tilt": `${(i % 2 ? 1 : -1) * (4 + (i % 3) * 2)}deg`,
                "--delay": `${-i * 0.37}s`,
              } as React.CSSProperties
            }
          >
            {letter}
          </span>
        ))}
      </span>
      <span className="logo-chess" aria-hidden>
        CHESS
      </span>
    </div>
  );
}
