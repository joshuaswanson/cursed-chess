import { useId } from "react";
import { RiverWater } from "./RiverWater";

const SQ = 100;
const BOARD = SQ * 8;
const PLANKS_PER_SQUARE = 6;

/** Deterministic noise so the terrain looks the same on every render */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface Point {
  x: number;
  y: number;
}

/** A wavy bank across the board at height `y`: points with a control point before each */
function bank(y: number, seed: number): { points: Point[]; controls: Point[] } {
  const rand = seeded(seed);
  const points: Point[] = [{ x: -20, y }];
  const controls: Point[] = [];
  for (let x = 20; x <= BOARD + 60; x += 40) {
    controls.push({ x: x - 20, y: y + (rand() - 0.5) * 22 });
    points.push({ x, y: y + (rand() - 0.5) * 12 });
  }
  return { points, controls };
}

function traceForward({ points, controls }: ReturnType<typeof bank>): string {
  return (
    `M${points[0].x} ${points[0].y}` +
    controls
      .map((c, i) => ` Q${c.x} ${c.y} ${points[i + 1].x} ${points[i + 1].y}`)
      .join("")
  );
}

/** The same bank traced right to left, continuing an existing path */
function traceBackward({ points, controls }: ReturnType<typeof bank>): string {
  const last = points[points.length - 1];
  let d = ` L${last.x} ${last.y}`;
  for (let i = controls.length - 1; i >= 0; i--) {
    d += ` Q${controls[i].x} ${controls[i].y} ${points[i].x} ${points[i].y}`;
  }
  return d;
}

/** Runs of consecutive columns, used to find each bridge's span */
function runs(cols: number[]): [number, number][] {
  const sorted = [...cols].sort((a, b) => a - b);
  const result: [number, number][] = [];
  for (const c of sorted) {
    const last = result[result.length - 1];
    if (last && last[1] === c - 1) last[1] = c;
    else result.push([c, c]);
  }
  return result;
}

function Bridge({
  x0,
  x1,
  y0,
  y1,
  grainId,
  seed,
}: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  grainId: string;
  seed: number;
}) {
  const rand = seeded(seed);
  const inset = 12;
  const left = x0 + inset;
  const right = x1 - inset;
  const top = y0 - 14;
  const bottom = y1 + 14;
  const plankH = SQ / PLANKS_PER_SQUARE;
  const planks = [];
  for (let y = top, i = 0; y < bottom; y += plankH, i++) {
    const shade = 0.82 + rand() * 0.3;
    const jut = (rand() - 0.5) * 6;
    planks.push(
      <g key={i}>
        <rect
          x={left - 4 + jut}
          y={y}
          width={right - left + 8}
          height={plankH - 1.6}
          rx={1.5}
          fill={`rgb(${Math.round(150 * shade)},${Math.round(98 * shade)},${Math.round(52 * shade)})`}
        />
        <rect
          x={left - 4 + jut}
          y={y}
          width={right - left + 8}
          height={plankH - 1.6}
          filter={`url(#${grainId})`}
          opacity={0.55}
        />
        <rect
          x={left - 4 + jut}
          y={y}
          width={right - left + 8}
          height={2}
          fill="rgba(255,230,190,0.25)"
        />
        <circle
          cx={left + 6 + jut}
          cy={y + plankH / 2}
          r={1.6}
          fill="#2a1a0c"
        />
        <circle
          cx={right - 6 + jut}
          cy={y + plankH / 2}
          r={1.6}
          fill="#2a1a0c"
        />
      </g>,
    );
  }
  const posts = [top + 6, (top + bottom) / 2, bottom - 6];
  return (
    <g className="bf-bridge">
      <rect
        x={left + 6}
        y={top + 10}
        width={right - left}
        height={bottom - top}
        fill="rgba(5,20,25,0.45)"
        filter="url(#bf-soft)"
      />
      {planks}
      {[left - 8, right + 2].map((x, i) => (
        <g key={i}>
          <rect
            x={x}
            y={top - 4}
            width={6}
            height={bottom - top + 8}
            fill="#4a2c12"
          />
          <rect
            x={x}
            y={top - 4}
            width={6}
            height={bottom - top + 8}
            filter={`url(#${grainId})`}
            opacity={0.5}
          />
          {posts.map((y) => (
            <rect
              key={y}
              x={x - 2}
              y={y - 5}
              width={10}
              height={10}
              rx={2}
              fill="#3a220d"
            />
          ))}
        </g>
      ))}
    </g>
  );
}

/**
 * A painted battlefield under the Stratego board: grass, dirt roads, craters,
 * and a river with wooden bridges where the board is passable.
 */
