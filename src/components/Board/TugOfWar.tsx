import { useEffect, useRef } from "react";
import { WIN_LINE } from "../../plugins/tugOfWar";
import type { TugView } from "../../plugins/tugOfWar";
import { sfx } from "../../audio/sfx";
import {
  ROPE_TILE,
  ROPE_TILE_RATIO,
  ROPE_TILE_SHADED_URL,
} from "./ropeTexture";
import { useTugStruggle } from "./tugStruggle";
import "./TugOfWar.css";

type Style = React.CSSProperties & Record<`--${string}`, string | number>;

/** The pennant's outline at the two ends of its ripple, flying off the rope to a point on the right */
const FLAG_WAVES = [
  "M9 4 C26 9 44 13 68 20 C44 26 26 31 9 36 Z",
  "M9 4 C24 12 46 9 68 21 C46 25 28 36 9 36 Z",
];
/** A white stripe running out to the point, rippling with the cloth */
const FLAG_STRIPE = [
  "M9 16 C28 18 46 19 62 20.2 C46 21.4 28 22.4 9 24 Z",
  "M9 16 C26 20 46 17 62 21 C46 22 30 25 9 24 Z",
];
/** Shadowed folds running across the cloth */
const FLAG_FOLDS = [
  "M27 9 C28 17 26 24 27 31 M45 13 C46 18 44 23 45 27",
  "M25 11 C23 18 27 25 25 32 M43 12 C45 17 41 23 44 28",
];

/** The rope's width inside the coil's 100-unit-wide drawing: the board's rope, at rest */
const COIL_ROPE = 12.6;
/** The rope texture repeats every this far along the rope */
const TILE_STEP = COIL_ROPE * ROPE_TILE_RATIO;
/** The rope is laid along the coil in pieces this long, overlapping a touch so no seam shows */
const PIECE = 2.4;
/** How far the slack rope starts back under the end of the rope in play, so the two overlap with no gap */
const COIL_TUCK = 2;
/** Share of the spiral a pile holds when neither team has pulled rope out of it or into it */
const COIL_REST = 0.6;
/** How much of the spiral feeds in or out as the rope gives during the struggle, and as it is hauled to a win line */
const COIL_GIVE = 0.08;
const COIL_HAUL = 0.6;
/** How quickly the pile takes up or pays out rope after a heave, in seconds */
const COIL_FEED_S = 0.3;
/** Enough pieces to lay the longest stretch of slack rope */
const LEAD_POOL = 60;

type Point = { x: number; y: number };

/**
 * A pile of rope lying on the ground, drawn for the bottom end: uneven loops
 * that tighten toward the middle, squashed because the pile lies flat. The
 * spiral runs from its outermost loop to the free end of the rope at the
 * center.
 */
function coilSpiral(): Point[] {
  const points: Point[] = [];
  const turns = 1.9;
  const steps = 260;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const theta = -Math.PI / 2 + t * turns * Math.PI * 2;
    const wobble =
      1 + 0.07 * Math.sin(theta * 3 + 1) + 0.05 * Math.sin(theta * 5);
    const r = (1 - 0.62 * t) * wobble;
    points.push({
      x: 50 + Math.cos(theta) * 40 * r,
      y: 31 + Math.sin(theta) * 31 * r,
    });
  }
  return points;
}

/**
 * Slack rope lying on the ground from where it leaves the board to the pile's
 * outside loop. It carries straight on from the board's rope, which comes down
 * into the pile, and runs into the loop the way the loop is already going, so
 * it bends smoothly at both ends.
 */
function slackCurve(from: Point, to: Point, into: Point): Point[] {
  const reach = Math.hypot(to.x - from.x, to.y - from.y);
  const handle = Math.min(18, Math.max(4, reach * 0.45));
  const c1 = { x: from.x, y: from.y + handle };
  const c2 = { x: to.x - into.x * handle, y: to.y - into.y * handle };
  return Array.from({ length: 50 }, (_, i) => {
    const t = i / 49;
    const u = 1 - t;
    return {
      x:
        u * u * u * from.x +
        3 * u * u * t * c1.x +
        3 * u * t * t * c2.x +
        t * t * t * to.x,
      y:
        u * u * u * from.y +
        3 * u * u * t * c1.y +
        3 * u * t * t * c2.y +
        t * t * t * to.y,
    };
  });
}

