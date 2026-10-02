const COLORS = [
  "#ffd23f",
  "#ff4fa3",
  "#3ee6b0",
  "#7ab8ff",
  "#ff8a1a",
  "#c69bff",
  "#ffffff",
];

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** A burst of paper confetti flung out from the center, then falling */
export function Confetti({
  count = 90,
  seed = 1,
  delayMs = 0,
}: {
  count?: number;
  seed?: number;
  delayMs?: number;
}) {
  const rand = seeded(seed);
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const angle = rand() * Math.PI * 2;
        const distance = 25 + rand() * 45;
        return (
          <i
            key={i}
            style={
              {
                "--dx": `${Math.cos(angle) * distance}vw`,
                "--dy": `${Math.sin(angle) * distance * 0.7 - 10}vh`,
                "--fall": `${30 + rand() * 40}vh`,
                "--spin": `${(rand() - 0.5) * 1440}deg`,
                "--w": `${6 + rand() * 8}px`,
                background: COLORS[Math.floor(rand() * COLORS.length)],
                animationDelay: `${delayMs + rand() * 120}ms`,
                animationDuration: `${1600 + rand() * 900}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
