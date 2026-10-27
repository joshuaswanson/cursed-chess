import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { MAZE_WALLS, PEN, TUNNEL_RANKS } from "../../plugins/pacman";
import type { Ghost, GhostName, PacView } from "../../plugins/pacman";
import type { SquareIndex } from "../../engine";
import { pieceImage } from "../../utils/pieceImages";
import { sfx } from "../../audio/sfx";
import { visualCol, visualRow } from "./boardGeometry";
import "./PacMan.css";

/** How far each wall stands out from the board's edge, in squares: the arcade's double line */
const WALLS = [0.1, 0.24];
/** How far the tunnels run out past the board, in squares */
const TUNNEL_REACH = 0.75;
const CORNER = 0.18;

/** How thick the maze's inner walls are, in squares */
const INNER_WALL = 0.2;
/** How long a ghost takes over a step, matching its glide in the stylesheet */
const GHOST_STEP_MS = 380;

interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The inner walls as lines on the screen, in squares, those that meet end to end joined into one */
function wallSegments(flipped: boolean): Segment[] {
  const lines = MAZE_WALLS.filter(
    ([a, b]) => !PEN.includes(a) && !PEN.includes(b),
  ).map(([a, b]): Segment => {
    const [ax, ay] = [visualCol(a, flipped), visualRow(a, flipped)];
    const [bx, by] = [visualCol(b, flipped), visualRow(b, flipped)];
    if (ay === by) {
      const x = Math.max(ax, bx);
      return { x0: x, y0: ay, x1: x, y1: ay + 1 };
    }
    const y = Math.max(ay, by);
    return { x0: ax, y0: y, x1: ax + 1, y1: y };
  });
  const joined: Segment[] = [];
  for (const line of lines) {
    const touching = joined.find(
      (j) =>
        (j.x0 === j.x1) === (line.x0 === line.x1) &&
        ((j.x1 === line.x0 && j.y1 === line.y0) ||
          (line.x1 === j.x0 && line.y1 === j.y0)),
    );
    if (!touching) {
      joined.push({ ...line });
      continue;
    }
    touching.x0 = Math.min(touching.x0, line.x0);
    touching.y0 = Math.min(touching.y0, line.y0);
    touching.x1 = Math.max(touching.x1, line.x1);
    touching.y1 = Math.max(touching.y1, line.y1);
  }
  return joined;
}

/** The maze: its double blue wall round the board, open on each side into a tunnel, the walls inside, and the ghosts' pen */
export function PacMaze({ flipped }: { flipped: boolean }) {
  const top = Math.min(...TUNNEL_RANKS.map((rank) => 7 - rank));
  const bottom = Math.max(...TUNNEL_RANKS.map((rank) => 7 - rank)) + 1;
  const paths = WALLS.map((d) => {
    const spread = d - WALLS[0];
    const gapTop = top - spread;
    const gapBottom = bottom + spread;
    const near = -d;
    const far = 8 + d;
    const r = CORNER + spread;
    const wall =
      `M${near} ${gapTop} L${near} ${near + r} Q${near} ${near} ${near + r} ${near}` +
      ` L${far - r} ${near} Q${far} ${near} ${far} ${near + r} L${far} ${gapTop}` +
      ` M${far} ${gapBottom} L${far} ${far - r} Q${far} ${far} ${far - r} ${far}` +
      ` L${near + r} ${far} Q${near} ${far} ${near} ${far - r} L${near} ${gapBottom}`;
    const tunnels = [gapTop, gapBottom]
      .flatMap((y) => [
        `M${near} ${y} L${-TUNNEL_REACH - 0.24} ${y}`,
        `M${far} ${y} L${8 + TUNNEL_REACH + 0.24} ${y}`,
      ])
      .join(" ");
    return `${wall} ${tunnels}`;
  });
  const pen = PEN.map((sq) => ({
    x: visualCol(sq, flipped),
    y: visualRow(sq, flipped),
  }));
  const penX = Math.min(...pen.map((p) => p.x));
  const penY = Math.min(...pen.map((p) => p.y));
  const inset = INNER_WALL / 2;
  return (
    <svg className="pac-maze" viewBox="-1.4 -0.4 10.8 8.8" aria-hidden>
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {wallSegments(flipped).map(({ x0, y0, x1, y1 }) => (
        <rect
          key={`${x0} ${y0} ${x1} ${y1}`}
          className="pac-wall"
          x={x0 - inset}
          y={y0 - inset}
          width={x1 - x0 + INNER_WALL}
          height={y1 - y0 + INNER_WALL}
          rx={inset}
        />
      ))}
      <rect
        className="pac-wall"
        x={penX + inset}
        y={penY + inset}
        width={2 - INNER_WALL}
        height={2 - INNER_WALL}
        rx={inset}
      />
      {/* The doors the ghosts come and go by */}
      {[penY + inset, penY + 2 - inset].map((y) => (
        <line
          key={y}
          className="pac-pen-door"
          x1={penX + 0.6}
          x2={penX + 1.4}
          y1={y}
          y2={y}
        />
      ))}
    </svg>
  );
}

const GHOST_COLORS: Record<GhostName, string> = {
  blinky: "#ff0000",
  pinky: "#ffb8ff",
  inky: "#00ffff",
  clyde: "#ffb852",
};

