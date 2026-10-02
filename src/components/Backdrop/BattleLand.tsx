const W = 1600;
const H = 900;

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Keeps scenery out of the middle band of the screen, where the river runs */
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
 * The battlefield the Stratego board sits on, seen from above: a meadow torn
 * by craters, trenches lined with sandbags, barbed wire along no man's land
 * by the river, and trees at the edges.
 */
export function BattleLand() {
  const rand = seeded(19);
  const patches = Array.from({ length: 16 }, () => ({
    x: rand() * W,
    y: rand() * H,
    rx: 80 + rand() * 180,
    ry: 50 + rand() * 120,
    tone: rand() < 0.6 ? "#4f6a26" : "#9a9a4a",
  }));
  const craters = Array.from({ length: 14 }, () => ({
    x: rand() * W,
    y: inBands(rand),
    r: 10 + rand() * 22,
  }));
  const trees = Array.from({ length: 22 }, () => {
    const left = rand() < 0.5;
    const x = left ? rand() * 230 : W - rand() * 230;
    const r = 22 + rand() * 20;
    // A ring of leaf clumps around a fuller middle makes a lumpy crown
    const clumps = Array.from({ length: 9 }, (_, k) => {
      const a = (k / 9) * Math.PI * 2 + rand() * 0.5;
      const d = 0.55 + rand() * 0.25;
      return [Math.cos(a) * d, Math.sin(a) * d, 0.36 + rand() * 0.18];
    });
    clumps.push([0, 0, 0.62]);
    const highlights = Array.from({ length: 4 }, () => [
      -0.25 - rand() * 0.25,
      -0.25 - rand() * 0.25,
      0.18 + rand() * 0.12,
    ]);
    return {
      x,
      y: inBands(rand),
      r,
      clumps,
      highlights,
      tone: Math.floor(rand() * 3),
    };
  });
  const trenches = [trench(rand, 115), trench(rand, 795)];
  const wires = [wire(rand, 228), wire(rand, 678)];

  return (
    <svg
      className="battle-land"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <filter id="land-grass" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012"
            numOctaves="3"
            seed="4"
          />
          <feColorMatrix
            values="0 0 0 0 0.18
                    0 0 0 0 0.26
                    0 0 0 0 0.05
                    0 0 0 -1.6 1.05"
          />
        </filter>
        <filter id="land-grass-fine" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.7"
            numOctaves="1"
            seed="9"
          />
          <feColorMatrix
            values="0 0 0 0 0.1
                    0 0 0 0 0.12
                    0 0 0 0 0.02
                    0 0 0 -2.2 1.25"
          />
        </filter>
        <filter id="land-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
        <filter id="land-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="land-rough" x="-5%" y="-150%" width="110%" height="400%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.06"
            numOctaves="2"
            seed="2"
          />
          <feDisplacementMap in="SourceGraphic" scale="8" />
        </filter>
        <radialGradient id="land-crater">
          <stop offset="0" stopColor="#24180c" />
          <stop offset="0.55" stopColor="#3d2a16" />
          <stop offset="0.8" stopColor="#7b6040" />
          <stop offset="1" stopColor="#7b6040" stopOpacity="0" />
        </radialGradient>
        {[
          ["#86ab4a", "#4f7226", "#263c11"],
          ["#9aa94a", "#617128", "#323a12"],
          ["#6f9d48", "#3e6626", "#1d3510"],
        ].map(([light, mid, dark], i) => (
          <radialGradient
            key={i}
            id={`land-canopy-${i}`}
            cx="0.38"
            cy="0.32"
            r="0.8"
          >
            <stop offset="0" stopColor={light} />
            <stop offset="0.55" stopColor={mid} />
            <stop offset="1" stopColor={dark} />
          </radialGradient>
        ))}
        {/* Jagged leafy edges, lit from the upper left so each crown looks bumpy */}
        <filter id="land-leafy" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.22"
            numOctaves="2"
            seed="5"
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="9"
            result="jagged"
          />
          <feDiffuseLighting
            in="noise"
            surfaceScale="3"
            lightingColor="#ffffff"
            result="light"
          >
            <feDistantLight azimuth="225" elevation="50" />
          </feDiffuseLighting>
          <feComposite
            in="jagged"
            in2="light"
            operator="arithmetic"
            k1="1.25"
            k2="0.15"
            result="lit"
          />
          <feComposite in="lit" in2="jagged" operator="in" />
        </filter>
      </defs>

      <rect width={W} height={H} fill="#6c8738" />
      <rect width={W} height={H} filter="url(#land-grass)" />
      <rect width={W} height={H} filter="url(#land-grass-fine)" />
      <g filter="url(#land-blur)" opacity="0.5">
        {patches.map((p, i) => (
          <ellipse
            key={i}
            cx={p.x}
            cy={p.y}
            rx={p.rx}
            ry={p.ry}
            fill={p.tone}
          />
        ))}
      </g>

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
            filter="url(#land-shadow)"
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

      {trees.map((t, i) => (
        <g key={i}>
          <circle
            cx={t.x + t.r * 0.35}
            cy={t.y + t.r * 0.45}
            r={t.r}
            fill="#0f1606"
            opacity="0.45"
            filter="url(#land-shadow)"
          />
          <g filter="url(#land-leafy)">
            {t.clumps.map(([dx, dy, k], j) => (
              <circle
                key={j}
                cx={t.x + dx * t.r}
                cy={t.y + dy * t.r}
                r={t.r * k}
                fill={`url(#land-canopy-${t.tone})`}
              />
            ))}
            {t.highlights.map(([dx, dy, k], j) => (
              <circle
                key={`h${j}`}
                cx={t.x + dx * t.r}
                cy={t.y + dy * t.r}
                r={t.r * k}
                fill="#b4cf6a"
                opacity="0.45"
              />
            ))}
          </g>
        </g>
      ))}
    </svg>
  );
}
