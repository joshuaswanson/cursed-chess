import { useId } from "react";
import type { ReactNode } from "react";
import "./Chessbot.css";

export type ChessbotMood =
  | "smug"
  | "proud"
  | "panic"
  | "sulk"
  | "angry"
  | "laugh"
  // Passing looks on his visor while nothing much is happening
  | "blink"
  | "wink"
  | "happy"
  | "love"
  | "stars"
  | "lookleft"
  | "lookright"
  | "deadpan"
  | "eyeroll"
  | "sly"
  // Working out his move
  | "thinking"
  // Spun about, as when gravity turns
  | "dizzy";

const INK = "#1b1033";
const EYE = "#ffffff";
const VISOR = "#14121c";
const BLUE = "#3aa7ff";
const DIM_BLUE = "#6f86a8";

/** His eyes and whatever hangs in the air around him, drawn for a visor centred on (100, 92) */
function Face({ mood, glow }: { mood: ChessbotMood; glow: string }) {
  switch (mood) {
    case "smug":
      return (
        <>
          <g
            fill="none"
            stroke={EYE}
            strokeWidth="9"
            strokeLinecap="round"
            filter={glow}
          >
            <path d="M62 102 Q74 82 86 102" />
            <path d="M114 102 Q126 82 138 102" />
          </g>
          <path
            d="M57 74 L89 82 M111 82 L143 74"
            stroke={EYE}
            strokeWidth="4.5"
            strokeLinecap="round"
            filter={glow}
          />
        </>
      );
    case "proud":
      return (
        <>
          <g
            fill="none"
            stroke={EYE}
            strokeWidth="9.5"
            strokeLinecap="round"
            filter={glow}
          >
            <path d="M61 99 Q74 76 87 99" />
            <path d="M113 99 Q126 76 139 99" />
          </g>
          <g fill="#ffd23f">
            <path d="M170 44 l2.8 6.6 l6.6 2.8 l-6.6 2.8 l-2.8 6.6 l-2.8 -6.6 l-6.6 -2.8 l6.6 -2.8 z" />
            <path d="M26 52 l2 4.6 l4.6 2 l-4.6 2 l-2 4.6 l-2 -4.6 l-4.6 -2 l4.6 -2 z" />
          </g>
        </>
      );
    case "panic":
      return (
        <>
          <g fill={EYE} filter={glow}>
            <ellipse cx="74" cy="93" rx="11" ry="14" />
            <ellipse cx="126" cy="93" rx="11" ry="14" />
          </g>
          <path
            d="M60 74 L84 68 M116 68 L140 74"
            stroke={EYE}
            strokeWidth="4.5"
            strokeLinecap="round"
            filter={glow}
          />
          <path
            d="M166 40 q8 11 0 17 q-8 -6 0 -17 z"
            fill="#8fe9ff"
            stroke={INK}
            strokeWidth="2.5"
          />
        </>
      );
    case "angry":
      return (
        <>
          <g fill="#ff5a5a" filter={glow}>
            <path d="M62 88 L86 96 v2 a12 9 0 0 1 -24 0 z" />
            <path d="M138 88 L114 96 v2 a12 9 0 0 0 24 0 z" />
          </g>
          <path
            d="M56 76 L90 88 M110 88 L144 76"
            stroke="#ff5a5a"
            strokeWidth="5.5"
            strokeLinecap="round"
            filter={glow}
          />
          {/* The anger mark: a vein standing out on his head */}
          <g
            className="chessbot-vein"
            fill="none"
            stroke="#ff3b3b"
            strokeWidth="4.5"
            strokeLinecap="round"
          >
            <path d="M152 38 q7 2 5 -6 M166 31 q-2 7 6 5 M172 45 q-7 -2 -5 6 M158 51 q2 -7 -6 -5" />
          </g>
        </>
      );
    case "laugh":
      return (
        <>
          <g
            fill="none"
            stroke={EYE}
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={glow}
          >
            <path d="M62 86 L84 95 L62 104" />
            <path d="M138 86 L116 95 L138 104" />
          </g>
          <path
            d="M57 72 L89 80 M111 80 L143 72"
            stroke={EYE}
            strokeWidth="4.5"
            strokeLinecap="round"
            filter={glow}
          />
        </>
      );
    case "lookleft":
    case "lookright":
      return (
        <g
          fill={EYE}
          filter={glow}
          transform={`translate(${mood === "lookleft" ? -17 : 17} 0)`}
        >
          <rect x="63" y="82" width="20" height="24" rx="9" />
          <rect x="117" y="82" width="20" height="24" rx="9" />
        </g>
      );
    case "deadpan":
      return (
        <>
          <g fill={EYE} filter={glow}>
            <rect x="61" y="91" width="26" height="8" rx="4" />
            <rect x="113" y="91" width="26" height="8" rx="4" />
          </g>
          <path
            d="M60 80 H88 M112 80 H140"
            stroke={EYE}
            strokeWidth="4.5"
            strokeLinecap="round"
            filter={glow}
          />
        </>
      );
    case "eyeroll":
      return (
        <>
          <g fill={EYE} filter={glow}>
            <path d="M62 86 a12 11 0 0 1 24 0 v3 h-24 z" />
            <path d="M114 86 a12 11 0 0 1 24 0 v3 h-24 z" />
          </g>
          <path
            d="M60 99 Q74 104 88 99 M112 99 Q126 104 140 99"
            fill="none"
            stroke={EYE}
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.7"
          />
        </>
      );
    case "sly":
      return (
        <>
          <path
            d="M62 92 h24 v3 a12 9 0 0 1 -24 0 z"
            fill={EYE}
            filter={glow}
          />
          <path
            d="M114 101 Q126 84 138 101"
            fill="none"
            stroke={EYE}
            strokeWidth="8.5"
            strokeLinecap="round"
            filter={glow}
          />
          <path
            d="M58 84 L90 88 M112 76 Q126 68 142 76"
            fill="none"
            stroke={EYE}
            strokeWidth="4.5"
            strokeLinecap="round"
            filter={glow}
          />
        </>
      );
    case "blink":
      return (
        <path
          d="M62 94 H86 M114 94 H138"
          stroke={EYE}
          strokeWidth="5"
          strokeLinecap="round"
          filter={glow}
        />
      );
    case "wink":
      return (
        <>
          <path
            d="M62 90 h24 v5 a12 11 0 0 1 -24 0 z"
            fill={EYE}
            filter={glow}
          />
          <path
            d="M113 97 Q126 82 139 97"
            fill="none"
            stroke={EYE}
            strokeWidth="8"
            strokeLinecap="round"
            filter={glow}
          />
        </>
      );
    case "happy":
      return (
        <g
          fill="none"
          stroke={EYE}
          strokeWidth="9.5"
          strokeLinecap="round"
          filter={glow}
        >
          <path d="M61 99 Q74 76 87 99" />
          <path d="M113 99 Q126 76 139 99" />
        </g>
      );
    case "love":
      return (
        <g fill="#ff5fa8" filter={glow}>
          <path
            d="M74 104 C56 92 62 78 74 87 C86 78 92 92 74 104 Z"
            transform="translate(72 92) scale(1.45) translate(-74 -92)"
          />
          <path
            d="M126 104 C108 92 114 78 126 87 C138 78 144 92 126 104 Z"
            transform="translate(128 92) scale(1.45) translate(-126 -92)"
          />
        </g>
      );
    case "stars":
      return (
        <g fill="#ffd23f" filter={glow}>
          <path d="M74 78 l4 9.5 l9.5 4 l-9.5 4 l-4 9.5 l-4 -9.5 l-9.5 -4 l9.5 -4 z" />
          <path d="M126 78 l4 9.5 l9.5 4 l-9.5 4 l-4 9.5 l-4 -9.5 l-9.5 -4 l9.5 -4 z" />
        </g>
      );
    case "dizzy":
      return (
        <g
          fill="none"
          stroke={EYE}
          strokeWidth="4.5"
          strokeLinecap="round"
          filter={glow}
        >
          <path
            className="chessbot-swirl"
            d="M71 93 a3 3 0 1 1 6 0 a6 6 0 1 1 -12 0 a9 9 0 1 1 18 0 a12 12 0 0 1 -12 12"
          />
          <path
            className="chessbot-swirl"
            d="M123 93 a3 3 0 1 1 6 0 a6 6 0 1 1 -12 0 a9 9 0 1 1 18 0 a12 12 0 0 1 -12 12"
          />
        </g>
      );
    case "thinking":
      return (
        <g fill={EYE} filter={glow}>
          <circle className="chessbot-dot" cx="72" cy="93" r="8.5" />
          <circle className="chessbot-dot" cx="100" cy="93" r="8.5" />
          <circle className="chessbot-dot" cx="128" cy="93" r="8.5" />
        </g>
      );
    case "sulk":
      return (
        <>
          <g fill={EYE} opacity="0.6">
            <path d="M62 92 h24 v3 a12 9 0 0 1 -24 0 z" />
            <path d="M114 92 h24 v3 a12 9 0 0 1 -24 0 z" />
          </g>
          <path
            d="M60 89 L86 82 M114 82 L140 89"
            stroke={EYE}
            strokeWidth="4.5"
            strokeLinecap="round"
            opacity="0.6"
          />
          <g fill={EYE} opacity="0.5">
            <circle cx="164" cy="48" r="2.6" />
            <circle cx="172" cy="41" r="3.2" />
            <circle cx="181" cy="33" r="3.8" />
          </g>
        </>
      );
  }
}

