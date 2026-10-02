const W = 1600;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Keeps scenery out of the middle band of the screen */
const inBands = (rand: () => number) =>
  rand() < 0.5 ? 20 + rand() * 300 : 600 + rand() * 280;

/** A zigzag trench across the field at height `y` */
function trench(rand: () => number, y: number): string {
  let d = `M-40 ${y}`;
  for (let x = 60; x <= W + 120; x += 120) {
    d += ` L${x - 60} ${y + (rand() - 0.5) * 45} L${x} ${y + (rand() < 0.5 ? -40 : 40)}`;
  }
  return d;
}

/** Coiled barbed wire across the field at height `y`, held up by crossed stakes */
function wire(rand: () => number, y: number) {
  const coils: { x: number; y: number; tilt: number }[] = [];
  const barbs: { x: number; y: number; a: number }[] = [];
  const stakes: number[] = [];
  for (let x = -20; x <= W + 20; x += 17) {
    const cy = y + Math.sin(x / 120) * 6;
    coils.push({ x, y: cy, tilt: (rand() - 0.5) * 20 });
    // Barbs bristle off the top and bottom of each loop
    for (const side of [-1, 1]) {
      barbs.push({
        x: x + (rand() - 0.5) * 9,
        y: cy + side * (10 + rand() * 3),
        a: rand() * 180,
      });
    }
  }
  for (let x = 30; x <= W; x += 160 + rand() * 80) stakes.push(x);
  return { coils, barbs, stakes, y };
}

/**
 * Trenches lined with sandbags, coiled barbed wire on crossed stakes, and shell
 * craters, for a battlefield seen from above. Drawn in a 1600 by 900 space, to
 * place inside an SVG with that viewBox. Not used by any mode yet.
 */
export function Fortifications() {
  const rand = seeded(23);
  const craters = Array.from({ length: 14 }, () => ({
    x: rand() * W,
    y: inBands(rand),
    r: 10 + rand() * 22,
  }));
  const trenches = [trench(rand, 115), trench(rand, 795)];
  const wires = [wire(rand, 228), wire(rand, 678)];

  return (
    <g>
      <defs>
        <filter id="land-rough" x="-5%" y="-150%" width="110%" height="400%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.06"
            numOctaves="2"
            seed="2"
          />
          <feDisplacementMap in="SourceGraphic" scale="8" />
        </filter>
        <filter
          id="land-shadow-fort"
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <radialGradient id="land-crater">
          <stop offset="0" stopColor="#24180c" />
          <stop offset="0.55" stopColor="#3d2a16" />
          <stop offset="0.8" stopColor="#7b6040" />
          <stop offset="1" stopColor="#7b6040" stopOpacity="0" />
        </radialGradient>
      </defs>
      {trenches.map((d, i) => (
        <g key={i} filter="url(#land-rough)">
          <path d={d} className="trench-spoil" />
          <path d={d} className="trench-bags" />
          <path d={d} className="trench-bags trench-bags-top" />
          <path d={d} className="trench-cut" />
          <path d={d} className="trench-wall" transform="translate(-3 -4)" />
          <path d={d} className="trench-floor" />
          <path d={d} className="trench-boards" />
        </g>
      ))}

      {craters.map((c, i) => (
        <g key={i}>
          <circle
            cx={c.x}
            cy={c.y}
            r={c.r * 1.6}
            fill="#5c4528"
            opacity="0.35"
            filter="url(#land-shadow-fort)"
          />
          <circle cx={c.x} cy={c.y} r={c.r} fill="url(#land-crater)" />
        </g>
      ))}

      {wires.map((w, i) => (
        <g key={i} className="barbed-wire">
          {w.stakes.map((x) => (
            <g key={x} className="wire-stake">
              <path
                d={`M${x - 14} ${w.y - 18} L${x + 14} ${w.y + 18} M${x + 14} ${w.y - 18} L${x - 14} ${w.y + 18}`}
              />
            </g>
          ))}
          <g className="wire-shadow" transform="translate(3 5)">
            {w.coils.map((c, k) => (
              <ellipse
                key={k}
                cx={c.x}
                cy={c.y}
                rx="13"
                ry="10"
                transform={`rotate(${c.tilt} ${c.x} ${c.y})`}
              />
            ))}
          </g>
          {w.coils.map((c, k) => (
            <ellipse
              key={k}
              cx={c.x}
              cy={c.y}
              rx="13"
              ry="10"
              transform={`rotate(${c.tilt} ${c.x} ${c.y})`}
            />
          ))}
          {w.barbs.map((b, k) => (
            <path
              key={`b${k}`}
              className="wire-barb"
              d={`M${b.x - 4} ${b.y} L${b.x + 4} ${b.y} M${b.x} ${b.y - 4} L${b.x} ${b.y + 4}`}
              transform={`rotate(${b.a} ${b.x} ${b.y})`}
            />
          ))}
        </g>
      ))}
    </g>
  );
}