/** Distance along a path at each of its points */
function arcLengths(points: Point[]): number[] {
  const at = [0];
  for (let i = 1; i < points.length; i++) {
    at.push(
      at[i - 1] +
        Math.hypot(
          points[i].x - points[i - 1].x,
          points[i].y - points[i - 1].y,
        ),
    );
  }
  return at;
}

/**
 * Short pieces of rope laid end to end along a path, each placed and turned to
 * follow it, with the texture carried on from one piece to the next. The rope
 * can swell or thin along the way, as a share of its width at rest.
 */
function piecesAlong(
  points: Point[],
  startAt = 0,
  widthAt: (along: number) => number = () => 1,
) {
  const along = arcLengths(points);
  const pieces: { transform: string; at: number; phase: number }[] = [];
  let i = 1;
  for (let at = 0; at < along[along.length - 1]; at += PIECE) {
    while (i < points.length - 1 && along[i] < at) i++;
    const a = points[i - 1];
    const b = points[i];
    const k = (at - along[i - 1]) / (along[i] - along[i - 1] || 1);
    const x = a.x + (b.x - a.x) * k;
    const y = a.y + (b.y - a.y) * k;
    const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI - 90;
    const phase = (((startAt + at) % TILE_STEP) + TILE_STEP) % TILE_STEP;
    const width = widthAt(at / (along[along.length - 1] || 1));
    pieces.push({
      at,
      phase,
      transform: `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(1)}) scale(${width.toFixed(3)} 1) translate(${(-COIL_ROPE / 2).toFixed(2)} ${(-phase).toFixed(2)})`,
    });
  }
  return pieces;
}

const COIL_SPIRAL = coilSpiral();
const SPIRAL_ALONG = arcLengths(COIL_SPIRAL);

/** Which way the pile's rope runs at a point along the spiral, as a unit step */
function spiralHeading(i: number): Point {
  const a = COIL_SPIRAL[i];
  const b = COIL_SPIRAL[i + 1];
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
}
const SPIRAL_LENGTH = SPIRAL_ALONG[SPIRAL_ALONG.length - 1];
/** The pile's pieces, the free end in the middle first: the order the rope was laid */
const SPIRAL_PIECES = piecesAlong(COIL_SPIRAL).reverse();

/** One short piece of the rope, filled with the rope's own texture */
function RopePiece({
  fill,
  phase,
  transform,
  innerRef,
}: {
  fill: string;
  phase: number;
  transform?: string;
  innerRef?: (el: SVGGElement | null) => void;
}) {
  return (
    <g ref={innerRef} transform={transform}>
      <rect
        x="0"
        y={phase.toFixed(2)}
        width={COIL_ROPE}
        height={PIECE + 0.7}
        fill={`url(#${fill})`}
      />
    </g>
  );
}

/**
 * A loose coil of rope at one end of the tug of war, laid from the same rope
 * as the rest of it. Its free end stays put in the middle of the pile; rope
 * pulled out of the pile comes off its outside loops, and rope hauled into it
 * winds fresh loops back round the outside. The rope lies slack between the
 * board and wherever the outside loop starts.
 */
