const W = 1600;
const H = 900;

/** A headstone's silhouette, rounded, crossed, or square-topped */
function stone(x: number, y: number, s: number, kind: number): string {
  if (kind === 0) {
    return `M${x - 14 * s} ${y} V${y - 30 * s} Q${x - 14 * s} ${y - 46 * s} ${x} ${y - 46 * s} Q${x + 14 * s} ${y - 46 * s} ${x + 14 * s} ${y - 30 * s} V${y} Z`;
  }
  if (kind === 1) {
    return `M${x - 4 * s} ${y} V${y - 34 * s} H${x - 16 * s} V${y - 42 * s} H${x - 4 * s} V${y - 56 * s} H${x + 4 * s} V${y - 42 * s} H${x + 16 * s} V${y - 34 * s} H${x + 4 * s} V${y} Z`;
  }
  return `M${x - 13 * s} ${y} V${y - 38 * s} H${x + 13 * s} V${y} Z`;
}

const STONES = [
  [90, 1.3, 0],
  [210, 1.0, 1],
  [300, 1.2, 2],
  [420, 0.9, 0],
  [1170, 1.0, 0],
  [1260, 1.3, 1],
  [1380, 1.0, 2],
  [1500, 1.2, 0],
] as const;

/**
 * Zombies' backdrop: a graveyard under a sickly full moon, crooked headstones
 * and a dead tree on the hill, and a green mist creeping along the ground
 */
export function Graveyard() {
  return (
    <>
      <svg
        className="graveyard"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          <radialGradient id="moon-glow">
            <stop offset="0" stopColor="#e8f7c8" stopOpacity="0.5" />
            <stop offset="1" stopColor="#8fe04a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="1470" cy="150" r="240" fill="url(#moon-glow)" />
        <circle cx="1470" cy="150" r="80" fill="#eef5d8" />
        <circle cx="1446" cy="134" r="16" fill="#cfd9b4" />
        <circle cx="1494" cy="172" r="11" fill="#cfd9b4" />
        <circle cx="1484" cy="116" r="7" fill="#cfd9b4" />
        <path
          d="M0 700 Q300 610 640 660 T1300 640 T1600 650 V900 H0 Z"
          fill="#141c18"
        />
        <path
          transform="translate(180 0)"
          d="M1360 655 C1356 600 1366 560 1352 520 M1356 600 C1330 585 1318 560 1300 552 M1360 575 C1390 560 1400 540 1420 530 M1352 540 C1340 520 1330 505 1318 500"
          stroke="#141c18"
          strokeWidth="14"
          strokeLinecap="round"
          fill="none"
        />
        {STONES.map(([x, s, kind]) => (
          <path
            key={x}
            d={stone(x, 700 - (x % 3) * 8, s * 1.4, kind)}
            fill="#141c18"
            transform={`rotate(${((x % 7) - 3) * 2} ${x} 700)`}
          />
        ))}
        <path d="M0 760 Q500 720 1000 760 T1600 750 V900 H0 Z" fill="#0d130f" />
      </svg>
      <div className="grave-mist grave-mist-a" />
      <div className="grave-mist grave-mist-b" />
    </>
  );
}
