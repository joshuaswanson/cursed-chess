import { useEffect, useRef } from "react";
import type { ThemeId } from "../../theme/themes";
import { PRESETS, stepParticles } from "./particles";
import type { Particle } from "./particles";
import "./Backdrop.css";

const FADE_SECONDS = 1;
const MAX_DT = 0.05;

/** Particles that keep drifting behind everything, recipe chosen by the channel */
function useParticleCanvas(theme: ThemeId) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const themeRef = useRef(theme);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    themeRef.current = theme;
    for (const p of particlesRef.current) p.fading ??= FADE_SECONDS;
    const preset = PRESETS[theme];
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
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const tick = (now: number) => {
      const dt = reducedMotion ? 0 : Math.min(MAX_DT, (now - last) / 1000);
      last = now;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const preset = PRESETS[themeRef.current];
      let particles = stepParticles(
        ctx,
        particlesRef.current,
        dt,
        now / 1000,
        w,
        h,
      );
      if (preset) {
        const live = particles.filter((p) => p.fading === undefined).length;
        for (let i = live; i < preset.count; i++) {
          particles.push(preset.spawn(w, h, false));
        }
        if (preset.extra && Math.random() < preset.extra.rate * dt) {
          particles = [...particles, preset.extra.spawn(w, h)];
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

/** Hand-drawn scenery for each channel, layered under the particles */
function Scene({ theme }: { theme: ThemeId }) {
  switch (theme) {
    case "portals":
      return (
        <>
          <div className="nebula nebula-a" />
          <div className="nebula nebula-b" />
          <div className="planet">
            <div className="planet-ring" />
          </div>
        </>
      );
    case "fog":
      return (
        <>
          <div className="moon" />
          <svg
            className="ridge ridge-far"
            viewBox="0 0 1200 200"
            preserveAspectRatio="none"
          >
            <path d="M0 200 L0 120 Q150 60 300 110 T600 90 T900 120 T1200 80 L1200 200 Z" />
          </svg>
          <svg
            className="ridge ridge-near"
            viewBox="0 0 1200 200"
            preserveAspectRatio="none"
          >
            <path d="M0 200 L0 150 Q200 100 380 150 T760 130 T1200 150 L1200 200 Z" />
          </svg>
        </>
      );
    case "royale":
      return (
        <>
          <div className="heat-glow" />
          <svg
            className="volcano"
            viewBox="0 0 1200 300"
            preserveAspectRatio="none"
          >
            <path d="M0 300 L0 240 L380 210 L520 90 L560 80 L600 100 L660 85 L700 95 L840 210 L1200 230 L1200 300 Z" />
            <path className="lava-vein" d="M560 82 Q575 150 548 210 T540 300" />
            <path className="lava-vein" d="M640 90 Q630 160 668 220 T690 300" />
          </svg>
        </>
      );
    case "clash":
      return (
        <>
          <div className="team-half team-blue" />
          <div className="team-half team-red" />
          <div className="spotlight spotlight-left" />
          <div className="spotlight spotlight-right" />
          <div className="banner banner-left" />
          <div className="banner banner-right" />
        </>
      );
    case "mines":
      return (
        <>
          <div className="camo" />
          <div className="radar-grid" />
          <div className="radar-sweep" />
          <div className="hazard-band" />
        </>
      );
    case "hill":
      return (
        <>
          <div className="sunburst" />
          <div className="sun-core" />
          <svg
            className="hills"
            viewBox="0 0 1200 200"
            preserveAspectRatio="none"
          >
            <path d="M0 200 L0 130 Q300 40 600 120 T1200 100 L1200 200 Z" />
          </svg>
        </>
      );
    case "gravity":
      return (
        <>
          <div className="spiral" />
          <div className="spiral spiral-inner" />
        </>
      );
    case "hex":
      return (
        <>
          <div className="synth-sun" />
          <div className="synth-floor">
            <div className="synth-grid" />
          </div>
        </>
      );
    case "stratego":
      return (
        <>
          <div className="caustics" />
          <svg
            className="island"
            viewBox="0 0 400 160"
            preserveAspectRatio="xMidYMax meet"
          >
            <path
              className="island-sand"
              d="M20 160 Q120 90 210 100 Q300 105 380 160 Z"
            />
            <path className="palm-trunk" d="M200 102 Q190 60 214 22" />
            <path
              className="palm-leaf"
              d="M214 22 Q250 10 280 32 Q246 24 214 30 Z"
            />
            <path
              className="palm-leaf"
              d="M214 22 Q180 4 150 24 Q184 18 212 30 Z"
            />
            <path
              className="palm-leaf"
              d="M214 22 Q238 40 246 70 Q226 44 210 32 Z"
            />
          </svg>
          <div className="waves waves-back" />
          <div className="waves waves-front" />
        </>
      );
    default:
      return null;
  }
}

/** Full-window animated scenery behind the game, different for every channel */
export function Backdrop({ theme }: { theme: ThemeId }) {
  const canvasRef = useParticleCanvas(theme);
  return (
    <div className="backdrop" data-scene={theme} aria-hidden>
      <div className="backdrop-sky" />
      <div className="backdrop-scene" key={theme}>
        <Scene theme={theme} />
      </div>
      <canvas ref={canvasRef} className="backdrop-particles" />
      <div className="backdrop-halftone" />
      <div className="backdrop-vignette" />
    </div>
  );
}
