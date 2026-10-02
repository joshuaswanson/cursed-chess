import { Color } from "../../engine";
import type { SquareIndex } from "../../engine";
import { GATES, TOWERS } from "../../plugins/siege";
import { visualCol, visualRow } from "./boardGeometry";

// Each square is drawn in a 0 to 100 space. A wall segment lies along the x
// axis with its outer face at the top, then is turned into place.
const OUTER = 16;
const WALK_TOP = 31;
const WALK_BOTTOM = 70;
const INNER = 84;
/** Towers spill past their square so the walls on both sides run into them */
const TOWER_R = 62;
const TOWER_RIM = 13;
const ROOF_R = 36;
const TURRET_R = 30;
/** The wall's shadow falls this way on screen, away from the light */
const SHADOW = { x: 6, y: 10 };

function seeded(seed: number) {
  let s = seed * 7919 + 13;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const flagColor = (defender: Color) =>
  defender === Color.White ? "#3b6fe0" : "#c8283a";

/** How a wall square is turned so its outer face points out of the castle */
function facing(col: number, row: number): number {
  if (row === 1) return 0;
  if (row === 6) return 180;
  return col === 1 ? -90 : 90;
}

/** The screen step taken by moving along a segment's +x axis */
function along(angle: number): [number, number] {
  if (angle === 0) return [1, 0];
  if (angle === 180) return [-1, 0];
  return angle === -90 ? [0, -1] : [0, 1];
}

/** A screen-space vector expressed in a segment's own turned frame */
function toLocal(v: { x: number; y: number }, angle: number) {
  const a = (-angle * Math.PI) / 180;
  return {
    x: v.x * Math.cos(a) - v.y * Math.sin(a),
    y: v.x * Math.sin(a) + v.y * Math.cos(a),
  };
}

const pt = (x: number, y: number) => `${x.toFixed(1)} ${y.toFixed(1)}`;

/** An annular wedge, for battlements around a round tower */
function sector(r1: number, r2: number, a0: number, a1: number): string {
  const p = (r: number, a: number) =>
    pt(50 + r * Math.cos(a), 50 + r * Math.sin(a));
  return `M${p(r2, a0)} A${r2} ${r2} 0 0 1 ${p(r2, a1)} L${p(r1, a1)} A${r1} ${r1} 0 0 0 ${p(r1, a0)} Z`;
}

/** A tapered, wandering crack with smaller cracks branching off it, as filled shapes */
function crackShapes(
  rand: () => number,
  start: { x: number; y: number },
  heading: number,
  length: number,
  width: number,
): string[] {
  const shapes: string[] = [];
  const grow = (
    from: { x: number; y: number },
    dir: number,
    len: number,
    w: number,
    depth: number,
  ) => {
    const steps = 6;
    const points = [from];
    let { x, y } = from;
    let a = dir;
    for (let i = 0; i < steps; i++) {
      a += (rand() - 0.5) * 1.1;
      x += Math.cos(a) * (len / steps);
      y += Math.sin(a) * (len / steps);
      points.push({ x, y });
    }
    const left: string[] = [];
    const right: string[] = [];
    points.forEach((p, i) => {
      const next = points[Math.min(i + 1, steps)];
      const prev = points[Math.max(i - 1, 0)];
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const n = Math.hypot(dx, dy) || 1;
      const half = (w / 2) * (1 - i / steps) * (0.6 + rand() * 0.8) + 0.1;
      left.push(pt(p.x - (dy / n) * half, p.y + (dx / n) * half));
      right.push(pt(p.x + (dy / n) * half, p.y - (dx / n) * half));
    });
    shapes.push(`M${[...left, ...right.reverse()].join(" L")} Z`);
    if (depth < 2) {
      const fork = points[2 + Math.floor(rand() * 3)];
      const turn = (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.6);
      grow(fork, a + turn, len * 0.5, w * 0.55, depth + 1);
    }
  };
  grow(start, heading, length, width, 0);
  return shapes;
}

/**
 * Where a stone struck: a pit knocked out of the masonry with a lit far edge,
 * and cracks splitting outward from it, kept inside the stonework by `clip`
 */
function Damage({
  seed,
  at,
  clip,
}: {
  seed: number;
  at: { x: number; y: number };
  clip: string;
}) {
  const rand = seeded(seed);
  const outline = (scale: number) =>
    `M${Array.from({ length: 11 }, (_, i) => {
      const a = (i / 11) * Math.PI * 2;
      const r = (7 + rand() * 7) * scale;
      return pt(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r * 0.85);
    }).join(" L")} Z`;
  const pit = outline(1);
  const floor = outline(0.55);
  const spin = rand() * Math.PI * 2;
  const cracks = [0, 1, 2, 3].flatMap((k) => {
    const a = spin + k * 1.6 + (rand() - 0.5) * 0.6;
    return crackShapes(
      rand,
      { x: at.x + Math.cos(a) * 8, y: at.y + Math.sin(a) * 7 },
      a,
      22 + rand() * 22,
      4.5 + rand() * 2.5,
    );
  });
  return (
    <g clipPath={`url(#${clip})`}>
      <ellipse cx={at.x} cy={at.y} rx="24" ry="18" className="scorch" />
      {cracks.map((d, i) => (
        <path
          key={`l${i}`}
          d={d}
          className="crack-lip"
          transform="translate(0.8 1)"
        />
      ))}
      {cracks.map((d, i) => (
        <path key={`c${i}`} d={d} className="crack-core" />
      ))}
      <path d={pit} className="pit-lip" transform="translate(1.2 1.5)" />
      <path d={pit} className="pit" />
      <path d={floor} className="pit-floor" />
    </g>
  );
}

const BLOCK_TOPS = ["#a39a8b", "#918878", "#b4ab9b", "#867d6e"];

/** A tumbled block of masonry: its shadow, its side face, and its lit top */
function Block({
  x,
  y,
  w,
  h,
  turn,
  tone,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  turn: number;
  tone: number;
}) {
  return (
    <g transform={`translate(${pt(x, y)}) rotate(${turn.toFixed(0)})`}>
      <rect
        x={-w / 2 + 2}
        y={-h / 2 + 4}
        width={w}
        height={h}
        rx="1.5"
        className="block-shadow"
      />
      <rect
        x={-w / 2}
        y={-h / 2 + 2.5}
        width={w}
        height={h}
        rx="1.5"
        className="block-side"
      />
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx="1.5"
        fill={BLOCK_TOPS[tone % 4]}
        className="block-top"
      />
      <rect
        x={-w / 2 + 1}
        y={-h / 2 + 0.8}
        width={Math.max(0, w - 2)}
        height="1.4"
        className="block-lit"
      />
    </g>
  );
}

/** A heap of fallen masonry spilling out across a square, big blocks in the middle */
function RubbleHeap({ seed, round }: { seed: number; round: boolean }) {
  const rand = seeded(seed + 7);
  const blocks = Array.from({ length: 30 }, (_, i) => {
    const big = i < 11;
    const spread = big ? 24 : round ? 50 : 44;
    const angle = rand() * Math.PI * 2;
    const dist = Math.sqrt(rand()) * spread;
    return {
      x: 50 + Math.cos(angle) * dist * (round ? 1 : 1.3),
      y: 50 + Math.sin(angle) * dist * (round ? 1 : 0.85),
      w: big ? 16 + rand() * 12 : 6 + rand() * 8,
      h: big ? 10 + rand() * 6 : 4 + rand() * 5,
      turn: rand() * 180,
      tone: Math.floor(rand() * 4),
    };
  });
  // Small stones scatter around the edges, under the big blocks
  blocks.reverse();
  return (
    <g className="rubble-heap">
      <ellipse
        cx="50"
        cy="54"
        rx={round ? 60 : 56}
        ry={round ? 56 : 40}
        className="rubble-dust"
      />
      {blocks.map((b, i) => (
        <Block key={i} {...b} />
      ))}
    </g>
  );
}

/** A straight stretch of curtain wall from x=start to x=end */
function SegmentBody({
  start,
  end,
  missing = -1,
}: {
  start: number;
  end: number;
  /** Index of a battlement knocked away */
  missing?: number;
}) {
  const width = end - start;
  const merlons = [];
  for (let x = Math.ceil((start - 4) / 25) * 25 + 4; x + 15 <= end; x += 25) {
    merlons.push(x);
  }
  return (
    <>
      <rect
        x={start}
        y={OUTER}
        width={width}
        height={INNER - OUTER}
        fill="url(#castle-masonry)"
      />
      <rect
        x={start}
        y={WALK_TOP}
        width={width}
        height={WALK_BOTTOM - WALK_TOP}
        fill="url(#castle-walk)"
      />
      <rect
        x={start}
        y={WALK_TOP}
        width={width}
        height="6"
        className="walk-shade"
      />
      <rect
        x={start}
        y={WALK_BOTTOM}
        width={width}
        height={INNER - WALK_BOTTOM}
        className="parapet-inner"
      />
      <rect
        x={start}
        y={WALK_BOTTOM}
        width={width}
        height="2.5"
        className="parapet-lit"
      />
      <rect
        x={start}
        y={WALK_BOTTOM - 3}
        width={width}
        height="3"
        className="walk-shade"
      />
      <rect
        x={start}
        y={OUTER + 4}
        width={width}
        height={WALK_TOP - OUTER - 4}
        className="parapet-base"
      />
      {merlons.map((x, i) =>
        i === missing ? (
          <path
            key={x}
            d={`M${pt(x, WALK_TOP)} L${pt(x, OUTER + 9)} L${pt(x + 4, OUTER + 6)} L${pt(x + 7, OUTER + 10)} L${pt(x + 11, OUTER + 5)} L${pt(x + 15, OUTER + 8)} L${pt(x + 15, WALK_TOP)} Z`}
            className="merlon"
          />
        ) : (
          <g key={x}>
            <rect
              x={x + 1}
              y={WALK_TOP}
              width="15"
              height="5"
              className="merlon-cast"
            />
            <rect
              x={x}
              y={OUTER}
              width="15"
              height={WALK_TOP - OUTER}
              rx="1.5"
              className="merlon"
            />
            <rect
              x={x + 1.5}
              y={OUTER + 1.5}
              width="12"
              height="3"
              className="merlon-lit"
            />
          </g>
        ),
      )}
      <line x1={start} x2={end} y1={OUTER} y2={OUTER} className="wall-face" />
      <line x1={start} x2={end} y1={INNER} y2={INNER} className="wall-face" />
    </>
  );
}

/** A round tower: a battlemented rim around a conical slate roof flying the defender's flag */
function TowerBody({ missing, flag }: { missing: number; flag: string }) {
  const count = 14;
  const step = (Math.PI * 2) / count;
  const rimInner = TOWER_R - TOWER_RIM;
  return (
    <>
      <circle cx="50" cy="50" r={TOWER_R} fill="url(#castle-masonry)" />
      <circle cx="50" cy="50" r={rimInner} fill="url(#castle-walk)" />
      <circle cx="50" cy="50" r={rimInner - 2} className="tower-rim-shade" />
      {Array.from({ length: count }, (_, i) =>
        i === missing ? null : (
          <path
            key={i}
            d={sector(rimInner, TOWER_R, i * step + 0.05, (i + 0.6) * step)}
            className="merlon"
          />
        ),
      )}
      <circle cx="50" cy="50" r={TOWER_R} className="wall-face-ring" />
      <circle cx="54" cy="57" r={ROOF_R} className="roof-cast" />
      <circle cx="50" cy="50" r={ROOF_R} fill="url(#castle-roof)" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <line
            key={i}
            x1="50"
            y1="50"
            x2={50 + Math.cos(a) * ROOF_R}
            y2={50 + Math.sin(a) * ROOF_R}
            className="roof-seam"
          />
        );
      })}
      <circle cx="50" cy="50" r={ROOF_R} className="roof-edge" />
      <g className="flag">
        <path
          d="M50 43 Q59 39 68 43 T88 43 L82 51 L88 59 Q78 55 68 59 T50 57 Z"
          fill={flag}
        />
        <path
          d="M50 43 Q59 39 68 43 T88 43 L87 45 L50 46 Z"
          className="flag-lit"
        />
      </g>
      <circle cx="50" cy="50" r="3.5" className="roof-finial" />
    </>
  );
}

