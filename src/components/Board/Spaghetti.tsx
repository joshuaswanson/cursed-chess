import { useEffect, useRef } from "react";
import {
  SPAGHETTI_REACH,
  drawSpaghetti,
  prepareSpaghetti,
} from "./spaghettiDraw";

/** A piece torn apart by a portal's pull as it is swallowed */
export function SpaghettiPiece({
  src,
  heading,
  squareSize,
  durationMs,
  color,
  style,
}: {
  src: string;
  /** The way the piece was travelling, in degrees, screen y pointing down */
  heading: number;
  squareSize: number;
  durationMs: number;
  color: "blue" | "orange";
  style: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = squareSize * SPAGHETTI_REACH;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let frame = 0;
    let cancelled = false;
    const begin = performance.now();
    prepareSpaghetti(src, heading, squareSize, color).then((spaghetti) => {
      if (cancelled) return;
      canvas.width = size * spaghetti.dpr;
      canvas.height = size * spaghetti.dpr;
      const draw = (now: number) => {
        const t = Math.min(1, (now - begin) / durationMs);
        drawSpaghetti(ctx, spaghetti, size, t);
        if (t < 1) frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [src, heading, squareSize, durationMs, color, size]);

  return (
    <canvas
      ref={canvasRef}
      className="spaghetti-piece"
      style={{ ...style, width: size, height: size }}
    />
  );
}
