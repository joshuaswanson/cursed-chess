import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { ThemeId } from "../../theme/themes";
import { PieceType } from "../../engine";
import { zombieImage } from "../../utils/pieceImages";
import { SoccerBall } from "../Board/Football";
import { Chessbot } from "../Chessbot/Chessbot";
import { MineBlast } from "../Board/MineBlast";
import { Portal } from "../Board/Portal";
import { Tombstone } from "../Board/Zombies";
import "./ModePreview.css";

const PIECES = `${import.meta.env.BASE_URL}pieces/party/`;

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
  return (
    <span
      className={`pv-piece ${className}`}
      style={{ left: `${x}%`, top: `${y}%`, width: `${size}%`, ...style }}
    >
      <img src={src ?? `${PIECES}${is}.svg`} alt="" draggable={false} />
      {children}
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
        <Piece is="wP" x={50} y={52} size={72} />
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
      <Piece is="wK" x={50} y={50} size={24} className="pv-nervous" />
    </>
  ),
  // Two pieces go at each other with swords, on their own, health bars draining
  clash: (
    <>
      <Piece is="wN" x={28} y={60} className="pv-lunge-right pv-faces-right">
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
      <Piece
        is="bP"
        x={BISHOP_STOPS[2]}
        y={47}
        size={20}
        className="pv-bopped"
      />
      <Piece is="wB" x={BISHOP_STOPS[0]} y={47} size={22} className="pv-hops" />
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
  trenches: (
    <>
      <span className="pv-trench pv-trench-far" />
      <span className="pv-trench pv-trench-near" />
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
      <Shell x={58} y={50} />
      <Shell x={24} y={44} late />
      <span className="pv-rain" />
    </>
  ),
};

/** A mode's little scene, in its own colours */
export function ModePreview({ theme }: { theme: ThemeId }) {
  return (
    <span className={`mode-preview scene-${theme}`} aria-hidden>
      {SCENES[theme]}
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
