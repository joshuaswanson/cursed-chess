import { useId } from "react";
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

  return (
    <div
      className={`portal-overlay portal-${color} portal-${state}${charge > 0.5 ? " portal-charged" : ""}`}
      style={
        {
          "--charge": charge,
          "--charge-ms": `${chargeMs}ms`,
        } as React.CSSProperties
      }
    >
      <svg className="portal-svg" viewBox="-60 -60 120 120" aria-hidden>
        <defs>
          <radialGradient id={`light-${id}`}>
            <stop offset="0%" className="portal-stop-mid" stopOpacity="0.7" />
            <stop offset="45%" className="portal-stop-mid" stopOpacity="0.25" />
            <stop offset="100%" className="portal-stop-mid" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`disc-${id}`}>
            <stop offset="0%" stopColor="#000" />
            <stop offset="22%" stopColor="#02030a" />
            <stop offset="55%" className="portal-stop-deep" />
            <stop offset="86%" className="portal-stop-mid" />
            <stop offset="100%" className="portal-stop-hi" />
          </radialGradient>
          <radialGradient
            id={`arm-${id}`}
            gradientUnits="userSpaceOnUse"
            r={DISC_RADIUS}
          >
            <stop offset="15%" className="portal-stop-hi" stopOpacity="0" />
            <stop offset="45%" className="portal-stop-hi" stopOpacity="0.95" />
            <stop offset="80%" className="portal-stop-hi" stopOpacity="0.7" />
            <stop offset="100%" className="portal-stop-mid" stopOpacity="0.3" />
          </radialGradient>
          <radialGradient id={`core-${id}`}>
            <stop offset="0%" stopColor="#000" />
            <stop offset="65%" stopColor="#000" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <clipPath id={`clip-${id}`}>
            <circle r={DISC_RADIUS} />
          </clipPath>
          <filter
            id={`wobble-${id}`}
            x="-30%"
            y="-30%"
            width="160%"
            height="160%"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.09"
              numOctaves="2"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                values="0.07;0.12;0.07"
                dur="2.6s"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" />
          </filter>
          <filter
            id={`plasma-${id}`}
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
          >
            <feTurbulence
              type="turbulence"
              baseFrequency="0.05"
              numOctaves="3"
              result="noise"
            >
              <animate
                attributeName="baseFrequency"
                values="0.04;0.07;0.05;0.04"
                dur="1.7s"
                repeatCount="indefinite"
              />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" />
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
          <filter
            id={`blur-${id}`}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>

        <circle className="portal-light" r="58" fill={ref("light")} />

        <g className="portal-corona" filter={ref("plasma")}>
          <circle r={DISC_RADIUS + 4} className="portal-flame" />
          <circle
            r={DISC_RADIUS + 7}
            className="portal-flame portal-flame-outer"
          />
        </g>

        <g className="portal-body">
          <circle r={DISC_RADIUS} fill={ref("disc")} />
          <g clipPath={ref("clip")}>
            <g className="portal-arms" stroke={ref("arm")}>
              {ARMS.map((d, i) => (
                <path key={i} d={d} className="portal-arm-haze" />
              ))}
              {ARMS.map((d, i) => (
                <path key={i} d={d} className="portal-arm" />
              ))}
            </g>
            <g className="portal-arms portal-arms-inner" stroke={ref("arm")}>
              {ARMS.map((d, i) => (
                <path key={i} d={d} className="portal-arm" />
              ))}
            </g>
          </g>
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
        </g>

        <g className="portal-bolts">
          <g className="portal-bolts-jump">
            {BOLTS.map((b, i) => (
              <g
                key={i}
                className="portal-bolt"
                style={{
                  animationDuration: `${b.duration}s`,
                  animationDelay: `${b.delay}s`,
                }}
              >
                <path
                  d={b.d}
                  className="portal-bolt-glow"
                  filter={ref("blur")}
                />
                <path d={b.d} className="portal-bolt-core" />
              </g>
            ))}
          </g>
        </g>

        {EMBERS.map((e, i) => (
          <circle
            key={i}
            r="1.4"
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
          <circle
            key={i}
            r={p.radius}
            className="portal-particle"
            style={
              {
                "--a": `${p.angle}deg`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </svg>
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
