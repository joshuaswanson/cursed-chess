import { useEffect } from "react";
import { WIN_LINE } from "../../plugins/tugOfWar";
import type { TugView } from "../../plugins/tugOfWar";
import { sfx } from "../../audio/sfx";
import { ROPE_TILE } from "./ropeTexture";
import "./TugOfWar.css";

type Style = React.CSSProperties & Record<`--${string}`, string | number>;

/** The pennant's outline at the two ends of its ripple, flying off the rope to a point on the right */
const FLAG_WAVES = [
  "M9 4 C26 9 44 13 68 20 C44 26 26 31 9 36 Z",
  "M9 4 C24 12 46 9 68 21 C46 25 28 36 9 36 Z",
];
/** A white stripe running out to the point, rippling with the cloth */
const FLAG_STRIPE = [
  "M9 16 C28 18 46 19 62 20.2 C46 21.4 28 22.4 9 24 Z",
  "M9 16 C26 20 46 17 62 21 C46 22 30 25 9 24 Z",
];
/** Shadowed folds running across the cloth */
const FLAG_FOLDS = [
  "M27 9 C28 17 26 24 27 31 M45 13 C46 18 44 23 45 27",
  "M25 11 C23 18 27 25 25 32 M43 12 C45 17 41 23 44 28",
];

/** The rope's width inside the coil's 100-unit-wide drawing, matching the rope beside it */
const COIL_ROPE = 12.6;
const STRAND_TONES = ["#c9a066", "#b88d52", "#d6b077"];

/**
 * The centerline of a pile of rope lying on the ground, drawn for the bottom
 * end: the rope drops in from the top, then winds round in uneven loops that
 * tighten toward the middle, squashed because the pile lies flat
 */
function coilPath(): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let y = -10; y < 6; y += 1) points.push({ x: 50, y });
  const turns = 2.4;
  const steps = 260;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = -Math.PI / 2 + t * turns * Math.PI * 2;
    const wobble =
      1 + 0.07 * Math.sin(theta * 3 + 1) + 0.05 * Math.sin(theta * 5);
    const r = (1 - 0.62 * t) * wobble;
    points.push({
      x: 50 + Math.cos(theta) * 40 * r,
      y: 31 + Math.sin(theta) * 25 * r,
    });
  }
  return points;
}

/** Strand lobes spaced evenly along the coil, each turned to follow it */
function coilLobes() {
  const path = coilPath();
  const spacing = COIL_ROPE * 0.5;
  const lobes: {
    x: number;
    y: number;
    angle: number;
    tone: string;
    shade: number;
  }[] = [];
  let carried = 0;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    carried += length;
    if (carried < spacing) continue;
    carried = 0;
    const heading = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    lobes.push({
      x: b.x,
      y: b.y,
      // The rope's lobes lean 38 degrees off its length
      angle: heading - 90 - 38,
      tone: STRAND_TONES[lobes.length % STRAND_TONES.length],
      // Loops lower in the pile sit in shadow
      shade: 0.3 * (1 - i / path.length),
    });
  }
  return lobes;
}

const COIL_LOBES = coilLobes();

/** A loose coil of rope, made of the same twisted strands as the rope it ends */
function Coil({ end }: { end: "top" | "bottom" }) {
  const rx = COIL_ROPE * 0.53;
  const ry = COIL_ROPE * 0.31;
  return (
    <svg className={`tug-coil coil-${end}`} viewBox="0 -12 100 72" aria-hidden>
      <defs>
        <linearGradient id={`coil-hl-${end}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {COIL_LOBES.map((lobe, i) => (
        <g
          key={i}
          transform={`translate(${lobe.x.toFixed(2)} ${lobe.y.toFixed(2)}) rotate(${lobe.angle.toFixed(1)})`}
        >
          <ellipse
            rx={rx}
            ry={ry}
            fill={lobe.tone}
            stroke="#4a2c12"
            strokeWidth="0.75"
          />
          <ellipse rx={rx} ry={ry} fill={`url(#coil-hl-${end})`} />
          <ellipse rx={rx} ry={ry} fill="#1a0e04" fillOpacity={lobe.shade} />
          <path
            d={`M${-rx * 0.6} ${-ry * 0.1} Q0 ${-ry * 0.45} ${rx * 0.6} ${-ry * 0.1}`}
            fill="none"
            stroke="#f3dcae"
            strokeWidth="0.45"
            strokeOpacity="0.75"
          />
        </g>
      ))}
    </svg>
  );
}

