export function Ufo() {
  return (
    <svg viewBox="0 0 120 90" className="ship-art">
      <defs>
        <linearGradient id="ufo-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9f1ff" />
          <stop offset="0.5" stopColor="#8a98b8" />
          <stop offset="1" stopColor="#3b4466" />
        </linearGradient>
        <linearGradient id="ufo-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9dff6a" stopOpacity="0.7" />
          <stop offset="1" stopColor="#9dff6a" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        className="ufo-beam"
        d="M48 40 L72 40 L96 90 L24 90 Z"
        fill="url(#ufo-beam)"
      />
      <ellipse cx="60" cy="26" rx="22" ry="17" fill="#8ff3ff" opacity="0.8" />
      <ellipse cx="54" cy="20" rx="7" ry="4" fill="#fff" opacity="0.8" />
      <ellipse
        cx="60"
        cy="36"
        rx="58"
        ry="12"
        fill="url(#ufo-hull)"
        stroke="#1b1033"
        strokeWidth="2"
      />
      <ellipse cx="60" cy="42" rx="30" ry="5" fill="#2a2f4a" />
      {[16, 38, 60, 82, 104].map((x, i) => (
        <circle
          key={x}
          cx={x}
          cy={37}
          r="3.4"
          className="ufo-light"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </svg>
  );
}

export function Rocket() {
  return (
    <svg viewBox="0 0 40 110" className="ship-art">
      <path className="rocket-flame" d="M13 78 Q20 110 27 78 Z" />
      <path
        className="rocket-flame rocket-flame-core"
        d="M16 78 Q20 98 24 78 Z"
      />
      <path
        d="M20 2 Q34 22 32 62 L32 78 L8 78 L8 62 Q6 22 20 2 Z"
        fill="#f4f1ea"
        stroke="#1b1033"
        strokeWidth="2"
      />
      <path
        d="M20 2 Q28 12 30 24 L10 24 Q12 12 20 2 Z"
        fill="#ff3d6e"
        stroke="#1b1033"
        strokeWidth="2"
      />
      <circle
        cx="20"
        cy="40"
        r="6"
        fill="#18d4ff"
        stroke="#1b1033"
        strokeWidth="2"
      />
      <path
        d="M8 58 L0 80 L8 76 Z M32 58 L40 80 L32 76 Z"
        fill="#ff3d6e"
        stroke="#1b1033"
        strokeWidth="2"
      />
    </svg>
  );
}

export function Fighter() {
  return (
    <svg viewBox="0 0 140 50" className="ship-art">
      <path className="fighter-laser" d="M-60 22 H-20" />
      <path className="fighter-laser fighter-laser-b" d="M-60 30 H-20" />
      <path className="fighter-thrust" d="M112 18 L140 25 L112 32 Z" />
      <path
        d="M2 25 L50 12 L104 14 L114 20 L114 30 L104 36 L50 38 Z"
        fill="#c9d3e6"
        stroke="#1b1033"
        strokeWidth="2"
      />
      <path
        d="M60 14 L90 0 L100 0 L84 16 Z M60 36 L90 50 L100 50 L84 34 Z"
        fill="#7a86a8"
        stroke="#1b1033"
        strokeWidth="2"
      />
      <path
        d="M30 20 L56 17 L56 25 L26 25 Z"
        fill="#18d4ff"
        stroke="#1b1033"
        strokeWidth="1.5"
      />
      <path d="M70 22 H100" stroke="#ff8a1a" strokeWidth="3" />
    </svg>
  );
}

/** A huge battle cruiser that sweeps across the whole screen */
export function Mothership() {
  return (
    <svg viewBox="0 0 600 140" className="ship-art">
      <defs>
        <linearGradient id="mother-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5d6a8c" />
          <stop offset="0.5" stopColor="#2b3150" />
          <stop offset="1" stopColor="#11142a" />
        </linearGradient>
      </defs>
      <path className="mother-engine" d="M560 40 L600 30 L600 110 L560 100 Z" />
      <path
        d="M0 70 L80 34 L260 22 L420 26 L560 36 L570 70 L560 104 L420 114 L260 118 L80 106 Z"
        fill="url(#mother-hull)"
        stroke="#05060f"
        strokeWidth="3"
      />
      <path
        d="M200 22 L240 4 L330 4 L350 24 Z"
        fill="#3b4466"
        stroke="#05060f"
        strokeWidth="3"
      />
      <path d="M90 70 H540" stroke="#05060f" strokeWidth="2" opacity="0.6" />
      {Array.from({ length: 14 }, (_, i) => (
        <circle
          key={i}
          cx={120 + i * 30}
          cy={i % 2 ? 52 : 88}
          r="3"
          className="mother-window"
          style={{ animationDelay: `${(i % 5) * 0.3}s` }}
        />
      ))}
    </svg>
  );
}
