import { pieceImage } from "../../utils/pieceImages";
import { offsetBetween, visualCol, visualRow } from "./boardGeometry";
import { PortalBurst } from "./Portal";
import { SpaghettiPiece } from "./Spaghetti";
import { phaseDurationMs } from "./usePortalTravel";
import type { PortalTravel } from "./usePortalTravel";

const PHASE_CLASS = {
  approach: "",
  shrink: "",
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
  if (phase.type === "approach") {
    style.animation = `slide-in ${durationMs}ms ease-in forwards`;
  } else if (phase.type === "fly") {
    style.animationDuration = `${durationMs}ms`;
  }

  // The piece tapers toward the hole along the way it was heading, so find where it came from
  const before = travel.phases[travel.phaseIndex - 1];
  const back = offsetBetween(
    before?.slideFrom ?? travel.info.from,
    phase.sq,
    flipped,
    1,
  );
  const heading =
    back.x === 0 && back.y === 0
      ? 90
      : (Math.atan2(-back.y, -back.x) * 180) / Math.PI;

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
      {phase.type === "shrink" ? (
        <SpaghettiPiece
          key={`piece-${travel.phaseIndex}`}
          src={pieceImage(travel.info.piece)}
          heading={heading}
          squareSize={squareSize}
          durationMs={durationMs}
          color={phase.color}
          style={{
            left: `calc(${visualCol(phase.sq, flipped) * 12.5 + 6.25}% - ${(squareSize * 3) / 2}px)`,
            top: `calc(${visualRow(phase.sq, flipped) * 12.5 + 6.25}% - ${(squareSize * 3) / 2}px)`,
          }}
        />
      ) : (
        <img
          key={`piece-${travel.phaseIndex}`}
          src={pieceImage(travel.info.piece)}
          className={`portal-anim-piece portal-${phase.color}${PHASE_CLASS[phase.type]}`}
          style={style}
          draggable={false}
        />
      )}
    </>
  );
}
