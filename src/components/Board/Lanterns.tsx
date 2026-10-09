import { useEffect, useRef } from "react";
import type { SquareIndex } from "../../engine";
import { useGameStore } from "../../stores/gameStore";
import type { Lantern } from "../../plugins/lanterns";
import { visualCol, visualRow } from "./boardGeometry";
import "./Lanterns.css";

/** How far a lantern's light reaches from its carrier's middle, in squares */
const REACH_SQUARES = 1.9;
/**
 * How much of the dark the light clears at each distance, in squares: only
 * the carrier stands in real light, and it falls away fast, so the pieces
 * on the eight squares round it can barely be made out
 */
const FALLOFF: [squares: number, cleared: number][] = [
  [0, 1],
  [0.25, 0.95],
  [0.45, 0.7],
  [0.65, 0.42],
  [0.85, 0.25],
  [1.05, 0.15],
  [1.3, 0.08],
  [1.6, 0.03],
  [REACH_SQUARES, 0],
];
/** The rest of the board is pitch black */
const DARKNESS = "rgb(4, 3, 10)";
/** How quickly the lanterns come up once they are lit, as the share of the way gained each frame */
const KINDLE = 0.07;
/** How quickly a light catches up with its carrier, as the share of the gap closed each frame */
const FOLLOW = 0.22;
const FRAME_MS = 40;

const BRASS = "#d9a441";
const BRASS_DARK = "#8a5f1c";
const LAMP_INK = "#2a1706";

/** The lantern a piece carries, hung beside it: one for each it holds */
export function LanternIcon({ count }: { count: number }) {
  return (
    <span className="lantern-held" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <svg key={i} viewBox="0 0 32 46">
          <defs>
            <radialGradient id="lantern-glass" cx="0.5" cy="0.6" r="0.7">
              <stop offset="0" stopColor="#fffbe0" />
              <stop offset="0.55" stopColor="#ffd666" />
              <stop offset="1" stopColor="#ff9d2e" />
            </radialGradient>
          </defs>
          {/* The carrying ring */}
          <path
            d="M9 13 Q16 -3 23 13"
            fill="none"
            stroke={LAMP_INK}
            strokeWidth="4.4"
            strokeLinecap="round"
          />
          <path
            d="M9 13 Q16 -3 23 13"
            fill="none"
            stroke={BRASS}
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* The chimney and the cap over the glass */}
          <rect
            x="13"
            y="8.5"
            width="6"
            height="4.5"
            rx="1"
            fill={BRASS_DARK}
            stroke={LAMP_INK}
            strokeWidth="1.6"
          />
          <path
            d="M9.5 12.5 h13 l3 5 h-19 z"
            fill={BRASS}
            stroke={LAMP_INK}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {/* The glass, wider at the foot, with the flame inside */}
          <path
            d="M8 17.5 h16 l2.5 16 h-21 z"
            fill="url(#lantern-glass)"
            stroke={LAMP_INK}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            className="lantern-flame"
            d="M16 20.5 q5.5 6.5 0 11.5 q-5.5 -5 0 -11.5 z"
            fill="#ff7a1a"
          />
          <path
            className="lantern-flame"
            d="M16 25 q2.6 3.4 0 6.4 q-2.6 -3 0 -6.4 z"
            fill="#fff3b0"
          />
          {/* The wire guards across the glass */}
          <path
            d="M12.4 17.5 L11.2 33.5 M19.6 17.5 L20.8 33.5 M6.8 25.5 H25.2"
            fill="none"
            stroke={LAMP_INK}
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.75"
          />
          {/* The oil pot it stands on */}
          <path
            d="M4.5 33.5 h23 l-1.5 6 h-20 z"
            fill={BRASS}
            stroke={LAMP_INK}
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <rect
            x="7"
            y="39.5"
            width="18"
            height="4"
            rx="1.5"
            fill={BRASS_DARK}
            stroke={LAMP_INK}
            strokeWidth="1.6"
          />
        </svg>
      ))}
    </span>
  );
}

/**
 * The dark that lies over the whole board, with a pool of light worn
 * through it round each lantern. Each square the piece you have picked up
 * could go to shows as a faint glimmer, so you can still find your way
 * about in the dark. The piece itself stays unlit.
 */
