import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { ThemeId } from "../../theme/themes";
import { PieceType } from "../../engine";
import type { Color, Piece as ChessPiece } from "../../engine";
import type { Strike } from "../../plugins/thunderstorm";
import {
  artworkLoaded,
  themedPieceImage,
  zombieImage,
} from "../../utils/pieceImages";
import { SoccerBall } from "../Board/Football";
import { LanternIcon } from "../Board/Lanterns";
import { Jewel } from "../Board/Heist";
import { Chessbot } from "../Chessbot/Chessbot";
import { MineBlast } from "../Board/MineBlast";
import { Portal } from "../Board/Portal";
import { Tombstone } from "../Board/Zombies";
import { StormBolt, StormScars } from "../Board/Thunderstorm";
import { BOLT_MS, drawBolt, renderBolt } from "../Board/boltCanvas";
import type { Bolt } from "../Board/boltCanvas";
import { lightningAt } from "../Board/lightning";
import { boltStrokes, seededRandom } from "../Board/lightningShapes";
import { toIndex } from "../../utils/squareUtils";
import "./ModePreview.css";

/** The mode a scene belongs to, so its pieces come in that mode's colours */
const SceneTheme = createContext<ThemeId | null>(null);

/** A piece standing in a scene, placed by its middle in percent of the scene */
function Piece({
  is,
  x,
  y,
  size = 26,
  className = "",
  src,
  style,
  children,
}: {
  /** Colour and kind, as in the artwork's file names: wN, bQ */
  is: string;
  x: number;
  y: number;
  size?: number;
  className?: string;
  /** Artwork of its own, in place of the plain piece */
  src?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const theme = useContext(SceneTheme) ?? "opening";
  return (
    <span
      className={`pv-piece ${className}`}
      style={{ left: `${x}%`, top: `${y}%`, width: `${size}%`, ...style }}
    >
      <img src={src ?? themedPieceImage(is, theme)} alt="" draggable={false} />
      {children}
    </span>
  );
}

/**
 * One belt and its pieces, two scene widths long, so the pieces carried off
 * one edge come back round from the other. A full run moves it one scene
 * width, which brings the same pieces back to where they started.
 */
function BeltLane({
  pieces,
  y,
  way,
}: {
  pieces: string[];
  y: number;
  way: "right" | "left";
}) {
  const spacing = 100 / pieces.length;
  return (
    <span className={`pv-lane pv-lane-${way}`}>
      <span className="pv-belt" style={{ top: `${y - 13}%` }} />
      {[...pieces, ...pieces].map((is, i) => (
        <Piece
          key={i}
          is={is}
          x={(spacing / 2 + spacing * i) / 2}
          y={y}
          size={10}
        />
      ))}
    </span>
  );
}

/**
 * A piece built to jump: it travels across on the outside, rises and falls
 * inside that, and spins inside that again, so each can keep its own pace
 * through a jump. Its shadow stays on the ground.
 */
function Flipper({
  is,
  x,
  y,
  size,
  className,
}: {
  is: string;
  x: number;
  y: number;
  size: number;
  className: string;
}) {
  const theme = useContext(SceneTheme) ?? "opening";
  return (
    <span
      className={`pv-piece pv-flipper ${className}`}
      style={{ left: `${x}%`, top: `${y}%`, width: `${size}%` }}
    >
      <span className="pv-flip-shadow" />
      <span className="pv-flip-rise">
        <span className="pv-flip-spin">
          <img src={themedPieceImage(is, theme)} alt="" draggable={false} />
        </span>
      </span>
    </span>
  );
}

/** How long the minefield scene runs before it starts over, and when in it the pawn reaches the mine */
const MINE_LOOP_MS = 4000;
const MINE_STEP_MS = 1900;

/**
 * A pawn walks in from the side onto a mine and the game's own blast goes off under it:
 * fireball, sparks, flying dirt, shockwave, and smoke, with the pawn
 * thrown clear. Played again and again while the card is on screen.
 */
function MineScene() {
  const ref = useRef<HTMLSpanElement>(null);
  const [run, setRun] = useState({ n: 0, blown: false, square: 0 });

  useEffect(() => {
    let step: number;
    const start = () => {
      const scene = ref.current;
      // Off screen there is nobody to blow up for
      if (!scene?.closest(".in-view")) return;
      const square = scene.clientWidth * 0.22;
      setRun((r) => ({ n: r.n + 1, blown: false, square }));
      step = window.setTimeout(
        () => setRun((r) => ({ ...r, blown: true })),
        MINE_STEP_MS,
      );
    };
    const first = window.setTimeout(start, 300);
    const loop = window.setInterval(start, MINE_LOOP_MS);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(step);
      window.clearInterval(loop);
    };
  }, []);

  return (
    <span ref={ref} className="pv-minefield">
      {/* Each warning sits in a square of its own beside the mine */}
      <span className="pv-warning" style={{ left: "56.25%", top: "37.5%" }}>
        1
      </span>
      <span className="pv-warning" style={{ left: "81.25%", top: "37.5%" }}>
        1
      </span>
      <span className="pv-warning" style={{ left: "81.25%", top: "87.5%" }}>
        2
      </span>
      {run.n > 0 && !run.blown && (
        <Piece
          key={run.n}
          is="wP"
          x={-6.25}
          y={60}
          size={20}
          className="pv-steps-on"
        />
      )}
      {run.blown && (
        <span key={run.n} className="pv-minefield">
          <span className="pv-mine-spot">
            <MineBlast col={0} row={0} squareSize={run.square} />
          </span>
          <Piece
            is="wP"
            x={68.75}
            y={60}
            size={20}
            className="pv-thrown"
            style={
              {
                "--fly-x": `${run.square * 1.6}px`,
                "--fly-y": `${-run.square * 3}px`,
              } as CSSProperties
            }
          />
        </span>
      )}
    </span>
  );
}

