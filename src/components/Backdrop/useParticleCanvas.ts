import { useEffect, useRef } from "react";
import type { ThemeId } from "../../theme/themes";
import { stepParticles } from "./particles";
import type { Particle, Preset } from "./particles";

const FADE_SECONDS = 1;
const MAX_DT = 0.05;
/** Where the shadow of something flying high above lands, down and right of it */
const SHADOW_OFFSET = { x: 48, y: 84 };
const BOARD_CHECK_MS = 500;

/**
 * Particles that keep drifting across a canvas, recipe chosen by the channel.
 * With `shadowOn`, a selector for something under the canvas, the particles
 * cast blurred shadows onto it.
 */
export function useParticleCanvas(
  theme: ThemeId,
  presets: Partial<Record<ThemeId, Preset>>,
  shadowOn?: string,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const themeRef = useRef(theme);
  const particlesRef = useRef<Particle[]>([]);
  const presetsRef = useRef(presets);

  useEffect(() => {
    themeRef.current = theme;
    for (const p of particlesRef.current) p.fading ??= FADE_SECONDS;
    const preset = presetsRef.current[theme];
    const canvas = canvasRef.current;
    if (!preset || !canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    for (let i = 0; i < preset.count; i++) {
      particlesRef.current.push(preset.spawn(w, h, true));
    }
  }, [theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let frame = 0;
    let last = performance.now();
    let w = 0;
    let h = 0;
    let dpr = 1;
    // Particles are drawn here first, so the same picture can be laid down twice
    const sprites = shadowOn ? document.createElement("canvas") : null;
    const spriteCtx = sprites?.getContext("2d") ?? null;
    let ground: DOMRect | null = null;
    let groundCheckedAt = -Infinity;
    // An empty canvas left untouched costs the browser nothing to show
    let blank = true;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio, 1.5);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      for (const [c, c2d] of [
        [canvas, ctx],
        [sprites, spriteCtx],
      ] as const) {
        if (!c || !c2d) continue;
        c.width = w * dpr;
        c.height = h * dpr;
        c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      blank = true;
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = (now: number) => {
      const dt = reducedMotion ? 0 : Math.min(MAX_DT, (now - last) / 1000);
      last = now;
      if (!blank || particlesRef.current.length > 0) {
        ctx.clearRect(0, 0, w, h);
        spriteCtx?.clearRect(0, 0, w, h);
      }

      const preset = presetsRef.current[themeRef.current];
      let particles = stepParticles(
        spriteCtx ?? ctx,
        particlesRef.current,
        dt,
        now / 1000,
        w,
        h,
      );
      blank = particles.length === 0;
      if (sprites && !blank) {
        if (now - groundCheckedAt > BOARD_CHECK_MS) {
          ground =
            document.querySelector(shadowOn!)?.getBoundingClientRect() ?? null;
          groundCheckedAt = now;
        }
        if (ground) castShadows(ctx, sprites, ground, dpr, w, h);
        ctx.drawImage(sprites, 0, 0, w, h);
      }
      if (preset) {
        const live = particles.filter((p) => p.fading === undefined).length;
        for (let i = live; i < preset.count; i++) {
          particles.push(preset.spawn(w, h, false));
        }
        for (const extra of preset.extras ?? []) {
          if (Math.random() < extra.rate * dt) {
            particles = [...particles, ...extra.spawn(w, h)];
          }
        }
      }
      particlesRef.current = particles;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [shadowOn]);

  return canvasRef;
}

/** Lays a dark, softened copy of the particles onto the part of the screen covered by `ground` */
function castShadows(
  ctx: CanvasRenderingContext2D,
  sprites: HTMLCanvasElement,
  ground: DOMRect,
  dpr: number,
  w: number,
  h: number,
) {
  // The stretch of sprites whose shadows fall on the ground, kept inside the canvas
  const left = Math.max(0, ground.left - SHADOW_OFFSET.x);
  const top = Math.max(0, ground.top - SHADOW_OFFSET.y);
  const right = Math.min(w, ground.right - SHADOW_OFFSET.x);
  const bottom = Math.min(h, ground.bottom - SHADOW_OFFSET.y);
  if (right <= left || bottom <= top) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(ground.left, ground.top, ground.width, ground.height);
  ctx.clip();
  ctx.filter = "brightness(0) blur(7px)";
  ctx.globalAlpha = 0.5;
  ctx.drawImage(
    sprites,
    left * dpr,
    top * dpr,
    (right - left) * dpr,
    (bottom - top) * dpr,
    left + SHADOW_OFFSET.x,
    top + SHADOW_OFFSET.y,
    right - left,
    bottom - top,
  );
  ctx.restore();
}
