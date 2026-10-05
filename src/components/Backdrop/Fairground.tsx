import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import type { TugOfWarPlugin } from "../../plugins/tugOfWar";

const W = 1600;
const H = 900;

const BUNTING = ["#e8402f", "#ffd23f", "#2f6bff", "#ffffff", "#3ec46d"];

/** A string of pennants sagging between two posts */
function Bunting({ from, to, sag }: { from: number; to: number; sag: number }) {
  const mid = (from + to) / 2;
  const y = 70;
  const count = 14;
  const point = (t: number) => {
    const x = from + (to - from) * t;
    return { x, y: y + sag * 4 * t * (1 - t) };
  };
  return (
    <g className="bunting">
      <path
        d={`M${from} ${y} Q${mid} ${y + sag * 2} ${to} ${y}`}
        fill="none"
        stroke="#4a2c14"
        strokeWidth="3"
      />
      {Array.from({ length: count }, (_, i) => {
        const a = point((i + 0.15) / count);
        const b = point((i + 0.85) / count);
        const tip = point((i + 0.5) / count);
        return (
          <path
            key={i}
            className="pennant"
            style={{ animationDelay: `${(i % 5) * -0.3}s` }}
            d={`M${a.x} ${a.y} L${b.x} ${b.y} L${tip.x} ${tip.y + 42} Z`}
            fill={BUNTING[i % BUNTING.length]}
            stroke="#2a1a10"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        );
      })}
    </g>
  );
}

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g className="fair-cloud" transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M0 40 Q-10 10 25 12 Q35 -15 70 0 Q100 -10 110 20 Q135 22 130 42 Z"
        fill="#ffffff"
        stroke="#9ccbe4"
        strokeWidth="3"
      />
    </g>
  );
}

const TEAM_COLORS = {
  blue: ["#2f6bff", "#4d86ff", "#1f4fc9"],
  red: ["#e8402f", "#ff5a48", "#c42c1d"],
};
const INK = "#2a1a10";

/** Seeded so the crowd sits the same way on every render */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** One fan: a pawn in team colors, waving a pennant or pom-poms */
function Fan({
  x,
  y,
  size,
  color,
  team,
  wave,
  delay,
  speed,
}: {
  x: number;
  y: number;
  size: number;
  color: string;
  team: "blue" | "red";
  wave: "pennant" | "pompoms" | "arms";
  delay: number;
  speed: number;
}) {
  const pom = team === "blue" ? "#ffffff" : "#ffd23f";
  return (
    <g transform={`translate(${x} ${y}) scale(${size})`}>
      <g
        className={`fan fan-${wave}`}
        style={{ animationDelay: `${delay}s`, animationDuration: `${speed}s` }}
      >
        {wave === "pennant" && (
          <g className="fan-pennant">
            <path d="M10 -26 L18 -66" stroke={INK} strokeWidth="2.5" />
            <path
              d="M18 -66 L40 -58 L16 -50 Z"
              fill={color}
              stroke={INK}
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
          </g>
        )}
        {wave !== "pennant" && (
          <g
            className="fan-arms"
            stroke={INK}
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="M-9 -24 L-18 -44" />
            <path d="M9 -24 L18 -44" />
          </g>
        )}
        {wave === "pompoms" && (
          <g className="fan-poms" fill={pom} stroke={INK} strokeWidth="2">
            <circle cx="-19" cy="-47" r="7" />
            <circle cx="19" cy="-47" r="7" />
          </g>
        )}
        <path
          d="M-15 0 C-15 -10 -9 -16 -7 -21 L7 -21 C9 -16 15 -10 15 0 Z"
          fill={color}
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <ellipse
          cx="0"
          cy="-21"
          rx="10"
          ry="3.5"
          fill={color}
          stroke={INK}
          strokeWidth="2.2"
        />
        <circle
          cx="0"
          cy="-32"
          r="9"
          fill={color}
          stroke={INK}
          strokeWidth="2.5"
        />
        <circle cx="-3" cy="-35" r="2.6" fill="#fff" fillOpacity="0.55" />
      </g>
    </g>
  );
}

