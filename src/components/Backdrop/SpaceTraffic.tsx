import { FRONT_PRESETS } from "./particles";
import { useParticleCanvas } from "./useParticleCanvas";
import { Rocket } from "./Ships";
import "./Backdrop.css";

/** A rocket, rocks, and meteors that fly across the screen in front of the board */
export function SpaceTraffic() {
  const canvasRef = useParticleCanvas("portals", FRONT_PRESETS);
  return (
    <div className="space-traffic" aria-hidden>
      <div className="ship ship-rocket">
        <Rocket />
      </div>
      <canvas ref={canvasRef} className="backdrop-particles" />
    </div>
  );
}
