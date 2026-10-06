import { memo, useMemo } from "react";
import { BOARD, MARGIN, REACH, SQ, frontFor } from "./trenchFront";
import type { Sandbag } from "./trenchFront";
import { ShellHole } from "./ShellHole";
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
        // Fatter bags bulge, thinner ones lie flat; the fill sags to one end
        const top = 0.9 + b.plump * 0.3;
        const lo = b.slump > 0 ? 1 + b.slump * 0.18 : 1;
        const ro = b.slump < 0 ? 1 - b.slump * 0.18 : 1;
        const body = `M${-w * 0.96} ${-h * 0.2 * lo} Q${-w * 1.02} ${-h * 0.95 * lo} ${-w * 0.6} ${-h * 0.98 * lo} Q0 ${-h * (1.04 + top * 0.18)} ${w * 0.6} ${-h * 0.98 * ro} Q${w * 1.02} ${-h * 0.95 * ro} ${w * 0.96} ${-h * 0.2 * ro} Q${w * 1.1} ${h * 0.35} ${w * 0.9} ${h * 0.72} Q${w * 0.5} ${h * 1.08} 0 ${h * 1.04} Q${-w * 0.5} ${h * 1.08} ${-w * 0.9} ${h * 0.72} Q${-w * 1.1} ${h * 0.35} ${-w * 0.96} ${-h * 0.2 * lo} Z`;
        // Fresh sacking is pale and warm, old sacking dark, grey, and filthy
        const look = `brightness(${(1.12 - b.wear * 0.5 + (b.tone - 0.5) * 0.18).toFixed(2)}) saturate(${(1.05 - b.wear * 0.55).toFixed(2)}) sepia(${(b.tone * 0.25).toFixed(2)})`;
        const crease =
          b.creases < 0.33
            ? `M${-w * 0.55} ${-h * 0.5} Q${-w * 0.1} ${-h * 0.15} ${w * 0.2} ${-h * 0.62} M${w * 0.1} ${h * 0.55} Q${w * 0.45} ${h * 0.2} ${w * 0.7} ${h * 0.45}`
            : b.creases < 0.66
              ? `M${-w * 0.2} ${-h * 0.75} Q${-w * 0.05} ${-h * 0.1} ${-w * 0.3} ${h * 0.6} M${w * 0.35} ${-h * 0.6} Q${w * 0.55} ${-h * 0.1} ${w * 0.4} ${h * 0.4}`
              : `M${-w * 0.7} ${-h * 0.1} Q${-w * 0.3} ${-h * 0.45} ${w * 0.05} ${-h * 0.2} Q${w * 0.4} ${h * 0.05} ${w * 0.75} ${-h * 0.25}`;
        return (
          <g
            key={i}
            transform={`translate(${b.x.toFixed(1)} ${b.y.toFixed(1)}) rotate(${b.tilt.toFixed(1)})`}
          >
            <ellipse
              cx={w * 0.08}
              cy={h * 0.95}
              rx={w * 1.02}
              ry={h * 0.35}
              className="sandbag-cast"
            />
            <path d={body} className="sandbag" style={{ filter: look }} />
            {b.mud.map((m, k) => (
              <ellipse
                key={k}
                cx={m.x * w}
                cy={m.y * h}
                rx={m.r * w}
                ry={m.r * h * 0.8}
                className="sandbag-mud"
              />
            ))}
            <path d={body} className="sandbag-shade" />
            <path d={crease} className="sandbag-crease" />
            <path
              d={`M${-w * 0.78} ${h * 0.05} Q0 ${h * 0.3} ${w * 0.78} ${h * 0.05}`}
              className="sandbag-seam"
            />
            {b.split && (
              <>
                <path
                  d={`M${-w * 0.2} ${h * 0.12} Q${w * 0.05} ${h * 0.5} ${w * 0.35} ${h * 0.15} Q${w * 0.1} ${h * 0.3} ${-w * 0.2} ${h * 0.12} Z`}
                  className="sandbag-split"
                />
                <path
                  d={`M${-w * 0.1} ${h * 0.4} q${w * 0.2} ${h * 0.6} ${w * 0.5} ${h * 0.75} q${-w * 0.3} ${h * 0.1} ${-w * 0.55} ${-h * 0.15} Z`}
                  className="sandbag-spill"
                />
              </>
            )}
            <path
              d={`M${-w * 0.92} ${-h * 0.7} q${-w * 0.14} ${-h * 0.25} ${-w * 0.2} ${-h * 0.05} M${w * 0.92} ${-h * 0.7} q${w * 0.14} ${-h * 0.25} ${w * 0.2} ${-h * 0.05}`}
              className="sandbag-ears"
            />
            <path
              d={`M${-w * 0.5} ${-h * 0.82} Q0 ${-h * 1.04} ${w * 0.45} ${-h * 0.84}`}
              className="sandbag-light"
              style={{ opacity: 1 - b.wear * 0.7 }}
            />
          </g>
        );
      })}
    </>
  );
}

