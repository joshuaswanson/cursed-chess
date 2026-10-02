import type { SquareIndex } from "../../engine";

/** Deterministic random numbers, so a crater keeps its shape across renders */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rand = () => number;
type Point = readonly [number, number];

const between = (rand: Rand, min: number, max: number) =>
  min + rand() * (max - min);
const polar = (r: number, a: number): Point => [
  r * Math.cos(a),
  r * Math.sin(a),
];
const fmt = (n: number) => n.toFixed(1);
const pt = ([x, y]: Point) => `${fmt(x)} ${fmt(y)}`;

/** A closed lumpy outline around the origin, smoothed through edge midpoints */
function blob(rand: Rand, radius: number, wobble: number, points: number) {
  const pts = Array.from({ length: points }, (_, i) =>
    polar(
      radius * between(rand, 1 - wobble, 1 + wobble),
      (i / points) * Math.PI * 2 + between(rand, -0.2, 0.2),
    ),
  );
  const mid = (i: number): Point => {
    const [x1, y1] = pts[i % points];
    const [x2, y2] = pts[(i + 1) % points];
    return [(x1 + x2) / 2, (y1 + y2) / 2];
  };
  let d = `M${pt(mid(0))}`;
  for (let i = 1; i <= points; i++) {
    d += ` Q${pt(pts[i % points])} ${pt(mid(i))}`;
  }
  return `${d}Z`;
}

/** A hard-edged broken fragment: straight sides, uneven corners */
function shard(rand: Rand, size: number) {
  const corners = 3 + Math.floor(rand() * 3);
  const pts = Array.from({ length: corners }, (_, i) =>
    polar(
      size * between(rand, 0.5, 1.1),
      (i / corners) * Math.PI * 2 + between(rand, -0.35, 0.35),
    ),
  );
  return `M${pts.map(pt).join(" L")}Z`;
}

/** A filled outline that runs along `points`, `width` wide at the start and tapering to a point */
function taper(points: Point[], width: number) {
  const left: Point[] = [];
  const right: Point[] = [];
  points.forEach(([x, y], i) => {
    const [nx, ny] = points[Math.min(i + 1, points.length - 1)];
    const [px, py] = points[Math.max(i - 1, 0)];
    const dx = nx - px;
    const dy = ny - py;
    const length = Math.hypot(dx, dy) || 1;
    const half = (width / 2) * (1 - i / (points.length - 1)) + 0.25;
    left.push([x - (dy / length) * half, y + (dx / length) * half]);
    right.push([x + (dy / length) * half, y - (dx / length) * half]);
  });
  return `M${[...left, ...right.reverse()].map(pt).join(" L")}Z`;
}

/** A fracture running out from the rim with sharp kinks, plus a branch or two */
function fracture(rand: Rand, angle: number): string[] {
  let r = between(rand, 38, 48);
  let a = angle;
  const main: Point[] = [polar(r, a)];
  const reach = between(rand, 95, 175);
  const branches: string[] = [];
  while (r < reach) {
    r += between(rand, 10, 22);
    a +=
      rand() < 0.25 ? between(rand, -0.45, 0.45) : between(rand, -0.12, 0.12);
    main.push(polar(r, a));
    if (branches.length < 2 && r > 70 && rand() < 0.35) {
      const side = rand() < 0.5 ? -1 : 1;
      const length = between(rand, 20, 45);
      branches.push(
        taper(
          [
            polar(r, a),
            polar(r + length * 0.5, a + side * 0.3),
            polar(r + length, a + side * between(rand, 0.35, 0.6)),
          ],
          3,
        ),
      );
    }
  }
  return [taper(main, between(rand, 5, 8)), ...branches];
}

/** A soot streak blown outward from the hole */
function blastRay(rand: Rand, angle: number) {
  const width = between(rand, 0.06, 0.16);
  const length = between(rand, 110, 175);
  return `M${pt(polar(30, angle - width))} L${pt(polar(length, angle + between(rand, -0.04, 0.04)))} L${pt(polar(30, angle + width))}Z`;
}

