import { useEffect, useRef } from "react";
import type { SquareIndex } from "../../engine";
import type { HeistView } from "../../plugins/heist";
import { visualCol, visualRow } from "./boardGeometry";
import "./Heist.css";

/** The jewel: a cut diamond, lit from above */
export function Jewel({ className = "" }: { className?: string }) {
  return (
    <svg className={`heist-jewel ${className}`} viewBox="0 0 40 36" aria-hidden>
      <path
        d="M8 3 H32 L39 13 L20 34 L1 13 Z"
        fill="#7fe6ff"
        stroke="#0b2a3a"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path d="M8 3 L13 13 L20 3 L27 13 L32 3" fill="#d9fbff" />
      <path d="M1 13 H39 L20 34 Z" fill="#3fb8e6" />
      <path d="M13 13 L20 34 L27 13 Z" fill="#9ff0ff" />
      <path
        d="M8 3 L13 13 L20 3 L27 13 L32 3 M1 13 H39 M13 13 L20 34 L27 13"
        fill="none"
        stroke="#0b2a3a"
        strokeWidth="1.2"
        strokeLinejoin="round"
        opacity="0.55"
      />
      <path
        d="M9 6 L12 11"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The jewel where it stands on the board: on its plinth under glass, or held up by whoever has it */
export function HeistLoot({ held }: { held: boolean }) {
  if (held) {
    return (
      <span className="heist-held" aria-hidden>
        <Jewel />
        <i className="heist-glint" />
      </span>
    );
  }
  return (
    <span className="heist-plinth" aria-hidden>
      <span className="heist-cushion" />
      <Jewel />
      <i className="heist-glint" />
    </span>
  );
}

/** How dark the hall is between the lights */
const GLOOM = "rgba(5, 8, 20, 0.62)";
/** How wide a light's pool is, in squares, out to where it is gone */
const POOL_SQUARES = 2.3;
const FRAME_MS = 40;
/** The searchlights: how far each swings, how fast, and where in its swing it starts */
const LIGHTS = [
  { swingX: 3.3, swingY: 2.6, speedX: 0.41, speedY: 0.29, phase: 0 },
  { swingX: 2.8, swingY: 3.3, speedX: 0.27, speedY: 0.38, phase: 2.1 },
  { swingX: 3.4, swingY: 3.0, speedX: 0.33, speedY: 0.22, phase: 4.4 },
];
/** How quickly a light closes on the thief once the alarm is up, as the share of the gap closed each frame */
const LOCK_ON = 0.09;

/**
 * The museum's lights: a dim hall with searchlights sweeping the floor.
 * When the jewel leaves its plinth the alarm goes up, the hall pulses red,
 * and one light swings round and stays on whoever has it.
 */
export function HeistLights({
  view,
  flipped,
  squareSize,
}: {
  view: HeistView;
  flipped: boolean;
  squareSize: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scene = useRef({ view, flipped, squareSize });
  useEffect(() => {
    scene.current = { view, flipped, squareSize };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const at = LIGHTS.map(() => ({ x: 4, y: 4 }));
    let frame = 0;
    let last = 0;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - last < FRAME_MS) return;
      last = now;
      const { view, flipped, squareSize } = scene.current;
      const scale = Math.min(2, window.devicePixelRatio || 1);
      const size = Math.round(squareSize * 8 * scale);
      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
      }
      const sq = size / 8;
      const alarm = view.carrier !== null;
      const t = now / 1000;
      const thief = (square: SquareIndex) => ({
        x: visualCol(square, flipped) + 0.5,
        y: visualRow(square, flipped) + 0.5,
      });

      LIGHTS.forEach((light, i) => {
        // With the alarm up, the lights sweep faster and the first hunts the thief
        const rate = alarm ? 1.9 : 1;
        const sweep = {
          x: 4 + light.swingX * Math.sin(t * light.speedX * rate + light.phase),
          y:
            4 +
            light.swingY *
              Math.sin(t * light.speedY * rate + light.phase * 1.7),
        };
        const goal = alarm && i === 0 ? thief(view.sq) : sweep;
        const ease = alarm && i === 0 ? LOCK_ON : 0.2;
        at[i].x += (goal.x - at[i].x) * ease;
        at[i].y += (goal.y - at[i].y) * ease;
      });

      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = GLOOM;
      ctx.fillRect(0, 0, size, size);

      // Each light wears a pool through the gloom
      ctx.globalCompositeOperation = "destination-out";
      for (const { x, y } of at) {
        const reach = POOL_SQUARES * sq;
        const pool = ctx.createRadialGradient(
          x * sq,
          y * sq,
          0,
          x * sq,
          y * sq,
          reach,
        );
        pool.addColorStop(0, "rgba(0, 0, 0, 1)");
        pool.addColorStop(0.45, "rgba(0, 0, 0, 0.92)");
        pool.addColorStop(0.7, "rgba(0, 0, 0, 0.4)");
        pool.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = pool;
        ctx.fillRect(x * sq - reach, y * sq - reach, reach * 2, reach * 2);
      }

      // The light itself: cool white, or red once the alarm is up
      ctx.globalCompositeOperation = "source-over";
      at.forEach(({ x, y }, i) => {
        const reach = POOL_SQUARES * 0.8 * sq;
        const tint = ctx.createRadialGradient(
          x * sq,
          y * sq,
          0,
          x * sq,
          y * sq,
          reach,
        );
        const hunting = alarm && i === 0;
        tint.addColorStop(
          0,
          hunting ? "rgba(255, 70, 70, 0.3)" : "rgba(210, 230, 255, 0.2)",
        );
        tint.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = tint;
        ctx.fillRect(x * sq - reach, y * sq - reach, reach * 2, reach * 2);
      });
      if (alarm) {
        ctx.fillStyle = `rgba(255, 30, 40, ${0.07 + 0.07 * Math.sin(t * 7)})`;
        ctx.fillRect(0, 0, size, size);
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} className="heist-lights" aria-hidden />;
}
