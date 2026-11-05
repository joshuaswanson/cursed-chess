import { useEffect, useRef, useState } from "react";
import { HOLE_AT, HOLE_TILT } from "./particles";

/** How far the flat of space lies above the throat of the well, in pixels */
const WELL_DEPTH = 300;
/** How quickly the well flattens out away from the hole */
const WELL_SOFTNESS = 90;
/** The innermost ring of the well, and how much wider each one out is than the last */
const THROAT = 46;
const RING_GROWTH = 1.24;
const RING_COUNT = 24;
const SPOKES = 36;
/** How long a ring takes to slide in to where the next ring in was */
const FLOW_SECONDS = 2.4;
/** How long the spokes take to turn once round */
const TURN_SECONDS = 240;
/** The black hole's shadow, and the disc of gas round it, in pixels */
const SHADOW = 44;
const DISC_OUTER = 250;
const DISC_INNER = SHADOW;
/** How flat the disc looks, seen nearly edge on */
const DISC_FLAT = HOLE_TILT * 0.42;
/** Where the hot clumps go round, as shares of the disc's reach */
const CLUMPS = [0.5, 0.68, 0.86];

/** How far up from the throat, where the hole is, a ring of the well lies */
const rise = (radius: number) =>
  WELL_DEPTH *
  (WELL_SOFTNESS / (WELL_SOFTNESS + THROAT) -
    WELL_SOFTNESS / (WELL_SOFTNESS + radius));

const smooth = (from: number, to: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
};
/** How strongly the grid shows at a distance from the hole: lost in the glare by it, and fading far off */
const showing = (radius: number) =>
  smooth(THROAT, THROAT * 2.6, radius) * (1 - smooth(700, 1900, radius));

/** Half of a flat ring round the hole: the far half above the middle, or the near half below it */
function halfRing(outer: number, inner: number, near: boolean) {
  const sweep = near ? 0 : 1;
  const back = near ? 1 : 0;
  return (
    `M ${-outer} 0 A ${outer} ${outer * DISC_FLAT} 0 0 ${sweep} ${outer} 0 ` +
    `L ${inner} 0 A ${inner} ${inner * DISC_FLAT} 0 0 ${back} ${-inner} 0 Z`
  );
}

/**
 * The well's grid, its rings sliding down into the throat and its spokes
 * slowly turning. Seen from above, the far wall of the well lies behind the
 * black hole and the near wall in front of it, so each is drawn on a canvas
 * of its own either side of the hole.
 */
function useWellGrid() {
  const farRef = useRef<HTMLCanvasElement>(null);
  const nearRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvases = [farRef.current, nearRef.current];
    const contexts = canvases.map((c) => c?.getContext("2d") ?? null);
    const [far, near] = contexts;
    if (!far || !near) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0;
    let h = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      canvases.forEach((canvas, i) => {
        if (!canvas) return;
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        contexts[i]?.setTransform(dpr, 0, 0, dpr, 0, 0);
      });
    };
    resize();
    const watcher = new ResizeObserver(resize);
    for (const canvas of canvases) if (canvas) watcher.observe(canvas);

    const spokeRings = Array.from(
      { length: RING_COUNT },
      (_, i) => THROAT * Math.pow(RING_GROWTH, i),
    );
    let frame = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const seconds = still ? 0 : now / 1000;
      const cx = w * HOLE_AT.x;
      const cy = h * HOLE_AT.y;
      for (const ctx of [far, near]) {
        ctx.clearRect(0, 0, w, h);
        ctx.lineWidth = 1.3;
      }
      // Each ring takes the place of the next one in, so the sheet seems to pour in
      const flow = (seconds / FLOW_SECONDS) % 1;
      for (let i = 0; i <= RING_COUNT; i++) {
        const radius = THROAT * Math.pow(RING_GROWTH, i + 1 - flow);
        const alpha = 0.5 * showing(radius);
        if (alpha <= 0.01) continue;
        // The near half of the ring runs below its middle, the far half above
        for (const [ctx, from] of [
          [near, 0],
          [far, Math.PI],
        ] as const) {
          ctx.strokeStyle = `rgba(255, 157, 77, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(
            cx,
            cy - rise(radius),
            radius,
            radius * HOLE_TILT,
            0,
            from,
            from + Math.PI,
          );
          ctx.stroke();
        }
      }
      const turn = ((seconds / TURN_SECONDS) % 1) * Math.PI * 2;
      for (let j = 0; j < SPOKES; j++) {
        const angle = (j / SPOKES) * Math.PI * 2 + turn;
        const ctx = Math.sin(angle) > 0 ? near : far;
        const at = (radius: number): [number, number] => [
          cx + Math.cos(angle) * radius,
          cy + Math.sin(angle) * radius * HOLE_TILT - rise(radius),
        ];
        for (let i = 0; i < spokeRings.length - 1; i++) {
          const alpha = 0.22 * showing(spokeRings[i]);
          if (alpha <= 0.01) continue;
          ctx.strokeStyle = `rgba(255, 157, 77, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(...at(spokeRings[i]));
          ctx.lineTo(...at(spokeRings[i + 1]));
          ctx.stroke();
        }
      }
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      watcher.disconnect();
    };
  }, []);
  return { farRef, nearRef };
}