function Coil({ end, hauled }: { end: "top" | "bottom"; hauled: number }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pieceRefs = useRef<(SVGGElement | null)[]>([]);
  const leadRefs = useRef<(SVGGElement | null)[]>([]);
  // Read by the drawing loop, which outlives each render
  const haulRef = useRef(hauled);
  useEffect(() => {
    haulRef.current = hauled;
  }, [hauled]);

  useEffect(() => {
    const board = svgRef.current?.closest<HTMLElement>(".tug-layer");
    const rope = board?.querySelector<HTMLElement>(".tug-rope");
    let frame = 0;
    let shown = -1;
    let shownEntry = { x: NaN, y: NaN };
    let shownThin = NaN;
    let feeding = haulRef.current;
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const svg = svgRef.current;
      if (!svg || !rope) {
        frame = requestAnimationFrame(draw);
        return;
      }
      // How thick the rope in play is right now, stretched by the struggle or springing after a heave
      const scale = getComputedStyle(rope).scale;
      const thin = scale === "none" ? 1 : parseFloat(scale) || 1;
      const pull = parseFloat(
        board?.style.getPropertyValue("--rope-pull") || "0",
      );
      // After a heave the pile takes up or pays out the rope it gained or lost
      feeding +=
        (haulRef.current - feeding) * (1 - Math.exp(-dt / COIL_FEED_S));
      // Rope moving down the screen piles into the bottom coil and comes out of the top one
      const toward = end === "bottom" ? 1 : -1;
      const held = Math.min(
        1,
        Math.max(
          0.15,
          COIL_REST +
            toward * (pull * COIL_GIVE + (feeding / WIN_LINE) * COIL_HAUL),
        ),
      );

      // The slack rope starts right at the end of the rope in play, wherever
      // the struggle and the heaves have put it, in the coil's own drawing
      const box = svg.getBoundingClientRect();
      const ends = rope.getBoundingClientRect();
      const unit = box.width / 100;
      const entry = {
        x: ((ends.left + ends.right) / 2 - box.left) / unit,
        y:
          (end === "bottom"
            ? (ends.bottom - box.top) / unit
            : (box.bottom - ends.top) / unit) -
          12 -
          COIL_TUCK,
      };
      if (
        Math.abs(held - shown) > 0.003 ||
        Math.abs(entry.x - shownEntry.x) > 0.2 ||
        Math.abs(entry.y - shownEntry.y) > 0.2 ||
        Math.abs(thin - shownThin) > 0.01
      ) {
        shown = held;
        shownEntry = entry;
        shownThin = thin;

        // Rope pulled out of the pile comes off its outside first
        const off = (1 - held) * SPIRAL_LENGTH;
        SPIRAL_PIECES.forEach((piece, n) => {
          const el = pieceRefs.current[n];
          if (el) el.style.display = piece.at < off ? "none" : "";
        });

        // The slack rope runs from the board to where the outside loop now starts
        const found = SPIRAL_ALONG.findIndex((at) => at >= off);
        const i = Math.min(
          found < 0 ? COIL_SPIRAL.length - 1 : found,
          COIL_SPIRAL.length - 2,
        );
        const curve = slackCurve(entry, COIL_SPIRAL[i], spiralHeading(i));
        // The slack rope eases from the rope in play's thickness to the pile's
        const tile = rope.offsetWidth * ROPE_TILE_RATIO;
        const ropeEnd =
          end === "bottom" ? (rope.offsetHeight % tile) / tile : 0;
        const lead = piecesAlong(
          curve,
          ropeEnd * TILE_STEP - COIL_TUCK,
          (t) => {
            const eased = t * t * (3 - 2 * t);
            return thin + (1 - thin) * eased;
          },
        );
        leadRefs.current.forEach((el, k) => {
          if (!el) return;
          const piece = lead[k];
          if (!piece) {
            el.style.display = "none";
            return;
          }
          el.style.display = "";
          el.setAttribute("transform", piece.transform);
          el.firstElementChild?.setAttribute("y", piece.phase.toFixed(2));
        });
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [end, haulRef]);

  // The pile and the rope leading into it are drawn on separate layers, so
  // the lead moving every frame never redraws the whole pile
  const layer = (part: "pile" | "lead") => (
    <svg
      ref={part === "pile" ? svgRef : undefined}
      className={`tug-coil coil-${end}`}
      viewBox="0 -12 100 72"
      aria-hidden
    >
      <defs>
        <pattern
          id={`rope-${end}-${part}`}
          patternUnits="userSpaceOnUse"
          width={COIL_ROPE}
          height={TILE_STEP}
        >
          <image
            href={ROPE_TILE_SHADED_URL}
            width={COIL_ROPE}
            height={TILE_STEP}
            preserveAspectRatio="none"
          />
        </pattern>
      </defs>
      {part === "pile"
        ? SPIRAL_PIECES.map((piece, n) => (
            <RopePiece
              key={n}
              fill={`rope-${end}-pile`}
              phase={piece.phase}
              transform={piece.transform}
              innerRef={(el) => {
                pieceRefs.current[n] = el;
              }}
            />
          ))
        : Array.from({ length: LEAD_POOL }, (_, k) => (
            <RopePiece
              key={k}
              fill={`rope-${end}-lead`}
              phase={0}
              innerRef={(el) => {
                leadRefs.current[k] = el;
              }}
            />
          ))}
    </svg>
  );
  return (
    <>
      {layer("pile")}
      {layer("lead")}
    </>
  );
}

/** Seeded so the pit looks the same on every render */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** An irregular blob of `points` around a center, for the pit and its wet middle */
function blob(cx: number, cy: number, rx: number, ry: number, seed: number) {
  const rand = seeded(seed);
  const n = 14;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const r = 0.82 + rand() * 0.3;
    return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r];
  });
  // A smooth closed curve through the points
  let d = `M${((pts[0][0] + pts[n - 1][0]) / 2).toFixed(1)} ${((pts[0][1] + pts[n - 1][1]) / 2).toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[(i + 1) % n];
    d += ` Q${x.toFixed(1)} ${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)} ${((y + ny) / 2).toFixed(1)}`;
  }
  return `${d} Z`;
}

const MUD_SHAPE = blob(100, 250, 80, 222, 11);
const MUD_WET = blob(104, 252, 50, 150, 23);
const MUD_PUDDLE = blob(108, 258, 26, 92, 37);

/**
 * A churned mud pit running along the rope, where the pullers dig in. The surface is noise lit from the
 * top left, so it has real lumps and hollows with a wet sheen on top; the
 * edges are ragged and soft, the middle is darker and wetter, and a murky
 * puddle sits in it reflecting the sky.
 */
function MudPit() {
  return (
    <svg
      className="tug-mud"
      viewBox="0 0 200 500"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <filter id="mud-surface" x="-10%" y="-20%" width="120%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.03 0.05"
            numOctaves="4"
            seed="9"
            result="noise"
          />
          {/* Ragged edges: the pit's outline pushed about by the same noise */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="26"
            xChannelSelector="R"
            yChannelSelector="G"
            result="shape"
          />
          <feGaussianBlur in="shape" stdDeviation="2.5" result="soft" />
          <feDiffuseLighting
            in="noise"
            surfaceScale="5"
            diffuseConstant="1.15"
            lightingColor="#9c7244"
            result="relief"
          >
            <feDistantLight azimuth="225" elevation="38" />
          </feDiffuseLighting>
          <feSpecularLighting
            in="noise"
            surfaceScale="6"
            specularConstant="0.8"
            specularExponent="28"
            lightingColor="#fff6e6"
            result="sheen"
          >
            <feDistantLight azimuth="225" elevation="55" />
          </feSpecularLighting>
          <feComposite
            in="relief"
            in2="sheen"
            operator="arithmetic"
            k2="1"
            k3="0.45"
            result="lit"
          />
          <feComposite in="lit" in2="soft" operator="in" />
        </filter>
        <filter id="mud-soft" x="-20%" y="-30%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id="mud-edge" x="-20%" y="-30%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <linearGradient id="mud-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fa6a6" />
          <stop offset="0.5" stopColor="#4d4b3c" />
          <stop offset="1" stopColor="#2f2616" />
        </linearGradient>
      </defs>
      {/* A soft dark ring where the wet ground stains the sand */}
      <path
        d={MUD_SHAPE}
        fill="#5a3a1c"
        fillOpacity="0.35"
        filter="url(#mud-soft)"
      />
      <path d={MUD_SHAPE} fill="#fff" filter="url(#mud-surface)" />
      <path
        d={MUD_WET}
        fill="#2a1606"
        fillOpacity="0.45"
        filter="url(#mud-soft)"
        style={{ mixBlendMode: "multiply" }}
      />
      {/* Ruts where feet have skidded in from both sides */}
      <g
        fill="none"
        stroke="#24130a"
        strokeOpacity="0.4"
        strokeLinecap="round"
        filter="url(#mud-edge)"
      >
        <path d="M78 70 C70 120 76 170 90 200" strokeWidth="9" />
        <path d="M128 86 C138 130 132 172 116 202" strokeWidth="7" />
        <path d="M76 432 C70 380 78 330 92 300" strokeWidth="9" />
        <path d="M130 416 C140 372 132 330 116 300" strokeWidth="7" />
      </g>
      <path d={MUD_PUDDLE} fill="url(#mud-water)" filter="url(#mud-edge)" />
      <ellipse className="mud-ripple" cx="108" cy="248" rx="7" ry="28" />
      <path
        d="M100 206 Q93 246 99 294"
        stroke="#dff0f4"
        strokeOpacity="0.45"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        filter="url(#mud-edge)"
      />
    </svg>
  );
}

/** A few turns of red cord bound tight round the rope, tying a corner of the pennant to it */
function Lashing({ y }: { y: number }) {
  return (
    <g className="tug-lashing">
      {[-3, 0, 3].map((dy) => (
        <g key={dy}>
          <rect
            x="2.5"
            y={y + dy - 1.3}
            width="11"
            height="2.6"
            rx="1.3"
            fill="#c42c1d"
            stroke="#2a1a10"
            strokeWidth="1.1"
          />
          <path
            d={`M4.5 ${y + dy - 0.5} H11.5`}
            stroke="#ff8a7a"
            strokeWidth="0.7"
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>
  );
}

/** Patches of mud flung across the arena, kept clear of the pit in the middle */
const MUD_SPLATS = (() => {
  const rand = seeded(17);
  const splats: { d: string; drops: { x: number; y: number; r: number }[] }[] =
    [];
  while (splats.length < 30) {
    const x = 40 + rand() * 720;
    const y = 40 + rand() * 720;
    if (Math.abs(x - 400) < 140 && Math.abs(y - 400) < 300) continue;
    const size = 9 + rand() * 30;
    const drops = Array.from({ length: 7 }, () => {
      const a = rand() * Math.PI * 2;
      const reach = size * (1.3 + rand() * 0.9);
      return {
        x: x + Math.cos(a) * reach,
        y: y + Math.sin(a) * reach * 0.8,
        r: 1.5 + rand() * 3.5,
      };
    });
    splats.push({
      d: blob(x, y, size, size * (0.6 + rand() * 0.3), splats.length + 40),
      drops,
    });
  }
  return splats;
})();

/** Mud splattered about the arena from all the slipping and sliding */
function MudSplats() {
  return (
    <svg className="tug-splats" viewBox="0 0 800 800" aria-hidden>
      <defs>
        <filter id="splat-surface" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.06"
            numOctaves="4"
            seed="3"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="14"
            xChannelSelector="R"
            yChannelSelector="G"
            result="shape"
          />
          <feDiffuseLighting
            in="noise"
            surfaceScale="4"
            diffuseConstant="1.15"
            lightingColor="#8d6438"
            result="relief"
          >
            <feDistantLight azimuth="225" elevation="40" />
          </feDiffuseLighting>
          <feSpecularLighting
            in="noise"
            surfaceScale="5"
            specularConstant="0.7"
            specularExponent="26"
            lightingColor="#fff6e6"
            result="sheen"
          >
            <feDistantLight azimuth="225" elevation="55" />
          </feSpecularLighting>
          <feComposite
            in="relief"
            in2="sheen"
            operator="arithmetic"
            k2="1"
            k3="0.4"
            result="lit"
          />
          <feComposite in="lit" in2="shape" operator="in" />
        </filter>
      </defs>
      {MUD_SPLATS.map((splat, i) => (
        <g key={i} filter="url(#splat-surface)">
          <path d={splat.d} fill="#fff" />
          {splat.drops.map((drop, j) => (
            <circle key={j} cx={drop.x} cy={drop.y} r={drop.r} fill="#fff" />
          ))}
        </g>
      ))}
    </svg>
  );
}

/** How far down the board, in squares, a spot `toWhite` squares from the center line toward White sits */
const fromTop = (toWhite: number, flipped: boolean) =>
  4 + (flipped ? -toWhite : toWhite);

/**
 * The tug of war: a rope up the middle of the board with the flag tied on it,
 * a mud pit at the center line, and chalk win lines three squares into each
 * half. Every heave yanks the rope and slides the flag toward the stronger side.
 */
export function TugLayer({
  view,
  flipped,
  delayMs,
}: {
  view: TugView;
  flipped: boolean;
  /** How long the heave waits for the move that set it off to finish */
  delayMs: number;
}) {
  useEffect(() => {
    if (view.heave === 0) return;
    const heave = setTimeout(() => sfx.heave(), delayMs);
    return () => clearTimeout(heave);
    // Only a new heave plays the sound
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.heave]);

  const flagTop = fromTop(view.flag, flipped);
  // Which way the last heave went on screen: down is positive
  const yank = view.heaveDir * (flipped ? -1 : 1);
  const lines = [
    { toWhite: WIN_LINE, team: "white" },
    { toWhite: -WIN_LINE, team: "black" },
  ];

  // The struggle only plays out when both teams have someone on the rope
  const contested = view.white > 0 && view.black > 0;
  const rootRef = useRef<HTMLDivElement>(null);
  useTugStruggle(rootRef, contested, flipped);

  return (
    <>
      <div ref={rootRef} className="tug-layer" aria-hidden>
        <MudSplats />
        <MudPit />
        <span className="tug-center-line" />
        {lines.map(({ toWhite, team }) => (
          <span
            key={team}
            className={`tug-win-line win-${team}`}
            style={{ top: `${fromTop(toWhite, flipped) * 12.5}%` }}
          >
            <span className="tug-win-label">
              {team === "white" ? "Your win line" : "Their win line"}
            </span>
          </span>
        ))}
      </div>
      <div className="tug-layer tug-rope-layer" aria-hidden>
        <div
          key={view.heave}
          className={`tug-rope-wrap${view.heave > 0 ? " heaving" : ""}`}
          style={{ "--yank": yank } as Style}
        >
          <Coil end="top" hauled={flagTop - 4} />
          <Coil end="bottom" hauled={flagTop - 4} />
          <div className="tug-rope-shadow">
            <div
              className="tug-rope"
              style={{ "--rope": ROPE_TILE } as Style}
            />
          </div>
        </div>
        {(["cloth", "knots"] as const).map((part) => (
          <div
            key={part}
            className={`tug-flag${part === "cloth" ? " under-rope" : ""}`}
            style={{ top: `${flagTop * 12.5}%` }}
          >
            <div
              key={view.heave}
              className={`tug-flag-body${view.heave > 0 ? " heaving" : ""}`}
              style={{ "--yank": yank } as Style}
            >
              <svg viewBox="0 0 70 44" className="tug-flag-cloth">
                {part === "cloth" ? (
                  /* The cloth ripples between two shapes as it flies off the
                     rope, and swings about its knots as the rope jolts */
                  <g className="tug-flag-swing">
                    <path
                      d={FLAG_WAVES[0]}
                      fill="#e8402f"
                      stroke="#2a1a10"
                      strokeWidth="2.4"
                      strokeLinejoin="round"
                    >
                      <animate
                        attributeName="d"
                        values={`${FLAG_WAVES[0]};${FLAG_WAVES[1]};${FLAG_WAVES[0]}`}
                        dur="1.1s"
                        repeatCount="indefinite"
                      />
                    </path>
                    <path d={FLAG_STRIPE[0]} fill="#ffffff">
                      <animate
                        attributeName="d"
                        values={`${FLAG_STRIPE[0]};${FLAG_STRIPE[1]};${FLAG_STRIPE[0]}`}
                        dur="1.1s"
                        repeatCount="indefinite"
                      />
                    </path>
                    <path
                      d={FLAG_FOLDS[0]}
                      fill="none"
                      stroke="#000"
                      strokeOpacity="0.22"
                      strokeWidth="3"
                    >
                      <animate
                        attributeName="d"
                        values={`${FLAG_FOLDS[0]};${FLAG_FOLDS[1]};${FLAG_FOLDS[0]}`}
                        dur="1.1s"
                        repeatCount="indefinite"
                      />
                    </path>
                  </g>
                ) : (
                  [5, 35].map((y) => <Lashing key={y} y={y} />)
                )}
              </svg>
              {part === "knots" && (
                <span className="tug-score">
                  <b className="you">{view.white}</b> vs{" "}
                  <b className="foe">{view.black}</b>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