/** A small round turret flanking a gate */
function Turret({ cx }: { cx: number }) {
  const rimInner = TURRET_R - 9;
  return (
    <g transform={`translate(${cx - 50} 0)`}>
      <circle cx="50" cy="50" r={TURRET_R} fill="url(#castle-masonry)" />
      <circle cx="50" cy="50" r={rimInner} fill="url(#castle-walk)" />
      <circle cx="50" cy="50" r={rimInner - 1.5} className="tower-rim-shade" />
      {Array.from({ length: 8 }, (_, i) => (
        <path
          key={i}
          d={sector(
            rimInner,
            TURRET_R,
            (i * Math.PI) / 4 + 0.08,
            ((i + 0.58) * Math.PI) / 4,
          )}
          className="merlon"
        />
      ))}
      <circle cx="50" cy="50" r={TURRET_R} className="wall-face-ring" />
    </g>
  );
}

/** Positions a piece of the castle on its square, turned to face out, rising with the others */
function Placed({
  col,
  row,
  angle,
  delay,
  className = "",
  children,
}: {
  col: number;
  row: number;
  angle: number;
  delay: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <g
      transform={`translate(${col * 100} ${row * 100}) rotate(${angle} 50 50)`}
    >
      <g
        className={`wall-rise ${className}`}
        style={{ animationDelay: `${delay}ms` }}
      >
        {children}
      </g>
    </g>
  );
}

