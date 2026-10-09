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
  | "lookright";

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
          transform={`translate(${mood === "lookleft" ? -11 : 11} 0)`}
        >
          <rect x="63" y="82" width="20" height="24" rx="9" />
          <rect x="117" y="82" width="20" height="24" rx="9" />
        </g>
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
          <path d="M74 104 C56 92 62 78 74 87 C86 78 92 92 74 104 Z" />
          <path d="M126 104 C108 92 114 78 126 87 C138 78 144 92 126 104 Z" />
        </g>
      );
    case "stars":
      return (
        <g fill="#ffd23f" filter={glow}>
          <path d="M74 78 l4 9.5 l9.5 4 l-9.5 4 l-4 9.5 l-4 -9.5 l-9.5 -4 l9.5 -4 z" />
          <path d="M126 78 l4 9.5 l9.5 4 l-9.5 4 l-4 9.5 l-4 -9.5 l-9.5 -4 l9.5 -4 z" />
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

/** How he carries himself in each mood: his lean, and where his antenna ends up */
const UPRIGHT = { lean: "", tip: { x: 124, y: 28 }, bend: "112 40" };
/** His usual smug tilt, kept through a blink or a wink so his head never jumps */
const LEANING = { ...UPRIGHT, lean: "rotate(6 100 170)" };
const POSE: Record<
  ChessbotMood,
  { lean: string; tip: { x: number; y: number }; bend: string }
> = {
  angry: UPRIGHT,
  laugh: UPRIGHT,
  lookleft: UPRIGHT,
  lookright: UPRIGHT,
  blink: LEANING,
  wink: LEANING,
  happy: UPRIGHT,
  love: UPRIGHT,
  stars: UPRIGHT,
  smug: LEANING,
  proud: { ...UPRIGHT, lean: "translate(0 -8)" },
  // Standing on end
  panic: { lean: "", tip: { x: 100, y: 20 }, bend: "100 38" },
  // Drooping over to one side
  sulk: {
    lean: "translate(0 4) rotate(-8 100 170)",
    tip: { x: 130, y: 46 },
    bend: "112 24",
  },
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
  const { lean, tip, bend } = POSE[mood];
  const head: ReactNode = (
    <g transform={lean}>
      <path
        d={`M100 54 Q${bend} ${tip.x} ${tip.y}`}
        fill="none"
        stroke={INK}
        strokeWidth="6.5"
        strokeLinecap="round"
      />
      <circle
        cx={tip.x}
        cy={tip.y}
        r="9"
        fill={dim ? DIM_BLUE : BLUE}
        stroke={INK}
        strokeWidth="4.5"
      />
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
        <clipPath id={`tear-a-${id}`}>
          <rect x="0" y="79" width="200" height="6" />
        </clipPath>
        <clipPath id={`tear-b-${id}`}>
          <rect x="0" y="152" width="200" height="6" />
        </clipPath>
      </defs>
      {grounded && (
        <ellipse cx="100" cy="186" rx="44" ry="6" fill="#000" opacity="0.3" />
      )}
      {head}
      {/* Rattled, he tears sideways the way the logo does */}
      {mood === "panic" && (
        <>
          <g
            className="chessbot-tear"
            clipPath={`url(#tear-a-${id})`}
            transform="translate(-9 0)"
          >
            {head}
            <rect
              x="30"
              y="79"
              width="140"
              height="6"
              fill="#21e6ff"
              opacity="0.45"
            />
          </g>
          <g
            className="chessbot-tear chessbot-tear-b"
            clipPath={`url(#tear-b-${id})`}
            transform="translate(8 0)"
          >
            {head}
            <rect
              x="44"
              y="152"
              width="124"
              height="6"
              fill="#ff2e88"
              opacity="0.45"
            />
          </g>
        </>
      )}
    </svg>
  );
}
