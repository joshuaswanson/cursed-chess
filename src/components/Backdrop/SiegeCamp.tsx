import { useGameStore } from "../../stores/gameStore";
import type { SiegePlugin } from "../../plugins/siege";
import { visualCol } from "../Board/boardGeometry";

const W = 1600;
const H = 900;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Keeps the camp out of the middle of the screen, where the board sits */
const nearEdge = (rand: () => number) =>
  rand() < 0.5 ? 30 + rand() * 230 : 640 + rand() * 230;

const TENT_CLOTH = ["#8a3a2a", "#c9b48a", "#6d5a3a", "#a89470"];

/** A square army tent seen from above: four sloped faces meeting at a ridge, two lit and two in shadow */
function Tent({
  x,
  y,
  r,
  cloth,
  turn,
}: {
  x: number;
  y: number;
  r: number;
  cloth: string;
  turn: number;
}) {
  const w = r;
  const h = r * 0.7;
  const ridge = r * 0.45;
  return (
    <g transform={`translate(${x} ${y}) rotate(${turn})`}>
      <rect
        x={-w + 8}
        y={-h + 10}
        width={w * 2}
        height={h * 2}
        fill="#000"
        opacity="0.5"
        filter="url(#camp-soft)"
      />
      <path
        d={`M${-w} ${-h} L${w} ${-h} L${ridge} 0 L${-ridge} 0 Z`}
        fill={cloth}
      />
      <path
        d={`M${-w} ${-h} L${w} ${-h} L${ridge} 0 L${-ridge} 0 Z`}
        fill="#fff"
        opacity="0.18"
      />
      <path
        d={`M${-w} ${h} L${w} ${h} L${ridge} 0 L${-ridge} 0 Z`}
        fill={cloth}
      />
      <path
        d={`M${-w} ${h} L${w} ${h} L${ridge} 0 L${-ridge} 0 Z`}
        fill="#000"
        opacity="0.32"
      />
      <path d={`M${-w} ${-h} L${-ridge} 0 L${-w} ${h} Z`} fill={cloth} />
      <path
        d={`M${-w} ${-h} L${-ridge} 0 L${-w} ${h} Z`}
        fill="#fff"
        opacity="0.08"
      />
      <path d={`M${w} ${-h} L${ridge} 0 L${w} ${h} Z`} fill={cloth} />
      <path
        d={`M${w} ${-h} L${ridge} 0 L${w} ${h} Z`}
        fill="#000"
        opacity="0.45"
      />
      <line
        x1={-ridge}
        y1="0"
        x2={ridge}
        y2="0"
        stroke="#2a1a0c"
        strokeWidth="2.5"
      />
      <rect
        x={-w}
        y={-h}
        width={w * 2}
        height={h * 2}
        fill="none"
        stroke="#1a0f08"
        strokeWidth="1.5"
      />
      {[-w, w].map((cx) =>
        [-h, h].map((cy) => (
          <line
            key={`${cx}${cy}`}
            x1={cx}
            y1={cy}
            x2={cx * 1.25}
            y2={cy * 1.35}
            stroke="#c9b48a"
            strokeWidth="1"
            opacity="0.6"
          />
        )),
      )}
    </g>
  );
}

/** A campfire: crossed logs, flickering flames, and a pool of warm light on the ground */
function Campfire({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle
        r="120"
        fill="url(#camp-firelight)"
        className="fire-glow"
        style={{ animationDelay: `${delay}s` }}
      />
      <circle r="16" fill="#2a1d14" />
      {[0, 60, 120].map((a) => (
        <rect
          key={a}
          x="-16"
          y="-3"
          width="32"
          height="6"
          rx="3"
          fill="#4a2f1a"
          transform={`rotate(${a})`}
        />
      ))}
      <circle
        r="11"
        fill="url(#camp-flame)"
        className="fire-flame"
        style={{ animationDelay: `${delay}s` }}
      />
    </g>
  );
}

