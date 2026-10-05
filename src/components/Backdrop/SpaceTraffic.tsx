import { FRONT_PRESETS } from "./particles";
import { useParticleCanvas } from "./useParticleCanvas";
import "./Backdrop.css";

/** Rocks and meteors that fly across the screen in front of the board, shadowing it as they pass */
export function SpaceTraffic() {
  const canvasRef = useParticleCanvas("portals", FRONT_PRESETS, ".board-shell");
  return (
    <div className="space-traffic" aria-hidden>
      <canvas ref={canvasRef} className="backdrop-particles" />
    </div>
  );
}
