const W = 1600;
const H = 900;

const BUNTING = ["#e8402f", "#ffd23f", "#2f6bff", "#ffffff", "#3ec46d"];

/** A string of pennants sagging between two posts */
function Bunting({ from, to, sag }: { from: number; to: number; sag: number }) {
  const mid = (from + to) / 2;
  const y = 70;
  const count = 14;
  const point = (t: number) => {
    const x = from + (to - from) * t;
    return { x, y: y + sag * 4 * t * (1 - t) };
  };
  return (
    <g className="bunting">
      <path
        d={`M${from} ${y} Q${mid} ${y + sag * 2} ${to} ${y}`}
        fill="none"
        stroke="#4a2c14"
        strokeWidth="3"
      />
      {Array.from({ length: count }, (_, i) => {
        const a = point((i + 0.15) / count);
        const b = point((i + 0.85) / count);
        const tip = point((i + 0.5) / count);
        return (
          <path
            key={i}
            className="pennant"
            style={{ animationDelay: `${(i % 5) * -0.3}s` }}
            d={`M${a.x} ${a.y} L${b.x} ${b.y} L${tip.x} ${tip.y + 42} Z`}
            fill={BUNTING[i % BUNTING.length]}
            stroke="#2a1a10"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        );
      })}
    </g>
  );
}

/** A striped marquee tent seen from the side */
function Tent({ x, scale }: { x: number; scale: number }) {
  return (
    <g transform={`translate(${x} 900) scale(${scale})`}>
      <path
        d="M-120 0 V-110 L0 -230 L120 -110 V0 Z"
        fill="#fff6e6"
        stroke="#2a1a10"
        strokeWidth="5"
      />
      {[-90, -30, 30, 90].map((sx) => (
        <path
          key={sx}
          d={`M${sx - 15} 0 V-110 L${sx * 0.2} -215 L${sx * 0.2 + 12} -215 L${sx + 15} -110 V0 Z`}
          fill="#e8402f"
        />
      ))}
      <path
        d="M-120 -110 L0 -230 L120 -110"
        fill="none"
        stroke="#2a1a10"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M-34 0 Q0 -90 34 0 Z" fill="#4a2c14" />
      <path d="M0 -230 V-280" stroke="#2a1a10" strokeWidth="5" />
      <path
        d="M0 -280 L46 -266 L0 -252 Z"
        fill="#ffd23f"
        stroke="#2a1a10"
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </g>
  );
}

function Cloud({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g className="fair-cloud" transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M0 40 Q-10 10 25 12 Q35 -15 70 0 Q100 -10 110 20 Q135 22 130 42 Z"
        fill="#ffffff"
        stroke="#9ccbe4"
        strokeWidth="3"
      />
    </g>
  );
}

/**
 * A sunny sports day: bunting strung across the sky, drifting clouds, striped
 * tents on the grass either side, and hay bales for the spectators
 */
export function Fairground() {
  return (
    <svg
      className="fairground"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <circle cx="1420" cy="150" r="110" fill="#ffe27a" className="fair-sun" />
      <circle
        cx="1420"
        cy="150"
        r="78"
        fill="#ffd23f"
        stroke="#e8a21c"
        strokeWidth="4"
      />
      <Cloud x={160} y={170} s={1.3} />
      <Cloud x={620} y={110} s={0.9} />
      <Cloud x={1080} y={210} s={1.1} />
      <path d="M0 720 Q400 640 800 700 T1600 680 V900 H0 Z" fill="#7cc35a" />
      <path d="M0 780 Q500 730 1000 780 T1600 760 V900 H0 Z" fill="#5fae3a" />
      <Tent x={150} scale={1.1} />
      <Tent x={1460} scale={0.95} />
      {[320, 1290].map((x) => (
        <g key={x} transform={`translate(${x} 870)`}>
          <rect
            x="-60"
            y="-50"
            width="120"
            height="50"
            rx="10"
            fill="#e8c46a"
            stroke="#2a1a10"
            strokeWidth="4"
          />
          <path
            d="M-50 -38 H50 M-50 -24 H50 M-50 -10 H50"
            stroke="#c99e3a"
            strokeWidth="3"
          />
        </g>
      ))}
      <Bunting from={-20} to={560} sag={60} />
      <Bunting from={540} to={1080} sag={50} />
      <Bunting from={1060} to={1620} sag={60} />
    </svg>
  );
}
