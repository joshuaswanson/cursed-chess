import { useMemo } from "react";
import { Color } from "../../engine";
import { NO_MANS_LAND, TRENCH_RANKS } from "../../plugins/trenches";
import "./WorldTrenches.css";

/** One square, in the drawing's units */
const SQ = 100;
const BOARD = SQ * 8;
/** How far the ground runs off each side of the board, and above and below it */
const REACH = 40 * SQ;
const MARGIN = SQ;
/** Along each line, a fresh point this often */
const STEP = 6;

type Point = { x: number; y: number };

/** A seeded random source, so the front is dug the same way every time */
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

/** A wandering offset that drifts a little at each step, for ragged edges */
function ragged(rand: () => number, count: number, spread: number): number[] {
  const out: number[] = [];
  let v = 0;
  for (let i = 0; i < count; i++) {
    v = v * 0.75 + (rand() - 0.5) * spread;
    out.push(v);
  }
  return out;
}

const onBoard = (x: number) => x > -SQ * 0.4 && x < BOARD + SQ * 0.4;

const toPath = (points: Point[], close = false) =>
  points
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ") + (close ? " Z" : "");

/** How tall a parapet stands where it faces the viewer, hiding the lower half of whoever is behind it */
const PARAPET_HEIGHT = 30;

interface TrenchLine {
  key: string;
  /** The screen row it runs along */
  row: number;
  /** The sandbag wall facing the viewer, where the trench's parapet is on its near side */
  face: string | null;
  /** How far down each square, on the board, the top of that wall comes, as a share of the square */
  wallTop: number[] | null;
  outline: string;
  centre: string;
  parapet: { x: number; y: number; w: number; tilt: number }[];
  parados: string;
  water: { x: number; y: number; rx: number; ry: number }[];
  /** The far wall, just inside the cut, where wattle shores it up */
  wattle: string;
}

/**
 * One trench line dug right across the front: fire bays alternating with
 * traverses, so it zigzags, each bay lined up with a square on the board,
 * with ragged walls, sandbags piled on the side facing the enemy, and the
 * spoil heaped behind
 */
