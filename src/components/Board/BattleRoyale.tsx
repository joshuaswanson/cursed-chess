import type { SquareIndex } from "../../engine";
import type { RingCollapse } from "../../plugins/battleRoyale";
import { pieceImage } from "../../utils/pieceImages";
import { fileOf, rankOf } from "../../utils/squareUtils";
import { visualCol, visualRow } from "./boardGeometry";

const WAVE_SPREAD_MS = 650;
const DUST_SPECKS = 7;

function seededRandom(seed: number): () => number {
  let state = seed * 7919 + 13;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** Jagged cracks across a tile in a 0-100 box, the same every time for a square */
function crackPaths(sq: SquareIndex): string[] {
  const rand = seededRandom(sq + 1);
  const edgePoint = (): [number, number] => {
    const t = 10 + rand() * 80;
    switch (Math.floor(rand() * 4)) {
      case 0:
        return [t, 0];
      case 1:
        return [100, t];
      case 2:
        return [t, 100];
      default:
        return [0, t];
    }
  };
  const jagged = (
    from: [number, number],
    to: [number, number],
    steps: number,
  ) => {
    const points = [from];
    for (let i = 1; i < steps; i++) {
      const f = i / steps;
      points.push([
        from[0] + (to[0] - from[0]) * f + (rand() - 0.5) * 18,
        from[1] + (to[1] - from[1]) * f + (rand() - 0.5) * 18,
      ]);
    }
    points.push(to);
    return points;
  };
  const toPath = (points: [number, number][]) =>
    "M" + points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L");

  const paths: string[] = [];
  for (let i = 0; i < 2; i++) {
    const main = jagged(edgePoint(), edgePoint(), 6);
    paths.push(toPath(main));
    const fork = main[2 + Math.floor(rand() * 3)];
    paths.push(toPath(jagged(fork, [rand() * 100, rand() * 100], 3)));
  }
  return paths;
}

const crackCache = new Map<SquareIndex, string[]>();
function cracksFor(sq: SquareIndex): string[] {
  let paths = crackCache.get(sq);
  if (!paths) {
    paths = crackPaths(sq);
    crackCache.set(sq, paths);
  }
  return paths;
}

function Cracks({ sq }: { sq: SquareIndex }) {
  const paths = cracksFor(sq);
  return (
    <svg className="br-cracks" viewBox="0 0 100 100" preserveAspectRatio="none">
      {(["glow", "", "core"] as const).map((layer) =>
        paths.map((d, i) => (
          <path
            key={`${layer}${i}`}
            d={d}
            className={layer ? `br-crack br-crack-${layer}` : "br-crack"}
          />
        )),
      )}
    </svg>
  );
}

/** A doomed tile: cracks spread and glow hotter as the collapse approaches */
export function DoomedTile({
  sq,
  progress,
}: {
  sq: SquareIndex;
  progress: number;
}) {
  return (
    <div
      className="br-doomed"
      style={
        {
          "--reveal": 0.25 + progress * 0.75,
          "--heat": progress,
        } as React.CSSProperties
      }
    >
      <div className="br-scorch" />
      <Cracks sq={sq} />
    </div>
  );
}

/** Molten seam between the doomed ring and safe ground, glowing hotter as the collapse nears */
export function Fissure({
  ring,
  progress,
}: {
  ring: number;
  progress: number;
}) {
  return (
    <div
      className="br-fissure"
      style={
        {
          inset: `${ring * 12.5}%`,
          "--heat": progress,
        } as React.CSSProperties
      }
    />
  );
}

/** A jagged run of points along one side of the break, pushed outward by `reach` */
function jaggedSide(
  rand: () => number,
  from: [number, number],
  to: [number, number],
  outward: [number, number],
  reach: number,
): [number, number][] {
  const points: [number, number][] = [];
  const steps = Math.round(Math.hypot(to[0] - from[0], to[1] - from[1]) / 11);
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const bite = rand() < 0.12 ? 1.7 : 1;
    const push = (2 + rand() * reach) * bite;
    points.push([
      from[0] + (to[0] - from[0]) * t + outward[0] * push,
      from[1] + (to[1] - from[1]) * t + outward[1] * push,
    ]);
  }
  return points;
}

const pathOf = (points: [number, number][]) =>
  "M" +
  points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L") +
  " Z";

/**
 * What is left after the ring falls: a slab with a jagged broken lip, its
 * cliff face showing below, and lava glowing along the break.
 */
