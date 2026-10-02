/** A flying saucer: polished hull, glass dome, running lights, and a tractor beam */
export function Ufo() {
  return (
    <svg viewBox="0 0 120 90" className="ship-art">
      <defs>
        <radialGradient id="ufo-hull" cx="0.42" cy="0.2" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor="#c7d0e4" />
          <stop offset="0.7" stopColor="#5d6788" />
          <stop offset="1" stopColor="#1d2240" />
        </radialGradient>
        <linearGradient id="ufo-belly" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a4266" />
          <stop offset="1" stopColor="#0d1026" />
        </linearGradient>
        <radialGradient id="ufo-dome" cx="0.38" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#f2fffe" />
          <stop offset="0.35" stopColor="#7ef0ff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#0f5f86" stopOpacity="0.85" />
        </radialGradient>
        <linearGradient id="ufo-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b6ff7a" stopOpacity="0.75" />
          <stop offset="1" stopColor="#b6ff7a" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="ufo-glow">
          <stop offset="0" stopColor="#fff6c2" />
          <stop offset="0.4" stopColor="#ffd23f" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffd23f" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path
        className="ufo-beam"
        d="M46 42 L74 42 L100 92 L20 92 Z"
        fill="url(#ufo-beam)"
      />
      <ellipse cx="60" cy="42" rx="34" ry="8" fill="url(#ufo-belly)" />
      <ellipse cx="60" cy="36" rx="58" ry="12" fill="url(#ufo-hull)" />
      <ellipse cx="60" cy="33" rx="50" ry="4" fill="#ffffff" opacity="0.35" />
      <ellipse cx="60" cy="27" rx="23" ry="18" fill="url(#ufo-dome)" />
      <ellipse
        cx="52"
        cy="19"
        rx="8"
        ry="4.5"
        fill="#ffffff"
        opacity="0.85"
        transform="rotate(-20 52 19)"
      />
      {[14, 37, 60, 83, 106].map((x, i) => (
        <g
          key={x}
          className="ufo-light"
          style={{ animationDelay: `${i * 0.15}s` }}
        >
          <circle cx={x} cy={38} r="7" fill="url(#ufo-glow)" />
          <circle cx={x} cy={38} r="2.2" fill="#fffbe6" />
        </g>
      ))}
    </svg>
  );
}

/** A retro rocket: rounded hull, red nose cone and fins, porthole, and a roaring flame */
export function Rocket() {
  return (
    <svg viewBox="0 0 40 110" className="ship-art">
      <defs>
        <linearGradient id="rocket-hull" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#6b7388" />
          <stop offset="0.35" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#dde2ec" />
          <stop offset="1" stopColor="#4b5266" />
        </linearGradient>
        <linearGradient id="rocket-red" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a0f24" />
          <stop offset="0.38" stopColor="#ff6b8a" />
          <stop offset="0.65" stopColor="#e52457" />
          <stop offset="1" stopColor="#5e0a1c" />
        </linearGradient>
        <radialGradient id="rocket-glass" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#f0fdff" />
          <stop offset="0.4" stopColor="#5fd6ff" />
          <stop offset="1" stopColor="#0b3b66" />
        </radialGradient>
        <radialGradient id="rocket-rim" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#7c8498" />
        </radialGradient>
        <linearGradient id="rocket-fire" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.3" stopColor="#ffe066" />
          <stop offset="0.7" stopColor="#ff7a1a" />
          <stop offset="1" stopColor="#ff3d00" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        className="rocket-flame"
        d="M10 76 Q20 124 30 76 Z"
        fill="url(#rocket-fire)"
        opacity="0.6"
      />
      <path
        className="rocket-flame"
        d="M14 76 Q20 104 26 76 Z"
        fill="url(#rocket-fire)"
      />
      <path d="M8 56 L-1 82 L9 77 Z" fill="url(#rocket-red)" />
      <path d="M32 56 L41 82 L31 77 Z" fill="url(#rocket-red)" />
      <path
        d="M20 2 Q34 22 32 62 L31 78 L9 78 L8 62 Q6 22 20 2 Z"
        fill="url(#rocket-hull)"
      />
      <path
        d="M20 2 Q29 12 31 25 L9 25 Q11 12 20 2 Z"
        fill="url(#rocket-red)"
      />
      <rect x="8.6" y="64" width="22.8" height="5" fill="url(#rocket-red)" />
      <circle cx="20" cy="41" r="7.5" fill="url(#rocket-rim)" />
      <circle cx="20" cy="41" r="5.5" fill="url(#rocket-glass)" />
      <ellipse cx="18" cy="39" rx="2" ry="1.3" fill="#ffffff" opacity="0.9" />
    </svg>
  );
}

/** A sleek fighter facing left, with a glass canopy, glowing thrusters, and lasers */
const FIGHTER_COLORS = {
  blue: {
    hi: "#f4f7ff",
    mid: "#a9b4d0",
    low: "#353d5c",
    wing: "#98a5c6",
    stripe: "#ffc06a",
  },
  red: {
    hi: "#ffeef0",
    mid: "#e38a99",
    low: "#5c1f2c",
    wing: "#d07385",
    stripe: "#7df2ff",
  },
};

export function Fighter({ variant = "blue" }: { variant?: "blue" | "red" }) {
  const c = FIGHTER_COLORS[variant];
  const id = (name: string) => `fighter-${name}-${variant}`;
  return (
    <svg viewBox="0 0 140 50" className="ship-art">
      <defs>
        <linearGradient id={id("hull")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.hi} />
          <stop offset="0.45" stopColor={c.mid} />
          <stop offset="1" stopColor={c.low} />
        </linearGradient>
        <linearGradient id={id("wing")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c.wing} />
          <stop offset="1" stopColor="#2a3150" />
        </linearGradient>
        <linearGradient id={id("glass")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8fdff" />
          <stop offset="0.5" stopColor="#3ccfff" />
          <stop offset="1" stopColor="#0a3d6e" />
        </linearGradient>
        <radialGradient id={id("thrust")}>
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.35" stopColor="#7df2ff" />
          <stop offset="1" stopColor="#18d4ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id("stripe")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.stripe} />
          <stop offset="1" stopColor="#d9530f" />
        </linearGradient>
      </defs>
      <path className="fighter-laser" d="M-60 22 H-20" />
      <path className="fighter-laser fighter-laser-b" d="M-60 30 H-20" />
      <ellipse
        className="fighter-thrust"
        cx="122"
        cy="25"
        rx="20"
        ry="9"
        fill={`url(#${id("thrust")})`}
      />
      <path d="M60 14 L92 0 L102 1 L86 17 Z" fill={`url(#${id("wing")})`} />
      <path
        d="M2 25 L50 11 L104 14 L115 20 L115 30 L104 36 L50 39 Z"
        fill={`url(#${id("hull")})`}
      />
      <path d="M60 36 L92 50 L102 49 L86 33 Z" fill={`url(#${id("wing")})`} />
      <path
        d="M8 25 L50 13 L104 16 L104 19 L50 17 Z"
        fill="#ffffff"
        opacity="0.45"
      />
      <path
        d="M28 21 Q40 13 58 16 L58 25 L26 25 Z"
        fill={`url(#${id("glass")})`}
      />
      <path
        d="M34 19 Q42 15 52 16"
        stroke="#ffffff"
        strokeWidth="1.6"
        opacity="0.8"
        fill="none"
      />
      <rect
        x="68"
        y="23"
        width="34"
        height="3.5"
        rx="1.5"
        fill={`url(#${id("stripe")})`}
      />
    </svg>
  );
}
