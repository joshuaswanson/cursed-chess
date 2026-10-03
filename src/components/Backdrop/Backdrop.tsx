import { useEffect, useRef } from "react";
import type { ThemeId } from "../../theme/themes";
import { useGameStore } from "../../stores/gameStore";
import { PRESETS } from "./particles";
import { useParticleCanvas } from "./useParticleCanvas";
import { BattleLand } from "./BattleLand";
import { SiegeCamp } from "./SiegeCamp";
import "./Backdrop.css";

/** How fast the spirals whirl backwards while gravity shifts, against their usual speed */
const SHIFT_SPIN_RATE = -3;
const RAMP_IN_MS = 350;
const RAMP_OUT_MS = 700;

/** The funhouse spirals, which whirl the other way while the pieces fall */
function Spirals() {
  const falling = useGameStore((s) => s.gravityFalling);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const spins = ref.current?.getAnimations({ subtree: true }) ?? [];
    const starts = spins.map((a) => a.playbackRate);
    const target = falling ? SHIFT_SPIN_RATE : 1;
    const duration = falling ? RAMP_IN_MS : RAMP_OUT_MS;
    const begin = performance.now();
    let frame = 0;
    const ramp = (now: number) => {
      const t = Math.min(1, (now - begin) / duration);
      const ease = t * t * (3 - 2 * t);
      spins.forEach((a, i) => {
        a.playbackRate = starts[i] + (target - starts[i]) * ease;
      });
      if (t < 1) frame = requestAnimationFrame(ramp);
    };
    frame = requestAnimationFrame(ramp);
    return () => cancelAnimationFrame(frame);
  }, [falling]);
  return (
    <div ref={ref} className="spirals">
      <div className="spiral" />
      <div className="spiral spiral-inner" />
    </div>
  );
}

/** Hand-drawn scenery for each channel, layered under the particles */
function Scene({ theme }: { theme: ThemeId }) {
  switch (theme) {
    case "portals":
      return (
        <>
          <div className="nebula nebula-a" />
          <div className="nebula nebula-b" />
          <div className="planet-giant" />
          <div className="planet-blue" />
          <div className="moon-cratered" />
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
    case "fifa":
      return (
        <>
          <div className="stand stand-far" />
          <div className="stand stand-near" />
          <div className="floodlight floodlight-left">
            <div className="floodlight-beam" />
          </div>
          <div className="floodlight floodlight-right">
            <div className="floodlight-beam" />
          </div>
          <div className="stadium-turf" />
        </>
      );
    case "gravity":
      return <Spirals />;
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
      return <BattleLand />;
    case "siege":
      return <SiegeCamp />;
    default:
      return null;
  }
}

/** Full-window animated scenery behind the game, different for every channel */
export function Backdrop({ theme }: { theme: ThemeId }) {
  const canvasRef = useParticleCanvas(theme, PRESETS);
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
