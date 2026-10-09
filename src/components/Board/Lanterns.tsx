import { useEffect, useRef } from "react";
import type { SquareIndex } from "../../engine";
import type { Lantern } from "../../plugins/lanterns";
import { visualCol, visualRow } from "./boardGeometry";
import "./Lanterns.css";

/**
 * A lantern lights the three by three squares round its carrier with a round
 * pool of light. It is fully lit out to this many squares from the carrier's
 * middle, which takes in the pieces on the corner squares, and gone by the
 * second number, short of the pieces two squares away.
 */
const LIT_SQUARES = 1.46;
const REACH_SQUARES = 1.8;
/** The rest of the board is pitch black */
const DARKNESS = "rgb(4, 3, 10)";
/** How quickly a light catches up with its carrier, as the share of the gap closed each frame */
const FOLLOW = 0.22;
const FRAME_MS = 40;

/** The lantern a piece carries, hung beside it: one for each it holds */
export function LanternIcon({ count }: { count: number }) {
  return (
    <span className="lantern-held" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <svg key={i} viewBox="0 0 24 34">
          <path
            d="M7 8 Q12 0 17 8"
            fill="none"
            stroke="#3a2a12"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <rect x="6" y="7" width="12" height="4" rx="1.5" fill="#5a4320" />
          <rect
            x="5"
            y="11"
            width="14"
            height="17"
            rx="4"
            fill="#ffd77a"
            stroke="#3a2a12"
            strokeWidth="2"
          />
          <path
            className="lantern-flame"
            d="M12 14 q5 6 0 11 q-5 -5 0 -11 z"
            fill="#ff8a1a"
          />
          <rect x="6" y="27" width="12" height="4" rx="1.5" fill="#5a4320" />
        </svg>
      ))}
    </span>
  );
}

/**
 * The dark that lies over the whole board, with a pool of light worn
 * through it round each lantern. The piece you have picked up shows as a
 * faint glimmer, and so does each square it could go to, so you can still
 * find your way about in the dark.
 */
export function LanternDark({
  lanterns,
  selected,
  targets,
  flipped,
  squareSize,
}: {
  lanterns: Lantern[];
  selected: SquareIndex | null;
  targets: SquareIndex[];
  flipped: boolean;
  squareSize: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Read by the drawing loop, which outlives any one render
  const scene = useRef({ lanterns, selected, targets, flipped, squareSize });
  useEffect(() => {
    scene.current = { lanterns, selected, targets, flipped, squareSize };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    /** Where each light is on screen now, in squares, as it follows its carrier */
    const at = new Map<number, { x: number; y: number }>();
    let frame = 0;
    let last = 0;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - last < FRAME_MS) return;
      last = now;
      const { lanterns, selected, targets, flipped, squareSize } =
        scene.current;
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
        wear(x, y, LIT_SQUARES * flicker, REACH_SQUARES * flicker, 1);
      }
      if (selected !== null) {
        const { x, y } = centre(selected);
        wear(x, y, 0.2, 0.75, 0.5);
      }
      for (const target of targets) {
        const { x, y } = centre(target);
        wear(x, y, 0.08, 0.34, 0.55);
      }

      // Lamplight is warm
      ctx.globalCompositeOperation = "source-over";
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
        warm.addColorStop(0, "rgba(255, 176, 64, 0.22)");
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
