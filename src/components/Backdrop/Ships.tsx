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
