import { Color } from "../../engine";
import { NO_MANS_LAND, TRENCH_RANKS } from "../../plugins/trenches";

/** One square, in the drawing's units */
export const SQ = 100;
export const BOARD = SQ * 8;
/** How far the ground runs off each side of the board, and above and below it */
export const REACH = 40 * SQ;
export const MARGIN = SQ;
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

/**
 * The trench's depth, as seen from the viewer's side of the board, from its
 * centre line: the far lip, where the far wall's shored face gives way to the
 * floor, the near lip, and how high the near bank rises over it. The near
 * bank tops out at a man's waist when he stands in the middle of his square.
 */
/** How far up the screen every trench line is drawn from the middle of its row of squares */
const LIFT = 25;
const FAR_LIP = -43;
const FAR_WALL_FOOT = -22;
const FLOOR = -9;
const NEAR_LIP = 19;
/** Where a trench's near edge crosses the squares of its row, as a share of the square: men in it are hidden below that */
export const TRENCH_EDGE = (SQ / 2 - LIFT + NEAR_LIP) / SQ;
const NEAR_BANK = 10;
/** How far the near bank spreads out in front of the trench, enough to cover a man's feet */
const NEAR_SPREAD = 30 + LIFT;

export interface Sandbag {
  x: number;
  y: number;
  w: number;
  tilt: number;
}

interface TrenchLine {
  key: string;
  outline: string;
  centre: string;
  water: { x: number; y: number; rx: number; ry: number }[];
  /** The far wall's face, shored with stakes and wattle */
  farWall: string;
  stakes: string;
  wattle: string;
  /** Behind the far lip: sandbags if the enemy lies that way, otherwise the spoil heap */
  farWorks: { bags: Sandbag[]; heap: string | null };
  /** The near bank, standing in front of the men: earth, with sandbags on it if the enemy lies this way */
  nearBank: string;
  nearBags: Sandbag[];
}

/** Courses of sandbags laid along an edge, each course stepped back from the one below */
function layBags(
  edge: Point[],
  rand: () => number,
  courses: number,
  rise: number,
  base: number,
): Sandbag[] {
  const bags: Sandbag[] = [];
  for (let course = 0; course < courses; course++) {
    for (let i = course % 2; i < edge.length - 2; i += 2) {
      const a = edge[i];
      const b = edge[i + 2];
      const tilt = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      bags.push({
        x: a.x + 2,
        y: a.y + base - course * rise + (rand() - 0.5) * 1.5,
        w: 11 + rand() * 3,
        tilt: tilt + (rand() - 0.5) * 6,
      });
    }
  }
  return bags;
}

/**
 * One trench line dug right across the front. On the board it runs straight
 * through each square, so the men stand square in it, and doglegs around a
 * traverse of earth at each square's edge; off the board it zigzags from bay
 * to bay. Seen from the viewer's side, its far wall shows as a shored face,
 * the floor is duckboarded, and the near bank stands in front of the men.
 */