/** The strips torn out of him when he is rattled: how far down, how tall, how far thrown, and in which of the glitch's two colours */
const TEARS = [
  { y: 62, h: 5, dx: 10, tint: "#ff2e88" },
  { y: 79, h: 6, dx: -9, tint: "#21e6ff" },
  { y: 101, h: 4, dx: 13, tint: "#21e6ff" },
  { y: 124, h: 7, dx: -12, tint: "#ff2e88" },
  { y: 152, h: 6, dx: 8, tint: "#ff2e88" },
];

/**
 * How he carries himself in each mood: how his head leans, and how his
 * antenna stands. Both ease from one pose to the next, so a change of mood
 * never makes him jump.
 */
interface Pose {
  /** How far his head tips, in degrees, and how far it sits up or down */
  lean: number;
  lift: number;
  /** How far his antenna droops to the side, in degrees, and how tall it stands */
  droop: number;
  stretch: number;
}
const UPRIGHT: Pose = { lean: 0, lift: 0, droop: 0, stretch: 1 };
/** His usual smug tilt, kept through a blink or a wink */
const LEANING: Pose = { ...UPRIGHT, lean: 6 };
const POSE: Record<ChessbotMood, Pose> = {
  angry: UPRIGHT,
  laugh: UPRIGHT,
  deadpan: UPRIGHT,
  eyeroll: UPRIGHT,
  sly: LEANING,
  lookleft: UPRIGHT,
  lookright: UPRIGHT,
  blink: LEANING,
  wink: LEANING,
  happy: UPRIGHT,
  love: UPRIGHT,
  stars: UPRIGHT,
  smug: LEANING,
  // His antenna flops over as he reels
  dizzy: { ...UPRIGHT, droop: 38 },
  // Head up, antenna reaching
  thinking: { ...UPRIGHT, lift: -3, stretch: 1.12 },
  proud: { ...UPRIGHT, lift: -8 },
  // Standing on end
  panic: { ...UPRIGHT, stretch: 1.3 },
  // Drooping over to one side
  sulk: { lean: -8, lift: 4, droop: 62, stretch: 0.9 },
};

