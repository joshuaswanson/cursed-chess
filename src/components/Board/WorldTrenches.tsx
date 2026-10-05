import { useMemo } from "react";
import { BOARD, MARGIN, REACH, SQ, frontFor } from "./trenchFront";
import type { Sandbag } from "./trenchFront";
import "./WorldTrenches.css";

/**
 * Sandbags laid in courses: burlap bags plumped in the middle, their tied
 * ends pinched, a seam down each, lit from above
 */
function Sandbags({ bags }: { bags: Sandbag[] }) {
  return (
    <>
      {bags.map((b, i) => {
        const w = b.w / 2;
        const h = b.h / 2;
        const body = `M${-w} ${-h * 0.35} Q${-w * 0.92} ${-h * 1.05} ${-w * 0.55} ${-h} Q0 ${-h * 1.25} ${w * 0.55} ${-h} Q${w * 0.92} ${-h * 1.05} ${w} ${-h * 0.35} Q${w * 1.12} 0 ${w} ${h * 0.4} Q${w * 0.9} ${h * 1.05} ${w * 0.5} ${h} Q0 ${h * 1.15} ${-w * 0.5} ${h} Q${-w * 0.9} ${h * 1.05} ${-w} ${h * 0.4} Q${-w * 1.12} 0 ${-w} ${-h * 0.35} Z`;
        return (
          <g
            key={i}
            transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${b.tilt.toFixed(1)})`}
          >
            <path
              d={body}
              className="sandbag"
              style={{ filter: `brightness(${0.82 + b.tone * 0.3})` }}
            />
            <path d={body} className="sandbag-weave" />
            <path
              d={`M${-w * 0.7} ${-h * 0.15} Q0 ${h * 0.1} ${w * 0.7} ${-h * 0.15}`}
              className="sandbag-seam"
            />
            <path
              d={`M${-w * 0.92} ${-h * 0.5} L${-w * 1.08} ${-h * 0.8} M${w * 0.92} ${-h * 0.5} L${w * 1.08} ${-h * 0.8}`}
              className="sandbag-ears"
            />
          </g>
        );
      })}
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
      <linearGradient id="wt-burlap" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#b8a679" />
        <stop offset="0.45" stopColor="#8f7d55" />
        <stop offset="1" stopColor="#5b4d31" />
      </linearGradient>
      <pattern id="wt-weave" width="3" height="3" patternUnits="userSpaceOnUse">
        <path d="M0 1.5 H3 M1.5 0 V3" stroke="#3b301d" strokeWidth="0.5" />
      </pattern>
      <linearGradient id="wt-plank" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#8a6a42" />
        <stop offset="0.5" stopColor="#7a5c37" />
        <stop offset="1" stopColor="#5f4628" />
      </linearGradient>
      <linearGradient id="wt-depth" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0" />
        <stop offset="0.5" stopColor="#000" stopOpacity="0.25" />
        <stop offset="1" stopColor="#000" stopOpacity="0.65" />
      </linearGradient>
      <filter id="wt-soft" x="-5%" y="-50%" width="110%" height="200%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
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
          <path
            d={line.centre}
            className="duckboard-rail"
            transform="translate(0 -9)"
          />
          <path
            d={line.centre}
            className="duckboard-rail"
            transform="translate(0 9)"
          />
          <path d={line.slats[0]} className="slats" />
          <path d={line.slats[1]} className="slats slats-dark" />
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
          <path d={line.boardsLight} className="planks" />
          <path d={line.wattle} className="planks planks-dark" />
          <path d={line.stakes} className="stakes" />
          {/* Darker the deeper the wall goes, out of the light */}
          <path d={line.farWall} fill="url(#wt-depth)" />
          <g clipPath={`url(#wt-inside-${line.key})`}>
            <path d={line.outline} className="trench-occlusion" />
          </g>
          <path d={line.farLip} className="lip-rim" />
          <path d={line.nearLip} className="lip-rim" />
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
          {line.ours && (
            <>
              <path d={line.nearLip} className="near-crumb" />
              <path d={line.nearLip} className="lip-rim" />
            </>
          )}
          <Sandbags bags={line.nearBags} />
        </g>
      ))}
    </svg>
  );
}
