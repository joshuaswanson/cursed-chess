import { FRONT_PRESETS } from "./particles";
import { useParticleCanvas } from "./useParticleCanvas";
import { Fighter, Mothership, Rocket, Ufo } from "./Ships";
import "./Backdrop.css";

/** Ships, rocks, and meteors that fly across the screen in front of the board */
export function SpaceTraffic() {
  const canvasRef = useParticleCanvas("portals", FRONT_PRESETS);
  return (
    <div className="space-traffic" aria-hidden>
      <div className="ship ship-mothership">
        <Mothership />
      </div>
      <div className="ship ship-ufo">
        <Ufo />
      </div>
      <div className="ship ship-rocket">
        <Rocket />
      </div>
      <div className="ship ship-fighter">
        <Fighter />
      </div>
      <div className="ship ship-fighter ship-chaser">
        <Fighter />
      </div>
      <canvas ref={canvasRef} className="backdrop-particles" />
    </div>
  );
}
