import type { ThemeId } from "../../theme/themes";
import { PRESETS } from "./particles";
import { useParticleCanvas } from "./useParticleCanvas";
import { BattleLand } from "./BattleLand";
import "./Backdrop.css";

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
      return <BattleLand />;
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
