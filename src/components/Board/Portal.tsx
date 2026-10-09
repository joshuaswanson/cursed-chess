import { useId } from "react";
import { BakedArt } from "./BakedArt";
import type { PortalColor } from "../../plugins/portalChess";

export type PortalState = "idle" | "spawn" | "despawn" | "surge";

const ARM_COUNT = 6;
const DISC_RADIUS = 33;
const PARTICLE_COUNT = 9;

/** Archimedean spiral arm from the core to the rim, as an SVG path */
function spiralArm(startAngle: number): string {
  const points: string[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = 3 + (DISC_RADIUS - 2) * t;
    const theta = startAngle + t * 5.2;
    points.push(
      `${(r * Math.cos(theta)).toFixed(2)},${(r * Math.sin(theta)).toFixed(2)}`,
    );
  }
  return `M${points.join(" L")}`;
}

const ARMS = Array.from({ length: ARM_COUNT }, (_, i) =>
  spiralArm((i / ARM_COUNT) * Math.PI * 2),
);

/** Deterministic pseudo-random sequence so bolt shapes are stable across renders */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function polar(r: number, theta: number): string {
  return `${(r * Math.cos(theta)).toFixed(2)},${(r * Math.sin(theta)).toFixed(2)}`;
}

/** Jagged lightning bolt leaping outward from the rim, sometimes forked */
function outwardBolt(angle: number, rand: () => number): string {
  const reach = 14 + rand() * 12;
  const segments = 5;
  const points: string[] = [];
  let theta = angle;
  for (let i = 0; i <= segments; i++) {
    const r = DISC_RADIUS - 2 + (reach * i) / segments;
    theta += (rand() - 0.5) * 0.35;
    points.push(polar(r, theta));
  }
  let d = `M${points.join(" L")}`;
  if (rand() < 0.6) {
    const forkAt = DISC_RADIUS + reach * 0.4;
    let forkTheta = angle + (rand() - 0.5) * 0.3;
    const fork = [polar(forkAt, forkTheta)];
    for (let i = 1; i <= 3; i++) {
      forkTheta += (rand() < 0.5 ? -1 : 1) * 0.12;
      fork.push(polar(forkAt + i * 3.5, forkTheta));
    }
    d += ` M${fork.join(" L")}`;
  }
  return d;
}

/** Jagged arc of plasma crawling along the rim */
function rimArc(angle: number, rand: () => number): string {
  const span = 0.9 + rand() * 0.8;
  const steps = 9;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const r = DISC_RADIUS + (rand() - 0.5) * 7;
    points.push(polar(r, angle + (span * i) / steps));
  }
  return `M${points.join(" L")}`;
}

const boltRand = seededRandom(7);
const BOLTS = Array.from({ length: 8 }, (_, i) => ({
  d:
    i % 3 === 2
      ? rimArc((i / 8) * Math.PI * 2, boltRand)
      : outwardBolt((i / 8) * Math.PI * 2 + boltRand() * 0.5, boltRand),
  duration: 0.55 + boltRand() * 0.9,
  delay: -boltRand() * 1.5,
}));

const EMBERS = Array.from({ length: 6 }, (_, i) => ({
  angle: i * 60 + 17,
  delay: -(i * 0.53) % 2.4,
  duration: 1.1 + (i % 3) * 0.4,
}));

const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  angle: (i * 360) / PARTICLE_COUNT,
  delay: -(i * 0.37) % 1.9,
  duration: 1.5 + (i % 3) * 0.35,
  radius: 1.3 + (i % 2) * 0.6,
}));

const VIEW_BOX = "-60 -60 120 120";

/**
 * A swirling portal. Each part is its own layer whose filters are drawn once,
 * and the motion only turns, scales, and fades those layers, so the browser
 * never has to redraw the noise and blur filters while the portal animates.
 */