/** How long the storm scene runs before it starts over */
const STORM_LOOP_MS = 5600;
/** Where each run's bolts come down, and when: two in quick succession onto empty squares, then one onto the knight */
const STORM_BOLTS = [
  { at: 600, file: 3, rank: 3 },
  { at: 1100, file: 6, rank: 3 },
  { at: 3000, file: 4, rank: 4 },
];
/** The pieces on the four ranks of the board the scene shows, by file and rank */
const STORM_PIECES: [is: string, file: number, rank: number][] = [
  ["bR", 1, 3],
  ["wB", 2, 4],
  ["bP", 3, 2],
  ["bN", 4, 4],
  ["wP", 5, 3],
  ["bP", 5, 5],
  ["wQ", 6, 2],
];
/** How long the current runs through the pieces next to a bolt */
const STORM_SHOCK_MS = 2000;
/** About how wide the game's board is, which the bolts are drawn to and then shrunk from */
const GAME_BOARD_PX = 560;

const pieceOf = (is: string): ChessPiece => ({
  color: is[0] as Color,
  type: is[1].toLowerCase() as ChessPiece["type"],
});
const stormImage = (piece: ChessPiece) =>
  themedPieceImage(`${piece.color}${piece.type.toUpperCase()}`, "storm");
const placeKey = (file: number, rank: number) => `${file},${rank}`;

/**
 * The game's own storm, on the middle four ranks of its board: dark and
 * rain, then a bolt onto an empty square and another straight after, each
 * lighting the board, scorching it, and running its current through the
 * pieces beside it, and then a bolt that hits the knight and blows it apart
 */
