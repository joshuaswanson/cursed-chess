const SPARKLES = [
  { x: 14, y: 20, d: 0 },
  { x: 80, y: 14, d: 0.5 },
  { x: 86, y: 70, d: 1.1 },
  { x: 22, y: 82, d: 0.8 },
  { x: 50, y: 10, d: 1.5 },
  { x: 8, y: 52, d: 0.3 },
  { x: 92, y: 42, d: 1.3 },
  { x: 60, y: 88, d: 0.2 },
];

/**
 * The hill in the middle of the board. Once you control it, with more pieces
 * on it than the foe, it powers up with every round you hold it: a glow, then
 * turning rays and sparkles, then a shine and a blazing crown. Pips under the
 * crown light for each round a side has held it.
 */
export function HillThrone({
  left,
  top,
  leader,
  streak,
}: {
  left: number;
  top: number;
  leader: "white" | "black" | null;
  streak: { white: number; black: number; needed: number };
}) {
  const holding = leader === "black" ? "black" : "white";
  const held = holding === "black" ? streak.black : streak.white;
  // Glows once you control it, and blazes brighter with each round you hold it
  const power = leader === "white" ? Math.min(4, 1 + streak.white) : 0;
  return (
    <>
      <div
        className={
          `hill-throne power-${power}` +
          (leader ? ` held-${leader}` : "") +
          (leader ? " dominated" : "")
        }
        style={
          {
            left: `${left * 12.5}%`,
            top: `${top * 12.5}%`,
            "--power": power / 4,
          } as React.CSSProperties
        }
        aria-hidden
      >
        <span className="hill-rays" />
        <span className="hill-sheen" />
        {SPARKLES.map((s, i) => (
          <span
            key={i}
            className="hill-sparkle"
            style={
              {
                left: `${s.x}%`,
                top: `${s.y}%`,
                animationDelay: `${s.d}s`,
                "--n": i,
              } as React.CSSProperties
            }
          />
        ))}
        <span className="hill-crown" />
      </div>
      <span
        className={`hill-pips pips-${holding}`}
        style={{ left: `${(left + 1) * 12.5}%`, top: `${(top + 2) * 12.5}%` }}
        aria-hidden
      >
        {Array.from({ length: streak.needed }, (_, i) => (
          <i key={i} className={i < held ? "lit" : ""} />
        ))}
      </span>
    </>
  );
}
