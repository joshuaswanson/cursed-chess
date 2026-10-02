import { FRONT_PRESETS } from "./particles";
import { useParticleCanvas } from "./useParticleCanvas";
import { Fighter, Rocket, Ufo } from "./Ships";
import "./Backdrop.css";

/** Ships, rocks, and meteors that fly across the screen in front of the board */
export function SpaceTraffic() {
  const canvasRef = useParticleCanvas("portals", FRONT_PRESETS);
  return (
    <div className="space-traffic" aria-hidden>
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
        <Fighter variant="red" />
      </div>
      <canvas ref={canvasRef} className="backdrop-particles" />
    </div>
  );
}