/** The window's size, so the black hole is drawn at one to one */
function useWindowSize() {
  const [size, setSize] = useState(() => ({
    w: window.innerWidth,
    h: window.innerHeight,
  }));
  useEffect(() => {
    const onResize = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
}

/**
 * Space round the black hole drawn the way physicists draw it: a sheet of
 * grid pulled down into a well, pouring into the hole at the bottom of its
 * throat. The disc of gas lies flat round the hole, brighter on the side
 * turning toward us, and the hole itself is a flat black circle over it all.
 */
export function WarpedSpace() {
  const { farRef, nearRef } = useWellGrid();
  const { w, h } = useWindowSize();
  const view = `${-w * HOLE_AT.x} ${-h * HOLE_AT.y} ${w} ${h}`;
  const clumpBox = `${-DISC_OUTER} ${-DISC_OUTER * DISC_FLAT} ${DISC_OUTER * 2} ${DISC_OUTER * DISC_FLAT * 2}`;
  const clumpArc = (share: number, near: boolean) =>
    `M ${-DISC_OUTER * share} 0 A ${DISC_OUTER * share} ${DISC_OUTER * share * DISC_FLAT} 0 0 ${near ? 0 : 1} ${DISC_OUTER * share} 0`;
  return (
    <div className="warped-space">
      <canvas ref={farRef} className="warp-grid" />
      <svg className="warp-hole" viewBox={view} width={w} height={h}>
        <defs>
          {/* Gas coming toward us is brighter: the left of the disc, where it turns our way */}
          <linearGradient
            id="warp-doppler"
            x1={-DISC_OUTER}
            y1="0"
            x2={DISC_OUTER}
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#ff9a3c" stopOpacity="0" />
            <stop offset="0.12" stopColor="#ffd28a" />
            <stop offset="0.38" stopColor="#fff6e2" />
            <stop offset="0.62" stopColor="#ffb055" />
            <stop offset="0.88" stopColor="#c2421a" />
            <stop offset="1" stopColor="#7a1e0a" stopOpacity="0" />
          </linearGradient>
          {/* The disc thins out toward its edge, so it fades into the dark */}
          <radialGradient
            id="warp-disc-fade"
            cx="0"
            cy="0"
            r={DISC_OUTER}
            gradientUnits="userSpaceOnUse"
            gradientTransform={`scale(1 ${DISC_FLAT})`}
          >
            <stop offset={DISC_INNER / DISC_OUTER} stopColor="#fff" />
            <stop offset="0.45" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="0.75" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask
            id="warp-disc-mask"
            maskUnits="userSpaceOnUse"
            x={-DISC_OUTER}
            y={-DISC_OUTER}
            width={DISC_OUTER * 2}
            height={DISC_OUTER * 2}
          >
            <rect
              x={-DISC_OUTER}
              y={-DISC_OUTER}
              width={DISC_OUTER * 2}
              height={DISC_OUTER * 2}
              fill="url(#warp-disc-fade)"
            />
          </mask>
        </defs>
        <path
          className="warp-disc"
          mask="url(#warp-disc-mask)"
          d={halfRing(DISC_OUTER, DISC_INNER, false)}
        />
        <path
          className="warp-disc"
          mask="url(#warp-disc-mask)"
          d={halfRing(DISC_OUTER, DISC_INNER, true)}
        />
      </svg>
      {/* Hot clumps of gas going round, on a layer of their own so only they are redrawn as they move */}
      <svg
        className="warp-clumps"
        viewBox={clumpBox}
        width={DISC_OUTER * 2}
        height={DISC_OUTER * DISC_FLAT * 2}
        style={{
          left: w * HOLE_AT.x - DISC_OUTER,
          top: h * HOLE_AT.y - DISC_OUTER * DISC_FLAT,
        }}
      >
        <defs>
          {/* Nothing shows where the shadow is */}
          <clipPath id="warp-behind">
            <path
              clipRule="evenodd"
              d={`M ${-DISC_OUTER} ${-DISC_OUTER} H ${DISC_OUTER} V ${DISC_OUTER} H ${-DISC_OUTER} Z M ${-SHADOW} 0 A ${SHADOW} ${SHADOW} 0 1 0 ${SHADOW} 0 A ${SHADOW} ${SHADOW} 0 1 0 ${-SHADOW} 0 Z`}
            />
          </clipPath>
        </defs>
        {CLUMPS.map((share) => (
          <g key={share}>
            <path
              className="warp-clump"
              clipPath="url(#warp-behind)"
              d={clumpArc(share, false)}
            />
            <path
              className="warp-clump"
              clipPath="url(#warp-behind)"
              d={clumpArc(share, true)}
            />
          </g>
        ))}
      </svg>
      <canvas ref={nearRef} className="warp-grid" />
      {/* The hole itself: a flat black circle with a thin ring of light, over everything */}
      <svg
        className="warp-shadow"
        viewBox={`${-SHADOW - 4} ${-SHADOW - 4} ${SHADOW * 2 + 8} ${SHADOW * 2 + 8}`}
        width={SHADOW * 2 + 8}
        height={SHADOW * 2 + 8}
        style={{
          left: w * HOLE_AT.x - SHADOW - 4,
          top: h * HOLE_AT.y - SHADOW - 4,
        }}
      >
        <circle className="warp-photon" r={SHADOW + 1.2} />
        <circle className="warp-core" r={SHADOW} />
      </svg>
    </div>
  );
}
