import { useEffect, useRef } from "react";
import type { ThemeId } from "../../theme/themes";
import { stepParticles } from "./particles";
import type { Particle, Preset } from "./particles";

const FADE_SECONDS = 1;
const MAX_DT = 0.05;

/** Particles that keep drifting across a canvas, recipe chosen by the channel */
export function useParticleCanvas(
  theme: ThemeId,
  presets: Partial<Record<ThemeId, Preset>>,
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
    // An empty canvas left untouched costs the browser nothing to show
    let blank = true;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      blank = true;
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = (now: number) => {
      const dt = reducedMotion ? 0 : Math.min(MAX_DT, (now - last) / 1000);
      last = now;
      if (!blank || particlesRef.current.length > 0) ctx.clearRect(0, 0, w, h);

      const preset = presetsRef.current[themeRef.current];
      let particles = stepParticles(
        ctx,
        particlesRef.current,
        dt,
        now / 1000,
        w,
        h,
      );
      blank = particles.length === 0;
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
  }, []);

  return canvasRef;
}
