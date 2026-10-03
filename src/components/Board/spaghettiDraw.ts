/** Thin slices across the pull, each squeezed and swirled on its own */
const SLICES = 32;
/** The canvas reaches this many squares around the hole, so the stretched tail fits */
export const SPAGHETTI_REACH = 3;

const GLOW = { blue: "47, 155, 255", orange: "255, 138, 26" };

/** Eased steps between [time, value] points */
function track(points: [number, number][], t: number): number {
  for (let i = 1; i < points.length; i++) {
    const [t1, v1] = points[i];
    if (t <= t1) {
      const [t0, v0] = points[i - 1];
      const k = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * k * k * (3 - 2 * k);
    }
  }
  return points[points.length - 1][1];
}

export interface Spaghetti {
  /** The piece turned so the way it was heading runs along x, ready to slice */
  turned: HTMLCanvasElement;
  /** The way the piece was heading, in radians, screen y pointing down */
  turn: number;
  /** The drawn piece's width, and the height of the turned copy that holds its corners */
  piece: number;
  span: number;
  glow: string;
  dpr: number;
}

/** Loads the piece and turns it to face the pull, ready for drawing frames */
export async function prepareSpaghetti(
  src: string,
  headingDeg: number,
  squareSize: number,
  color: "blue" | "orange",
): Promise<Spaghetti> {
  const dpr = window.devicePixelRatio || 1;
  const piece = squareSize * 0.9;
  const span = piece * Math.SQRT2;
  const turn = (headingDeg * Math.PI) / 180;
  const image = new Image();
  image.src = src;
  await image.decode();
  const turned = document.createElement("canvas");
  // Only as long as the piece along the pull, so its front edge is the slices' front
  turned.width = Math.ceil(piece * dpr);
  turned.height = Math.ceil(span * dpr);
  const ctx = turned.getContext("2d")!;
  ctx.translate(turned.width / 2, turned.height / 2);
  ctx.rotate(-turn);
  const drawn = piece * dpr;
  ctx.drawImage(image, -drawn / 2, -drawn / 2, drawn, drawn);
  return { turned, turn, piece, span, glow: GLOW[color], dpr };
}

/**
 * Draws the piece `t` of the way into the hole at the canvas center. The pull
 * is strongest on the side nearest the hole, so that side pinches to a point
 * and the piece becomes a wedge aimed at the center. The wedge stretches out
 * behind, winds round the hole, and is swallowed tip first.
 */
export function drawSpaghetti(
  ctx: CanvasRenderingContext2D,
  s: Spaghetti,
  size: number,
  t: number,
): void {
  // Tail and head along the pull with the hole at 0, in piece widths. The
  // head reaches a little past the center, since the piece art has a margin.
  const tail = track(
    [
      [0, -0.5],
      [0.45, -1.35],
      [1, -0.05],
    ],
    t,
  );
  const head = track(
    [
      [0, 0.5],
      [0.35, 0.12],
      [1, 0.05],
    ],
    t,
  );
  const pinch = track(
    [
      [0, 0],
      [0.35, 1],
      [1, 1],
    ],
    t,
  );
  const thick = track(
    [
      [0, 1],
      [0.45, 0.9],
      [1, 0.12],
    ],
    t,
  );
  const spin = track(
    [
      [0, 0],
      [1, 2.2],
    ],
    t,
  );
  const fade = track(
    [
      [0, 0],
      [0.75, 0],
      [1, 1],
    ],
    t,
  );

  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  ctx.rotate(s.turn);
  ctx.globalAlpha = 1 - fade;
  ctx.shadowColor = `rgba(${s.glow}, 0.9)`;
  ctx.shadowBlur = 14 * t;

  const sliceSource = s.turned.width / SLICES;
  const step = ((head - tail) * s.piece) / SLICES;
  for (let i = 0; i < SLICES; i++) {
    const u = (i + 0.5) / SLICES;
    const x = (tail + (head - tail) * u) * s.piece;
    // Slices nearer the hole are squeezed thinner and wound further round it
    const closeness = 1 - Math.min(1, Math.abs(x) / s.piece);
    const height = s.span * thick * (1 - pinch * u);
    ctx.save();
    ctx.rotate(spin * closeness * closeness);
    ctx.translate(x, 0);
    ctx.drawImage(
      s.turned,
      i * sliceSource,
      0,
      sliceSource,
      s.turned.height,
      -step / 2 - 0.4,
      -height / 2,
      step + 0.8,
      height,
    );
    ctx.restore();
  }
}