/** A catapult seen from above: a timber frame and a throwing arm that swings when it fires */
function Catapult({
  x,
  y,
  facing,
  firing,
}: {
  x: number;
  y: number;
  facing: 1 | -1;
  firing: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${facing} 1)`}>
      <rect
        x="-42"
        y="-34"
        width="84"
        height="68"
        rx="4"
        fill="#000"
        opacity="0.4"
        filter="url(#camp-soft)"
        transform="translate(6 8)"
      />
      <rect
        x="-42"
        y="-30"
        width="10"
        height="60"
        rx="2"
        fill="#6b4524"
        stroke="#24150a"
        strokeWidth="2"
      />
      <rect
        x="32"
        y="-30"
        width="10"
        height="60"
        rx="2"
        fill="#6b4524"
        stroke="#24150a"
        strokeWidth="2"
      />
      <rect
        x="-42"
        y="-34"
        width="84"
        height="10"
        rx="2"
        fill="#7a5130"
        stroke="#24150a"
        strokeWidth="2"
      />
      <rect
        x="-42"
        y="24"
        width="84"
        height="10"
        rx="2"
        fill="#7a5130"
        stroke="#24150a"
        strokeWidth="2"
      />
      <rect
        x="-30"
        y="-4"
        width="60"
        height="8"
        rx="2"
        fill="#4d3018"
        stroke="#24150a"
        strokeWidth="2"
      />
      <g
        key={firing}
        className={firing ? "catapult-arm firing" : "catapult-arm"}
      >
        <rect
          x="-4"
          y="-6"
          width="78"
          height="12"
          rx="4"
          fill="#8a5c34"
          stroke="#24150a"
          strokeWidth="2"
        />
        <circle
          cx="74"
          cy="0"
          r="11"
          fill="#5a3a1e"
          stroke="#24150a"
          strokeWidth="2"
        />
        <circle
          cx="74"
          cy="0"
          r="7"
          fill="#8f877c"
          className="catapult-stone"
        />
      </g>
    </g>
  );
}

/** A tall standard: a pole with a square flag streaming out from it */
function Banner({ x, y, cloth }: { x: number; y: number; cloth: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse
        cx="10"
        cy="8"
        rx="20"
        ry="7"
        fill="#000"
        opacity="0.35"
        filter="url(#camp-soft)"
      />
      <circle r="4.5" fill="#24150a" />
      <g className="banner-cloth">
        <rect
          x="2"
          y="-13"
          width="34"
          height="24"
          fill={cloth}
          stroke="#1a0f08"
          strokeWidth="1.5"
        />
        <path
          d="M36 -13 L46 -13 L40 -1 L46 11 L36 11 Z"
          fill={cloth}
          stroke="#1a0f08"
          strokeWidth="1.5"
        />
        <rect x="2" y="-13" width="34" height="5" fill="#000" opacity="0.2" />
        <circle
          cx="19"
          cy="-1"
          r="5"
          fill="#e8c56a"
          stroke="#1a0f08"
          strokeWidth="1"
        />
      </g>
    </g>
  );
}

/**
 * The besieging army's camp at night, seen from above: scorched earth, tents,
 * campfires, banners, and a catapult on each side that swings when it fires.
 */
export function SiegeCamp() {
  const boulder = useGameStore(
    (s) => s.pluginManager.find<SiegePlugin>("siege")?.lastBoulder ?? null,
  );
  const flipped = useGameStore((s) => s.flipped);
  const fromLeft = boulder ? visualCol(boulder.target, flipped) < 4 : null;

  const rand = seeded(41);
  const tents = Array.from({ length: 18 }, () => {
    const left = rand() < 0.5;
    return {
      x: left ? 40 + rand() * 170 : W - 40 - rand() * 170,
      y: nearEdge(rand),
      r: 26 + rand() * 14,
      cloth: TENT_CLOTH[Math.floor(rand() * TENT_CLOTH.length)],
      turn: (rand() - 0.5) * 40,
    };
  });
  const fires = Array.from({ length: 6 }, (_, i) => ({
    x: i % 2 ? W - 150 - rand() * 120 : 150 + rand() * 120,
    y: nearEdge(rand),
    delay: rand() * 2,
  }));
  const banners = Array.from({ length: 6 }, (_, i) => ({
    x: i % 2 ? W - 60 - rand() * 200 : 60 + rand() * 200,
    y: nearEdge(rand),
    cloth: i % 3 ? "#a02a28" : "#e8d9b4",
  }));

  return (
    <svg
      className="siege-camp"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <filter id="camp-ground" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.02"
            numOctaves="4"
            seed="7"
          />
          <feColorMatrix
            values="0 0 0 0 0.16
                    0 0 0 0 0.11
                    0 0 0 0 0.07
                    0 0 0 -1.4 1.0"
          />
        </filter>
        <filter id="camp-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <radialGradient id="camp-cone" cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.25" />
          <stop offset="0.6" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.45" />
        </radialGradient>
        <radialGradient id="camp-firelight">
          <stop offset="0" stopColor="#ffb347" stopOpacity="0.55" />
          <stop offset="0.4" stopColor="#ff7a1a" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ff5a00" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="camp-flame">
          <stop offset="0" stopColor="#fff6c8" />
          <stop offset="0.45" stopColor="#ffb03a" />
          <stop offset="1" stopColor="#d4400e" />
        </radialGradient>
        <radialGradient id="camp-night" cx="0.5" cy="0.45" r="0.75">
          <stop offset="0.45" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#03030a" stopOpacity="0.75" />
        </radialGradient>
      </defs>

      <rect width={W} height={H} fill="#2a2018" />
      <rect width={W} height={H} filter="url(#camp-ground)" />
      {fires.map((f, i) => (
        <Campfire key={i} {...f} />
      ))}
      {tents.map((t, i) => (
        <Tent key={i} {...t} />
      ))}
      {banners.map((b, i) => (
        <Banner key={i} {...b} />
      ))}
      <Catapult
        x={110}
        y={450}
        facing={1}
        firing={fromLeft === true ? boulder!.id : 0}
      />
      <Catapult
        x={W - 110}
        y={450}
        facing={-1}
        firing={fromLeft === false ? boulder!.id : 0}
      />
      <rect width={W} height={H} fill="url(#camp-night)" />
    </svg>
  );
}
