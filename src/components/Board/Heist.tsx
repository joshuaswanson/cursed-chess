import { useEffect, useRef } from "react";
import type { SquareIndex } from "../../engine";
import type { HeistView } from "../../plugins/heist";
import { boardRanks } from "../../utils/squareUtils";
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

/** The jewel where it stands on the board: on its cushion in the vault, or held up by whoever has it */
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

/** How dark the hall is where no light falls */
const GLOOM = "rgba(3, 4, 12, 0.89)";
/** How far a searchlight reaches from the middle of its four squares: fully lit, then gone, in squares */
const LIGHT_LIT = 1.0;
const LIGHT_REACH = 1.55;
const FRAME_MS = 40;
/** How quickly a light glides to its new squares, as the share of the gap closed each frame */
const GLIDE = 0.16;

/**
 * The dark of the hall and what shows through it: the searchlights, the
 * squares the piece you have picked up could go to, the vault, and the
 * jewel. With the jewel out of the vault the whole hall pulses red.
 */
export function HeistLights({
  view,
  targets,
  flipped,
  squareSize,
}: {
  view: HeistView;
  targets: SquareIndex[];
  flipped: boolean;
  squareSize: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scene = useRef({ view, targets, flipped, squareSize });
  useEffect(() => {
    scene.current = { view, targets, flipped, squareSize };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    /** Where each light is on screen now, in squares, as it glides after its squares */
    const at = new Map<number, { x: number; y: number }>();
    let frame = 0;
    let last = 0;

    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      if (now - last < FRAME_MS) return;
      last = now;
      const { view, targets, flipped, squareSize } = scene.current;
      const scale = Math.min(2, window.devicePixelRatio || 1);
      const ranks = boardRanks();
      const width = Math.round(squareSize * 8 * scale);
      const height = Math.round(squareSize * ranks * scale);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const sq = width / 8;
      const alarm = view.carrier !== null;
      const centre = (square: SquareIndex) => ({
        x: visualCol(square, flipped) + 0.5,
        y: visualRow(square, flipped) + 0.5,
      });
      /** The middle of a two by two block, on screen, from its corner nearest a1 */
      const block = (file: number, rank: number) => ({
        x: flipped ? 7 - file - 1 : file + 1,
        y: flipped ? rank + 1 : ranks - rank - 1,
      });
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

      const lights = view.lights.map((light) => {
        const goal = block(light.file, light.rank);
        const here = at.get(light.id) ?? goal;
        const next = {
          x: here.x + (goal.x - here.x) * GLIDE,
          y: here.y + (goal.y - here.y) * GLIDE,
        };
        at.set(light.id, next);
        return next;
      });

      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = GLOOM;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = "destination-out";
      // The vault is never quite dark, so there is always somewhere to make for
      const vault = block(view.vault.file + 1, view.vault.rank + 1);
      wear(vault.x, vault.y, 0.6, 3.1, 0.28);
      for (const { x, y } of lights) wear(x, y, LIGHT_LIT, LIGHT_REACH, 1);
      for (const target of targets) {
        const { x, y } = centre(target);
        wear(x, y, 0.08, 0.34, 0.6);
      }
      const jewel = centre(view.sq);
      wear(jewel.x, jewel.y, 0.25, 0.8, 0.85);

      ctx.globalCompositeOperation = "source-over";
      for (const { x, y } of lights) {
        // The beam itself: cold white, or red once the alarm is up
        const reach = LIGHT_REACH * sq;
        const tint = ctx.createRadialGradient(
          x * sq,
          y * sq,
          0,
          x * sq,
          y * sq,
          reach,
        );
        tint.addColorStop(
          0,
          alarm ? "rgba(255, 80, 80, 0.3)" : "rgba(215, 232, 255, 0.24)",
        );
        tint.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = tint;
        ctx.fillRect(x * sq - reach, y * sq - reach, reach * 2, reach * 2);
      }
      if (alarm) {
        ctx.fillStyle = `rgba(255, 30, 40, ${0.06 + 0.06 * Math.sin(now / 140)})`;
        ctx.fillRect(0, 0, width, height);
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} className="heist-lights" aria-hidden />;
}
