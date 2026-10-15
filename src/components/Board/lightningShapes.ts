export type Point = [number, number];

export function seededRandom(seed: number): () => number {
  let state = (seed * 7919 + 13) % 2147483647;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** Roughly normal noise with a spread of about 0.5 */
const gauss = (rand: () => number) =>
  (rand() + rand() + rand() + rand() - 2) / 1.15;

/** A run of a channel, drawn at one width and brightness */
export interface Stroke {
  points: Point[];
  width: number;
  bright: number;
  /** How far through the bolt's growth it starts, 0 to 1, for drawing it in as it grows */
  at: number;
  main: boolean;
}

interface Walk {
  from: Point;
  heading: number;
  /** How far it grows; the main channel grows until it reaches `toward` */
  length: number;
  width: number;
  toward?: Point;
  forks: number;
  at: number;
}

interface Growth {
  /** The shortest and longest step it takes */
  step: [number, number];
  forkChance: number;
  canFork: (at: Point) => boolean;
  /** How strongly branches bend back toward falling straight down, 0 for none */
  fall: number;
}

/**
 * A channel grown a short step at a time, as lightning is: it keeps a
 * direction for a few steps, then kinks sharply to a new one, all the while
 * keeping to its heading overall. Branches grow off it the same way, each
 * thinner and fainter toward its tip.
 */
function walk(rand: () => number, w: Walk, out: Stroke[], g: Growth) {
  const points: Point[] = [w.from];
  const forkAt: { index: number; angle: number }[] = [];
  let kink = 0;
  let meander = 0;
  let heading = w.heading;
  let grown = 0;
  const main = w.toward !== undefined;
  for (let i = 0; i < 2000; i++) {
    const [x, y] = points[points.length - 1];
    const step = g.step[0] + rand() * (g.step[1] - g.step[0]);
    if (rand() < 0.3) kink = gauss(rand) * 0.75;
    meander = meander * 0.9 + gauss(rand) * 0.1;
    let aim = heading;
    let calm = 1;
    if (w.toward) {
      const left = Math.hypot(w.toward[0] - x, w.toward[1] - y);
      if (left < step * 1.3) {
        points.push(w.toward);
        break;
      }
      aim = Math.atan2(w.toward[1] - y, w.toward[0] - x);
      // It straightens out as it nears the ground, so it lands where it should
      calm = Math.min(1, left / (step * 8));
    } else {
      heading += (Math.PI / 2 - heading) * g.fall;
      if (grown >= w.length) break;
    }
    const angle = aim + (kink + meander + gauss(rand) * 0.12) * calm;
    points.push([x + Math.cos(angle) * step, y + Math.sin(angle) * step]);
    grown += step;
    if (w.forks > 0 && rand() < g.forkChance && g.canFork([x, y])) {
      forkAt.push({ index: points.length - 1, angle });
    }
  }

  const span = (from: number, to: number) => points.slice(from, to + 1);
  if (main) {
    out.push({ points, width: w.width, bright: 1, at: w.at, main: true });
  } else {
    // Thinner and fainter toward the tip, in three runs
    const third = Math.max(1, Math.floor(points.length / 3));
    [
      [0, third, 1],
      [third, third * 2, 0.65],
      [third * 2, points.length - 1, 0.35],
    ].forEach(([from, to, share]) => {
      if (to > from) {
        out.push({
          points: span(from, to),
          width: w.width * share,
          bright: share,
          at: w.at,
          main: false,
        });
      }
    });
  }

  for (const { index, angle } of forkAt) {
    const side = rand() < 0.5 ? -1 : 1;
    walk(
      rand,
      {
        from: points[index],
        heading: angle + side * (0.3 + rand() * 0.55),
        length: main
          ? (70 + rand() * 260) * (g.step[1] / 11)
          : (w.length - (index / points.length) * w.length) *
            (0.35 + rand() * 0.35),
        width: w.width * 0.5,
        forks: w.forks - 1,
        at: w.at + (index / points.length) * (1 - w.at),
      },
      out,
      { ...g, forkChance: g.forkChance * 0.8 },
    );
  }
}

/**
 * Filaments winding round a channel: each follows it, drifting from side to
 * side of it and jagged in its own way, so the bolt is a braid of strands
 */
function strands(rand: () => number, channel: Stroke, count: number): Stroke[] {
  const points = channel.points;
  return Array.from({ length: count }, () => {
    let drift = (rand() - 0.5) * 6;
    const wound = points.map(([x, y], i): Point => {
      if (i === 0 || i === points.length - 1) return [x, y];
      const [px, py] = points[i - 1];
      const [nx, ny] = points[i + 1];
      const len = Math.hypot(nx - px, ny - py) || 1;
      drift = Math.max(-9, Math.min(9, drift * 0.93 + gauss(rand) * 1.6));
      const off = drift + gauss(rand) * 1.4;
      return [x - ((ny - py) / len) * off, y + ((nx - px) / len) * off];
    });
    return {
      points: wound,
      width: channel.width * (0.35 + rand() * 0.25),
      bright: 0.45 + rand() * 0.35,
      at: channel.at,
      main: channel.main,
    };
  });
}

/** A bolt from `from` in the sky down onto `to`, in screen pixels: a braided main channel, forking all the way down */
export function boltStrokes(
  rand: () => number,
  from: Point,
  to: Point,
): Stroke[] {
  const out: Stroke[] = [];
  walk(
    rand,
    {
      from,
      heading: Math.PI / 2,
      length: Infinity,
      width: 2.6,
      toward: to,
      forks: 3,
      at: 0,
    },
    out,
    {
      step: [4, 11],
      forkChance: 0.12,
      canFork: ([, y]) => y > 10 && y < to[1] - 30,
      fall: 0.03,
    },
  );
  const braided = out.flatMap((stroke) =>
    stroke.main
      ? strands(rand, stroke, 3 + Math.floor(rand() * 2))
      : stroke.width > 0.9
        ? strands(rand, stroke, 1)
        : [],
  );
  return [...out, ...braided];
}

/** The burn a strike leaves, forking out over the ground from its middle, with `square` the size of a square */
export function burnStrokes(rand: () => number, square: number): Stroke[] {
  const out: Stroke[] = [];
  const unit = square / 84;
  const arms = 10 + Math.floor(rand() * 5);
  for (let i = 0; i < arms; i++) {
    walk(
      rand,
      {
        from: [0, 0],
        heading: (i / arms) * Math.PI * 2 + gauss(rand) * 0.3,
        length: square * (0.75 + rand() * 1.0),
        width: 2.8 * unit,
        forks: 3,
        at: 0,
      },
      out,
      {
        step: [2.5 * unit, 6 * unit],
        forkChance: 0.12,
        canFork: () => true,
        fall: 0,
      },
    );
  }
  return out;
}

/** The pit in the middle of a burn, its edge ragged */
export function craterEdge(rand: () => number, square: number): Point[] {
  const corners = 18;
  return Array.from({ length: corners }, (_, i) => {
    const angle = (i / corners) * Math.PI * 2;
    const r = square * (0.1 + rand() * 0.06);
    return [Math.cos(angle) * r, Math.sin(angle) * r];
  });
}

/** Specks of soot blown out round a burn, as offsets from its middle and sizes, in squares */
export function sootSpecks(rand: () => number): [number, number, number][] {
  return Array.from({ length: 46 }, () => {
    const angle = rand() * Math.PI * 2;
    const r = Math.abs(gauss(rand)) * 0.55;
    return [Math.cos(angle) * r, Math.sin(angle) * r, 0.07 + rand() * 0.16];
  });
}