/**
 * Chessbot, the engine behind a very boring chess website, who decided the
 * game was the problem: a round white head with a black visor, a rook on
 * his forehead, and whatever he is feeling written in his eyes
 */
export function Chessbot({
  mood = "smug",
  says,
  grounded = true,
  className = "",
}: {
  mood?: ChessbotMood;
  /** A word or two flashed across his visor in place of his eyes */
  says?: string;
  /** Whether his shadow is drawn under him; off where he floats over a shadow of his own */
  grounded?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const glow = `url(#glow-${id})`;
  const dim = mood === "sulk";
  const { lean, lift, droop, stretch } = POSE[mood];
  const head: ReactNode = (
    <g
      className="chessbot-head"
      style={{ transform: `translateY(${lift}px) rotate(${lean}deg)` }}
    >
      <g
        className="chessbot-antenna"
        style={{ transform: `rotate(${droop}deg) scaleY(${stretch})` }}
      >
        <path
          d="M100 54 V27"
          fill="none"
          stroke={INK}
          strokeWidth="6.5"
          strokeLinecap="round"
        />
        <circle
          cx="100"
          cy="27"
          r="9"
          fill={dim ? DIM_BLUE : BLUE}
          stroke={INK}
          strokeWidth="4.5"
        />
      </g>
      <ellipse
        cx="35"
        cy="116"
        rx="11"
        ry="19"
        fill="#2a2634"
        stroke={INK}
        strokeWidth="4.5"
      />
      <ellipse
        cx="165"
        cy="116"
        rx="11"
        ry="19"
        fill="#2a2634"
        stroke={INK}
        strokeWidth="4.5"
      />
      <path
        d="M32 107 V125 M168 107 V125"
        stroke={dim ? DIM_BLUE : BLUE}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <rect
        x="36"
        y="52"
        width="128"
        height="114"
        rx="40"
        fill={`url(#shell-${id})`}
        stroke={INK}
        strokeWidth="5"
      />
      <path
        d="M54 78 Q60 64 78 60"
        fill="none"
        stroke="#fff"
        strokeWidth="5.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <g
        fill={VISOR}
        transform="translate(100 71) scale(0.56) translate(-100 -181.5)"
      >
        <path d="M88 165 h6 v4 h3.5 v-4 h5 v4 h3.5 v-4 h6 v9 h-24 z" />
        <path d="M91 175 h18 l2.5 15 h-23 z" />
        <rect x="85" y="191" width="30" height="7" rx="2.5" />
      </g>
      {/* The visor: a little screen, lit from within, with scan lines and a glare */}
      <rect
        x="50"
        y="86"
        width="100"
        height="64"
        rx="22"
        fill={`url(#screen-${id})`}
        stroke={INK}
        strokeWidth="4"
      />
      <g clipPath={`url(#visor-${id})`}>
        <rect
          x="50"
          y="86"
          width="100"
          height="64"
          fill={`url(#lines-${id})`}
        />
        <path d="M58 86 L84 86 L66 150 L46 150 Z" fill="#fff" opacity="0.07" />
      </g>
      <rect
        x="54.5"
        y="90.5"
        width="91"
        height="55"
        rx="18"
        fill="none"
        stroke="#7fb6ff"
        strokeWidth="1.5"
        opacity="0.28"
      />
      {says ? (
        <text
          className="chessbot-says"
          x="100"
          y="126"
          textAnchor="middle"
          textLength={Math.min(80, says.length * 15)}
          lengthAdjust="spacingAndGlyphs"
          fill={EYE}
          filter={glow}
        >
          {says}
        </text>
      ) : (
        <g transform="translate(100 118) scale(0.84) translate(-100 -92)">
          <Face mood={mood} glow={glow} />
        </g>
      )}
    </g>
  );
  return (
    <svg
      className={`chessbot chessbot-${mood} ${className}`}
      viewBox="0 0 200 200"
      role="img"
      aria-label="Chessbot"
    >
      <defs>
        <linearGradient id={`shell-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.6" stopColor="#f1eef5" />
          <stop offset="1" stopColor="#cfc8dc" />
        </linearGradient>
        <filter id={`glow-${id}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id={`screen-${id}`} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" stopColor="#232a4d" />
          <stop offset="0.7" stopColor="#151426" />
          <stop offset="1" stopColor="#0c0b14" />
        </radialGradient>
        <pattern
          id={`lines-${id}`}
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <rect width="4" height="1.3" fill="#9cc8ff" opacity="0.1" />
        </pattern>
        <clipPath id={`visor-${id}`}>
          <rect x="50" y="86" width="100" height="64" rx="22" />
        </clipPath>
        {TEARS.map((tear, i) => (
          <clipPath key={i} id={`tear-${i}-${id}`}>
            <rect x="0" y={tear.y} width="200" height={tear.h} />
          </clipPath>
        ))}
      </defs>
      {grounded && (
        <ellipse cx="100" cy="186" rx="44" ry="6" fill="#000" opacity="0.3" />
      )}
      {head}
      {/* Rattled, he tears sideways the way the logo does */}
      {mood === "panic" &&
        TEARS.map((tear, i) => (
          <g
            key={i}
            className={`chessbot-tear chessbot-tear-${i % 3}`}
            clipPath={`url(#tear-${i}-${id})`}
            transform={`translate(${tear.dx} 0)`}
            style={{ animationDelay: `${-i * 0.07}s` }}
          >
            {head}
            <rect
              x="20"
              y={tear.y}
              width="160"
              height={tear.h}
              fill={tear.tint}
              opacity="0.45"
            />
          </g>
        ))}
    </svg>
  );
}