function StormScene() {
  const scene = useRef<HTMLSpanElement>(null);
  const dark = useRef<HTMLSpanElement>(null);
  const sky = useRef<HTMLCanvasElement>(null);
  const [strikes, setStrikes] = useState<Strike[]>([]);
  /** The pieces shown by the current running through them, or gone */
  const [hidden, setHidden] = useState<string[]>([]);

  useEffect(() => {
    const canvas = sky.current;
    const ctx = canvas?.getContext("2d");
    const el = scene.current;
    if (!canvas || !ctx || !el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) =>
      timers.push(window.setTimeout(fn, ms));
    let bolts: Bolt[] = [];
    let struckAt = -Infinity;
    let ids = 0;
    let drops: { x: number; y: number; near: number }[] = [];

    const shake = (strength: number) => {
      if (still) return;
      el.animate(
        Array.from({ length: 11 }, (_, i) => {
          const left = i === 10 ? 0 : strength * (1 - i / 10) ** 1.6;
          return {
            translate: `${(Math.random() - 0.5) * 2 * left}px ${(Math.random() - 0.5) * 2 * left}px`,
          };
        }),
        { duration: 520, easing: "linear" },
      );
    };

    const strike = (file: number, rank: number) => {
      const sq = toIndex(file, rank);
      const victim = STORM_PIECES.find(([, f, r]) => f === file && r === rank);
      const beside = STORM_PIECES.filter(
        ([, f, r]) =>
          (f !== file || r !== rank) &&
          Math.abs(f - file) <= 1 &&
          Math.abs(r - rank) <= 1,
      );
      const hit: Strike = {
        id: ++ids,
        sq,
        killed: victim ? pieceOf(victim[0]) : null,
        shocked: beside.map(([is, f, r]) => ({
          sq: toIndex(f, r),
          piece: pieceOf(is),
        })),
      };
      const shockedKeys = beside.map(([, f, r]) => placeKey(f, r));
      setStrikes((s) => [...s, hit].slice(-4));
      setHidden((h) => [
        ...h,
        ...shockedKeys,
        ...(victim ? [placeKey(file, rank)] : []),
      ]);
      later(
        () => setHidden((h) => h.filter((key) => !shockedKeys.includes(key))),
        STORM_SHOCK_MS,
      );

      // Laid out as on the game's board, and shrunk to the card
      const width = canvas.clientWidth;
      const k = GAME_BOARD_PX / width;
      const target: [number, number] = [
        ((file + 0.5) / 8) * width * k,
        ((7 - rank + 0.5) / 8 - 0.25) * width * k,
      ];
      const rand = seededRandom(ids * 131 + sq);
      struckAt = performance.now();
      bolts.push(
        renderBolt(
          boltStrokes(rand, [target[0] + (rand() - 0.5) * 420, -30], target),
          target,
          struckAt,
          Math.min(2, window.devicePixelRatio || 1) / k,
        ),
      );
      shake(victim ? 6 : 3);
      if (victim) later(() => shake(5), 880);
    };

    const run = () => {
      // Off screen nobody is watching, so it waits to come into view
      if (!el.closest(".in-view")) {
        later(run, 400);
        return;
      }
      setHidden([]);
      for (const { at, file, rank } of STORM_BOLTS) {
        later(() => strike(file, rank), at);
      }
      later(run, STORM_LOOP_MS);
    };
    later(run, 300);

    let frame = 0;
    let last = performance.now();
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const dt = Math.min(50, now - last) / 1000;
      last = now;
      if (!el.closest(".in-view")) return;
      const scale = Math.min(2, window.devicePixelRatio || 1);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.round(width * scale)) {
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        drops = Array.from(
          { length: Math.round((width * height) / 260) },
          () => ({
            x: Math.random() * width * 1.3 - width * 0.15,
            y: Math.random() * height,
            near: Math.random() ** 1.8,
          }),
        );
      }
      const light = lightningAt(now - struckAt);
      if (dark.current) dark.current.style.opacity = String(1 - light);

      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = "round";
      const wind = 0.22 + 0.06 * Math.sin(now / 1700);
      for (const [lo, hi] of [
        [0, 0.35],
        [0.35, 0.7],
        [0.7, 1.01],
      ]) {
        const near = (lo + hi) / 2;
        const alpha = Math.min(0.9, (0.07 + near * 0.18) * (1 + light * 4));
        const shade = Math.round(175 + light * 80);
        ctx.strokeStyle = `rgba(${shade}, ${shade}, ${Math.min(255, shade + 30)}, ${alpha})`;
        ctx.lineWidth = 0.5 + near * 0.9;
        ctx.beginPath();
        for (const drop of drops) {
          if (drop.near < lo || drop.near >= hi) continue;
          const length = 6 + drop.near * 12;
          if (!still) {
            const speed = 420 + drop.near * 620;
            drop.y += speed * dt;
            drop.x += speed * wind * dt;
          }
          if (drop.y > height + length) {
            drop.y = -length - Math.random() * 30;
            drop.x = Math.random() * width * 1.3 - width * 0.15;
          }
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x - length * wind, drop.y - length);
        }
        ctx.stroke();
      }

      bolts = bolts.filter((b) => now - b.born < BOLT_MS);
      const k = GAME_BOARD_PX / width;
      ctx.setTransform(scale / k, 0, 0, scale / k, 0, 0);
      for (const bolt of bolts) drawBolt(ctx, bolt, now);
      if (light > 0) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(225, 233, 255, ${0.22 * light})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return (
    <span ref={scene} className="pv-storm">
      <span className="pv-storm-board">
        <StormScars strikes={strikes} flipped={false} />
        {STORM_PIECES.map(([is, file, rank]) => (
          <Piece
            key={placeKey(file, rank)}
            is={is}
            x={(file + 0.5) * 12.5}
            y={(7 - rank + 0.5) * 12.5}
            size={11}
            className={
              hidden.includes(placeKey(file, rank)) ? "pv-storm-gone" : ""
            }
          />
        ))}
        <span ref={dark} className="pv-storm-dark" />
        <StormBolt strikes={strikes} flipped={false} imageOf={stormImage} />
      </span>
      <canvas ref={sky} className="pv-storm-sky" />
    </span>
  );
}

