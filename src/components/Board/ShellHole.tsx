import { useMemo } from "react";
import "./ShellHole.css";

const TEXTURES = `${import.meta.env.BASE_URL}textures/trenches/`;

/** A seeded random source, so a crater keeps its shape */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A closed, lumpy outline around the middle: a ring of points pushed in and out at random, smoothed */
function blob(
  rand: () => number,
  radius: number,
  squash: number,
  rough: number,
): string {
  const count = 14;
  const pts = Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    const r = radius * (1 - rough / 2 + rand() * rough);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r * squash };
  });
  // Smooth through the midpoints so the edge is torn but never spiky
  const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
  const start = mid(pts[count - 1], pts[0]);
  let d = `M${start.x.toFixed(2)} ${start.y.toFixed(2)}`;
  pts.forEach((p, i) => {
    const m = mid(p, pts[(i + 1) % count]);
    d += ` Q${p.x.toFixed(2)} ${p.y.toFixed(2)} ${m.x.toFixed(2)} ${m.y.toFixed(2)}`;
  });
  return `${d} Z`;
}

/** How many raindrops are ringing a pool at any moment */
const RAINDROPS = 26;

/** Rings from raindrops spreading across the water, each at its own spot and pace */
function useRipples(seed: number, count: number) {
  return useMemo(() => {
    const rand = seeded(seed ^ 0x5bd1e995);
    return Array.from({ length: count }, () => {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * 0.72;
      return {
        x: 50 + Math.cos(a) * d * 50,
        y: 50 + Math.sin(a) * d * 50,
        size: 6 + rand() * 14,
        delay: -rand() * 1.4,
        duration: 0.55 + rand() * 0.8,
      };
    });
  }, [seed, count]);
}

/**
 * A shell hole: a torn rim of thrown-up earth, the bowl falling away into
 * shadow, and brown water pooled at the bottom, ringed constantly by the rain
 */
export function ShellHole({
  seed,
  rippling = true,
  className,
  style,
}: {
  seed: number;
  /** Whether rain rings are drawn on its water; off for holes too far out to be seen */
  rippling?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const shape = useMemo(() => {
    const rand = seeded(seed);
    const squash = 0.7 + rand() * 0.25;
    return {
      spoil: blob(rand, 1, squash, 0.35),
      lip: blob(rand, 0.8, squash, 0.3),
      bowl: blob(rand, 0.66, squash, 0.28),
      water: blob(rand, 0.42 + rand() * 0.12, squash * 0.85, 0.35),
      squash,
      turn: rand() * 360,
    };
  }, [seed]);
  const id = `hole-${seed}`;
  const ripples = useRipples(seed, rippling ? RAINDROPS : 0);
  return (
    <span
      className={`shell-hole${className ? ` ${className}` : ""}`}
      style={style}
    >
      <svg viewBox="-1.1 -1.1 2.2 2.2" aria-hidden>
        <defs>
          <pattern
            id={`${id}-soil`}
            width="0.9"
            height="0.9"
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${shape.turn})`}
          >
            <image
              href={`${TEXTURES}soil.jpg`}
              width="0.9"
              height="0.9"
              preserveAspectRatio="none"
            />
          </pattern>
          <pattern
            id={`${id}-mud`}
            width="1.1"
            height="1.1"
            patternUnits="userSpaceOnUse"
            patternTransform={`rotate(${-shape.turn})`}
          >
            <image
              href={`${TEXTURES}mud.jpg`}
              width="1.1"
              height="1.1"
              preserveAspectRatio="none"
            />
          </pattern>
          {/* The thrown earth thins out into the ground around it */}
          <radialGradient id={`${id}-fade`}>
            <stop offset="0.55" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id={`${id}-spread`} maskContentUnits="userSpaceOnUse">
            <rect
              x="-1.1"
              y="-1.1"
              width="2.2"
              height="2.2"
              fill={`url(#${id}-fade)`}
            />
          </mask>
          {/* Light from above: the bowl's far side in shadow, its near side lit */}
          <linearGradient id={`${id}-slope`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.85" />
            <stop offset="0.55" stopColor="#000" stopOpacity="0.45" />
            <stop offset="1" stopColor="#000" stopOpacity="0.1" />
          </linearGradient>
          <clipPath id={`${id}-pool`}>
            <path d={shape.water} />
          </clipPath>
          <linearGradient id={`${id}-depth`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b2124" />
            <stop offset="1" stopColor="#2d3539" />
          </linearGradient>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c9d2d5" stopOpacity="0.5" />
            <stop offset="0.35" stopColor="#9aa6aa" stopOpacity="0.2" />
            <stop offset="1" stopColor="#5a6468" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <g mask={`url(#${id}-spread)`}>
          <path
            d={shape.spoil}
            fill={`url(#${id}-mud)`}
            className="hole-spoil"
          />
        </g>
        <path d={shape.lip} fill={`url(#${id}-mud)`} className="hole-lip" />
        <path d={shape.bowl} fill={`url(#${id}-soil)`} className="hole-bowl" />
        <path d={shape.bowl} fill={`url(#${id}-slope)`} />
        {/* Standing water: dark and still, the overcast sky lying on it */}
        <path d={shape.water} fill={`url(#${id}-depth)`} />
        <path d={shape.water} fill={`url(#${id}-mud)`} className="hole-silt" />
        <path d={shape.water} fill={`url(#${id}-sky)`} />
        <g clipPath={`url(#${id}-pool)`}>
          <ellipse
            cx="-0.12"
            cy={-0.18 * shape.squash}
            rx="0.5"
            ry={0.07 * shape.squash}
            className="hole-glare"
          />
        </g>
        <path d={shape.water} className="hole-wet-edge" />
      </svg>
      {ripples.length > 0 && (
        <span
          className="hole-ripples"
          style={{ "--squash": shape.squash } as React.CSSProperties}
        >
          {ripples.map((r, i) => (
            <i
              key={i}
              style={{
                left: `${r.x}%`,
                top: `${r.y}%`,
                width: `${r.size}%`,
                animationDelay: `${r.delay}s`,
                animationDuration: `${r.duration}s`,
              }}
            />
          ))}
        </span>
      )}
    </span>
  );
}
