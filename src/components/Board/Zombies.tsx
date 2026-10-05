import { useId } from "react";
import type { PieceType } from "../../engine";
import { pieceImage, zombieImage } from "../../utils/pieceImages";
import type { ZombieAct } from "./useBoardEffects";
import {
  GRAVE_DROP_MS,
  ZOMBIE_BITE_MS,
  ZOMBIE_DELAY_MS,
  ZOMBIE_RISE_MS,
} from "./useBoardEffects";
import "./Zombies.css";

type Style = React.CSSProperties & Record<`--${string}`, string | number>;

/** How far each headstone design leans, in degrees */
const LEANS = [-6, 4, -3, 7];

/** Each headstone design's outline, standing in the earth at y 86 */
const OUTLINES = [
  "M27 86 V36 Q27 10 50 9 Q73 10 73 36 V86 Z",
  "M44 86 V42 H26 Q24 42 24 40 V29 Q24 27 26 27 H44 V8 Q44 6 46 6 H54 Q56 6 56 8 V27 H74 Q76 27 76 29 V40 Q76 42 74 42 H56 V86 Z",
  "M28 86 V40 Q28 24 50 6 Q72 24 72 40 V86 Z",
  "M24 86 V22 Q24 19 27 19 H55 L60 25 L57 30 L66 31 L71 34 Q76 35 76 38 V86 Z",
];

/** Lettering cut into the stone: a pale lip under a dark groove */
function Carved({
  x,
  y,
  size,
  text,
}: {
  x: number;
  y: number;
  size: number;
  text: string;
}) {
  return (
    <>
      <text
        x={x}
        y={y + 0.9}
        fontSize={size}
        textAnchor="middle"
        className="carving-lip"
      >
        {text}
      </text>
      <text x={x} y={y} fontSize={size} textAnchor="middle" className="carving">
        {text}
      </text>
    </>
  );
}

/** Lines of worn epitaph, too weathered to read */
function Epitaph({ x, y, widths }: { x: number; y: number; widths: number[] }) {
  return (
    <path
      d={widths
        .map((w, i) => `M${x - w / 2} ${y + i * 6} H${x + w / 2}`)
        .join(" ")}
      className="epitaph"
    />
  );
}

/** The carving and weathering particular to each headstone design */
function Details({ look }: { look: number }) {
  switch (look) {
    case 1:
      return (
        <>
          <circle cx="50" cy="34.5" r="14" className="cross-ring" />
          <circle cx="50" cy="34.5" r="16.5" className="carving-line" />
          <circle cx="50" cy="34.5" r="11.5" className="carving-line" />
          <circle cx="50" cy="34.5" r="3.2" className="carving-line" />
          <path d="M50 46 V80" className="carving-line" />
          <path d="M46 70 Q49 66 53 69 Q51 73 46 70 Z" className="lichen" />
          <path d="M27 31 Q30 28 33 31 Q30 33 27 31 Z" className="lichen" />
        </>
      );
    case 2:
      return (
        <>
          <path
            d="M34 84 V42 Q34 30 50 15 Q66 30 66 42 V84 Z"
            className="recess"
          />
          <path
            d="M50 27 C40 27 39 39 43 43 V48 H57 V43 C61 39 60 27 50 27 Z"
            className="skull"
          />
          <circle cx="46" cy="37" r="2.8" className="socket" />
          <circle cx="54" cy="37" r="2.8" className="socket" />
          <path d="M47 48 V45 M50 48 V45 M53 48 V45" className="carving-line" />
          <Epitaph x={50} y={60} widths={[22, 18, 20]} />
          <path d="M30 78 Q34 74 38 78 Q34 81 30 78 Z" className="lichen" />
        </>
      );
    case 3:
      return (
        <>
          <path
            d="M26 22 Q32 15 40 20 Q47 15 54 21 L55 24 H25 Z"
            className="moss"
          />
          <path d="M64 38 L58 50 L65 58 L59 72" className="headstone-crack" />
          <path d="M58 50 L52 53" className="headstone-crack" />
          <Carved x={44} y={42} size={11} text="1652" />
          <Epitaph x={44} y={54} widths={[26, 20]} />
          <path d="M66 70 Q70 66 74 70 Q70 73 66 70 Z" className="lichen" />
        </>
      );
    default:
      return (
        <>
          <path
            d="M32 84 V37 Q32 15 50 14 Q68 15 68 37 V84"
            className="carving-line"
          />
          <Carved x={50} y={42} size={15} text="RIP" />
          <Epitaph x={50} y={56} widths={[24, 18, 20]} />
          <path d="M64 13 L70 18 L66 20 Z" className="chip" />
          <path d="M60 74 Q64 70 68 74 Q64 77 60 74 Z" className="lichen" />
          <path d="M30 26 Q33 23 36 26 Q33 28 30 26 Z" className="lichen" />
        </>
      );
  }
}