export function Battlefield({
  riverRows,
  lakeCols,
}: {
  /** On-screen rows the river runs through */
  riverRows: number[];
  /** On-screen columns where the river is open water */
  lakeCols: number[];
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const grassId = `bf-grass-${id}`;
  const grainId = `bf-grain-${id}`;
  const riverClipId = `bf-river-${id}`;

  const y0 = Math.min(...riverRows) * SQ;
  const y1 = (Math.max(...riverRows) + 1) * SQ;
  const top = bank(y0, 11);
  const bottom = bank(y1, 23);
  const topBank = traceForward(top);
  const bottomBank = traceForward(bottom);
  const riverShape = topBank + traceBackward(bottom) + " Z";
  const bridgeCols = runs(
    Array.from({ length: 8 }, (_, c) => c).filter((c) => !lakeCols.includes(c)),
  );

  const bandTop = y0 - 40;
  const bandHeight = y1 - y0 + 80;
  const pct = (units: number) => `${(units / BOARD) * 100}%`;

  const craters = [
    [140, 120, 26],
    [560, 70, 18],
    [690, 230, 22],
    [90, 640, 20],
    [470, 710, 28],
    [720, 600, 16],
  ];

  return (
    <>
      <svg
        className="battlefield"
        viewBox={`0 0 ${BOARD} ${BOARD}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <filter id={grassId} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.018"
              numOctaves="3"
              seed="4"
            />
            <feColorMatrix
              values="0 0 0 0 0.20
                      0 0 0 0 0.28
                      0 0 0 0 0.05
                      0 0 0 -1.6 1.05"
            />
          </filter>
          <filter id={`${grassId}-fine`} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="1"
              seed="9"
            />
            <feColorMatrix
              values="0 0 0 0 0.1
                      0 0 0 0 0.12
                      0 0 0 0 0.02
                      0 0 0 -2.2 1.25"
            />
          </filter>
          <filter id={grainId} x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.45"
              numOctaves="3"
              seed="7"
            />
            <feColorMatrix
              values="0 0 0 0 0.16
                      0 0 0 0 0.08
                      0 0 0 0 0.02
                      0 0 0 -1.4 0.9"
            />
          </filter>
          <filter id="bf-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <rect width={BOARD} height={BOARD} fill="#7a8f3e" />
        <rect width={BOARD} height={BOARD} filter={`url(#${grassId})`} />
        <rect width={BOARD} height={BOARD} filter={`url(#${grassId}-fine)`} />

        {bridgeCols.map(([a, b], i) => {
          const x = ((a + b + 1) / 2) * SQ;
          return (
            <g key={i} className="bf-road">
              <path
                d={`M${x - 10} -10 C${x + 30} ${y0 * 0.4} ${x - 30} ${y0 * 0.7} ${x} ${y0}`}
              />
              <path
                d={`M${x} ${y1} C${x + 25} ${y1 + 90} ${x - 35} ${y1 + 200} ${x + 10} ${BOARD + 10}`}
              />
            </g>
          );
        })}

        {craters.map(([cx, cy, r], i) => (
          <g key={i}>
            <circle
              cx={cx}
              cy={cy}
              r={r + 7}
              fill="rgba(70,55,30,0.35)"
              filter="url(#bf-soft)"
            />
            <circle cx={cx} cy={cy} r={r} fill="rgba(40,30,15,0.55)" />
            <circle
              cx={cx - r * 0.2}
              cy={cy - r * 0.2}
              r={r * 0.55}
              fill="rgba(20,14,6,0.45)"
            />
          </g>
        ))}

        <path
          d={riverShape}
          fill="#4b3a1f"
          transform="translate(0 4)"
          filter="url(#bf-soft)"
        />
      </svg>

      <RiverWater
        className="battlefield-water"
        style={{ top: pct(bandTop), height: pct(bandHeight) }}
        viewBox={`0 ${bandTop} ${BOARD} ${bandHeight}`}
        outline={riverShape}
        pad={40 / bandHeight}
      />

      <svg
        className="battlefield"
        viewBox={`0 0 ${BOARD} ${BOARD}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <clipPath id={riverClipId}>
            <path d={riverShape} />
          </clipPath>
        </defs>
        <rect
          y={bandTop}
          width={BOARD}
          height={70}
          fill="rgba(10,30,30,0.35)"
          filter="url(#bf-soft)"
          clipPath={`url(#${riverClipId})`}
        />
        <path d={topBank} className="bf-bank" />
        <path d={bottomBank} className="bf-bank" />
        {bridgeCols.map(([a, b], i) => (
          <Bridge
            key={i}
            x0={a * SQ}
            x1={(b + 1) * SQ}
            y0={y0}
            y1={y1}
            grainId={grainId}
            seed={31 + i * 17}
          />
        ))}
      </svg>
    </>
  );
}

const WORLD_WIDTH = 4000;

/**
 * The river continuing off both sides of the board, behind its frame, so the
 * board sits on one stretch of a longer river.
 */
export function WorldRiver({ rows }: { rows: number }) {
  const height = rows * SQ;
  const pad = 40;
  const top = bank(pad, 41);
  const bottom = bank(pad + height, 57);
  const scaleX = WORLD_WIDTH / (BOARD + 80);
  const stretch = (d: string) =>
    d.replace(
      /(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g,
      (_, x, y) => `${(+x + 20) * scaleX} ${y}`,
    );
  const shape = stretch(traceForward(top) + traceBackward(bottom)) + " Z";

  const total = height + pad * 2;
  const viewBox = `0 0 ${WORLD_WIDTH} ${total}`;
  const style = { "--river-rows": rows } as React.CSSProperties;
  return (
    <>
      <svg
        className="world-river"
        viewBox={viewBox}
        preserveAspectRatio="none"
        style={style}
        aria-hidden
      >
        <path
          d={shape}
          fill="#4b3a1f"
          transform="translate(0 6)"
          opacity="0.8"
        />
      </svg>
      <RiverWater
        className="world-river"
        style={style}
        viewBox={viewBox}
        outline={shape}
        pad={pad / total}
      />
      <svg
        className="world-river"
        viewBox={viewBox}
        preserveAspectRatio="none"
        style={style}
        aria-hidden
      >
        <path d={stretch(traceForward(top))} className="bf-bank" />
        <path d={stretch(traceForward(bottom))} className="bf-bank" />
      </svg>
    </>
  );
}