/**
 * The castle seen from above: curtain walls with battlements on the outer
 * face, round towers at the corners, gatehouses, and ruins where walls fell.
 */
export function Castle({
  walls,
  rubble,
  hpOf,
  flipped,
  defender,
  riseDelay,
}: {
  /** Wall squares still standing */
  walls: SquareIndex[];
  rubble: SquareIndex[];
  hpOf: (sq: SquareIndex) => number;
  flipped: boolean;
  defender: Color;
  riseDelay: (sq: SquareIndex) => number;
}) {
  const at = (sq: SquareIndex) => ({
    col: visualCol(sq, flipped),
    row: visualRow(sq, flipped),
  });
  const towerStanding = new Set(
    walls
      .filter((sq) => TOWERS.includes(sq))
      .map((sq) => {
        const { col, row } = at(sq);
        return `${col},${row}`;
      }),
  );
  const towerFallen = new Set(
    rubble
      .filter((sq) => TOWERS.includes(sq))
      .map((sq) => {
        const { col, row } = at(sq);
        return `${col},${row}`;
      }),
  );
  /**
   * A segment runs on into a standing tower's center, so it disappears under
   * it, and breaks off raggedly where a tower beside it has fallen
   */
  const reach = (col: number, row: number, angle: number) => {
    const [dc, dr] = along(angle);
    const next = (sign: number) => `${col + dc * sign},${row + dr * sign}`;
    return {
      start: towerStanding.has(next(-1)) ? -50 : 0,
      end: towerStanding.has(next(1)) ? 150 : 100,
      brokenStart: towerFallen.has(next(-1)),
      brokenEnd: towerFallen.has(next(1)),
    };
  };

  const straight = walls.filter((sq) => !TOWERS.includes(sq));
  const towers = walls.filter((sq) => TOWERS.includes(sq));
  const gates = GATES.map((sq) => ({ sq, ...at(sq) }));

  return (
    <g className="castle">
      <defs>
        <pattern
          id="castle-masonry"
          width="24"
          height="12"
          patternUnits="userSpaceOnUse"
        >
          <rect width="24" height="12" fill="#5f574c" />
          <rect
            x="0.8"
            y="0.8"
            width="10.4"
            height="4.6"
            rx="0.8"
            fill="#9a9182"
          />
          <rect
            x="12.8"
            y="0.8"
            width="10.4"
            height="4.6"
            rx="0.8"
            fill="#8c8374"
          />
          <rect
            x="-5.2"
            y="6.8"
            width="10.4"
            height="4.6"
            rx="0.8"
            fill="#938a7b"
          />
          <rect
            x="6.8"
            y="6.8"
            width="10.4"
            height="4.6"
            rx="0.8"
            fill="#a49b8c"
          />
          <rect
            x="18.8"
            y="6.8"
            width="10.4"
            height="4.6"
            rx="0.8"
            fill="#887f70"
          />
        </pattern>
        <pattern
          id="castle-walk"
          width="14"
          height="14"
          patternUnits="userSpaceOnUse"
        >
          <rect width="14" height="14" fill="#655d50" />
          <rect
            x="0.8"
            y="0.8"
            width="12.4"
            height="12.4"
            rx="1"
            fill="#7a7263"
          />
        </pattern>
        <radialGradient id="castle-roof" cx="0.36" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#8a94a3" />
          <stop offset="0.55" stopColor="#4a5260" />
          <stop offset="1" stopColor="#23272f" />
        </radialGradient>
        <clipPath id="castle-band">
          <rect x="-50" y={OUTER} width="200" height={INNER - OUTER} />
        </clipPath>
        <clipPath id="castle-tower-clip">
          <circle cx="50" cy="50" r={TOWER_R} />
        </clipPath>
        <filter id="castle-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* All shadows go down first, so none falls across a wall */}
      <g className="castle-shadows" filter="url(#castle-blur)">
        {straight.map((sq) => {
          const { col, row } = at(sq);
          const angle = facing(col, row);
          const { start, end } = reach(col, row, angle);
          const off = toLocal(SHADOW, angle);
          return (
            <Placed
              key={sq}
              col={col}
              row={row}
              angle={angle}
              delay={riseDelay(sq)}
            >
              <rect
                x={start + off.x}
                y={OUTER + off.y}
                width={end - start}
                height={INNER - OUTER}
              />
            </Placed>
          );
        })}
        {towers.map((sq) => {
          const { col, row } = at(sq);
          return (
            <Placed
              key={sq}
              col={col}
              row={row}
              angle={0}
              delay={riseDelay(sq)}
            >
              <circle cx={50 + SHADOW.x} cy={50 + SHADOW.y} r={TOWER_R} />
            </Placed>
          );
        })}
        {gates.map(({ sq, col, row }) => (
          <Placed key={sq} col={col} row={row} angle={0} delay={riseDelay(sq)}>
            {(row === 1 || row === 6
              ? [
                  [0, 50],
                  [100, 50],
                ]
              : [
                  [50, 0],
                  [50, 100],
                ]
            ).map(([x, y]) => (
              <circle
                key={`${x}${y}`}
                cx={x + SHADOW.x}
                cy={y + SHADOW.y}
                r={TURRET_R}
              />
            ))}
          </Placed>
        ))}
      </g>

      {rubble.map((sq) => {
        const { col, row } = at(sq);
        const tower = TOWERS.includes(sq);
        const angle = tower ? 0 : facing(col, row);
        const rand = seeded(sq);
        const { start, end } = tower
          ? { start: 0, end: 100 }
          : reach(col, row, angle);
        const jag = (x: number, dir: number) =>
          Array.from({ length: 7 }, (_, i) =>
            pt(
              x + dir * rand() * 12,
              OUTER - 2 + (i / 6) * (INNER - OUTER + 4),
            ),
          ).join(" L");
        const off = toLocal(SHADOW, angle);
        const stubs = [
          { from: start, to: 30, edge: jag(12, 1), dir: 1 },
          { from: 70, to: end, edge: jag(88, -1), dir: -1 },
        ].map((stub) => {
          const base = stub.dir > 0 ? start : end;
          return {
            ...stub,
            outline: `M${base} ${OUTER - 2} L${stub.edge} L${base} ${INNER + 2} Z`,
          };
        });
        const ruin = [
          [2.3, 3.7],
          [5.1, 5.9],
          [0.6, 1.0],
        ]
          .map(([a0, a1]) => sector(TOWER_R - TOWER_RIM, TOWER_R, a0, a1))
          .join(" ");
        return (
          <g
            key={`r${sq}`}
            transform={`translate(${col * 100} ${row * 100}) rotate(${angle} 50 50)`}
          >
            <RubbleHeap seed={sq} round={tower} />
            {/* What still stands throws a shadow down onto the heap below it */}
            <g className="ruin-cast" filter="url(#castle-blur)">
              {tower ? (
                <path
                  d={ruin}
                  transform={`translate(${SHADOW.x * 1.4} ${SHADOW.y * 1.4})`}
                />
              ) : (
                stubs.map((stub) => (
                  <path
                    key={stub.dir}
                    d={stub.outline}
                    transform={`translate(${stub.dir * 10 + off.x} ${off.y})`}
                  />
                ))
              )}
            </g>
            {tower ? (
              <path d={ruin} fill="url(#castle-masonry)" className="ruin-arc" />
            ) : (
              stubs.map((stub) => (
                <g key={stub.dir}>
                  <clipPath id={`stub-${stub.dir}-${sq}`}>
                    <path d={stub.outline} />
                  </clipPath>
                  <g clipPath={`url(#stub-${stub.dir}-${sq})`}>
                    <SegmentBody start={stub.from} end={stub.to} />
                  </g>
                  <path d={`M${stub.edge}`} className="break-edge" />
                </g>
              ))
            )}
          </g>
        );
      })}

      {straight.map((sq) => {
        const { col, row } = at(sq);
        const angle = facing(col, row);
        const { start, end, brokenStart, brokenEnd } = reach(col, row, angle);
        const cracked = hpOf(sq) === 1;
        const rand = seeded(sq);
        const breakRand = seeded(sq + 11);
        const ragged = (x: number, dir: number) =>
          Array.from({ length: 7 }, (_, i) =>
            pt(
              x + dir * breakRand() * 12,
              OUTER - 2 + (i / 6) * (INNER - OUTER + 4),
            ),
          );
        const startEdge = brokenStart ? ragged(-8, 1) : null;
        const endEdge = brokenEnd ? ragged(108, -1) : null;
        const outline = `M${(endEdge ?? [pt(end, OUTER - 2), pt(end, INNER + 2)]).join(" L")} L${[...(startEdge ?? [pt(start, OUTER - 2), pt(start, INNER + 2)])].reverse().join(" L")} Z`;
        const off = toLocal(SHADOW, angle);
        const breaks = [
          { edge: startEdge, back: 30, dir: -1 },
          { edge: endEdge, back: 70, dir: 1 },
        ].filter((b) => b.edge !== null);
        const body = (
          <SegmentBody
            start={brokenStart ? -8 : start}
            end={brokenEnd ? 108 : end}
            missing={cracked ? 1 + (sq % 2) : -1}
          />
        );
        return (
          <Placed
            key={sq}
            col={col}
            row={row}
            angle={angle}
            delay={riseDelay(sq)}
            className={cracked ? "cracked" : ""}
          >
            {breaks.length > 0 ? (
              <>
                <g className="ruin-cast" filter="url(#castle-blur)">
                  {breaks.map(({ edge, back, dir }) => (
                    <path
                      key={dir}
                      d={`M${back} ${OUTER - 2} L${edge!.join(" L")} L${back} ${INNER + 2} Z`}
                      transform={`translate(${dir * 10 + off.x} ${off.y})`}
                    />
                  ))}
                </g>
                <clipPath id={`broken-${sq}`}>
                  <path d={outline} />
                </clipPath>
                <g clipPath={`url(#broken-${sq})`}>{body}</g>
                {breaks.map(({ edge, dir }) => (
                  <path
                    key={dir}
                    d={`M${edge!.join(" L")}`}
                    className="break-edge"
                  />
                ))}
              </>
            ) : (
              body
            )}
            {cracked && (
              <>
                <Damage
                  seed={sq}
                  at={{
                    x: 30 + rand() * 40,
                    y: OUTER + 14 + rand() * (INNER - OUTER - 28),
                  }}
                  clip="castle-band"
                />
                <Block
                  x={30 + (sq % 40)}
                  y={WALK_TOP + 10}
                  w={8}
                  h={5}
                  turn={sq * 37}
                  tone={sq}
                />
                <Block
                  x={42 + (sq % 30)}
                  y={WALK_TOP + 20}
                  w={5}
                  h={3.5}
                  turn={sq * 53}
                  tone={sq + 1}
                />
              </>
            )}
          </Placed>
        );
      })}

      {gates.map(({ sq, col, row }) => (
        <Placed
          key={sq}
          col={col}
          row={row}
          angle={facing(col, row)}
          delay={riseDelay(sq)}
        >
          <rect x="18" y="-6" width="64" height="112" className="drawbridge" />
          {Array.from({ length: 11 }, (_, i) => (
            <line
              key={i}
              x1="18"
              x2="82"
              y1={4 + i * 9.5}
              y2={4 + i * 9.5}
              className="plank-seam"
            />
          ))}
          <rect x="18" y="26" width="64" height="4" className="iron-band" />
          <rect x="18" y="74" width="64" height="4" className="iron-band" />
          <rect x="18" y={OUTER} width="64" height="7" className="portcullis" />
          {[26, 38, 50, 62, 74].map((x) => (
            <line
              key={x}
              x1={x}
              x2={x}
              y1={OUTER - 4}
              y2={OUTER + 7}
              className="portcullis-bar"
            />
          ))}
          <Turret cx={0} />
          <Turret cx={100} />
        </Placed>
      ))}

      {towers.map((sq) => {
        const { col, row } = at(sq);
        const cracked = hpOf(sq) === 1;
        const rand = seeded(sq + 3);
        const hit = rand() * Math.PI * 2;
        return (
          <Placed
            key={sq}
            col={col}
            row={row}
            angle={0}
            delay={riseDelay(sq)}
            className={cracked ? "cracked" : ""}
          >
            <TowerBody
              missing={cracked ? sq % 14 : -1}
              flag={flagColor(defender)}
            />
            {cracked && (
              <Damage
                seed={sq}
                at={{
                  x: 50 + Math.cos(hit) * (TOWER_R - 9),
                  y: 50 + Math.sin(hit) * (TOWER_R - 9),
                }}
                clip="castle-tower-clip"
              />
            )}
          </Placed>
        );
      })}
    </g>
  );
}
