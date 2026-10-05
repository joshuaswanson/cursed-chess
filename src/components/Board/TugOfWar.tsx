import { useEffect, useRef } from "react";
import { WIN_LINE } from "../../plugins/tugOfWar";
import type { TugView } from "../../plugins/tugOfWar";
import { sfx } from "../../audio/sfx";
import { ROPE_TILE, STRAND_LEAN, fibrePaths, strandPath } from "./ropeTexture";
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

/** The rope's width inside the coil's 100-unit-wide drawing, matching the rope beside it */
const COIL_ROPE = 10;
const STRAND_TONES = ["#c9a066", "#b88d52", "#d6b077"];
/** Where the rope comes down into the pile, in the coil's drawing */
const COIL_ENTRY = { x: 50, y: -10 };
/** The same proportions as the rope's own strands, so the pile matches it */
const STRAND_HALF = COIL_ROPE * 0.9;
const STRAND_THICK = COIL_ROPE * 0.3;
const LOBE_SPACING = COIL_ROPE * 0.4;
/** Share of the spiral a pile holds when neither team has pulled rope out of it or into it */
const COIL_REST = 0.7;
const COIL_GIVE = 0.3;
const LEAD_POOL = 44;
/** The pile is drawn in this many stretches, each outlined, so loops lying against each other stay distinct */
const COIL_STRETCHES = 22;

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
 * outside loop: a loose S that swings out to one side, then back the other
 */
