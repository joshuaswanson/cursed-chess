import type { CSSProperties } from "react";
import { HOLE_AT, HOLE_TILT } from "./particles";

/** How far the flat of space lies above the throat of the well, in pixels */
const WELL_DEPTH = 300;
/** How quickly the well flattens out away from the hole */
const WELL_SOFTNESS = 90;
const RINGS = Array.from({ length: 22 }, (_, i) => 46 * Math.pow(1.24, i));
const SPOKES = 36;

/** How far up from the throat, where the hole is, a ring of the well lies */
const rise = (radius: number) =>
  WELL_DEPTH *
  (WELL_SOFTNESS / (WELL_SOFTNESS + RINGS[0]) -
    WELL_SOFTNESS / (WELL_SOFTNESS + radius));

const point = (radius: number, angle: number) =>
  `${(Math.cos(angle) * radius).toFixed(1)},${(
    Math.sin(angle) * radius * HOLE_TILT -
    rise(radius)
  ).toFixed(1)}`;

/**
 * Space round the black hole drawn the way physicists draw it: a sheet of
 * grid pulled down into a well, the hole at the bottom of its throat, with
 * its disc of gas lying flat round it and the light from the far side of
 * the disc bent up over the top
 */
export function WarpedSpace() {
  return (
    <div
      className="warped-space"
      style={
        {
          left: `${HOLE_AT.x * 100}vw`,
          top: `${HOLE_AT.y * 100}vh`,
        } as CSSProperties
      }
    >
      <svg viewBox="-2400 -1800 4800 3000" className="warped-grid">
        <defs>
          <radialGradient id="warp-glow">
            <stop offset="0" stopColor="#ffb547" stopOpacity="0.55" />
            <stop offset="0.35" stopColor="#ff6a2a" stopOpacity="0.18" />
            <stop offset="1" stopColor="#ff6a2a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="warp-disc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ff6a2a" stopOpacity="0" />
            <stop offset="0.3" stopColor="#ff8a35" />
            <stop offset="0.5" stopColor="#fff1c8" />
            <stop offset="0.7" stopColor="#ff8a35" />
            <stop offset="1" stopColor="#ff6a2a" stopOpacity="0" />
          </linearGradient>
        </defs>
        {RINGS.map((radius, i) => (
          <ellipse
            key={radius}
            cx="0"
            cy={-rise(radius)}
            rx={radius}
            ry={radius * HOLE_TILT}
            className="warp-ring"
            style={{ opacity: 0.5 - (i / RINGS.length) * 0.42 }}
          />
        ))}
        {Array.from({ length: SPOKES }, (_, j) => {
          const angle = (j / SPOKES) * Math.PI * 2;
          return (
            <polyline
              key={j}
              className="warp-spoke"
              points={RINGS.map((radius) => point(radius, angle)).join(" ")}
            />
          );
        })}
        <circle r="360" fill="url(#warp-glow)" />
        {/* The far side of the disc, its light bent up and over the hole */}
        <ellipse className="warp-halo" rx="62" ry="58" />
        <ellipse className="warp-disc" rx="210" ry="34" />
        <ellipse className="warp-disc-sparkle" rx="190" ry="30" />
        <circle className="warp-core" r="44" />
        <circle className="warp-photon" r="47" />
        {/* The near side of the disc, passing in front of the hole */}
        <path className="warp-disc" d="M -210 0 A 210 34 0 0 0 210 0" />
        <path className="warp-disc-sparkle" d="M -190 0 A 190 30 0 0 0 190 0" />
      </svg>
    </div>
  );
}
