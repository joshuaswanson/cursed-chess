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

/** Molten seam between the doomed ring and safe ground, then the rim of the abyss */
export function Fissure({
  ring,
  progress,
  collapsed,
}: {
  ring: number;
  progress: number;
  collapsed: boolean;
}) {
  return (
    <div
      className={`br-fissure${collapsed ? " br-rim" : ""}`}
      style={
        {
          inset: `${ring * 12.5}%`,
          "--heat": collapsed ? 1 : progress,
        } as React.CSSProperties
      }
    />
  );
}

/** Outer tiles break loose in a wave and tumble into the abyss, taking their pieces */
export function CollapsingRing({
  collapse,
  flipped,
}: {
  collapse: RingCollapse;
  flipped: boolean;
}) {
  const rand = seededRandom(collapse.id * 101);
  const waveStart = rand() * Math.PI * 2;
  const fallenOn = new Map(collapse.fallen.map((f) => [f.sq, f.piece]));

  return (
    <div className="br-collapse" key={collapse.id}>
      {collapse.squares.map((sq) => {
        const col = visualCol(sq, flipped);
        const row = visualRow(sq, flipped);
        const dx = col - 3.5;
        const dy = row - 3.5;
        const angle =
          (Math.atan2(dy, dx) - waveStart + Math.PI * 4) % (Math.PI * 2);
        const delay = (angle / (Math.PI * 2)) * WAVE_SPREAD_MS;

        // Each tile hinges on its inner edge and its outer edge drops away
        const horizontal =
          Math.abs(dx) > Math.abs(dy) ||
          (Math.abs(dx) === Math.abs(dy) && rand() < 0.5);
        const hinge = horizontal
          ? dx > 0
            ? "left center"
            : "right center"
          : dy > 0
            ? "center top"
            : "center bottom";
        const tiltX = horizontal ? 0 : dy > 0 ? -75 : 75;
        const tiltY = horizontal ? (dx > 0 ? 75 : -75) : 0;
        const spin = (rand() - 0.5) * 50;
        const piece = fallenOn.get(sq);
        const isLight = (fileOf(sq) + rankOf(sq)) % 2 !== 0;

        return (
          <div
            key={sq}
            className="br-fall-slot"
            style={{
              left: `${col * 12.5}%`,
              top: `${row * 12.5}%`,
            }}
          >
            <div
              className={`br-fall-tile ${isLight ? "light" : "dark"}`}
              style={
                {
                  transformOrigin: hinge,
                  animationDelay: `${delay}ms`,
                  "--tilt-x": `${tiltX}deg`,
                  "--tilt-y": `${tiltY}deg`,
                  "--spin": `${spin}deg`,
                } as React.CSSProperties
              }
            >
              <DoomedTile sq={sq} progress={1} />
              {piece && (
                <img
                  src={pieceImage(piece)}
                  className="br-fall-piece"
                  draggable={false}
                  alt=""
                />
              )}
            </div>
            <div className="br-dust" style={{ animationDelay: `${delay}ms` }}>
              {Array.from({ length: DUST_SPECKS }, (_, i) => (
                <i
                  key={i}
                  style={
                    {
                      "--a": `${(i * 360) / DUST_SPECKS + rand() * 30}deg`,
                      "--d": `${20 + rand() * 30}px`,
                      animationDelay: `${delay + rand() * 80}ms`,
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
