import { pieceImage } from "../../utils/pieceImages";
import { offsetBetween, visualCol, visualRow } from "./boardGeometry";
import { PortalBurst } from "./Portal";
import { phaseDurationMs } from "./usePortalTravel";
import type { PortalTravel } from "./usePortalTravel";

const PHASE_CLASS = {
  approach: "",
  shrink: " portal-anim-enter",
  pop: " portal-anim-exit",
  fly: " portal-anim-fly",
};

/** The piece moving through portals, plus the burst at the portal it is touching */
export function PortalTravelPiece({
  travel,
  flipped,
  squareSize,
}: {
  travel: PortalTravel;
  flipped: boolean;
  squareSize: number;
}) {
  const phase = travel.phases[travel.phaseIndex];
  if (!phase) return null;
  const durationMs = phaseDurationMs(phase);

  const style: React.CSSProperties & Record<string, string> = {
    left: `${visualCol(phase.sq, flipped) * 12.5 + 0.625}%`,
    top: `${visualRow(phase.sq, flipped) * 12.5 + 0.625}%`,
    width: "11.25%",
    height: "11.25%",
  };
  if (phase.slideFrom !== undefined) {
    const offset = offsetBetween(
      phase.slideFrom,
      phase.sq,
      flipped,
      squareSize,
    );
    style["--slide-from-x"] = `${offset.x}px`;
    style["--slide-from-y"] = `${offset.y}px`;
  }
  if (phase.type === "shrink") {
    // The piece stretches back along the way it came, so find where that was
    const before = travel.phases[travel.phaseIndex - 1];
    const cameFrom = before?.slideFrom ?? travel.info.from;
    const back = offsetBetween(cameFrom, phase.sq, flipped, 1);
    const angle =
      back.x === 0 && back.y === 0
        ? 90
        : (Math.atan2(-back.y, -back.x) * 180) / Math.PI;
    style["--pull"] = `${angle}deg`;
    style.animationDuration = `${durationMs}ms`;
  }
  if (phase.type === "approach") {
    style.animation = `slide-in ${durationMs}ms ease-in forwards`;
  } else if (phase.type === "fly") {
    style.animationDuration = `${durationMs}ms`;
  }

  const burstSq = phase.type === "fly" ? phase.slideFrom : phase.sq;
  const showBurst = phase.type !== "approach" && burstSq !== undefined;

  return (
    <>
      {showBurst && (
        <PortalBurst
          key={`burst-${travel.phaseIndex}`}
          color={phase.color}
          direction={phase.type === "shrink" ? "in" : "out"}
          style={
            {
              left: `${visualCol(burstSq, flipped) * 12.5}%`,
              top: `${visualRow(burstSq, flipped) * 12.5}%`,
              width: "12.5%",
              height: "12.5%",
              "--reach": `${squareSize * 0.8}px`,
            } as React.CSSProperties
          }
        />
      )}
      <img
        key={`piece-${travel.phaseIndex}`}
        src={pieceImage(travel.info.piece)}
        className={`portal-anim-piece portal-${phase.color}${PHASE_CLASS[phase.type]}`}
        style={style}
        draggable={false}
      />
    </>
  );
}