function digTrench(row: number, enemyAbove: boolean, seed: number): TrenchLine {
  const rand = seeded(seed);
  const centreY = MARGIN + row * SQ + SQ / 2;
  const xs: number[] = [];
  for (let x = -REACH; x <= BOARD + REACH; x += STEP) xs.push(x);
  const bays = new Map<number, number>();
  const bayOffset = (bay: number) => {
    if (!bays.has(bay)) {
      const inside = bay >= 0 && bay < 8;
      const swing = inside ? 6 + rand() * 3 : 7 + rand() * 13;
      const wander = inside ? 0 : Math.sin(bay * 0.37) * 14;
      bays.set(bay, (bay % 2 ? 1 : -1) * swing + wander);
    }
    return bays.get(bay)!;
  };
  // Within a short jog at each bay's end, the trench steps across to the next bay
  const centreAt = (x: number) => {
    const bay = Math.floor(x / SQ);
    const into = x - bay * SQ;
    const jog = 12;
    const here = bayOffset(bay);
    if (into > SQ - jog) {
      const t = (into - (SQ - jog)) / jog;
      return centreY + here + (bayOffset(bay + 1) - here) * t;
    }
    return centreY + here;
  };
  const wallsA = ragged(rand, xs.length, 5);
  const wallsB = ragged(rand, xs.length, 5);
  const half = (x: number) => (onBoard(x) ? 31 : 26 + rand() * 6);
  const top: Point[] = [];
  const bottom: Point[] = [];
  xs.forEach((x, i) => {
    const c = centreAt(x);
    const h = half(x);
    const roughness = onBoard(x) ? 0.5 : 1;
    top.push({ x, y: c - h + wallsA[i] * roughness });
    bottom.push({ x, y: c + h + wallsB[i] * roughness });
  });
  const enemyEdge = enemyAbove ? top : bottom;
  const rearEdge = enemyAbove ? bottom : top;
  const away = enemyAbove ? 1 : -1;
  // A parapet on the near side is seen from the front: a wall of sandbags
  // standing up from the trench's edge, hiding the men behind it to the waist
  const facesViewer = !enemyAbove;

  const parapet: TrenchLine["parapet"] = [];
  const courses = facesViewer ? 3 : 2;
  for (let course = 0; course < courses; course++) {
    for (let i = course % 2; i < enemyEdge.length - 2; i += 2) {
      const a = enemyEdge[i];
      const b = enemyEdge[i + 2];
      const tilt = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      parapet.push({
        x: a.x + 2,
        y: facesViewer
          ? a.y - 5 - course * 9.5 + (rand() - 0.5) * 1.5
          : a.y - away * (4 + course * 7) + (rand() - 0.5) * 2,
        w: 11 + rand() * 3,
        tilt: tilt + (rand() - 0.5) * (facesViewer ? 6 : 12),
      });
    }
  }
  const face = facesViewer
    ? toPath(
        [
          ...bottom.map((p) => ({ x: p.x, y: p.y - PARAPET_HEIGHT })),
          ...[...bottom].reverse(),
        ],
        true,
      )
    : null;
  const wallTop = facesViewer
    ? Array.from({ length: 8 }, (_, col) => {
        const i = Math.round((col * SQ + SQ / 2 + REACH) / STEP);
        return (bottom[i].y - PARAPET_HEIGHT - (MARGIN + row * SQ)) / SQ;
      })
    : null;

  // The spoil thrown up behind, in a lumpy heap
  const heap = ragged(rand, rearEdge.length, 9);
  const paradosOuter = rearEdge.map((p, i) => ({
    x: p.x,
    y: p.y + away * (16 + Math.abs(heap[i]) * 1.4),
  }));
  const parados = toPath([...rearEdge, ...paradosOuter.reverse()], true);

  const water: TrenchLine["water"] = [];
  for (let x = -REACH; x < BOARD + REACH; x += 30 + rand() * 90) {
    if (rand() < 0.45) {
      water.push({
        x,
        y: centreAt(x) + (rand() - 0.5) * 18,
        rx: 10 + rand() * 18,
        ry: 5 + rand() * 7,
      });
    }
  }

  const wattle = toPath(top.map((p) => ({ x: p.x, y: p.y + 4 })));

  return {
    key: `t${row}`,
    row,
    wattle,
    face,
    wallTop,
    outline: toPath([...top, ...[...bottom].reverse()], true),
    centre: toPath(xs.map((x) => ({ x, y: centreAt(x) }))),
    parapet,
    parados,
    water,
  };
}

/** A zigzag communication trench running back between a side's two lines, off the board */
function commsTrench(x0: number, fromRow: number, toRow: number, seed: number) {
  const rand = seeded(seed);
  const y0 = MARGIN + fromRow * SQ + SQ / 2;
  const y1 = MARGIN + toRow * SQ + SQ / 2;
  const steps = Math.ceil(Math.abs(y1 - y0) / 30);
  const points: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const y = y0 + ((y1 - y0) * i) / steps;
    points.push({ x: x0 + (i % 2 ? 18 : -18) + (rand() - 0.5) * 10, y });
  }
  return toPath(points);
}

/** Belts of wire staked across no man's land, off the board where the plugin does not string it */
function wireBelts(rows: number[], seed: number) {
  const rand = seeded(seed);
  const posts: Point[] = [];
  const coils: string[] = [];
  for (const row of rows) {
    const y = MARGIN + row * SQ + SQ / 2;
    let prev: Point | null = null;
    for (let x = -REACH; x < BOARD + REACH; x += 45 + rand() * 25) {
      const post = { x, y: y + (rand() - 0.5) * 30 };
      if (onBoard(x)) {
        prev = null;
        continue;
      }
      // Some lengths have been blown away by the shelling
      if (rand() < 0.15) {
        prev = null;
        continue;
      }
      posts.push(post);
      if (prev) {
        const loops = 4;
        let d = `M${prev.x} ${prev.y}`;
        for (let k = 1; k <= loops; k++) {
          const t = k / loops;
          const px = prev.x + (post.x - prev.x) * t;
          const py = prev.y + (post.y - prev.y) * t;
          d += ` Q${(px - 6).toFixed(1)} ${(py - 14).toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)}`;
        }
        coils.push(d);
      }
      prev = post;
    }
  }
  return { posts, coils };
}