/** A heap of freshly turned earth, lumpy along its length */
const MOUND =
  "M6 91 C6 86 11 83 16 82 C19 77 25 76 29 77 C32 72 39 71 43 73 C47 69 55 69 59 72 C63 70 70 71 73 75 C78 74 84 77 86 81 C91 82 95 86 94 90 C80 95 20 95 6 91 Z";
const MOUND_LIT =
  "M16 84 C20 79 26 79 30 80 C34 75 40 75 44 76 C48 73 55 73 58 75 C63 73 69 75 72 78 C77 77 82 79 84 83 C70 81 30 81 16 84 Z";
/** Clods of earth scattered on and around the heap */
const CLODS = [
  "M10 93 l3 -3 l3 1 l-1 3 Z",
  "M86 93 l2 -3 l4 0 l0 3 Z",
  "M24 83 l2 -3 l3 1 l0 3 Z",
  "M62 77 l3 -2 l2 2 l-2 2 Z",
  "M44 80 l2 -3 l3 2 l-2 2 Z",
  "M93 85 l2 -2 l2 2 l-2 1 Z",
];

/**
 * A grave on the board: a heap of fresh earth and a weathered headstone that
 * slams down when it is dug, trembles the round before its dead rise, and
 * sinks away once they are out
 */
export function Tombstone({
  look,
  stirring = false,
  rising = false,
}: {
  look: number;
  stirring?: boolean;
  rising?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const style: Style = {
    "--lean": `${LEANS[look] ?? 0}deg`,
    "--drop-delay": `${GRAVE_DROP_MS - 270}ms`,
    "--delay": `${ZOMBIE_DELAY_MS}ms`,
    "--rise-ms": `${ZOMBIE_RISE_MS}ms`,
  };
  const state = rising ? " rising" : stirring ? " stirring" : "";
  const outline = OUTLINES[look] ?? OUTLINES[0];
  return (
    <svg
      className={`tombstone${state}`}
      viewBox="0 0 100 100"
      style={style}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-stone`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#cdcabc" />
          <stop offset="0.55" stopColor="#a09d90" />
          <stop offset="1" stopColor="#77746a" />
        </linearGradient>
        <pattern
          id={`${id}-grain`}
          width="7"
          height="7"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1.5" cy="2" r="0.6" fill="#55524a" opacity="0.55" />
          <circle cx="5" cy="5" r="0.5" fill="#ecE8da" opacity="0.5" />
          <circle cx="4.2" cy="1.2" r="0.35" fill="#55524a" opacity="0.5" />
          <circle cx="2" cy="5.6" r="0.3" fill="#3f3d38" opacity="0.4" />
        </pattern>
        <linearGradient id={`${id}-earth`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6b4a2c" />
          <stop offset="0.5" stopColor="#4c331d" />
          <stop offset="1" stopColor="#2c1d10" />
        </linearGradient>
        <pattern
          id={`${id}-crumbs`}
          width="6"
          height="5"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="0.75" fill="#24160a" opacity="0.7" />
          <circle cx="4" cy="3.2" r="0.55" fill="#957250" opacity="0.7" />
          <circle cx="2.6" cy="4.2" r="0.4" fill="#24160a" opacity="0.5" />
        </pattern>
      </defs>
      <g className="headstone">
        <path
          d={outline}
          transform="translate(4.5 -2.5)"
          className="headstone-side"
        />
        <path
          d={outline}
          fill={`url(#${id}-stone)`}
          className="headstone-face"
        />
        <path d={outline} fill={`url(#${id}-grain)`} />
        <Details look={look} />
        {(stirring || rising) && (
          <path
            d="M50 10 L46 26 L54 36 L47 50 L55 62"
            className="headstone-crack"
          />
        )}
      </g>
      <g className="grave-mound">
        <ellipse cx="50" cy="92" rx="46" ry="5" className="grave-shadow" />
        <path d={MOUND} fill={`url(#${id}-earth)`} className="grave-earth" />
        <path d={MOUND_LIT} className="grave-lit" />
        <path d={MOUND} fill={`url(#${id}-crumbs)`} />
        <ellipse cx="34" cy="86" rx="2.4" ry="1.6" className="grave-stone" />
        <ellipse cx="66" cy="84" rx="1.8" ry="1.3" className="grave-stone" />
        <ellipse cx="52" cy="89" rx="1.4" ry="1" className="grave-stone" />
        {CLODS.map((d) => (
          <path key={d} d={d} className="grave-clod" />
        ))}
        <path
          d="M8 90 l-2 -6 M10 90 l1 -7 M12 90 l3 -5 M90 89 l-1 -6 M92 89 l2 -5"
          className="grave-grass"
        />
      </g>
    </svg>
  );
}

/** One of the undead: a rotting, twitching husk trailing flies and ooze, with whatever it did this round */
export function ZombiePiece({
  type,
  sq,
  act,
  reach,
}: {
  type: PieceType;
  sq: number;
  act: ZombieAct | undefined;
  /** Where the king it is about to bite stands, if it is next to one */
  reach?: { x: number; y: number };
}) {
  const image = zombieImage(type);
  const menacing = !act && reach !== undefined;
  const x = act?.x ?? reach?.x ?? 0;
  const y = act?.y ?? reach?.y ?? 0;
  const style: Style = {
    "--from-x": `${x}px`,
    "--from-y": `${y}px`,
    "--side-x": `${50 + Math.sign(x) * 32}%`,
    "--side-y": `${45 + Math.sign(y) * 28}%`,
    "--away": `${-Math.sign(x) || 1}`,
    "--toward": `${Math.sign(x)}`,
    "--delay": `${ZOMBIE_DELAY_MS}ms`,
    "--rise-ms": `${ZOMBIE_RISE_MS}ms`,
    "--bite-ms": `${ZOMBIE_BITE_MS}ms`,
    "--phase": `${-((sq * 0.37) % 3)}s`,
  };
  const bitten = act?.kind === "bitten" && act.was;
  return (
    <div
      className={`zombie${act ? ` zombie-${act.kind}` : ""}${menacing ? " zombie-menace" : ""}`}
      style={style}
    >
      {act?.kind === "rise" && (
        <>
          <span className="rise-clods" aria-hidden>
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </>
      )}
      <div className="zombie-body">
        {bitten && (
          <img
            className="zombie-was"
            src={pieceImage(act.was!)}
            alt=""
            draggable={false}
          />
        )}
        <div className="zombie-flesh">
          <img src={image} alt="" draggable={false} />
        </div>
        {bitten && <span className="zombie-wound" aria-hidden />}
        {bitten && (
          <span className="zombie-sweat" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        )}
      </div>
      <span className="zombie-drips" aria-hidden>
        <i />
        <i />
      </span>
      <span className="zombie-flies" aria-hidden>
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