/** Seeded so the pit looks the same on every render */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** An irregular blob of `points` around a center, for the pit and its wet middle */
function blob(cx: number, cy: number, rx: number, ry: number, seed: number) {
  const rand = seeded(seed);
  const n = 14;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = 0.82 + rand() * 0.3;
    return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r];
  });
  // A smooth closed curve through the points
  let d = `M${((pts[0][0] + pts[n - 1][0]) / 2).toFixed(1)} ${((pts[0][1] + pts[n - 1][1]) / 2).toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[(i + 1) % n];
    d += ` Q${x.toFixed(1)} ${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)} ${((y + ny) / 2).toFixed(1)}`;
  }
  return `${d} Z`;
}

const MUD_LIP = blob(250, 100, 236, 86, 11);
const MUD_BOWL = blob(250, 104, 196, 66, 23);
const MUD_PUDDLE = blob(258, 110, 104, 30, 37);
const MUD_SPLATTER = (() => {
  const rand = seeded(5);
  return Array.from({ length: 14 }, () => {
    const a = rand() * Math.PI * 2;
    const reach = 1.04 + rand() * 0.16;
    return {
      x: 250 + Math.cos(a) * 236 * reach,
      y: 100 + Math.sin(a) * 86 * reach,
      r: 2 + rand() * 4,
    };
  });
})();
const MUD_CLODS = [
  { x: 120, y: 92, r: 9 },
  { x: 372, y: 124, r: 7 },
  { x: 330, y: 70, r: 5 },
];

/**
 * A pit of mud sunk into the arena where the halves meet: a raised lip of
 * drier mud lit along its top, a dark wet bowl, and a puddle in the middle
 * reflecting the sky
 */
function MudPit() {
  return (
    <svg className="tug-mud" viewBox="0 0 500 200" aria-hidden>
      <defs>
        <linearGradient id="mud-lip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a17a48" />
          <stop offset="1" stopColor="#7a5530" />
        </linearGradient>
        <linearGradient id="mud-bowl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3e2510" />
          <stop offset="0.45" stopColor="#5a3818" />
          <stop offset="1" stopColor="#6b4422" />
        </linearGradient>
        <linearGradient id="mud-puddle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6f7f7a" />
          <stop offset="1" stopColor="#3e3a2a" />
        </linearGradient>
      </defs>
      {MUD_SPLATTER.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#7a5530" />
      ))}
      <path d={MUD_LIP} fill="url(#mud-lip)" stroke="#4a2c12" strokeWidth="3" />
      <path d={MUD_BOWL} fill="url(#mud-bowl)" />
      <path d={MUD_PUDDLE} fill="url(#mud-puddle)" />
      <ellipse className="mud-ripple" cx="240" cy="108" rx="30" ry="8" />
      <path
        d="M196 100 Q240 92 290 98"
        stroke="#cfe6ee"
        strokeOpacity="0.55"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      {MUD_CLODS.map((c, i) => (
        <g key={i}>
          <circle
            cx={c.x}
            cy={c.y + 2}
            r={c.r}
            fill="#2e1a08"
            fillOpacity="0.5"
          />
          <circle
            cx={c.x}
            cy={c.y}
            r={c.r}
            fill="#7a5530"
            stroke="#3e2510"
            strokeWidth="1.5"
          />
          <circle
            cx={c.x - c.r * 0.3}
            cy={c.y - c.r * 0.35}
            r={c.r * 0.35}
            fill="#b08a58"
          />
        </g>
      ))}
    </svg>
  );
}

const STRUGGLE = new Set([
  "tug-surge",
  "tug-stretch",
  "tug-lean-white",
  "tug-lean-black",
]);

/** How far down the board, in squares, a spot `toWhite` squares from the center line toward White sits */
const fromTop = (toWhite: number, flipped: boolean) =>
  4 + (flipped ? -toWhite : toWhite);

/**
 * The tug of war: a rope up the middle of the board with the flag tied on it,
 * a mud pit at the center line, and chalk win lines three squares into each
 * half. Every heave yanks the rope and slides the flag toward the stronger side.
 */
export function TugLayer({
  view,
  flipped,
}: {
  view: TugView;
  flipped: boolean;
}) {
  useEffect(() => {
    if (view.heave > 0) sfx.heave();
  }, [view.heave]);

  // A piece that steps onto the rope joins the struggle mid-cycle, in step
  // with the rope and everyone else on it, by sharing one clock with them
  useEffect(() => {
    for (const animation of document.getAnimations()) {
      if (
        animation instanceof CSSAnimation &&
        STRUGGLE.has(animation.animationName) &&
        animation.startTime !== 0
      ) {
        animation.startTime = 0;
      }
    }
  });

  const flagTop = fromTop(view.flag, flipped);
  // Which way the last heave went on screen: down is positive
  const yank = view.heaveDir * (flipped ? -1 : 1);
  const lines = [
    { toWhite: WIN_LINE, team: "white" },
    { toWhite: -WIN_LINE, team: "black" },
  ];

  // The struggle only plays out when both teams have someone on the rope
  const contested = view.white > 0 && view.black > 0;

  return (
    <>
      <div className="tug-layer" aria-hidden>
        <MudPit />
        <span className="tug-center-line" />
        {lines.map(({ toWhite, team }) => (
          <span
            key={team}
            className={`tug-win-line win-${team}`}
            style={{ top: `${fromTop(toWhite, flipped) * 12.5}%` }}
          >
            <span className="tug-win-label">
              {team === "white" ? "Your win line" : "Their win line"}
            </span>
          </span>
        ))}
      </div>
      <div
        className={`tug-layer tug-rope-layer${contested ? " contested" : ""}`}
        aria-hidden
      >
        <div
          key={view.heave}
          className={`tug-rope-wrap${view.heave > 0 ? " heaving" : ""}`}
          style={{ "--yank": yank } as Style}
        >
          <Coil end="top" />
          <Coil end="bottom" />
          <div className="tug-rope" style={{ "--rope": ROPE_TILE } as Style} />
        </div>
        <div className="tug-flag" style={{ top: `${flagTop * 12.5}%` }}>
          <div
            key={view.heave}
            className={`tug-flag-body${view.heave > 0 ? " heaving" : ""}`}
            style={{ "--yank": yank } as Style}
          >
            <svg viewBox="0 0 70 44" className="tug-flag-cloth">
              {/* The cloth ripples between two shapes as it flies off the rope */}
              <path
                d={FLAG_WAVES[0]}
                fill="#e8402f"
                stroke="#2a1a10"
                strokeWidth="2.4"
                strokeLinejoin="round"
              >
                <animate
                  attributeName="d"
                  values={`${FLAG_WAVES[0]};${FLAG_WAVES[1]};${FLAG_WAVES[0]}`}
                  dur="1.1s"
                  repeatCount="indefinite"
                />
              </path>
              <path d={FLAG_STRIPE[0]} fill="#ffffff">
                <animate
                  attributeName="d"
                  values={`${FLAG_STRIPE[0]};${FLAG_STRIPE[1]};${FLAG_STRIPE[0]}`}
                  dur="1.1s"
                  repeatCount="indefinite"
                />
              </path>
              <path
                d={FLAG_FOLDS[0]}
                fill="none"
                stroke="#000"
                strokeOpacity="0.22"
                strokeWidth="3"
              >
                <animate
                  attributeName="d"
                  values={`${FLAG_FOLDS[0]};${FLAG_FOLDS[1]};${FLAG_FOLDS[0]}`}
                  dur="1.1s"
                  repeatCount="indefinite"
                />
              </path>
              {[8, 32].map((y) => (
                <g key={y}>
                  <ellipse
                    cx="9"
                    cy={y}
                    rx="7"
                    ry="3.4"
                    fill="#e8402f"
                    stroke="#2a1a10"
                    strokeWidth="2"
                  />
                  <path
                    d={`M9 ${y} l-4 6 M9 ${y} l3 6`}
                    stroke="#2a1a10"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </g>
              ))}
            </svg>
            <span className="tug-score">
              <b className="you">{view.white}</b> vs{" "}
              <b className="foe">{view.black}</b>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