/** The dead pawn coming up out of its grave, in the rotten look it has in the game */
function Undead() {
  return (
    <Piece
      is="bP"
      src={zombieImage(PieceType.Pawn)}
      x={50}
      y={50}
      size={100}
      className="pv-undead"
    />
  );
}

/** A shell landing in no man's land: a flash, a fireball, earth thrown up, and smoke climbing away */
function Shell({
  x,
  y,
  late = false,
}: {
  x: number;
  y: number;
  late?: boolean;
}) {
  return (
    <span
      className={`pv-shell${late ? " pv-shell-late" : ""}`}
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <span className="pv-shell-smoke" />
      <span className="pv-shell-fire" />
      <span className="pv-shell-flash" />
      {Array.from({ length: 7 }, (_, i) => (
        <i
          key={i}
          style={
            {
              "--dx": `${(scatter(i * 5 + x) * 2 - 1) * 14}cqw`,
              "--up": `${6 + scatter(i * 5 + y) * 10}cqw`,
              "--spin": `${(scatter(i * 3 + x) * 2 - 1) * 500}deg`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

/** A short sword: a pointed blade with a groove down it, a crossguard, a wrapped grip, and a pommel */
function Sword() {
  return (
    <svg className="pv-sword" viewBox="0 0 16 64">
      <path
        d="M8 1 L11.5 9 V42 H4.5 V9 Z"
        fill="#eef3f8"
        stroke="#1b1033"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 9 V39" stroke="#9fb0c2" strokeWidth="1.4" />
      <rect
        x="0.8"
        y="41"
        width="14.4"
        height="4.2"
        rx="2"
        fill="#e2b84a"
        stroke="#1b1033"
        strokeWidth="1.6"
      />
      <rect
        x="6"
        y="45"
        width="4"
        height="11"
        fill="#7a4a22"
        stroke="#1b1033"
        strokeWidth="1.4"
      />
      <circle
        cx="8"
        cy="59"
        r="3.2"
        fill="#e2b84a"
        stroke="#1b1033"
        strokeWidth="1.6"
      />
    </svg>
  );
}

/** The size of a hexagon in the hex scene, in a drawing 200 wide and 100 tall */
const HEX_R = 19;
const HEX_H = Math.sqrt(3) * HEX_R;
/** Three tones of one dusk: plum, orchid, and a warm rose, each lit from above */
const HEX_TONES = [
  ["#5a2a9c", "#3a176e"],
  ["#d6489f", "#a02c7c"],
  ["#ffb38a", "#f07f7a"],
];
/** The column of each cell the bishop stops on, along the middle row */
const BISHOP_COLUMNS = [1, 3, 5];
const hexX = (q: number) => 10 + q * HEX_R * 1.5;
const BISHOP_STOPS = BISHOP_COLUMNS.map((q) => hexX(q) / 2);

/**
 * A board of regular hexagons in three colours, no two alike side by side,
 * as hexagonal chess is played on. A bishop keeps to one colour, moving
 * from cell to cell through the corners between them.
 */
function HexBoard() {
  const cells: ReactNode[] = [];
  const path: ReactNode[] = [];
  for (let q = 0; q <= 7; q++) {
    for (let row = -1; row <= 3; row++) {
      const x = hexX(q);
      const y = 50 + (row - 1) * HEX_H + (q % 2 ? HEX_H / 2 : 0);
      const tone = (((q - (row - (q - (q % 2)) / 2)) % 3) + 3) % 3;
      const corners = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i;
        return `${(x + HEX_R * Math.cos(a)).toFixed(1)},${(y + HEX_R * Math.sin(a)).toFixed(1)}`;
      }).join(" ");
      const step = row === 1 ? BISHOP_COLUMNS.indexOf(q) : -1;
      const onPath = step >= 0;
      // The bishop's cells are drawn last, so their outline lies over their neighbours
      (onPath ? path : cells).push(
        <polygon
          key={`${q}:${row}`}
          points={corners}
          fill={`url(#pv-hex-${tone})`}
          className={onPath ? `pv-hex-path pv-hex-step-${step}` : undefined}
        />,
      );
    }
  }
  return (
    <svg className="pv-hexes" viewBox="0 0 200 100" preserveAspectRatio="none">
      <defs>
        {HEX_TONES.map(([top, bottom], i) => (
          <linearGradient
            key={i}
            id={`pv-hex-${i}`}
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0" stopColor={top} />
            <stop offset="1" stopColor={bottom} />
          </linearGradient>
        ))}
      </defs>
      {cells}
      {path}
    </svg>
  );
}

/** A repeatable scatter in [0, 1) */
const scatter = (n: number) => {
  const v = Math.sin(n * 78.233 + 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * The rifle fire in the trench scene: each round from its own spot, at its
 * own slant, either way across, and fired again after its own uneven wait,
 * so the shooting comes in ragged bursts with lulls between
 */
const TRACERS = Array.from({ length: 16 }, (_, i) => ({
  x: 4 + scatter(i * 3 + 1) * 92,
  lean: (scatter(i * 3 + 2) * 2 - 1) * 24,
  back: scatter(i * 3 + 3) > 0.5,
  every: 0.45 + scatter(i * 7 + 4) * 1.5,
  delay: scatter(i * 7 + 5) * 2,
}));

/** Where along a trench its men stand, in percent across the scene */
const TRENCH_LINE = [10, 28, 46, 64, 82];

/** Something that happens in each mode, played on a loop in a little window */
const SCENES: Partial<Record<ThemeId, ReactNode>> = {
  // A knight hops up to the blue portal, is sucked in, and walks out of the orange one
  portals: (
    <>
      <span className="pv-portal" style={{ left: "24%", top: "56%" }}>
        <Portal color="blue" />
      </span>
      <span className="pv-portal" style={{ left: "76%", top: "56%" }}>
        <Portal color="orange" />
      </span>
      <Piece is="wN" x={24} y={50} className="pv-into-portal pv-faces-right" />
      <Piece
        is="wN"
        x={76}
        y={50}
        className="pv-out-of-portal pv-faces-right"
      />
    </>
  ),
  // The enemy's pieces are swallowed by a bank of fog rolling over them
  fog: (
    <>
      <Piece is="bR" x={22} y={34} />
      <Piece is="bQ" x={50} y={32} />
      <Piece is="bN" x={78} y={34} />
      <Piece is="wP" x={50} y={78} size={22} />
      <span className="pv-fog pv-fog-a" />
      <span className="pv-fog pv-fog-b" />
      <span className="pv-fog pv-fog-c" />
      <span className="pv-fog pv-fog-d" />
    </>
  ),
  // A pawn carries its lantern across the dark, and a knight nobody could see turns up in its light
  lanterns: (
    <>
      <Piece is="bN" x={70} y={46} className="pv-lurker" />
      <span className="pv-dark" />
      <span className="pv-lamplight">
        {/* Set down and to the left, so the lantern it carries is at the middle of the light */}
        <Piece is="wP" x={27} y={65} size={72}>
          <LanternIcon count={1} />
        </Piece>
      </span>
    </>
  ),
  storm: <StormScene />,
  // A rook eats its way along a corridor of the maze, takes a power pellet, eats the ghost that turns blue, and goes out through the tunnel
  pacman: (
    <>
      <span className="pv-pac-wall pv-pac-wall-top" />
      <span className="pv-pac-wall pv-pac-wall-bottom" />
      {[10, 20, 30, 40, 66, 74, 88].map((x) => (
        <span key={x} className="pv-pac-dot" style={{ left: `${x}%` }} />
      ))}
      <span className="pv-pac-power" style={{ left: "52%" }} />
      <span className="pv-pac-eaten" />
      <Piece is="bN" x={80} y={52} size={20} className="pv-pac-ghost" />
      <span className="pv-pac-points">200</span>
      <Piece is="wR" x={0} y={52} size={20} className="pv-pac-runner" />
    </>
  ),
  // Searchlights cross a dark hall while a pawn creeps up on the jewel
  heist: (
    <>
      <Piece is="bP" x={20} y={62} size={24} className="pv-thief" />
      <span className="pv-gloom" />
      <span className="pv-searchlight pv-searchlight-a" />
      <span className="pv-searchlight pv-searchlight-b" />
      {/* The jewel shines through the dark by itself */}
      <span className="pv-loot">
        <Jewel />
      </span>
    </>
  ),
  // A rook runs up and belts the ball into the net
  fifa: (
    <>
      <span className="pv-goal" />
      <Piece is="wR" x={22} y={56} className="pv-kicker" />
      <span className="pv-ball">
        <SoccerBall />
      </span>
      <span className="pv-shout pv-goal-shout">GOAL!</span>
    </>
  ),
  // The two teams heave out of time with each other, so the rope goes taut
  // and thin whenever both happen to pull at once
  tug: (
    <>
      <span className="pv-team">
        <Piece is="wP" x={12} y={50} size={22} />
        <Piece is="wN" x={28} y={48} size={24} className="pv-faces-right" />
      </span>
      <span className="pv-team pv-team-far">
        <Piece is="bN" x={72} y={48} size={24} />
        <Piece is="bP" x={88} y={50} size={22} />
      </span>
      <span className="pv-rope" />
      <span className="pv-flag" />
    </>
  ),
  // Two belts run opposite ways, clunking their pieces along a place at a time
  conveyor: (
    <>
      <BeltLane pieces={["wR", "bN", "wP", "bB"]} y={30} way="right" />
      <BeltLane pieces={["bP", "wQ", "bR", "wN"]} y={70} way="left" />
    </>
  ),
  // A pawn steps forward onto exactly the wrong square
  mines: <MineScene />,
  // The edge of the board falls away tile by tile, closing in on the king
  royale: (
    <>
      <span className="pv-tiles">
        {Array.from({ length: 15 }, (_, i) => {
          const col = i % 5;
          const row = Math.floor(i / 5);
          const edge = col === 0 || col === 4 || row === 0 || row === 2;
          return (
            <i
              key={i}
              className={edge ? "pv-doomed" : ""}
              style={{ "--n": (col + row * 2) % 7 } as CSSProperties}
            />
          );
        })}
      </span>
      <Piece is="wK" x={50} y={50} size={14} className="pv-nervous" />
    </>
  ),
  // Two pieces go at each other with swords, on their own, health bars draining
  clash: (
    <>
      <Piece is="wR" x={28} y={60} className="pv-lunge-right">
        <span className="pv-hp pv-hp-blue" />
        <Sword />
      </Piece>
      <Piece is="bB" x={72} y={60} className="pv-lunge-left">
        <span className="pv-hp pv-hp-red" />
        <Sword />
      </Piece>
      <span className="pv-spark" style={{ left: "50%", top: "30%" }} />
    </>
  ),
  // A king hops onto the hill and the count climbs to three
  hill: (
    <>
      <span className="pv-hill" />
      <Piece is="wK" x={50} y={50} className="pv-takes-hill" />
      <span className="pv-count">
        <i>1</i>
        <i>2</i>
        <i>3</i>
      </span>
    </>
  ),
  // The board turns and turns, and pieces tumble down across it
  gravity: (
    <>
      <span className="pv-ground" />
      <Piece is="wR" x={22} y={50} size={22} className="pv-tumbles" />
      <Piece
        is="bN"
        x={52}
        y={50}
        size={24}
        className="pv-tumbles pv-tumbles-b"
      />
      <Piece
        is="wP"
        x={80}
        y={50}
        size={20}
        className="pv-tumbles pv-tumbles-c"
      />
    </>
  ),
  // A bishop bounds along a line of its own colour, each cell lighting as it
  // lands, and knocks a pawn clean off the last one
  hex: (
    <>
      <HexBoard />
      <Flipper
        is="bP"
        x={BISHOP_STOPS[2]}
        y={47}
        size={20}
        className="pv-bopped"
      />
      <Flipper
        is="wB"
        x={BISHOP_STOPS[0]}
        y={47}
        size={22}
        className="pv-hops"
      />
      <span
        className="pv-spark pv-bop"
        style={{ left: `${BISHOP_STOPS[2]}%`, top: "44%" }}
      />
    </>
  ),
  // A shell game: three masked pieces swap places, a pawn takes its pick,
  // and the mask comes off the queen
  stratego: (
    <>
      <Piece is="bP" x={24} y={34} className="pv-hidden pv-shell-1">
        <span className="pv-mask">?</span>
      </Piece>
      <Piece is="bP" x={52} y={34} className="pv-hidden pv-shell-2">
        <span className="pv-mask">?</span>
      </Piece>
      <Piece is="bQ" x={80} y={34} className="pv-hidden pv-shell-3">
        <span className="pv-mask pv-unmasks">?</span>
      </Piece>
      <Piece is="wP" x={52} y={80} size={22} className="pv-picks" />
      <span className="pv-shout pv-uh-oh">!</span>
    </>
  ),
  // A captured pawn claws its way back out of its grave
  zombies: (
    <>
      <span className="pv-plot">
        <Tombstone look={0} part="stone" stirring />
        <span className="pv-rises">
          <Undead />
        </span>
        <Tombstone look={0} part="heap" />
      </span>
      <Piece is="wP" x={80} y={64} size={22} className="pv-shivers" />
    </>
  ),
  // Rifle fire pours across no man's land in the rain, and a shell lands short
  // Two lines of men firing across the wire, a machine gun hammering away,
  // shells coming down, and an assault team going over the top
  trenches: (
    <>
      <span className="pv-crater" style={{ left: "30%", top: "50%" }} />
      <span
        className="pv-crater pv-crater-small"
        style={{ left: "74%", top: "42%" }}
      />
      <span className="pv-trench pv-trench-far" />
      <span className="pv-trench pv-trench-near" />
      {TRENCH_LINE.map((x, i) => (
        <Piece
          key={`far-${i}`}
          is={i === 3 ? "bR" : "bP"}
          x={x}
          y={16}
          size={11}
          className="pv-trooper pv-trooper-far"
          style={{ animationDelay: `${-i * 0.7}s` }}
        />
      ))}
      {/* The enemy keep down behind their sandbags */}
      <span className="pv-trench-bags" />
      {TRENCH_LINE.map((x, i) => (
        <Piece
          key={`near-${i}`}
          is={i === 1 ? "wR" : "wP"}
          x={x + 4}
          y={85}
          size={11}
          className="pv-trooper"
          style={{ animationDelay: `${-i * 0.9 - 0.4}s` }}
        />
      ))}
      <span className="pv-wire" />
      {TRACERS.map((t, i) => (
        <span
          key={i}
          className={`pv-tracer${t.back ? " pv-tracer-back" : ""}`}
          style={
            {
              left: `${t.x}%`,
              rotate: `${t.back ? 180 + t.lean : t.lean}deg`,
              animationDelay: `${-t.delay}s`,
              animationDuration: `${t.every}s`,
            } as CSSProperties
          }
        />
      ))}
      {/* The machine guns, one in each line, never letting up */}
      <span className="pv-muzzle" style={{ left: "64%", top: "27%" }} />
      <span
        className="pv-muzzle pv-muzzle-near"
        style={{ left: "26%", top: "73%" }}
      />
      <Shell x={58} y={50} />
      <Shell x={24} y={44} late />
      <span className="pv-flare" />
      <span className="pv-rain" />
    </>
  ),
};

/** A mode's little scene, in its own colours */
export function ModePreview({ theme }: { theme: ThemeId }) {
  // The pieces are recoloured from artwork that may still be on its way
  const [, setLoaded] = useState(false);
  useEffect(() => {
    let mounted = true;
    void artworkLoaded.then(() => mounted && setLoaded(true));
    return () => {
      mounted = false;
    };
  }, []);
  return (
    <span className={`mode-preview scene-${theme}`} aria-hidden>
      <SceneTheme.Provider value={theme}>{SCENES[theme]}</SceneTheme.Provider>
    </span>
  );
}

/**
 * The adventure's scene: Chessbot popping up over a plain green chess board
 * that glitches into colour around him
 */
export function AdventurePreview() {
  return (
    <span className="mode-preview scene-adventure" aria-hidden>
      <span className="pv-plain-board" />
      <span className="pv-cursed-board" />
      <span className="pv-host">
        <Chessbot mood="smug" grounded={false} />
      </span>
      <span className="pv-glitch-bar pv-glitch-bar-a" />
      <span className="pv-glitch-bar pv-glitch-bar-b" />
    </span>
  );
}

/** Two kings squaring up across a board, for the mode that is not here yet */
export function MultiplayerPreview() {
  return (
    <span className="mode-preview scene-multiplayer" aria-hidden>
      <Piece is="wK" x={20} y={54} size={34} />
      <Piece is="bK" x={80} y={54} size={34} />
    </span>
  );
}
