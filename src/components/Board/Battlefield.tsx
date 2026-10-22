import { useId } from "react";
import { RiverWater } from "./RiverWater";
import { meanderAt } from "./meander";
import type { Meander } from "./meander";

const SQ = 100;
const BOARD = SQ * 8;
const PLANKS_PER_SQUARE = 6;
/** Sides of the tiles the grass noise is drawn on */
const GRASS_TILE = 400;
const FINE_GRASS_TILE = 200;

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

/** Points along a bank's curve, one every `step` units across */
function sample(
  { points, controls }: ReturnType<typeof bank>,
  step: number,
): Point[] {
  const line = [points[0]];
  controls.forEach((c, i) => {
    const a = points[i];
    const b = points[i + 1];
    const n = Math.max(1, Math.round((b.x - a.x) / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const u = 1 - t;
      line.push({
        x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
        y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
      });
    }
  });
  return line;
}

const toPath = (line: Point[]) =>
  line
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join("");

/**
 * A band of earth along the bank, `offset` from its line, each edge torn its
 * own way. Drawn as a shape, so no filter has to roughen it: filters across
 * a river this long take Safari seconds to draw.
 */
function tornBand(
  line: Point[],
  offset: number,
  width: number,
  tear: number,
  rand: () => number,
): string {
  const edge = (side: 1 | -1) => {
    let drift = 0;
    return line.map((p) => {
      drift = drift * 0.7 + (rand() - 0.5) * tear;
      return { x: p.x, y: p.y + offset + (side * width) / 2 + drift };
    });
  };
  return toPath([...edge(-1), ...edge(1).reverse()]) + "Z";
}

/**
 * The bands of a bank from the land to the water: how far out, how wide, and
 * how torn. Soft ones are laid down three times, wider and fainter each time,
 * so they fade out at the edges.
 */
const BANK_BANDS = [
  { shift: 16, width: 26, tear: 8, fill: "#8a7a45", opacity: 0.55, soft: true },
  { shift: 10, width: 20, tear: 5, fill: "#9a7a4e", opacity: 1 },
  { shift: 5, width: 13, tear: 5, fill: "#73553a", opacity: 1 },
  { shift: 1.5, width: 7, tear: 5, fill: "#452f1b", opacity: 1 },
  { shift: -11, width: 12, tear: 8, fill: "#cdf5ee", opacity: 0.4, soft: true },
  { shift: -4, width: 6, tear: 8, fill: "#0a232d", opacity: 0.4, soft: true },
];
/** How much wider each fainter pass of a soft band is */
const FEATHER = [9, 6, 3, 0];

const STONE_TONES = ["#8f877c", "#77706a", "#a39a8c", "#6a625a"];
const GRASS_TONES = ["#6f8f34", "#5a7a28", "#86a843", "#4b6820", "#9bbd52"];

/**
 * A natural river bank along `d`. From the land to the water: dirt fading out
 * of the grass, a slope that darkens to wet mud, stones and foam at the
 * waterline, the bank's shadow, and pale shallows. Grass clumps hang over the
 * edge. `side` is -1 when the land lies above the line and 1 when below.
 */
function Bank({
  line,
  points,
  side,
  seed,
}: {
  line: Point[];
  points: Point[];
  side: 1 | -1;
  seed: number;
}) {
  const rand = seeded(seed);
  const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)];
  const stones: {
    x: number;
    y: number;
    r: number;
    tone: string;
    foam: boolean;
  }[] = [];
  const blades: { d: string; tone: string; width: number }[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const along = (t: number) => ({
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
    });
    for (let k = 0; k < 2; k++) {
      if (rand() > 0.55) continue;
      const p = along(rand());
      stones.push({
        x: p.x,
        y: p.y + side * (rand() * 5 - 1),
        r: 2.2 + rand() * 3.8,
        tone: pick(STONE_TONES),
        foam: rand() < 0.6,
      });
    }
    const clumps = rand() < 0.5 ? 2 : 1;
    for (let c = 0; c < clumps; c++) {
      const root = along(rand());
      // On the far bank the roots sit lower, so blades spring up from the dirt into the grass
      const baseY = root.y + side * (17 + rand() * 5) + (side < 0 ? 10 : 0);
      const count = 5 + Math.floor(rand() * 5);
      for (let j = 0; j < count; j++) {
        const bx = root.x + (j - count / 2) * 1.8 + (rand() - 0.5) * 2;
        const length = 9 + rand() * 13;
        const lean = (rand() - 0.5) * 14;
        // Blades always grow up the screen, the way the player looks at the board
        const tipY = baseY - length;
        blades.push({
          d: `M${bx.toFixed(1)} ${baseY.toFixed(1)} Q${(bx + lean * 0.25).toFixed(1)} ${(baseY - length * 0.65).toFixed(1)} ${(bx + lean).toFixed(1)} ${tipY.toFixed(1)}`,
          tone: pick(GRASS_TONES),
          width: 1.3 + rand() * 1.1,
        });
      }
    }
  }

  return (
    <g className="bf-bank">
      {BANK_BANDS.flatMap((band, i) => {
        const passes = band.soft ? FEATHER : [0];
        // Stacked, the passes add up to the band's own opacity in the middle
        const each = 1 - (1 - band.opacity) ** (1 / passes.length);
        // Every pass of a band is torn the same way, so they fade out evenly
        return passes.map((extra) => (
          <path
            key={`${i}-${extra}`}
            d={tornBand(
              line,
              side * band.shift,
              band.width + extra,
              band.tear,
              seeded(seed * 7 + i),
            )}
            fill={band.fill}
            fillOpacity={each}
          />
        ));
      })}
      <path
        d={toPath(line.map((p) => ({ x: p.x, y: p.y - side * 3 })))}
        className="bank-sheen"
      />
      {stones.map((st, i) => (
        <g key={i}>
          {st.foam && (
            <ellipse
              cx={st.x}
              cy={st.y - side * st.r * 0.5}
              rx={st.r * 1.7}
              ry={st.r * 0.9}
              className="bank-foam"
            />
          )}
          <ellipse
            cx={st.x}
            cy={st.y + 1}
            rx={st.r}
            ry={st.r * 0.75}
            fill="#2a1d12"
            opacity="0.5"
          />
          <ellipse
            cx={st.x}
            cy={st.y}
            rx={st.r}
            ry={st.r * 0.72}
            fill={st.tone}
          />
          <ellipse
            cx={st.x - st.r * 0.3}
            cy={st.y - st.r * 0.28}
            rx={st.r * 0.45}
            ry={st.r * 0.28}
            fill="#ffffff"
            opacity="0.3"
          />
        </g>
      ))}
      {blades.map((bl, i) => (
        <path
          key={i}
          d={bl.d}
          className="bank-grass"
          stroke={bl.tone}
          strokeWidth={bl.width}
        />
      ))}
    </g>
  );
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
  const riverShape = traceForward(top) + traceBackward(bottom) + " Z";
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
              stitchTiles="stitch"
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
              stitchTiles="stitch"
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
          {/* Grass noise drawn once on a tile and repeated, which Safari
              draws far faster than noise across the whole board */}
          {[
            [`${grassId}-tile`, grassId, GRASS_TILE],
            [`${grassId}-fine-tile`, `${grassId}-fine`, FINE_GRASS_TILE],
          ].map(([tile, noise, size]) => (
            <pattern
              key={tile}
              id={String(tile)}
              width={size}
              height={size}
              patternUnits="userSpaceOnUse"
            >
              <rect width={size} height={size} filter={`url(#${noise})`} />
            </pattern>
          ))}
          <filter id="bf-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>

        <rect width={BOARD} height={BOARD} fill="#7a8f3e" />
        <rect width={BOARD} height={BOARD} fill={`url(#${grassId}-tile)`} />
        <rect
          width={BOARD}
          height={BOARD}
          fill={`url(#${grassId}-fine-tile)`}
        />

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
        <Bank line={sample(top, 3)} points={top.points} side={-1} seed={61} />
        <Bank
          line={sample(bottom, 3)}
          points={bottom.points}
          side={1}
          seed={67}
        />
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