/** Wooden bleachers packed with one team's fans, drawn for the left edge of the screen */
function Bleachers({ team, seed }: { team: "blue" | "red"; seed: number }) {
  const rand = seeded(seed);
  const tiers = [0, 1, 2, 3, 4];
  const fans = tiers.flatMap((tier) =>
    Array.from({ length: 4 }, (_, i) => {
      const colors = TEAM_COLORS[team];
      const roll = rand();
      return {
        key: `${tier}-${i}`,
        x: 26 + i * 52 + tier * 6 + (rand() - 0.5) * 10,
        y: 560 - tier * 78,
        size: 1.05 - tier * 0.07,
        color: colors[Math.floor(rand() * colors.length)],
        wave: (roll < 0.35 ? "pennant" : roll < 0.7 ? "pompoms" : "arms") as
          "pennant" | "pompoms" | "arms",
        delay: -rand() * 2,
        speed: 0.45 + rand() * 0.45,
      };
    }),
  );
  return (
    <svg className="bleacher-art" viewBox="0 0 250 600" aria-hidden>
      {tiers.map((tier) => {
        const y = 560 - tier * 78;
        return (
          <g key={tier}>
            <rect
              x="-10"
              y={y}
              width="270"
              height="78"
              fill={tier % 2 ? "#a86f3c" : "#b97c45"}
            />
            <rect
              x="-10"
              y={y}
              width="270"
              height="10"
              fill="#d49a5c"
              stroke={INK}
              strokeWidth="2.5"
            />
          </g>
        );
      })}
      <rect x="-10" y="560" width="270" height="60" fill="#8a5a2b" />
      {/* Back rows first, so the front rows sit in front of them */}
      {[...fans].reverse().map(({ key, ...fan }) => (
        <Fan key={key} team={team} {...fan} />
      ))}
    </svg>
  );
}

/** Which crowd is on its feet after the latest heave, if any */
function useCheering(): "blue" | "red" | null {
  const heave = useGameStore(
    (s) => s.pluginManager.find<TugOfWarPlugin>("tug-of-war")?.heave ?? 0,
  );
  const dir = useGameStore(
    (s) => s.pluginManager.find<TugOfWarPlugin>("tug-of-war")?.heaveDir ?? 0,
  );
  const [cheer, setCheer] = useState<"blue" | "red" | null>(null);
  useEffect(() => {
    if (heave === 0 || dir === 0) return;
    const team = dir > 0 ? "blue" : "red";
    const timers = [
      setTimeout(() => setCheer(team), 400),
      setTimeout(() => setCheer(null), 2000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [heave, dir]);
  return cheer;
}

/**
 * A sunny sports day: bunting strung across the sky, drifting clouds, striped
 * tents on the grass either side, and hay bales for the spectators
 */
export function Fairground() {
  const cheering = useCheering();
  return (
    <>
      <svg
        className="fairground"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <circle
          cx="1420"
          cy="150"
          r="110"
          fill="#ffe27a"
          className="fair-sun"
        />
        <circle
          cx="1420"
          cy="150"
          r="78"
          fill="#ffd23f"
          stroke="#e8a21c"
          strokeWidth="4"
        />
        <Cloud x={160} y={170} s={1.3} />
        <Cloud x={620} y={110} s={0.9} />
        <Cloud x={1080} y={210} s={1.1} />
        <path
          d="M0 640 Q300 560 620 620 T1200 600 T1600 610 V900 H0 Z"
          fill="#9fd47a"
        />
        {Array.from({ length: 22 }, (_, i) => {
          const x = i * 76 + (i % 3) * 14;
          const y = 616 + Math.sin(i * 1.7) * 14;
          const r = 30 + (i % 4) * 7;
          return (
            <g key={i}>
              <rect x={x - 4} y={y} width="8" height="26" fill="#6b4422" />
              <circle
                cx={x}
                cy={y - r * 0.4}
                r={r}
                fill={i % 2 ? "#4f9a3a" : "#5aa843"}
                stroke="#2f6a26"
                strokeWidth="3"
              />
            </g>
          );
        })}
        <path d="M0 700 Q400 650 800 690 T1600 680 V900 H0 Z" fill="#7cc35a" />
        <path d="M0 770 Q500 730 1000 770 T1600 755 V900 H0 Z" fill="#5fae3a" />
        <Bunting from={-20} to={560} sag={60} />
        <Bunting from={540} to={1080} sag={50} />
        <Bunting from={1060} to={1620} sag={60} />
      </svg>
      <div
        className={`bleachers bleachers-blue${cheering === "blue" ? " cheering" : ""}`}
      >
        <Bleachers team="blue" seed={3} />
      </div>
      <div
        className={`bleachers bleachers-red${cheering === "red" ? " cheering" : ""}`}
      >
        <Bleachers team="red" seed={9} />
      </div>
    </>
  );
}