export function LanternDark({
  lanterns,
  shown,
  targets,
  flipped,
  squareSize,
}: {
  lanterns: Lantern[];
  /** Squares lit with no lantern near: your king in check, and the piece checking it */
  shown: SquareIndex[];
  targets: SquareIndex[];
  flipped: boolean;
  squareSize: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The lanterns stay out while the mode's title cards are up, and are lit as play begins
  const lit = useGameStore((s) => s.introDone);
  // Read by the drawing loop, which outlives any one render
  const scene = useRef({ lanterns, shown, targets, flipped, squareSize, lit });
  useEffect(() => {
    scene.current = { lanterns, shown, targets, flipped, squareSize, lit };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    /** Where each light is on screen now, in squares, as it follows its carrier */
    const at = new Map<number, { x: number; y: number }>();
    let frame = 0;
    let last = 0;
    /** How far up the lanterns are, from out to fully alight */
    let glow = 0;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - last < FRAME_MS) return;
      last = now;
      const { lanterns, shown, targets, flipped, squareSize, lit } =
        scene.current;
      glow += ((lit ? 1 : 0) - glow) * KINDLE;
      const scale = Math.min(2, window.devicePixelRatio || 1);
      const size = Math.round(squareSize * 8 * scale);
      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
      }
      const sq = size / 8;
      const centre = (square: SquareIndex) => ({
        x: visualCol(square, flipped) + 0.5,
        y: visualRow(square, flipped) + 0.5,
      });
      /** Wears a round hole in the dark, fully through out to `lit` and fading to nothing at `reach` */
      const wear = (
        x: number,
        y: number,
        lit: number,
        reach: number,
        depth: number,
      ) => {
        const glow = ctx.createRadialGradient(
          x * sq,
          y * sq,
          lit * sq,
          x * sq,
          y * sq,
          reach * sq,
        );
        glow.addColorStop(0, `rgba(0, 0, 0, ${depth})`);
        glow.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(
          (x - reach) * sq,
          (y - reach) * sq,
          reach * 2 * sq,
          reach * 2 * sq,
        );
      };

      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = DARKNESS;
      ctx.fillRect(0, 0, size, size);

      ctx.globalCompositeOperation = "destination-out";
      const lights = lanterns.map((lantern) => {
        const goal = centre(lantern.sq);
        const here = at.get(lantern.id) ?? goal;
        const next = {
          x: here.x + (goal.x - here.x) * FOLLOW,
          y: here.y + (goal.y - here.y) * FOLLOW,
        };
        at.set(lantern.id, next);
        // The flame is never quite steady
        const flicker =
          1 +
          0.02 * Math.sin(now / 140 + lantern.id * 2.1) +
          0.012 * Math.sin(now / 61 + lantern.id);
        return { ...next, flicker };
      });
      for (const { x, y, flicker } of lights) {
        const reach = REACH_SQUARES * flicker * sq;
        const pool = ctx.createRadialGradient(
          x * sq,
          y * sq,
          0,
          x * sq,
          y * sq,
          reach,
        );
        for (const [squares, cleared] of FALLOFF) {
          pool.addColorStop(
            squares / REACH_SQUARES,
            `rgba(0, 0, 0, ${cleared * glow})`,
          );
        }
        ctx.fillStyle = pool;
        ctx.fillRect(x * sq - reach, y * sq - reach, reach * 2, reach * 2);
      }
      // A red-edged pool, pulsing, on each square a check brings to light
      for (const square of shown) {
        const { x, y } = centre(square);
        wear(x, y, 0.42, 0.8, 0.9 * glow);
      }
      for (const target of targets) {
        const { x, y } = centre(target);
        wear(x, y, 0.08, 0.34, 0.55 * glow);
      }

      // Lamplight is warm
      ctx.globalCompositeOperation = "source-over";
      for (const square of shown) {
        const { x, y } = centre(square);
        const reach = 0.8 * sq;
        const danger = ctx.createRadialGradient(
          x * sq,
          y * sq,
          0.3 * sq,
          x * sq,
          y * sq,
          reach,
        );
        const pulse = 0.4 + 0.2 * Math.sin(now / 160);
        danger.addColorStop(0, "rgba(255, 60, 60, 0)");
        danger.addColorStop(0.6, `rgba(255, 60, 60, ${pulse * glow})`);
        danger.addColorStop(1, "rgba(255, 60, 60, 0)");
        ctx.fillStyle = danger;
        ctx.fillRect(x * sq - reach, y * sq - reach, reach * 2, reach * 2);
      }
      for (const { x, y, flicker } of lights) {
        const reach = REACH_SQUARES * flicker * sq;
        const warm = ctx.createRadialGradient(
          x * sq,
          y * sq,
          0,
          x * sq,
          y * sq,
          reach,
        );
        warm.addColorStop(0, `rgba(255, 176, 64, ${0.22 * glow})`);
        warm.addColorStop(1, "rgba(255, 140, 40, 0)");
        ctx.fillStyle = warm;
        ctx.fillRect(x * sq - reach, y * sq - reach, reach * 2, reach * 2);
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} className="lantern-dark" aria-hidden />;
}
