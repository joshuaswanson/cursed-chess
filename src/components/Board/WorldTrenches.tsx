import { useMemo } from "react";
import { BOARD, MARGIN, REACH, SQ, frontFor } from "./trenchFront";
import type { Sandbag } from "./trenchFront";
import "./WorldTrenches.css";

/** Sandbags laid in courses, each turned along the line it sits on */
function Sandbags({ bags }: { bags: Sandbag[] }) {
  return (
    <>
      {bags.map((b, i) => (
        <rect
          key={i}
          x={b.x}
          y={b.y - 4.5}
          width={b.w}
          height={9}
          rx={3.5}
          className="sandbag"
          transform={`rotate(${b.tilt.toFixed(1)} ${b.x} ${b.y})`}
        />
      ))}
    </>
  );
}

/** The turned-earth texture and the shell hole shading the front is drawn with */
function EarthDefs() {
  return (
    <defs>
      <filter id="wt-soil" x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.09"
          numOctaves="4"
          seed="5"
          stitchTiles="stitch"
          result="n"
        />
        <feDiffuseLighting
          in="n"
          surfaceScale="3"
          diffuseConstant="1"
          lightingColor="#fff"
          result="lit"
        >
          <feDistantLight azimuth="235" elevation="40" />
        </feDiffuseLighting>
        <feFlood floodColor="#4a3824" result="base" />
        <feComposite
          in="lit"
          in2="base"
          operator="arithmetic"
          k1="1"
          k2="0"
          k3="0.1"
          k4="0"
        />
      </filter>
      <pattern
        id="wt-earth"
        width="140"
        height="140"
        patternUnits="userSpaceOnUse"
      >
        <rect width="140" height="140" filter="url(#wt-soil)" />
      </pattern>
      <radialGradient id="wt-crater">
        <stop offset="0" stopColor="#3a3f3e" />
        <stop offset="0.45" stopColor="#2c2a24" />
        <stop offset="0.62" stopColor="#2a1d12" />
        <stop offset="0.8" stopColor="#6b5236" />
        <stop offset="1" stopColor="#6b5236" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

const viewBox = `${-REACH} 0 ${BOARD + REACH * 2} ${BOARD + MARGIN * 2}`;
const placement = {
  "--reach": REACH / SQ,
  "--margin": MARGIN / SQ,
} as React.CSSProperties;

/**
 * The front running on off both sides of the board: the same trench lines
 * zigzagging away into the distance, communication trenches between them,
 * wire and shell holes across no man's land, so the board is one stretch of
 * a war that goes on out of sight
 */
export function WorldTrenches({ flipped }: { flipped: boolean }) {
  const scene = useMemo(() => frontFor(flipped), [flipped]);

  return (
    <svg
      className="world-trenches"
      viewBox={viewBox}
      preserveAspectRatio="none"
      style={placement}
      aria-hidden
    >
      <EarthDefs />
      {scene.craters.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={c.r} fill="url(#wt-crater)" />
      ))}
      {scene.comms.map((d, i) => (
        <g key={`c${i}`}>
          <path d={d} className="comms-cut" />
          <path d={d} className="comms-floor" />
        </g>
      ))}
      {scene.lines.map((line) => (
        <g key={line.key}>
          {line.farWorks.heap && (
            <>
              <path d={line.farWorks.heap} className="spoil" />
              <path d={line.farWorks.heap} className="earth-texture" />
            </>
          )}
          <Sandbags bags={line.farWorks.bags} />
          <path d={line.outline} className="trench-cut" />
          <path d={line.outline} className="earth-texture trench-floor" />
          <path d={line.centre} className="duckboard-bed" />
          <path d={line.centre} className="duckboards" />
          {line.water.map((w, i) => (
            <ellipse
              key={i}
              cx={w.x}
              cy={w.y}
              rx={w.rx}
              ry={w.ry}
              className="trench-water"
            />
          ))}
          <path d={line.farWall} className="far-wall" />
          <path d={line.farWall} className="earth-texture" />
          <path d={line.wattle} className="wattle" />
          <path d={line.stakes} className="stakes" />
          <path d={line.outline} className="trench-lip" />
        </g>
      ))}
      {scene.wire.coils.map((d, i) => (
        <path key={`w${i}`} d={d} className="world-wire" />
      ))}
      {scene.wire.posts.map((p, i) => (
        <rect
          key={`p${i}`}
          x={p.x - 2.5}
          y={p.y - 9}
          width={5}
          height={14}
          className="world-post"
        />
      ))}
    </svg>
  );
}

/** The sandbags along the near edge of the enemy's trenches, drawn in front of the men in them */
export function WorldTrenchesFront({ flipped }: { flipped: boolean }) {
  const scene = useMemo(() => frontFor(flipped), [flipped]);
  return (
    <svg
      className="world-trenches world-trenches-front"
      viewBox={viewBox}
      preserveAspectRatio="none"
      style={placement}
      aria-hidden
    >
      {scene.lines.map((line) => (
        <g key={line.key}>
          <Sandbags bags={line.nearBags} />
        </g>
      ))}
    </svg>
  );
}
