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

/** Rings from raindrops spreading across the water, each at its own spot and pace */
function useRipples(seed: number, count: number) {
  return useMemo(() => {
    const rand = seeded(seed ^ 0x5bd1e995);
    return Array.from({ length: count }, () => {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * 0.55;
      return {
        x: 50 + Math.cos(a) * d * 50,
        y: 50 + Math.sin(a) * d * 50,
        size: 14 + rand() * 18,
        delay: -rand() * 2,
        duration: 0.9 + rand() * 0.9,
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
  const ripples = useRipples(seed, rippling ? 5 : 0);
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
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b9c2c4" stopOpacity="0.32" />
            <stop offset="0.6" stopColor="#8e989a" stopOpacity="0.1" />
            <stop offset="1" stopColor="#000" stopOpacity="0.25" />
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
        <path d={shape.water} fill={`url(#${id}-mud)`} className="hole-water" />
        <path d={shape.water} fill={`url(#${id}-sky)`} />
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
