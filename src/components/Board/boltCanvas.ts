import { lightningAt } from "./lightning";
import type { Point, Stroke } from "./lightningShapes";

/** How long the bolt takes to step down from the sky before it strikes */
const LEADER_MS = 70;
/** How long a bolt lasts, flickers and all */
export const BOLT_MS = 950;
/** How far the ground lights up round where it lands, in pixels */
const GROUND_GLOW = 130;
/** How far the glow spreads past the channel, in pixels */
const GLOW_MARGIN = 70;

/** One layer of a bolt, drawn once into an image of its own at the resolution it needs */
interface Layer {
  image: HTMLCanvasElement;
  res: number;
}

/**
 * A bolt on its way down, or flickering where it struck: drawn once, as a
 * photograph shows one, into a wide soft bloom, a bright halo, and a
 * hair-thin white-hot core, for the main channel and its branches apart
 */
export interface Bolt {
  /** The box it is drawn in, on screen */
  left: number;
  top: number;
  width: number;
  height: number;
  main: Layer[];
  branches: Layer[];
  /** How far down the box the main channel has reached at each step of the leader, 0 to 1 */
  leader: number[];
  target: Point;
  born: number;
}

export function renderBolt(
  strokes: Stroke[],
  target: Point,
  born: number,
  /** Image pixels to each pixel the bolt is laid out in */
  pixelRatio = 1,
): Bolt {
  const xs = strokes.flatMap((s) => s.points.map(([x]) => x));
  const ys = strokes.flatMap((s) => s.points.map(([, y]) => y));
  const left = Math.min(...xs) - GLOW_MARGIN;
  const top = Math.min(...ys) - GLOW_MARGIN;
  const width = Math.max(...xs) + GLOW_MARGIN - left;
  const height = Math.max(...ys) + GLOW_MARGIN - top;
  const layer = (
    of: Stroke[],
    res: number,
    paint: (ctx: CanvasRenderingContext2D, stroke: Stroke) => void,
  ): Layer => {
    const image = document.createElement("canvas");
    image.width = Math.ceil(width * res * pixelRatio);
    image.height = Math.ceil(height * res * pixelRatio);
    const ctx = image.getContext("2d")!;
    const scale = res * pixelRatio;
    ctx.setTransform(scale, 0, 0, scale, -left * scale, -top * scale);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of of) {
      ctx.beginPath();
      ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
      for (const [x, y] of stroke.points.slice(1)) ctx.lineTo(x, y);
      paint(ctx, stroke);
    }
    return { image, res: res * pixelRatio };
  };
  const layers = (of: Stroke[]) => [
    // A wide soft bloom, drawn small so it blurs as it is scaled up
    layer(of, 0.25, (ctx, { width: w, bright: b }) => {
      ctx.shadowColor = `rgba(120, 140, 255, ${0.9 * b})`;
      ctx.shadowBlur = 12;
      ctx.lineWidth = w * 3;
      ctx.strokeStyle = `rgba(130, 150, 255, ${0.3 * b})`;
      ctx.stroke();
    }),
    // A bright halo hugging the channel
    layer(of, 0.5, (ctx, { width: w, bright: b }) => {
      ctx.shadowColor = `rgba(190, 210, 255, ${b})`;
      ctx.shadowBlur = 8;
      ctx.lineWidth = w * 1.5;
      ctx.strokeStyle = `rgba(215, 228, 255, ${0.85 * b})`;
      ctx.stroke();
    }),
    // The white-hot core
    layer(of, 1, (ctx, { width: w, bright: b }) => {
      ctx.shadowColor = `rgba(255, 255, 255, ${b})`;
      ctx.shadowBlur = 4;
      ctx.lineWidth = w * 0.8;
      ctx.strokeStyle = `rgba(255, 255, 255, ${b})`;
      ctx.stroke();
    }),
  ];
  const trunk = strokes.find((s) => s.main && s.width >= 2) ?? strokes[0];
  const leader = Array.from({ length: 6 }, (_, i) => {
    const reached = trunk.points.slice(
      0,
      Math.max(2, Math.ceil((trunk.points.length * (i + 1)) / 6)),
    );
    return (Math.max(...reached.map(([, y]) => y)) - top) / height;
  });
  return {
    left,
    top,
    width,
    height,
    main: layers(strokes.filter((s) => s.main)),
    branches: layers(strokes.filter((s) => !s.main)),
    leader,
    target,
    born,
  };
}

/** Adds a bolt's images onto the weather, at the brightness of the moment and as far down as it has reached */
export function drawBolt(
  ctx: CanvasRenderingContext2D,
  bolt: Bolt,
  now: number,
) {
  const t = now - bolt.born;
  const light = t < LEADER_MS + 5 ? 0.45 : lightningAt(t);
  if (light <= 0) return;
  const step = Math.min(5, Math.floor((t / LEADER_MS) * 6));
  const shown = t < LEADER_MS ? bolt.leader[step] : 1;
  // The branches die away before the main channel does
  const branchFade = t < 260 ? 1 : Math.max(0, 1 - (t - 260) / 380);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const paint = (layers: Layer[], alpha: number) => {
    if (alpha <= 0.01) return;
    ctx.globalAlpha = alpha;
    for (const { image, res } of layers) {
      const h = bolt.height * shown;
      ctx.drawImage(
        image,
        0,
        0,
        image.width,
        Math.max(1, Math.ceil(h * res)),
        bolt.left,
        bolt.top,
        bolt.width,
        h,
      );
    }
  };
  paint(bolt.main, light);
  paint(bolt.branches, light * branchFade);
  // The ground where it lands lights up round it
  if (shown === 1) {
    const [x, y] = bolt.target;
    const r = GROUND_GLOW;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r);
    glow.addColorStop(0, `rgba(200, 215, 255, ${0.5 * light})`);
    glow.addColorStop(1, "rgba(120, 140, 255, 0)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
}