export function Portal({
  color,
  state = "idle",
  charge = 0,
  chargeMs = 250,
}: {
  color: PortalColor;
  state?: PortalState;
  /** 0 is resting, 1 is fully charged by a nearby piece */
  charge?: number;
  /** How long the portal takes to grow or shrink to the new charge */
  chargeMs?: number;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ref = (name: string) => `url(#${name}-${id})`;
  const plasma = (name: string, seed: number) => (
    <filter id={`${name}-${id}`} x="-40%" y="-40%" width="180%" height="180%">
      <feTurbulence
        type="turbulence"
        baseFrequency="0.05"
        numOctaves="3"
        seed={seed}
      />
      <feDisplacementMap in="SourceGraphic" scale="10" />
      <feGaussianBlur stdDeviation="1.2" />
    </filter>
  );
  const wobble = (
    <filter id={`wobble-${id}`} x="-30%" y="-30%" width="160%" height="160%">
      <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" />
      <feDisplacementMap in="SourceGraphic" scale="7" />
    </filter>
  );
  const blur = (
    <filter id={`blur-${id}`} x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="2.4" />
    </filter>
  );

  return (
    <div
      className={`portal-overlay portal-${color} portal-${state}${charge > 0.5 ? " portal-charged" : ""}`}
      data-charged={charge > 0 || undefined}
      style={
        {
          "--charge": charge,
          "--charge-ms": `${chargeMs}ms`,
        } as React.CSSProperties
      }
    >
      {state === "spawn" && (
        <>
          <span className="portal-rift" aria-hidden />
          <span className="portal-shock" aria-hidden />
        </>
      )}
      <div className="portal-svg" aria-hidden>
        <div className="portal-light" />

        <div className="portal-corona">
          <div className="portal-layer portal-flame-spin">
            <BakedArt name={`portal:${color}:flame`} viewBox={VIEW_BOX} pixels>
              <defs>{plasma("flame", 1)}</defs>
              <g filter={ref("flame")}>
                <circle r={DISC_RADIUS + 4} className="portal-flame" />
              </g>
            </BakedArt>
          </div>
          <div className="portal-layer portal-flame-spin portal-flame-spin-outer">
            <BakedArt name={`portal:${color}:flare`} viewBox={VIEW_BOX} pixels>
              <defs>{plasma("flare", 2)}</defs>
              <g filter={ref("flare")}>
                <circle
                  r={DISC_RADIUS + 7}
                  className="portal-flame portal-flame-outer"
                />
              </g>
            </BakedArt>
          </div>
        </div>

        <div className="portal-body">
          <div className="portal-layer">
            {" "}
            <BakedArt name={`portal:${color}:disc`} viewBox={VIEW_BOX} pixels>
              <defs>
                <radialGradient id={`disc-${id}`}>
                  <stop offset="0%" stopColor="#000" />
                  <stop offset="22%" stopColor="#02030a" />
                  <stop offset="55%" className="portal-stop-deep" />
                  <stop offset="86%" className="portal-stop-mid" />
                  <stop offset="100%" className="portal-stop-hi" />
                </radialGradient>
              </defs>
              <circle r={DISC_RADIUS} fill={ref("disc")} />
            </BakedArt>
          </div>
          {["portal-arms", "portal-arms portal-arms-inner"].map((layer, k) => (
            <div key={layer} className={`portal-layer ${layer}`}>
              <BakedArt
                name={`portal:${color}:arms:${k}`}
                viewBox={VIEW_BOX}
                pixels
              >
                <defs>
                  <radialGradient
                    id={`arm-${k}-${id}`}
                    gradientUnits="userSpaceOnUse"
                    r={DISC_RADIUS}
                  >
                    <stop
                      offset="15%"
                      className="portal-stop-hi"
                      stopOpacity="0"
                    />
                    <stop
                      offset="45%"
                      className="portal-stop-hi"
                      stopOpacity="0.95"
                    />
                    <stop
                      offset="80%"
                      className="portal-stop-hi"
                      stopOpacity="0.7"
                    />
                    <stop
                      offset="100%"
                      className="portal-stop-mid"
                      stopOpacity="0.3"
                    />
                  </radialGradient>
                  <clipPath id={`clip-${k}-${id}`}>
                    <circle r={DISC_RADIUS} />
                  </clipPath>
                </defs>
                <g clipPath={ref(`clip-${k}`)} stroke={ref(`arm-${k}`)}>
                  {k === 0 &&
                    ARMS.map((d, i) => (
                      <path key={`h${i}`} d={d} className="portal-arm-haze" />
                    ))}
                  {ARMS.map((d, i) => (
                    <path key={i} d={d} className="portal-arm" />
                  ))}
                </g>
              </BakedArt>
            </div>
          ))}
          <div className="portal-layer">
            {" "}
            <BakedArt name={`portal:${color}:rim`} viewBox={VIEW_BOX} pixels>
              <defs>
                <radialGradient id={`core-${id}`}>
                  <stop offset="0%" stopColor="#000" />
                  <stop offset="65%" stopColor="#000" />
                  <stop offset="100%" stopColor="#000" stopOpacity="0" />
                </radialGradient>
                {blur}
                {wobble}
              </defs>
              <circle r="13" fill={ref("core")} />
              <circle
                r={DISC_RADIUS}
                className="portal-rim-glow"
                filter={ref("blur")}
              />
              <circle
                r={DISC_RADIUS}
                className="portal-rim"
                filter={ref("wobble")}
              />
            </BakedArt>
          </div>
          <div className="portal-layer portal-rim-flare">
            {" "}
            <BakedArt
              name={`portal:${color}:flare-rim`}
              viewBox={VIEW_BOX}
              pixels
            >
              <defs>{wobble}</defs>
              <circle
                r={DISC_RADIUS}
                className="portal-rim portal-rim-thick"
                filter={ref("wobble")}
              />
            </BakedArt>
          </div>
        </div>

        <div className="portal-layer portal-bolts">
          <div className="portal-layer portal-bolts-jump">
            {BOLTS.map((b, i) => (
              <div
                key={i}
                className="portal-layer portal-bolt"
                style={{
                  animationDuration: `${b.duration}s`,
                  animationDelay: `${b.delay}s`,
                }}
              >
                <BakedArt
                  name={`portal:${color}:bolt:${i}`}
                  viewBox={VIEW_BOX}
                  pixels
                >
                  <defs>{blur}</defs>
                  <path
                    d={b.d}
                    className="portal-bolt-glow"
                    filter={ref("blur")}
                  />
                  <path d={b.d} className="portal-bolt-core" />
                </BakedArt>
              </div>
            ))}
          </div>
        </div>

        <div className="portal-layer portal-sparks">
          {EMBERS.map((e, i) => (
            <span
              key={`e${i}`}
              className="portal-ember"
              style={
                {
                  "--a": `${e.angle}deg`,
                  animationDelay: `${e.delay}s`,
                  animationDuration: `${e.duration}s`,
                } as React.CSSProperties
              }
            />
          ))}
          {PARTICLES.map((p, i) => (
            <span
              key={`p${i}`}
              className="portal-particle"
              style={
                {
                  "--a": `${p.angle}deg`,
                  "--r": p.radius,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Flash, shockwave ring, and sparks where a piece enters or leaves a portal */
export function PortalBurst({
  color,
  direction,
  style,
}: {
  color: PortalColor;
  direction: "in" | "out";
  style: React.CSSProperties;
}) {
  return (
    <div
      className={`portal-burst portal-burst-${direction} portal-${color}`}
      style={style}
    >
      <span className="portal-burst-flash" />
      <span className="portal-burst-ring" />
      {Array.from({ length: 10 }, (_, i) => (
        <i
          key={i}
          style={
            {
              "--a": `${i * 36 + (i % 2) * 14}deg`,
              animationDelay: `${(i % 3) * 25}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
