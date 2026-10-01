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

const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  angle: (i * 360) / PARTICLE_COUNT,
  delay: -(i * 0.37) % 1.9,
  duration: 1.5 + (i % 3) * 0.35,
  radius: 1.3 + (i % 2) * 0.6,
}));

export function Portal({
  color,
  state = "idle",
}: {
  color: PortalColor;
  state?: PortalState;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const ref = (name: string) => `url(#${name}-${id})`;

  return (
    <div className={`portal-overlay portal-${color} portal-${state}`}>
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
          <filter id={`wobble-${id}`} x="-30%" y="-30%" width="160%" height="160%">
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
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" />
          </filter>
          <filter id={`blur-${id}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>

        <circle className="portal-light" r="58" fill={ref("light")} />

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