function digTrench(row: number, enemyAbove: boolean, seed: number): TrenchLine {
  const rand = seeded(seed);
  const centreY = MARGIN + row * SQ + SQ / 2 - LIFT;
  const xs: number[] = [];
  for (let x = -REACH; x <= BOARD + REACH; x += STEP) xs.push(x);
  const bays = new Map<number, number>();
  const bayOffset = (bay: number) => {
    if (bay >= 0 && bay < 8) return 0;
    if (!bays.has(bay)) {
      const swing = 7 + rand() * 13;
      bays.set(bay, (bay % 2 ? 1 : -1) * swing + Math.sin(bay * 0.37) * 14);
    }
    return bays.get(bay)!;
  };
  const TRAVERSE = 13;
  const centreAt = (x: number) => {
    const bay = Math.floor(x / SQ);
    const into = x - bay * SQ;
    const jog = 12;
    const here = bayOffset(bay);
    let y = centreY + here;
    if (into > SQ - jog) {
      const t = (into - (SQ - jog)) / jog;
      y += (bayOffset(bay + 1) - here) * t;
    }
    // Between two squares of the board, the trench steps back around a traverse
    const edge = Math.round(x / SQ);
    const from = Math.abs(x - edge * SQ);
    if (edge >= 1 && edge <= 7 && from < TRAVERSE) {
      y -= 12 * (0.5 + 0.5 * Math.cos((from / TRAVERSE) * Math.PI));
    }
    return y;
  };
  const wallsA = ragged(rand, xs.length, 5);
  const wallsB = ragged(rand, xs.length, 5);
  const far: Point[] = [];
  const near: Point[] = [];
  xs.forEach((x, i) => {
    const c = centreAt(x);
    const board = onBoard(x);
    const roughness = board ? 0.4 : 1;
    const widen = board ? 0 : rand() * 5 - 3;
    far.push({ x, y: c + FAR_LIP - widen + wallsA[i] * roughness });
    near.push({ x, y: c + NEAR_LIP + widen + wallsB[i] * roughness });
  });

  const farFoot = xs.map((x, i) => ({
    x,
    y: centreAt(x) + FAR_WALL_FOOT + wallsA[i] * 0.3,
  }));
  const farWall = toPath([...far, ...[...farFoot].reverse()], true);
  const stakes = far
    .filter((_, i) => i % 3 === 0)
    .map(
      (p, i) =>
        `M${p.x.toFixed(1)} ${(p.y + 1).toFixed(1)} L${(p.x + (rand() - 0.5) * 3).toFixed(1)} ${farFoot[i * 3].y.toFixed(1)}`,
    )
    .join(" ");
  const wattle = [0.3, 0.55, 0.8]
    .map((t) =>
      toPath(
        far.map((p, i) => ({ x: p.x, y: p.y + (farFoot[i].y - p.y) * t })),
      ),
    )
    .join(" ");

  // Behind the far lip
  const heapLumps = ragged(rand, xs.length, 9);
  const farWorks = enemyAbove
    ? { bags: layBags(far, rand, 2, 7, -4), heap: null }
    : {
        bags: [],
        heap: toPath(
          [
            ...far,
            ...far
              .map((p, i) => ({ x: p.x, y: p.y - 14 - Math.abs(heapLumps[i]) }))
              .reverse(),
          ],
          true,
        ),
      };

  // The near bank, rising in front of the men and spreading out to cover their feet
  const bankLumps = ragged(rand, xs.length, 7);
  const bankTop = near.map((p, i) => ({
    x: p.x,
    y: p.y - NEAR_BANK + (enemyAbove ? bankLumps[i] * 0.35 : 6),
  }));
  const bankFoot = near.map((p, i) => ({
    x: p.x,
    y: p.y + NEAR_SPREAD + Math.abs(bankLumps[i]) * 0.8,
  }));
  const nearBank = toPath([...bankTop, ...[...bankFoot].reverse()], true);
  const nearBags = enemyAbove ? [] : layBags(near, rand, 2, 6.5, -5);

  const water: TrenchLine["water"] = [];
  for (let x = -REACH; x < BOARD + REACH; x += 30 + rand() * 90) {
    if (rand() < 0.45) {
      water.push({
        x,
        y: centreAt(x) + FLOOR + (rand() - 0.5) * 8,
        rx: 10 + rand() * 18,
        ry: 3 + rand() * 4,
      });
    }
  }

  return {
    key: `t${row}`,
    outline: toPath([...far, ...[...near].reverse()], true),
    centre: toPath(xs.map((x) => ({ x, y: centreAt(x) + FLOOR }))),
    water,
    farWall,
    stakes,
    wattle,
    farWorks,
    nearBank,
    nearBags,
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

/** The front as dug for one way round of the board, worked out once */
const fronts = new Map<boolean, ReturnType<typeof surveyFront>>();

export function frontFor(flipped: boolean) {
  if (!fronts.has(flipped)) fronts.set(flipped, surveyFront(flipped));
  return fronts.get(flipped)!;
}