/**
 * Where a mine went off: the board is charred far past the square, split by
 * fractures, and littered with dirt and heaved-up tile slabs around a deep pit
 * whose floor is still glowing.
 */
export function Crater({ sq }: { sq: SquareIndex }) {
  const rand = seeded(sq * 9973 + 17);
  const id = (name: string) => `crater-${name}-${sq}`;
  const url = (name: string) => `url(#${id(name)})`;

  const rayCount = 12 + Math.floor(rand() * 6);
  const rays = Array.from({ length: rayCount }, (_, i) =>
    blastRay(rand, (i / rayCount) * Math.PI * 2 + between(rand, -0.2, 0.2)),
  );
  const crackCount = 6 + Math.floor(rand() * 4);
  const cracks = Array.from({ length: crackCount }, (_, i) =>
    fracture(rand, (i / crackCount) * Math.PI * 2 + between(rand, -0.25, 0.25)),
  ).flat();
  const char = blob(rand, 64, 0.25, 12);
  const rim = blob(rand, 53, 0.22, 14);
  const pit = blob(rand, 40, 0.18, 11);
  const floor = blob(rand, 20, 0.3, 7);

  const clods = Array.from({ length: 34 + Math.floor(rand() * 14) }, () => {
    const reach = 44 + Math.pow(rand(), 1.8) * 85;
    const at = polar(reach, rand() * Math.PI * 2);
    return {
      at,
      d: shard(rand, between(rand, 1.5, 6.5) * (1 - (reach - 44) / 170)),
      tone: ["#24170b", "#3e2a16", "#5a3f22", "#14100c", "#4d443d"][
        Math.floor(rand() * 5)
      ],
    };
  });
  const slabCount = 5 + Math.floor(rand() * 3);
  const slabs = Array.from({ length: slabCount }, (_, i) => {
    const angle = (i / slabCount) * Math.PI * 2 + between(rand, -0.3, 0.3);
    return {
      at: polar(between(rand, 48, 62), angle),
      d: shard(rand, between(rand, 11, 19)),
      spin: rand() * 360,
      lift: between(rand, 2.5, 5),
      light: rand() < 0.5,
      burnt: between(rand, 0.15, 0.65),
    };
  });
  const veinCount = 3 + Math.floor(rand() * 2);
  const veins = Array.from({ length: veinCount }, (_, i) => {
    const a = (i / veinCount) * Math.PI * 2 + rand();
    return `M${pt(polar(between(rand, 0, 5), a))} L${pt(polar(between(rand, 9, 14), a + between(rand, -0.5, 0.5)))} L${pt(polar(between(rand, 17, 25), a + between(rand, -0.4, 0.4)))}`;
  });
  const embers = Array.from({ length: 4 + Math.floor(rand() * 4) }, () => {
    const at = polar(between(rand, 0, 22), rand() * Math.PI * 2);
    return { at, r: between(rand, 1.2, 2.8), delay: rand() * 1.6 };
  });

  return (
    <svg className="crater" viewBox="-150 -150 300 300" aria-hidden>
      <defs>
        {/* Breaks the soot into blotches so the burn looks splattered */}
        <filter id={id("char")} x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.035"
            numOctaves="4"
            seed={sq}
            result="noise"
          />
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  6 0 0 0 -2.3"
            result="blotches"
          />
          <feComposite
            in="SourceGraphic"
            in2="blotches"
            operator="in"
            result="patchy"
          />
          <feDisplacementMap
            in="patchy"
            in2="noise"
            scale="34"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
        <filter id={id("rough")} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.09"
            numOctaves="3"
            seed={sq + 7}
          />
          <feDisplacementMap in="SourceGraphic" scale="14" />
        </filter>
        <filter id={id("glow")} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
        <radialGradient id={id("soot")}>
          <stop offset="0" stopColor="#040404" />
          <stop offset="0.4" stopColor="#0b0a09" stopOpacity="0.95" />
          <stop offset="0.7" stopColor="#171514" stopOpacity="0.6" />
          <stop offset="1" stopColor="#201d1b" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("burn")}>
          <stop offset="0" stopColor="#030303" />
          <stop offset="0.75" stopColor="#0c0b0a" stopOpacity="0.92" />
          <stop offset="1" stopColor="#171514" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id("rim")} cx="0.38" cy="0.34" r="0.7">
          <stop offset="0.5" stopColor="#7a5634" />
          <stop offset="0.78" stopColor="#3f2a16" />
          <stop offset="1" stopColor="#140c05" />
        </radialGradient>
        <radialGradient id={id("pit")} cx="0.6" cy="0.66" r="0.7">
          <stop offset="0" stopColor="#000" />
          <stop offset="0.55" stopColor="#0b0603" />
          <stop offset="0.85" stopColor="#2a190b" />
          <stop offset="1" stopColor="#4d3118" />
        </radialGradient>
        <radialGradient id={id("heat")}>
          <stop offset="0" stopColor="#ff8a1f" stopOpacity="0.7" />
          <stop offset="0.6" stopColor="#ff3d00" stopOpacity="0.25" />
          <stop offset="1" stopColor="#ff3d00" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("slab")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#000" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      <circle r="140" fill={url("soot")} filter={url("char")} />
      <g filter={url("rough")}>
        <path d={char} fill={url("burn")} />
        {rays.map((d, i) => (
          <path key={i} d={d} fill="#0a0603" opacity={0.45 + (i % 4) * 0.1} />
        ))}
      </g>

      {cracks.map((d, i) => (
        <g key={i}>
          <path d={d} className="crack-light" />
          <path d={d} className="crack-dark" />
        </g>
      ))}

      <path
        d={rim}
        fill={url("rim")}
        filter={url("rough")}
        className="crater-rim"
      />
      <path d={rim} fill={url("soot")} opacity="0.55" filter={url("char")} />
      {clods.map((c, i) => (
        <path
          key={i}
          d={c.d}
          fill={c.tone}
          transform={`translate(${pt(c.at)})`}
        />
      ))}
      <path d={pit} fill={url("pit")} filter={url("rough")} />
      <path
        d={pit}
        fill="none"
        stroke="#000"
        strokeOpacity="0.6"
        strokeWidth="7"
        transform="translate(-3 -5) scale(0.86)"
      />

      <circle r="30" fill={url("heat")} className="crater-heat" />
      <path d={floor} fill="#120703" />
      <g className="crater-veins">
        {veins.map((d, i) => (
          <g key={i}>
            <path d={d} className="vein-glow" filter={url("glow")} />
            <path d={d} className="vein-core" />
          </g>
        ))}
      </g>
      {embers.map((e, i) => (
        <g
          key={i}
          className="crater-ember"
          style={{ animationDelay: `${e.delay}s` }}
        >
          <circle
            cx={e.at[0]}
            cy={e.at[1]}
            r={e.r * 2.4}
            fill="#ff6a00"
            filter={url("glow")}
          />
          <circle cx={e.at[0]} cy={e.at[1]} r={e.r} fill="#ffe08a" />
        </g>
      ))}

      {slabs.map((s, i) => (
        <g key={i} transform={`translate(${pt(s.at)}) rotate(${fmt(s.spin)})`}>
          <path
            d={s.d}
            fill="#140c06"
            transform={`translate(${fmt(s.lift * 0.5)} ${fmt(s.lift)})`}
          />
          <path d={s.d} className={s.light ? "slab-light" : "slab-dark"} />
          <path d={s.d} fill={url("slab")} />
          <path d={s.d} fill="#0a0603" opacity={s.burnt} />
          <path d={s.d} fill="none" stroke="#0a0603" strokeWidth="1.2" />
        </g>
      ))}

      <g className="crater-smoke">
        <circle r="20" cx="-5" cy="0" />
        <circle r="16" cx="7" cy="2" />
        <circle r="14" cx="0" cy="-4" />
      </g>
    </svg>
  );
}
