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
/**
 * How far up the screen a trench line is drawn from the middle of its row of
 * squares. The far side's trenches sit high, their men down in them below the
 * near edge; ours sit low enough that our men stand in them in full view.
 */
const LIFT = 25;
const OUR_LIFT = 0;
const FAR_LIP = -43;
const FAR_WALL_FOOT = -22;
const FLOOR = -9;
/** Our trenches are seen from behind the men: the far wall runs down to their boots, where the floor is */
const OUR_FAR_WALL_FOOT = 8;
const OUR_FLOOR = 32;
const NEAR_LIP = 47;
/** Where a trench's near edge crosses the squares of its row, as a share of the square: men in it are hidden below that */
export const TRENCH_EDGE = (SQ / 2 - LIFT + NEAR_LIP) / SQ;
const NEAR_BANK = 10;
/** How far the near bank spreads out in front of the trench, enough to cover a man's feet */
const NEAR_SPREAD = 30 + LIFT;

export interface Sandbag {
  x: number;
  y: number;
  w: number;
  h: number;
  tilt: number;
  /** How the burlap catches the light, 0 to 1 */
  tone: number;
  /** How plump it is, and how far its fill has slumped to one end, -1 to 1 */
  plump: number;
  slump: number;
  /** How weathered the sacking is: new and pale at 0, rotten and black with mud at 1 */
  wear: number;
  /** Mud caked on it, as blotches at points across the bag, -1 to 1 each way */
  mud: { x: number; y: number; r: number }[];
  /** Burst along a seam, earth spilling out */
  split: boolean;
  /** Which way its creases run */
  creases: number;
}

/** A sandbag's size in the drawing: long and fat, the way a filled bag sags */
const BAG_W = 36;
const BAG_H = 21;
/** How far above a trench's near edge its sandbags stand, as a share of a square */
export const BAG_TOP = 0.08;