/** A photographic texture from the front, tiled across whatever it fills, at a size in the drawing's units */
function PhotoPattern({
  id,
  file,
  size,
}: {
  id: string;
  file: string;
  size: number;
}) {
  return (
    <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
      <image
        href={`${TEXTURES}${file}.jpg`}
        width={size}
        height={size}
        preserveAspectRatio="none"
      />
    </pattern>
  );
}

const TEXTURES = `${import.meta.env.BASE_URL}textures/trenches/`;

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
      <filter id="wt-soft-bag" x="-20%" y="-60%" width="140%" height="220%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
      <filter id="wt-soft" x="-5%" y="-50%" width="110%" height="200%">
        <feGaussianBlur stdDeviation="5" />
      </filter>
      <PhotoPattern id="tx-mud" file="mud" size={240} />
      <PhotoPattern id="tx-soil" file="soil" size={180} />
      <PhotoPattern id="tx-planks" file="planks" size={110} />
      <PhotoPattern id="tx-duck" file="duckboards" size={90} />
      <PhotoPattern id="tx-hessian" file="hessian" size={30} />
      <radialGradient id="wt-shade" cx="0.42" cy="0.22" r="0.85">
        <stop offset="0" stopColor="#fff" stopOpacity="0.22" />
        <stop offset="0.45" stopColor="#000" stopOpacity="0" />
        <stop offset="0.8" stopColor="#000" stopOpacity="0.4" />
        <stop offset="1" stopColor="#000" stopOpacity="0.7" />
      </radialGradient>
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
function WorldTrenchesLayer({ flipped }: { flipped: boolean }) {
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
          <clipPath id={`wt-inside-${line.key}`}>
            <path d={line.outline} />
          </clipPath>
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
          {/* Sandbags piled along the lip, over the edge of the cut */}
          <Sandbags bags={line.farWorks.bags} />
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
function WorldTrenchesFrontLayer({ flipped }: { flipped: boolean }) {
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

/** The shell holes pocking the ground off the board, under the trench lines */
function WorldCratersLayer({ flipped }: { flipped: boolean }) {
  const scene = useMemo(() => frontFor(flipped), [flipped]);
  const width = BOARD + REACH * 2;
  const height = BOARD + MARGIN * 2;
  return (
    <div className="world-trenches world-craters" style={placement} aria-hidden>
      {scene.craters.map((c) => (
        <ShellHole
          key={c.seed}
          seed={c.seed}
          style={{
            left: `${((c.x - c.r + REACH) / width) * 100}%`,
            top: `${((c.y - c.r) / height) * 100}%`,
            width: `${((c.r * 2) / width) * 100}%`,
            height: `${((c.r * 2) / height) * 100}%`,
          }}
        />
      ))}
    </div>
  );
}

// The front only changes when the board turns round, so these skip the
// game's many re-renders a second
export const WorldTrenches = memo(WorldTrenchesLayer);
export const WorldTrenchesFront = memo(WorldTrenchesFrontLayer);
export const WorldCraters = memo(WorldCratersLayer);
