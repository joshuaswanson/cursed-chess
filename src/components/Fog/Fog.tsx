import { useEffect, useRef, useState } from "react";
import { FogBank, SideFog } from "./fogField";
import type { Rect } from "./fogField";
import "./Fog.css";

/** Fog is drawn at this fraction of screen resolution and scaled up, which softens it */
const RESOLUTION = 0.35;
const ROLL_IN_SECONDS = 5;
const LIFT_SECONDS = 1.6;
const MAX_DT = 0.05;

/** Runs a fog canvas until it has fully faded out after `active` turns off */
function useFogCanvas(
  active: boolean,
  draw: (
    ctx: CanvasRenderingContext2D,
    dt: number,
    w: number,
    h: number,
    amount: number,
  ) => void,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const drawRef = useRef(draw);
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    activeRef.current = active;
    drawRef.current = draw;
  });

  if (active && !visible) setVisible(true);

  useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    let amount = 0;
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(MAX_DT, (now - last) / 1000);
      last = now;
      amount = activeRef.current
        ? Math.min(1, amount + dt / ROLL_IN_SECONDS)
        : Math.max(0, amount - dt / LIFT_SECONDS);

      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const pw = Math.max(1, Math.round(w * RESOLUTION));
      const ph = Math.max(1, Math.round(h * RESOLUTION));
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      ctx.clearRect(0, 0, pw, ph);
      drawRef.current(ctx, dt, w, h, amount);

      if (!activeRef.current && amount === 0) {
        setVisible(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible]);

  return { canvasRef, visible };
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Where the board sits on screen, so the side banks know how far to reach */
function boardRect(w: number, h: number): Rect {
  const board = document.querySelector(".board")?.getBoundingClientRect();
  if (!board) return { x: w * 0.25, y: 0, w: w * 0.5, h };
  return { x: board.left, y: board.top, w: board.width, h: board.height };
}

/** Fog banks rolling in from the sides over the board, and a ribbon along the bottom */
export function PageFog({ active }: { active: boolean }) {
  const fog = useRef(new SideFog());
  const { canvasRef, visible } = useFogCanvas(active, (ctx, dt, w, h, amount) =>
    fog.current.step(
      ctx,
      dt,
      w,
      h,
      boardRect(w, h),
      RESOLUTION,
      easeOut(amount),
    ),
  );
  if (!visible) return null;
  return <canvas ref={canvasRef} className="page-fog" aria-hidden />;
}

/** How far in from each side, and from the top and bottom, the bank fades to nothing */
const FADE = { sides: 120, ends: 80 };

/**
 * Fades the fog already drawn to nothing at every edge of its canvas, so
 * puffs drifting off it never end in a straight line. Done in the drawing
 * itself, which every browser gets right.
 */
function fadeEdges(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const through = (gradient: CanvasGradient, depth: number, length: number) => {
    const edge = Math.min(0.5, (depth * RESOLUTION) / length);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(edge, "#000");
    gradient.addColorStop(1 - edge, "#000");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  };
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "destination-in";
  through(ctx.createLinearGradient(0, 0, w, 0), FADE.sides, w);
  through(ctx.createLinearGradient(0, 0, 0, h), FADE.ends, h);
  ctx.restore();
}

/** Margin around the hidden half where the bank's edges can billow */
const BANK_MARGIN = 170;

/** An opaque bank of fog rolling over the enemy half of the board */
export function BoardFog({
  active,
  enemyOnTop,
}: {
  active: boolean;
  enemyOnTop: boolean;
}) {
  const bank = useRef(new FogBank());
  const { canvasRef, visible } = useFogCanvas(
    active,
    (ctx, dt, w, h, amount) => {
      const core = {
        x: BANK_MARGIN,
        y: BANK_MARGIN,
        w: w - BANK_MARGIN * 2,
        h: h - BANK_MARGIN * 2,
      };
      bank.current.step(ctx, dt, core, RESOLUTION, easeOut(amount));
      fadeEdges(ctx, w * RESOLUTION, h * RESOLUTION);
    },
  );
  if (!visible) return null;
  return (
    <canvas
      ref={canvasRef}
      className={`board-fog${enemyOnTop ? "" : " board-fog-bottom"}`}
      style={{ "--bank-margin": `${BANK_MARGIN}px` } as React.CSSProperties}
      aria-hidden
    />
  );
}