interface TrenchLine {
  key: string;
  outline: string;
  centre: string;
  water: { x: number; y: number; rx: number; ry: number }[];
  /** The far wall's face, shored with upright planks in two tones and heavy stakes */
  farWall: string;
  stakes: string;
  wattle: string;
  boardsLight: string;
  /** The lip of ground along each edge */
  farLip: string;
  nearLip: string;
  /** One of our own trenches, seen from behind the men in it */
  ours: boolean;
  /** Duckboard slats, in two tones */
  slats: [string, string];
  /** Behind the far lip: sandbags if the enemy lies that way, otherwise the spoil heap */
  farWorks: { bags: Sandbag[]; heap: string | null };
  /** The near bank, standing in front of the men: earth, with sandbags on it if the enemy lies this way */
  nearBank: string;
  nearBags: Sandbag[];
  /** The screen row of squares it runs through */
  row: number;
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
  const along = (x: number) => {
    const i = Math.max(
      0,
      Math.min(edge.length - 2, Math.floor((x - edge[0].x) / STEP)),
    );
    const a = edge[i];
    const b = edge[i + 1];
    const t = (x - a.x) / (b.x - a.x || 1);
    return {
      y: a.y + (b.y - a.y) * t,
      tilt: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
    };
  };
  const end = edge[edge.length - 1].x;
  // Laid by hand: each bag its own size, packed unevenly, the odd one missing
  // or slumped, each course staggered over the one below
  for (let course = 0; course < courses; course++) {
    let x = edge[0].x + (course % 2 ? BAG_W * 0.5 : 0) + rand() * 6;
    while (x < end) {
      const w = BAG_W * (0.8 + rand() * 0.4);
      const h = BAG_H * (0.8 + rand() * 0.35);
      if (rand() > (course > 0 ? 0.1 : 0.03)) {
        const { y, tilt } = along(x + w / 2);
        bags.push({
          x: x + w / 2,
          y:
            y +
            base -
            course * rise +
            (rand() - 0.5) * 3 +
            (rand() < 0.08 ? 4 : 0),
          w,
          h,
          tilt: tilt + (rand() - 0.5) * 12,
          tone: rand(),
          plump: rand(),
          slump: rand() * 2 - 1,
          wear: rand() ** 1.6,
          mud: Array.from({ length: Math.floor(rand() * 4) }, () => ({
            x: rand() * 1.6 - 0.8,
            y: rand() * 1.2 - 0.3,
            r: 0.12 + rand() * 0.22,
          })),
          split: rand() < 0.07,
          creases: rand(),
        });
      }
      x += w * (0.78 + rand() * 0.12);
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
  const centreY = MARGIN + row * SQ + SQ / 2 - (enemyAbove ? OUR_LIFT : LIFT);
  const floor = enemyAbove ? OUR_FLOOR : FLOOR;
  const farWallFoot = enemyAbove ? OUR_FAR_WALL_FOOT : FAR_WALL_FOOT;
  const xs: number[] = [];
  for (let x = -REACH; x <= BOARD + REACH; x += STEP) xs.push(x);
  // Off the board the bays are dug to no plan: each its own length, set back
  // or forward by its own amount. On the board they line up with the squares.
  const bayStarts: number[] = [];
  const bayShift: number[] = [];
  for (let x = 0; x > -REACH - 200;) {
    x -= 55 + rand() * 120;
    bayStarts.unshift(x);
  }
  for (let col = 0; col < 8; col++) bayStarts.push(col * SQ);
  for (let x = BOARD; x < BOARD + REACH + 200; x += 55 + rand() * 120) {
    bayStarts.push(x);
  }
  let shift = 0;
  for (const start of bayStarts) {
    const inside = start >= 0 && start < BOARD;
    shift = inside
      ? 0
      : (shift > 0 ? -1 : 1) * (3 + rand() * 20) + (rand() - 0.5) * 10;
    bayShift.push(shift);
  }
  const bayIndex = (x: number) => {
    let lo = 0;
    let hi = bayStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (bayStarts[mid] <= x) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  // Traverses between squares, each its own depth and width, a few left out
  const traverses = Array.from({ length: 7 }, () =>
    rand() < 0.2 ? null : { depth: 5 + rand() * 12, half: 9 + rand() * 9 },
  );
  const centreAt = (x: number) => {
    const bay = bayIndex(x);
    const start = bayStarts[bay];
    const length = (bayStarts[bay + 1] ?? start + SQ) - start;
    const into = x - start;
    const jog = Math.min(14, length * 0.25);
    const here = bayShift[bay];
    let y = centreY + here;
    if (into > length - jog) {
      const t = (into - (length - jog)) / jog;
      y += ((bayShift[bay + 1] ?? here) - here) * t;
    }
    const edge = Math.round(x / SQ);
    const traverse = edge >= 1 && edge <= 7 ? traverses[edge - 1] : null;
    const from = Math.abs(x - edge * SQ);
    if (traverse && from < traverse.half) {
      y -=
        traverse.depth *
        (0.5 + 0.5 * Math.cos((from / traverse.half) * Math.PI));
    }
    return y;
  };
  const wallsA = ragged(rand, xs.length, 7);
  const wallsB = ragged(rand, xs.length, 7);
  const far: Point[] = [];
  const near: Point[] = [];
  xs.forEach((x, i) => {
    const c = centreAt(x);
    const board = onBoard(x);
    const roughness = board ? 0.7 : 1.3;
    const widen = board ? 0 : rand() * 8 - 4;
    far.push({ x, y: c + FAR_LIP - widen + wallsA[i] * roughness });
    near.push({ x, y: c + NEAR_LIP + widen + wallsB[i] * roughness });
  });

  const farFoot = xs.map((x, i) => ({
    x,
    y: centreAt(x) + farWallFoot + wallsA[i] * 0.3,
  }));
  const farWall = toPath([...far, ...[...farFoot].reverse()], true);
  // Upright planks shoring the far wall, in two tones so each board reads,
  // with a heavy stake every few boards holding them back
  // Planks of every width, some shorter, some leaning, the odd one gone
  const boards: [string, string] = ["", ""];
  let stakes = "";
  const footAt = (x: number) =>
    farFoot[
      Math.min(farFoot.length - 1, Math.max(0, Math.round((x - xs[0]) / STEP)))
    ].y;
  const lipAt = (x: number) =>
    far[Math.min(far.length - 1, Math.max(0, Math.round((x - xs[0]) / STEP)))]
      .y;
  let sinceStake = 0;
  for (let x = xs[0]; x < xs[xs.length - 1];) {
    const w = 7 + rand() * 7;
    const gap = rand() < 0.08 ? w : 0;
    if (!gap) {
      const top = lipAt(x) + 1 + (rand() < 0.15 ? 3 + rand() * 5 : 0);
      const foot = footAt(x) - (rand() < 0.1 ? 4 : 0);
      const lean = (rand() - 0.5) * 3;
      boards[rand() < 0.5 ? 0 : 1] +=
        `M${x.toFixed(1)} ${top.toFixed(1)} h${w.toFixed(1)} L${(x + w + lean).toFixed(1)} ${foot.toFixed(1)} h${(-w).toFixed(1)} Z `;
    }
    sinceStake += w;
    if (sinceStake > 45 + rand() * 50) {
      sinceStake = 0;
      stakes += `M${x.toFixed(1)} ${(lipAt(x) - 3 - rand() * 4).toFixed(1)} L${(x + (rand() - 0.5) * 4).toFixed(1)} ${(footAt(x) + 2).toFixed(1)} `;
    }
    x += w + 0.6 + gap;
  }
  const wattle = boards[1];
  const boardsLight = boards[0];

  // Behind the far lip
  const heapLumps = ragged(rand, xs.length, 9);
  const farWorks = enemyAbove
    ? { bags: layBags(far, rand, 2, 14, -11), heap: null }
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
  const nearBags = enemyAbove ? [] : layBags(near, rand, 1, 14, -3);

  // Duckboard slats laid across the floor, unevenly spaced, some skewed,
  // broken, or missing, in two tones of wet wood
  const slats: [string, string] = ["", ""];
  for (let x = xs[0]; x < xs[xs.length - 1];) {
    const w = 4.5 + rand() * 3;
    if (rand() > 0.07) {
      const y = centreAt(x) + floor;
      const broken = rand() < 0.08;
      const top = y - 12 + (broken ? 5 : 0);
      const bottom = y + 12 - (rand() < 0.08 ? 6 : 0);
      const skew = (rand() - 0.5) * 3;
      slats[rand() < 0.6 ? 0 : 1] +=
        `M${(x + skew).toFixed(1)} ${top.toFixed(1)} h${w.toFixed(1)} L${(x + w - skew).toFixed(1)} ${bottom.toFixed(1)} h${(-w).toFixed(1)} Z `;
    }
    x += w + 1.6 + rand() * 2.4;
  }

  const water: TrenchLine["water"] = [];
  for (let x = -REACH; x < BOARD + REACH; x += 30 + rand() * 90) {
    if (rand() < 0.45) {
      water.push({
        x,
        y: centreAt(x) + floor + (rand() - 0.5) * 8,
        rx: 10 + rand() * 18,
        ry: 3 + rand() * 4,
      });
    }
  }

  return {
    key: `t${row}`,
    outline: toPath([...far, ...[...near].reverse()], true),
    centre: toPath(xs.map((x) => ({ x, y: centreAt(x) + floor }))),
    farLip: toPath(far),
    nearLip: toPath(near),
    ours: enemyAbove,
    water,
    farWall,
    stakes,
    wattle,
    boardsLight,
    slats,
    farWorks,
    nearBank,
    nearBags,
    row,
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
  const out: { x: number; y: number; r: number; seed: number }[] = [];
  for (let i = 0; i < 160; i++) {
    const x = -REACH + rand() * (BOARD + REACH * 2);
    if (onBoard(x)) continue;
    const inNoMansLand = rand() < 0.65;
    const row = inNoMansLand
      ? rows[Math.floor(rand() * rows.length)]
      : Math.floor(rand() * 8);
    const hole = {
      x,
      y: MARGIN + row * SQ + rand() * SQ,
      r: 14 + rand() * (inNoMansLand ? 36 : 22),
      seed: Math.floor(rand() * 1e9),
    };
    // Shell holes never half overlap; where two would, the ground holds one
    if (
      out.some((c) => Math.hypot(c.x - hole.x, c.y - hole.y) < c.r + hole.r)
    ) {
      continue;
    }
    out.push(hole);
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

/** How finely the parapet's top is traced across a square */
const TRACE_STEPS = 16;

/**
 * The outline that cuts a man off where the sandbags in front of him begin,
 * traced along the bags' own lumpy tops, as a CSS clip-path for his body,
 * which fills the middle nine-tenths of his square. Null if no sandbags
 * stand in front of that square.
 */
export function parapetClip(
  flipped: boolean,
  row: number,
  col: number,
): string | null {
  const line = frontFor(flipped).lines.find(
    (l) => l.row === row && l.nearBags.length > 0,
  );
  if (!line) return null;
  const rowTop = MARGIN + row * SQ;
  const bags = line.nearBags.filter(
    (b) =>
      b.x + b.w > col * SQ - SQ * 0.2 && b.x - b.w < (col + 1) * SQ + SQ * 0.2,
  );
  // The highest bag top over each point across the square, or the lowest
  // bag's middle where there is a gap between bags
  const floor = Math.max(...bags.map((b) => b.y)) - rowTop;
  const topAt = (x: number) => {
    let top = floor;
    for (const b of bags) {
      const u = (x - b.x) / (b.w / 2);
      if (Math.abs(u) >= 1) continue;
      top = Math.min(
        top,
        b.y - rowTop - (b.h / 2) * 0.92 * Math.sqrt(1 - u * u),
      );
    }
    return top / SQ;
  };
  const toBody = (share: number) => ((share - 0.05) / 0.9) * 100;
  const points: string[] = [];
  for (let i = TRACE_STEPS; i >= 0; i--) {
    const sx = -0.15 + (1.3 * i) / TRACE_STEPS;
    const y = topAt(col * SQ + sx * SQ);
    points.push(`${toBody(sx).toFixed(1)}% ${toBody(y).toFixed(1)}%`);
  }
  return `polygon(-80% -80%, 180% -80%, 180% ${points[0].split(" ")[1]}, ${points.join(", ")}, -80% ${points[points.length - 1].split(" ")[1]})`;
}