const BENDS: Meander = {
  worldWidth: WORLD_WIDTH,
  straightHalf: 420,
  ramp: 260,
  waves: [
    [85, 210, 0.6],
    [30, 110, 1],
  ],
};

const meander = (x: number) => meanderAt(BENDS, x);

/**
 * The river continuing off both sides of the board, behind its frame, so the
 * board sits on one stretch of a longer river.
 */
export function WorldRiver({ rows }: { rows: number }) {
  const height = rows * SQ;
  // Room above and below for the river to meander into
  const pad = 200;
  const top = bank(pad, 41);
  const bottom = bank(pad + height, 57);
  const scaleX = WORLD_WIDTH / (BOARD + 80);
  const stretch = (d: string) =>
    d.replace(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g, (_, x, y) => {
      const wx = (+x + 20) * scaleX;
      return `${wx} ${+y + meander(wx)}`;
    });
  const shape = stretch(traceForward(top) + traceBackward(bottom)) + " Z";
  const stretchPoint = (p: Point): Point => {
    const wx = (p.x + 20) * scaleX;
    return { x: wx, y: p.y + meander(wx) };
  };

  const total = height + pad * 2;
  const viewBox = `0 0 ${WORLD_WIDTH} ${total}`;
  const style = {
    "--river-rows": rows,
    "--river-pad": pad / SQ,
  } as React.CSSProperties;
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
        bends={{ meander: BENDS, worldHeight: total }}
      />
      <svg
        className="world-river"
        viewBox={viewBox}
        preserveAspectRatio="none"
        style={style}
        aria-hidden
      >
        <Bank
          line={sample(top, 1.5).map(stretchPoint)}
          points={top.points.map(stretchPoint)}
          side={-1}
          seed={71}
        />
        <Bank
          line={sample(bottom, 1.5).map(stretchPoint)}
          points={bottom.points.map(stretchPoint)}
          side={1}
          seed={73}
        />
      </svg>
    </>
  );
}