function slackCurve(from: Point, to: Point): Point[] {
  const swing = to.x >= from.x ? -24 : 24;
  const c1 = { x: from.x + swing, y: from.y + 20 };
  const c2 = { x: to.x - swing * 0.9, y: to.y - 18 };
  return Array.from({ length: 60 }, (_, i) => {
    const t = i / 59;
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

/** The rope's strands lean steeply off straight across it */
const lobeAngle = (dx: number, dy: number) =>
  (Math.atan2(dy, dx) * 180) / Math.PI - 90 - STRAND_LEAN;

const pathThrough = (points: Point[]) =>
  `M${points.map((p) => `${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" L")}`;

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

/** Strand placements spaced evenly along a path, each with its distance along it */
function lobesAlong(points: Point[], spacing: number) {
  const along = arcLengths(points);
  const lobes: { x: number; y: number; angle: number; at: number }[] = [];
  let next = spacing / 2;
  for (let i = 1; i < points.length; i++) {
    while (along[i] >= next) {
      const a = points[i - 1];
      const b = points[i];
      const k = (next - along[i - 1]) / (along[i] - along[i - 1] || 1);
      lobes.push({
        x: a.x + (b.x - a.x) * k,
        y: a.y + (b.y - a.y) * k,
        angle: lobeAngle(b.x - a.x, b.y - a.y),
        at: next,
      });
      next += spacing;
    }
  }
  return lobes;
}

const COIL_SPIRAL = coilSpiral();
const SPIRAL_ALONG = arcLengths(COIL_SPIRAL);
const SPIRAL_LENGTH = SPIRAL_ALONG[SPIRAL_ALONG.length - 1];
const SPIRAL_LOBES = lobesAlong(COIL_SPIRAL, LOBE_SPACING);

/**
 * The spiral cut into stretches. They are drawn from the free end in the
 * middle outward, the order the rope was laid, so each loop's outline shows
 * where it lies against the one inside it.
 */
const COIL_PIECES = Array.from({ length: COIL_STRETCHES }, (_, n) => {
  const from = (SPIRAL_LENGTH * n) / COIL_STRETCHES;
  const to = (SPIRAL_LENGTH * (n + 1)) / COIL_STRETCHES;
  const points = COIL_SPIRAL.filter(
    (_, i) => SPIRAL_ALONG[i] >= from - 0.01 && SPIRAL_ALONG[i] <= to + 0.6,
  );
  return {
    from,
    to,
    d: pathThrough(points),
    lobes: SPIRAL_LOBES.filter((l) => l.at >= from && l.at < to).map(
      (l, k) => ({
        ...l,
        tone: STRAND_TONES[
          Math.round(l.at / LOBE_SPACING) % STRAND_TONES.length
        ],
        // The inner loops sit lower in the pile, a little in shadow
        shade: 0.22 * (l.at / SPIRAL_LENGTH),
        key: `${n}-${k}`,
      }),
    ),
  };
}).reverse();

/** One twisted strand lobe of the rope */
function Strand({
  end,
  tone,
  shade,
  transform,
  innerRef,
}: {
  end: string;
  tone: string;
  shade: number;
  transform?: string;
  innerRef?: (el: SVGGElement | null) => void;
}) {
  const half = STRAND_HALF;
  const thick = STRAND_THICK;
  const [low, mid, high] = fibrePaths(half, thick);
  const body = strandPath(half, thick);
  return (
    <g ref={innerRef} transform={transform}>
      <path
        d={body}
        fill={tone}
        stroke="#4a2c12"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <path d={body} fill={`url(#coil-hl-${end})`} />
      <path d={body} fill="#1a0e04" fillOpacity={shade} />
      <path
        d={`${low} ${high}`}
        fill="none"
        stroke="#7a5228"
        strokeWidth="0.4"
        strokeOpacity="0.8"
      />
      <path
        d={mid}
        fill="none"
        stroke="#f3dcae"
        strokeWidth="0.45"
        strokeOpacity="0.85"
      />
    </g>
  );
}

/**
 * A loose coil of rope at one end of the tug of war. Its free end stays put in
 * the middle of the pile; rope pulled out of the pile comes off its outside
 * loops, and rope hauled into it winds fresh loops back round the outside.
 * The rope lies slack between the board and wherever the outside loop starts.
 */
function Coil({ end }: { end: "top" | "bottom" }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const pieceRefs = useRef<(SVGGElement | null)[]>([]);
  const bandRefs = useRef<(SVGPathElement | null)[][]>([]);
  const lobeRefs = useRef<Map<string, SVGGElement | null>>(new Map());
  const leadBandRefs = useRef<(SVGPathElement | null)[]>([]);
  const leadRefs = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    const board = svgRef.current?.closest<HTMLElement>(".board");
    let frame = 0;
    let shown = -1;
    let shownShift = NaN;
    const draw = () => {
      const pull = parseFloat(
        board?.style.getPropertyValue("--rope-pull") || "0",
      );
      // The pile stays put on the ground; only the rope coming down into it
      // moves, following the rope's end as it is hauled back and forth
      const shift = parseFloat(
        board?.style.getPropertyValue("--rope-shift") || "0",
      );
      // Rope moving down the screen piles into the bottom coil and comes out of the top one
      const held = COIL_REST + (end === "bottom" ? pull : -pull) * COIL_GIVE;
      if (
        Math.abs(held - shown) > 0.004 ||
        Math.abs(shift - shownShift) > 0.3
      ) {
        shown = held;
        shownShift = shift;
        const unit =
          (svgRef.current?.getBoundingClientRect().width ?? 100) / 100;
        const entry = {
          x: COIL_ENTRY.x,
          y: COIL_ENTRY.y + (shift / unit) * (end === "bottom" ? 1 : -1),
        };

        // Rope pulled out of the pile comes off its outside first
        const off = (1 - held) * SPIRAL_LENGTH;
        COIL_PIECES.forEach((piece, n) => {
          const group = pieceRefs.current[n];
          if (!group) return;
          group.style.display = piece.to <= off ? "none" : "";
          const cut =
            piece.from < off
              ? `0 ${(off - piece.from).toFixed(2)} ${SPIRAL_LENGTH.toFixed(1)}`
              : "";
          for (const band of bandRefs.current[n] ?? []) {
            if (cut) band?.setAttribute("stroke-dasharray", cut);
            else band?.removeAttribute("stroke-dasharray");
          }
          for (const lobe of piece.lobes) {
            const el = lobeRefs.current.get(lobe.key);
            if (el) el.style.display = lobe.at < off ? "none" : "";
          }
        });

        // The rope lies slack between the board and the outside loop, in a lazy S
        const startAt = Math.min(off, SPIRAL_LENGTH - 1);
        const i = SPIRAL_ALONG.findIndex((at) => at >= startAt);
        const curve = slackCurve(entry, COIL_SPIRAL[Math.max(0, i)]);
        const leadD = pathThrough(curve);
        for (const band of leadBandRefs.current) band?.setAttribute("d", leadD);
        const lobes = lobesAlong(curve, LOBE_SPACING);
        leadRefs.current.forEach((el, k) => {
          if (!el) return;
          const lobe = lobes[k];
          if (!lobe) {
            el.style.display = "none";
            return;
          }
          el.style.display = "";
          el.setAttribute(
            "transform",
            `translate(${lobe.x.toFixed(2)} ${lobe.y.toFixed(2)}) rotate(${lobe.angle.toFixed(1)})`,
          );
        });
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [end]);

  /**
   * A stretch of rope: its dark outline and the rope's body under the
   * strands, and a soft sheen down the middle over them. Stretches of the pile
   * meet end to end, so their ends are cut square.
   */
  const bands = (
    d: string | undefined,
    keep: (el: SVGPathElement | null, slot: number) => void,
    cap: "butt" | "round",
  ) => {
    const band = (slot: number, width: number, stroke: string, opacity = 1) => (
      <path
        key={slot}
        ref={(el) => keep(el, slot)}
        d={d}
        fill="none"
        stroke={stroke}
        strokeOpacity={opacity}
        strokeWidth={width}
        strokeLinecap={cap}
        strokeLinejoin="round"
      />
    );
    return {
      under: [
        band(0, COIL_ROPE + 1.8, "#4a2c12"),
        band(1, COIL_ROPE, "#b88d52"),
      ],
      over: band(2, COIL_ROPE * 0.32, "#fff6e0", 0.18),
    };
  };

  return (
    <svg
      ref={svgRef}
      className={`tug-coil coil-${end}`}
      viewBox="0 -12 100 72"
      aria-hidden
    >
      <defs>
        <linearGradient id={`coil-hl-${end}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {COIL_PIECES.map((piece, n) => (
        <g
          key={n}
          ref={(el) => {
            pieceRefs.current[n] = el;
          }}
        >
          {
            bands(
              piece.d,
              (el, slot) => {
                (bandRefs.current[n] ??= [])[slot] = el;
              },
              "butt",
            ).under
          }
          {piece.lobes.map((lobe) => (
            <Strand
              key={lobe.key}
              end={end}
              tone={lobe.tone}
              shade={lobe.shade}
              transform={`translate(${lobe.x.toFixed(2)} ${lobe.y.toFixed(2)}) rotate(${lobe.angle.toFixed(1)})`}
              innerRef={(el) => {
                lobeRefs.current.set(lobe.key, el);
              }}
            />
          ))}
          {
            bands(
              piece.d,
              (el) => {
                (bandRefs.current[n] ??= [])[2] = el;
              },
              "butt",
            ).over
          }
        </g>
      ))}
      {
        bands(
          undefined,
          (el, slot) => {
            leadBandRefs.current[slot] = el;
          },
          "round",
        ).under
      }
      {Array.from({ length: LEAD_POOL }, (_, k) => (
        <Strand
          key={`lead-${k}`}
          end={end}
          tone={STRAND_TONES[k % STRAND_TONES.length]}
          shade={0}
          innerRef={(el) => {
            leadRefs.current[k] = el;
          }}
        />
      ))}
      {
        bands(
          undefined,
          (el) => {
            leadBandRefs.current[2] = el;
          },
          "round",
        ).over
      }
    </svg>
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
          <Coil end="top" />
          <Coil end="bottom" />
          <div className="tug-rope" style={{ "--rope": ROPE_TILE } as Style} />
        </div>
        <div className="tug-flag" style={{ top: `${flagTop * 12.5}%` }}>
          <div
            key={view.heave}
            className={`tug-flag-body${view.heave > 0 ? " heaving" : ""}`}
            style={{ "--yank": yank } as Style}
          >
            <svg viewBox="0 0 70 44" className="tug-flag-cloth">
              {/* The cloth ripples between two shapes as it flies off the rope,
                  and swings about its knots as the rope jolts */}
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
              {[5, 35].map((y) => (
                <Lashing key={y} y={y} />
              ))}
            </svg>
            <span className="tug-score">
              <b className="you">{view.white}</b> vs{" "}
              <b className="foe">{view.black}</b>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