/** Shell holes pocking the ground off the board, thickest in no man's land */
function cratersOff(rows: number[], seed: number) {
  const rand = seeded(seed);
  const out: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < 160; i++) {
    const x = -REACH + rand() * (BOARD + REACH * 2);
    if (onBoard(x)) continue;
    const inNoMansLand = rand() < 0.65;
    const row = inNoMansLand
      ? rows[Math.floor(rand() * rows.length)]
      : Math.floor(rand() * 8);
    out.push({
      x,
      y: MARGIN + row * SQ + rand() * SQ,
      r: 14 + rand() * (inNoMansLand ? 36 : 22),
    });
  }
  return out;
}

/**
 * The front running on off both sides of the board: the same trench lines
 * zigzagging away into the distance, communication trenches between them,
 * wire and shell holes across no man's land, so the board is one stretch of
 * a war that goes on out of sight
 */
/** The front as dug for one way round of the board, worked out once */
const fronts = new Map<boolean, ReturnType<typeof surveyFront>>();

function frontFor(flipped: boolean) {
  if (!fronts.has(flipped)) fronts.set(flipped, surveyFront(flipped));
  return fronts.get(flipped)!;
}

/**
 * Where a parapet facing the viewer tops out in each square of the board, by
 * screen row and column, as a share of the square: the men behind it show
 * only above that line
 */
export function parapetTops(flipped: boolean): Map<number, number[]> {
  return new Map(
    frontFor(flipped).lines.flatMap((line) =>
      line.wallTop ? [[line.row, line.wallTop] as const] : [],
    ),
  );
}

/** Dig the whole front: the four trench lines, the saps between them, the wire and the craters */
function surveyFront(flipped: boolean) {
  const rowOf = (rank: number) => (flipped ? rank : 7 - rank);
  const lines = (Object.keys(TRENCH_RANKS) as Color[]).flatMap((color) =>
    [TRENCH_RANKS[color].front, TRENCH_RANKS[color].back].map((rank, i) => {
      const enemyAbove = (color === Color.White) !== flipped;
      return digTrench(rowOf(rank), enemyAbove, 101 + rank * 37 + i);
    }),
  );
  const comms = (Object.keys(TRENCH_RANKS) as Color[]).flatMap((color, c) => {
    const { front, back } = TRENCH_RANKS[color];
    const rand = seeded(500 + c);
    const out: string[] = [];
    for (let x = -REACH + 200; x < BOARD + REACH; x += 380 + rand() * 360) {
      if (onBoard(x) || onBoard(x - 60) || onBoard(x + 60)) continue;
      out.push(commsTrench(x, rowOf(front), rowOf(back), 700 + Math.round(x)));
    }
    return out;
  });
  const noMansLand = NO_MANS_LAND.map(rowOf);
  return {
    lines,
    comms,
    wire: wireBelts(noMansLand, 77),
    craters: cratersOff(noMansLand, 91),
  };
}

export function WorldTrenches({ flipped }: { flipped: boolean }) {
  const scene = useMemo(() => frontFor(flipped), [flipped]);

  const viewBox = `${-REACH} 0 ${BOARD + REACH * 2} ${BOARD + MARGIN * 2}`;
  return (
    <svg
      className="world-trenches"
      viewBox={viewBox}
      preserveAspectRatio="none"
      style={
        {
          "--reach": REACH / SQ,
          "--margin": MARGIN / SQ,
        } as React.CSSProperties
      }
      aria-hidden
    >
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
          <path d={line.parados} className="parados" />
          <path d={line.parados} className="earth-texture" />
          <path d={line.outline} className="trench-cut" />
          <path d={line.outline} className="earth-texture trench-floor" />
          <clipPath id={`wt-inside-${line.key}`}>
            <path d={line.outline} />
          </clipPath>
          <path
            d={line.outline}
            className="trench-shadow"
            clipPath={`url(#wt-inside-${line.key})`}
          />
          <path d={line.wattle} className="wattle" />
          <path d={line.wattle} className="wattle wattle-weave" />
          <path d={line.outline} className="trench-wall" />
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
          {line.face && <path d={line.face} className="parapet-face" />}
          {line.parapet.map((b, i) => (
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