/** The two shapes the hem of a ghost flicks between as it goes */
const GHOST_BODIES = [
  "M0 14V6.5C0 2.9 3.1 0 7 0s7 2.9 7 6.5V14l-2.3-2.3L9.3 14 7 11.7 4.7 14l-2.4-2.3L0 14Z",
  "M0 14V6.5C0 2.9 3.1 0 7 0s7 2.9 7 6.5V12.5L12.8 14l-2.3-2.3L8.2 14H5.8L3.5 11.7 1.2 14 0 12.5Z",
];

/** A ghost as in the arcade: in its own colour, its eyes on where it is going; blue and wavy-mouthed while scared; just its eyes once eaten */
function GhostArt({
  ghost,
  look,
}: {
  ghost: Ghost;
  look: { x: number; y: number };
}) {
  return (
    <svg viewBox="0 0 14 14" className="pac-ghost-art">
      {GHOST_BODIES.map((d, i) => (
        <path
          key={i}
          d={d}
          className={`pac-ghost-body hem-${i}`}
          fill={GHOST_COLORS[ghost.name]}
        />
      ))}
      <g className="pac-ghost-eyes">
        {[4.3, 9.7].map((cx) => (
          <g key={cx}>
            <ellipse cx={cx} cy={5.6} rx={2.1} ry={2.6} fill="#fff" />
            <circle
              cx={cx + look.x * 0.9}
              cy={5.6 + look.y * 1.2}
              r={1.2}
              fill="#2121ff"
            />
          </g>
        ))}
      </g>
      <g className="pac-ghost-fright" fill="#ffb8ae">
        <rect x={3.4} y={4.6} width={1.8} height={1.8} />
        <rect x={8.8} y={4.6} width={1.8} height={1.8} />
        <polyline
          points="1.6,10.2 3,9 4.4,10.2 5.8,9 7.2,10.2 8.6,9 10,10.2 11.4,9 12.6,10.2"
          fill="none"
          stroke="#ffb8ae"
          strokeWidth={0.8}
        />
      </g>
    </svg>
  );
}

/** Which way, on screen, from one square to the next a ghost steps to, through a tunnel too */
function heading(from: SquareIndex, to: SquareIndex | null, flipped: boolean) {
  if (to === null) return { x: 0, y: 0 };
  const dx = visualCol(to, flipped) - visualCol(from, flipped);
  const dy = visualRow(to, flipped) - visualRow(from, flipped);
  return { x: Math.abs(dx) > 1 ? -Math.sign(dx) : dx, y: dy };
}

const at = (sq: SquareIndex, flipped: boolean): CSSProperties => ({
  left: `${visualCol(sq, flipped) * 12.5}%`,
  top: `${visualRow(sq, flipped) * 12.5}%`,
});

/**
 * The four ghosts, gliding a square after each move once the move has
 * landed, and the pieces they catch shrivelling away where they were caught
 */
export function PacGhosts({
  view,
  flipped,
  delayMs,
}: {
  view: PacView;
  flipped: boolean;
  /** How long the ghosts wait for the move before them to land */
  delayMs: number;
}) {
  const hunters = [view.powerLeft.w, view.powerLeft.b].filter((n) => n > 0);
  const scared = hunters.length > 0;
  const ending = scared && Math.max(...hunters) === 1;
  const caughtAfterMs = delayMs + GHOST_STEP_MS * 0.8;

  const heard = useRef(0);
  const lastBite = view.bites[view.bites.length - 1]?.id ?? 0;
  useEffect(() => {
    if (lastBite <= heard.current) return;
    heard.current = lastBite;
    const timer = setTimeout(() => sfx.pacDeath(), caughtAfterMs);
    return () => clearTimeout(timer);
  }, [lastBite, caughtAfterMs]);

  return (
    <div
      className="pac-ghosts"
      style={{ "--ghost-delay": `${delayMs}ms` } as CSSProperties}
      aria-hidden
    >
      {view.bites.map((bite) => (
        <img
          key={bite.id}
          className="pac-caught"
          src={pieceImage(bite.piece)}
          alt=""
          draggable={false}
          style={{
            ...at(bite.sq, flipped),
            animationDelay: `${caughtAfterMs}ms`,
          }}
        />
      ))}
      {view.ghosts.map((ghost) => {
        const state =
          ghost.state === "eaten"
            ? " is-eaten"
            : scared && ghost.state === "out"
              ? ` is-scared${ending ? " is-ending" : ""}`
              : "";
        return (
          <div
            // A jump through a tunnel or home to the pen is drawn afresh, not glided
            key={`${ghost.name}-${ghost.jumps}`}
            className={`pac-ghost${state}${ghost.state === "out" ? "" : " in-pen"}`}
            style={at(ghost.sq, flipped)}
          >
            <GhostArt
              ghost={ghost}
              look={heading(ghost.sq, ghost.next, flipped)}
            />
          </div>
        );
      })}
    </div>
  );
}

/** A pellet on its square, or one being eaten as the piece that ate it passes */
export function PacPellet({
  power,
  eatenAfterMs,
}: {
  power: boolean;
  /** When this pellet is eaten in the move being shown */
  eatenAfterMs?: number;
}) {
  const eating = eatenAfterMs !== undefined;
  return (
    <span
      className={`pac-dot${power ? " pac-power" : ""}${eating ? " pac-eating" : ""}`}
      style={eating ? { animationDelay: `${eatenAfterMs}ms` } : undefined}
      aria-hidden
    />
  );
}