export function BrokenRim({ ring }: { ring: number }) {
  const rand = seededRandom(ring * 31 + 7);
  const a = ring * 100;
  const b = 800 - ring * 100;
  const lip = [
    ...jaggedSide(rand, [a, a], [b, a], [0, -1], 18),
    ...jaggedSide(rand, [b, a], [b, b], [1, 0], 18),
    ...jaggedSide(rand, [b, b], [a, b], [0, 1], 18),
    ...jaggedSide(rand, [a, b], [a, a], [-1, 0], 18),
  ];
  // The break eats a few pixels into the edge squares, so the edge is never straight
  const bitten = [
    ...jaggedSide(rand, [a, a], [a, b], [1, 0], 4),
    ...jaggedSide(rand, [a, b], [b, b], [0, -1], 4),
    ...jaggedSide(rand, [b, b], [b, a], [-1, 0], 4),
    ...jaggedSide(rand, [b, a], [a, a], [0, 1], 4),
  ];
  // The slab's thickness, seen below and to the right of the break
  const cliffBottom = [
    ...jaggedSide(rand, [a - 10, b + 22], [b + 22, b + 22], [0, 1], 20),
    [b + 22, b] as [number, number],
    [a - 10, b] as [number, number],
  ];
  const cliffRight = [
    ...jaggedSide(rand, [b + 16, a + 8], [b + 16, b + 30], [1, 0], 12),
    [b, b] as [number, number],
    [b, a] as [number, number],
  ];
  const cracks = Array.from({ length: 10 }, (_, i) => {
    const side = i % 4;
    const t = a + 40 + rand() * (b - a - 80);
    const depth = 25 + rand() * 45;
    const start: [number, number] =
      side === 0 ? [t, a] : side === 1 ? [b, t] : side === 2 ? [t, b] : [a, t];
    const dir: [number, number] =
      side === 0
        ? [0, 1]
        : side === 1
          ? [-1, 0]
          : side === 2
            ? [0, -1]
            : [1, 0];
    const points: [number, number][] = [start];
    for (let k = 1; k <= 4; k++) {
      const f = (k / 4) * depth;
      points.push([
        start[0] + dir[0] * f + dir[1] * (rand() - 0.5) * 14,
        start[1] + dir[1] * f + dir[0] * (rand() - 0.5) * 14,
      ]);
    }
    return (
      "M" + points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")
    );
  });

  return (
    <svg className="br-rim" viewBox="0 0 800 800" aria-hidden>
      <defs>
        <linearGradient id="br-cliff" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a2414" />
          <stop offset="0.4" stopColor="#2a0d07" />
          <stop offset="1" stopColor="#0d0302" />
        </linearGradient>
        <linearGradient id="br-lip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6e3a28" />
          <stop offset="0.5" stopColor="#3a1810" />
          <stop offset="1" stopColor="#1a0805" />
        </linearGradient>
        <filter id="br-glow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <path d={pathOf(cliffRight)} fill="url(#br-cliff)" />
      <path d={pathOf(cliffBottom)} fill="url(#br-cliff)" />
      <path
        d={pathOf(lip) + " " + pathOf(bitten)}
        fill="url(#br-lip)"
        fillRule="evenodd"
      />
      <g className="br-seam">
        <path d={pathOf(lip)} className="br-seam-glow" filter="url(#br-glow)" />
        <path d={pathOf(lip)} className="br-seam-core" />
        {cracks.map((d, i) => (
          <g key={i}>
            <path
              d={d}
              className="br-seam-glow br-crack-glow-line"
              filter="url(#br-glow)"
            />
            <path d={d} className="br-crack-line" />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Rock chips thrown out where a tile tears loose */
function Chips({ rand, delay }: { rand: () => number; delay: number }) {
  return (
    <div className="br-chips">
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (i / 6) * Math.PI * 2 + rand();
        const reach = 18 + rand() * 30;
        return (
          <i
            key={i}
            style={
              {
                "--cx": `${Math.cos(angle) * reach}px`,
                "--cy": `${Math.sin(angle) * reach - 10}px`,
                "--cr": `${(rand() - 0.5) * 540}deg`,
                "--size": `${3 + rand() * 5}px`,
                animationDelay: `${delay + rand() * 60}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/** How far down and outward a piece of the board drops as it falls away */
function fallVector(rand: () => number, dx: number, dy: number) {
  const out = Math.hypot(dx, dy) || 1;
  return {
    "--fall-x": `${(dx / out) * (20 + rand() * 30)}px`,
    "--fall-y": `${120 + rand() * 90}px`,
    "--fall-rot": `${(rand() - 0.5) * 140}deg`,
  };
}

/** Strips of the board's frame, broken into chunks that fall with the ring */
function FrameChunks({
  rand,
  waveDelay,
}: {
  rand: () => number;
  waveDelay: (dx: number, dy: number) => number;
}) {
  const chunks: { style: React.CSSProperties; dx: number; dy: number }[] = [];
  const pad = "(var(--square-size) * 0.26 + 4px)";
  for (let i = 0; i < 8; i++) {
    const along = `${i * 12.5}%`;
    const first = i === 0;
    const last = i === 7;
    const span = `calc(12.5% + ${first ? pad : "0px"} + ${last ? pad : "0px"})`;
    const start = first ? `calc(-1 * ${pad})` : along;
    chunks.push(
      {
        style: {
          left: start,
          width: span,
          top: `calc(-1 * ${pad})`,
          height: `calc${pad}`,
        },
        dx: i - 3.5,
        dy: -4.5,
      },
      {
        style: {
          left: start,
          width: span,
          bottom: `calc(-1 * ${pad})`,
          height: `calc${pad}`,
        },
        dx: i - 3.5,
        dy: 4.5,
      },
      {
        style: {
          top: along,
          height: "12.5%",
          left: `calc(-1 * ${pad})`,
          width: `calc${pad}`,
        },
        dx: -4.5,
        dy: i - 3.5,
      },
      {
        style: {
          top: along,
          height: "12.5%",
          right: `calc(-1 * ${pad})`,
          width: `calc${pad}`,
        },
        dx: 4.5,
        dy: i - 3.5,
      },
    );
  }
  return (
    <>
      {chunks.map(({ style, dx, dy }, i) => (
        <div
          key={i}
          className="br-frame-chunk"
          style={
            {
              ...style,
              ...fallVector(rand, dx, dy),
              animationDelay: `${waveDelay(dx, dy)}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

/** The ring tears loose in a wave: tiles, the frame, and any pieces on them fall into the abyss */
export function CollapsingRing({
  collapse,
  flipped,
}: {
  collapse: RingCollapse;
  flipped: boolean;
}) {
  const rand = seededRandom(collapse.id * 101);
  const waveStart = rand() * Math.PI * 2;
  const waveDelay = (dx: number, dy: number) =>
    (((Math.atan2(dy, dx) - waveStart + Math.PI * 4) % (Math.PI * 2)) /
      (Math.PI * 2)) *
      WAVE_SPREAD_MS +
    rand() * 90;
  const fallenOn = new Map(collapse.fallen.map((f) => [f.sq, f.piece]));

  return (
    <div className="br-collapse" key={collapse.id}>
      <FrameChunks rand={rand} waveDelay={waveDelay} />
      {collapse.squares.map((sq) => {
        const col = visualCol(sq, flipped);
        const row = visualRow(sq, flipped);
        const dx = col - 3.5;
        const dy = row - 3.5;
        const delay = waveDelay(dx, dy);
        const piece = fallenOn.get(sq);
        const isLight = (fileOf(sq) + rankOf(sq)) % 2 !== 0;
        const fall = fallVector(rand, dx, dy);

        return (
          <div
            key={sq}
            className="br-fall-slot"
            style={{ left: `${col * 12.5}%`, top: `${row * 12.5}%` }}
          >
            <div
              className={`br-fall-tile ${isLight ? "light" : "dark"}`}
              style={
                { ...fall, animationDelay: `${delay}ms` } as React.CSSProperties
              }
            >
              <DoomedTile sq={sq} progress={1} />
            </div>
            {piece && (
              <img
                src={pieceImage(piece)}
                className="br-fall-piece"
                style={
                  {
                    ...fall,
                    "--piece-rot": `${(rand() - 0.5) * 720}deg`,
                    animationDelay: `${delay + 90}ms`,
                  } as React.CSSProperties
                }
                draggable={false}
                alt=""
              />
            )}
            <Chips rand={rand} delay={delay + 60} />
            <div className="br-dust" style={{ animationDelay: `${delay}ms` }}>
              {Array.from({ length: DUST_SPECKS }, (_, i) => (
                <i
                  key={i}
                  style={
                    {
                      "--a": `${(i * 360) / DUST_SPECKS + rand() * 30}deg`,
                      "--d": `${20 + rand() * 30}px`,
                      animationDelay: `${delay + 60 + rand() * 80}ms`,
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
