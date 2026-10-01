import type { SquareIndex } from "../../engine";
import { visualCol, visualRow } from "./boardGeometry";
import type { PortalPair } from "./readOverlays";

const ARROW_COLORS = {
  blue: "rgba(30, 144, 255, 0.6)",
  orange: "rgba(255, 140, 0, 0.6)",
};
const CHEVRON_SPACING = 2.5;

/** Chevrons streaming from the selected piece's entrance portal to its exit */
export function PortalArrows({
  pairs,
  entrance,
  flipped,
}: {
  pairs: PortalPair[];
  entrance: SquareIndex;
  flipped: boolean;
}) {
  const pair = pairs.find((p) => p.a === entrance || p.b === entrance);
  if (!pair) return null;
  const exit = entrance === pair.a ? pair.b : pair.a;

  // Board coordinates in percent, matching the SVG's 0-100 viewBox
  const x1 = (visualCol(entrance, flipped) + 0.5) * 12.5;
  const y1 = (visualRow(entrance, flipped) + 0.5) * 12.5;
  const x2 = (visualCol(exit, flipped) + 0.5) * 12.5;
  const y2 = (visualRow(exit, flipped) + 0.5) * 12.5;
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
  const count = Math.max(
    4,
    Math.round(Math.hypot(x2 - x1, y2 - y1) / CHEVRON_SPACING),
  );
  const duration = count * 0.2;

  return (
    <svg className="portal-arrow-svg" viewBox="0 0 100 100">
      {Array.from({ length: count }, (_, i) => {
        const delay = (i * duration) / count;
        return (
          <g
            key={i}
            className="portal-chevron"
            style={
              {
                "--chevron-dur": `${duration}s`,
                animationDelay: `-${duration - delay}s`,
              } as React.CSSProperties
            }
          >
            <animateMotion
              dur={`${duration}s`}
              repeatCount="indefinite"
              begin={`-${delay}s`}
              path={`M${x1},${y1} L${x2},${y2}`}
            />
            <text
              textAnchor="middle"
              dy="0.35em"
              fill={ARROW_COLORS[pair.color]}
              fontSize="6"
              fontWeight="bold"
              transform={`rotate(${angle})`}
            >
              {"›"}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
