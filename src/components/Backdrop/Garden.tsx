/** A leaf, drawn pointing up from its stem at the bottom */
function Leaf({
  d,
  vein,
  fill,
  shade,
}: {
  d: string;
  vein: string;
  fill: string;
  shade: string;
}) {
  return (
    <>
      <path d={d} fill={fill} stroke="#10200f" strokeWidth="5" />
      <path
        d={vein}
        fill="none"
        stroke={shade}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </>
  );
}

/** Drops of dew, each with a glint */
function Dew({ drops }: { drops: [number, number, number][] }) {
  return drops.map(([x, y, r]) => (
    <g key={`${x}-${y}`}>
      <circle
        cx={x}
        cy={y}
        r={r}
        fill="rgba(230, 255, 245, 0.55)"
        stroke="rgba(16, 32, 15, 0.6)"
        strokeWidth="2"
      />
      <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.3} fill="#fff" />
    </g>
  ));
}

/**
 * A garden at dawn, seen from down among the leaves: hills going back to a
 * low sun, big wet leaves close by, and far off along the ridge the
 * silhouette of a snail the size of a hill, coming, very slowly
 */
export function Garden() {
  return (
    <>
      <div className="garden-sun" />
      <svg
        className="garden-hills"
        viewBox="0 0 1600 600"
        preserveAspectRatio="xMidYMax slice"
      >
        <path
          d="M0 330 C 220 250, 420 300, 640 270 C 860 240, 1080 300, 1300 260 C 1450 235, 1530 250, 1600 245 V 600 H 0 Z"
          fill="#3c6b3a"
        />
        <path
          d="M0 420 C 260 360, 520 410, 780 380 C 1040 350, 1300 410, 1600 370 V 600 H 0 Z"
          fill="#2a5229"
        />
        <path
          d="M0 500 C 300 460, 600 500, 900 480 C 1200 460, 1400 500, 1600 480 V 600 H 0 Z"
          fill="#1b3a1c"
        />
      </svg>
      {/* It is always coming */}
      <div className="garden-far-snail">
        <svg viewBox="0 0 64 48">
          <path
            d="M6 40 C 10 33, 30 33, 50 34 C 56 34.5, 60 37, 60 40 C 60 43, 54 44, 48 44 L 10 44 C 6 44, 4 42, 6 40 Z M51 35 C 52 28, 53 22, 55 16 L 57 16 C 55 22, 54 28, 53 35 Z M55 35 C 57 29, 59 24, 62 19 L 63.5 20 C 60.5 25, 58.5 30, 57 35 Z"
            fill="#2f5730"
          />
          <circle cx="28" cy="24" r="15" fill="#2f5730" />
          <circle cx="55" cy="15" r="2.6" fill="#2f5730" />
          <circle cx="62.6" cy="18.6" r="2.6" fill="#2f5730" />
        </svg>
      </div>
      <svg
        className="garden-leaves garden-leaves-left"
        viewBox="0 0 520 620"
        preserveAspectRatio="xMinYMax meet"
      >
        <Leaf
          d="M40 640 C 0 460, 60 260, 240 120 C 300 280, 260 470, 120 640 Z"
          vein="M70 630 C 110 470, 170 300, 238 128"
          fill="#4f8a3f"
          shade="#2f5e27"
        />
        <Leaf
          d="M130 640 C 170 470, 300 330, 500 300 C 470 450, 340 580, 200 640 Z"
          vein="M160 636 C 250 500, 360 390, 496 304"
          fill="#6aa84f"
          shade="#3d7330"
        />
        <Dew
          drops={[
            [190, 260, 11],
            [330, 420, 8],
            [120, 470, 7],
          ]}
        />
      </svg>
      <svg
        className="garden-leaves garden-leaves-right"
        viewBox="0 0 520 620"
        preserveAspectRatio="xMaxYMax meet"
      >
        <Leaf
          d="M480 640 C 520 450, 440 250, 270 110 C 210 290, 260 480, 400 640 Z"
          vein="M450 630 C 410 470, 350 300, 272 118"
          fill="#5d9b46"
          shade="#356a2b"
        />
        <Leaf
          d="M380 640 C 330 480, 210 360, 20 330 C 60 470, 190 590, 320 640 Z"
          vein="M352 636 C 270 510, 150 410, 26 334"
          fill="#4a823b"
          shade="#2c5a24"
        />
        <Dew
          drops={[
            [320, 240, 10],
            [180, 430, 9],
            [420, 500, 6],
          ]}
        />
      </svg>
    </>
  );
}
