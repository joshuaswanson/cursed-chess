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

/** The headstone designs: a rounded RIP stone, a ringed cross, a gothic arch with a skull, and a broken slab */
function Headstone({ look }: { look: number }) {
  switch (look) {
    case 1:
      return (
        <>
          <path
            d="M43 88 V40 H22 V26 H43 V4 H57 V26 H78 V40 H57 V88 Z"
            className="headstone-face"
          />
          <circle cx="50" cy="33" r="15" className="headstone-ring" />
          <path d="M46 84 V38 M46 8 V22" className="headstone-lit" />
        </>
      );
    case 2:
      return (
        <>
          <path
            d="M27 88 V38 Q27 22 50 4 Q73 22 73 38 V88 Z"
            className="headstone-face"
          />
          <path d="M31 84 V38 Q31 25 49 10" className="headstone-lit" />
          <path
            d="M50 30 C40 30 39 42 43 46 V51 H57 V46 C61 42 60 30 50 30 Z"
            className="headstone-skull"
          />
          <circle cx="46" cy="40" r="2.6" className="headstone-socket" />
          <circle cx="54" cy="40" r="2.6" className="headstone-socket" />
          <path d="M37 64 H63 M40 71 H60" className="headstone-lines" />
        </>
      );
    case 3:
      return (
        <>
          <path
            d="M22 88 V20 H58 L63 28 L59 33 L78 36 V88 Z"
            className="headstone-face"
          />
          <path d="M26 84 V24 H56" className="headstone-lit" />
          <path
            d="M22 22 Q30 14 40 20 Q48 15 56 21 L56 24 H22 Z"
            className="headstone-moss"
          />
          <path d="M66 40 L60 52 L67 60 L61 72" className="headstone-crack" />
          <path d="M30 46 H52 M30 54 H48" className="headstone-lines" />
        </>
      );
    default:
      return (
        <>
          <path
            d="M26 88 V34 Q26 8 50 8 Q74 8 74 34 V88 Z"
            className="headstone-face"
          />
          <path d="M30 84 V34 Q30 13 50 13" className="headstone-lit" />
          <text x="50" y="44" textAnchor="middle" className="headstone-rip">
            RIP
          </text>
          <path d="M37 58 H63 M40 66 H60" className="headstone-lines" />
        </>
      );
  }
}

/**
 * A grave on the board: a mound of fresh earth and a leaning headstone that
 * slams down when it is dug, trembles the round before its dead rise, and
 * topples as they claw their way out
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
  const style: Style = {
    "--lean": `${LEANS[look] ?? 0}deg`,
    "--drop-delay": `${GRAVE_DROP_MS - 270}ms`,
    "--delay": `${ZOMBIE_DELAY_MS}ms`,
    "--rise-ms": `${ZOMBIE_RISE_MS}ms`,
  };
  const state = rising ? " rising" : stirring ? " stirring" : "";
  return (
    <svg
      className={`tombstone${state}`}
      viewBox="0 0 100 100"
      style={style}
      aria-hidden
    >
      <g className="headstone">
        <Headstone look={look} />
        {(stirring || rising) && (
          <path
            d="M50 10 L46 26 L54 36 L47 50 L55 62"
            className="headstone-crack"
          />
        )}
      </g>
      <g className="grave-mound">
        <ellipse cx="50" cy="88" rx="40" ry="11" className="grave-earth" />
        <path d="M14 88 Q30 77 50 79 Q70 77 86 88" className="grave-lit" />
        <circle cx="30" cy="90" r="2.5" className="grave-clod" />
        <circle cx="64" cy="92" r="2" className="grave-clod" />
        <circle cx="74" cy="86" r="1.6" className="grave-clod" />
      </g>
    </svg>
  );
}

/** One of the undead: a rotting, twitching husk trailing flies and ooze, with whatever it did this round */
export function ZombiePiece({
  type,
  sq,
  act,
}: {
  type: PieceType;
  sq: number;
  act: ZombieAct | undefined;
}) {
  const image = zombieImage(type);
  const x = act?.x ?? 0;
  const y = act?.y ?? 0;
  const style: Style = {
    "--from-x": `${x}px`,
    "--from-y": `${y}px`,
    "--side-x": `${50 + Math.sign(x) * 32}%`,
    "--side-y": `${45 + Math.sign(y) * 28}%`,
    "--away": `${-Math.sign(x) || 1}`,
    "--delay": `${ZOMBIE_DELAY_MS}ms`,
    "--rise-ms": `${ZOMBIE_RISE_MS}ms`,
    "--bite-ms": `${ZOMBIE_BITE_MS}ms`,
    "--phase": `${-((sq * 0.37) % 3)}s`,
  };
  const bitten = act?.kind === "bitten" && act.was;
  return (
    <div className={`zombie${act ? ` zombie-${act.kind}` : ""}`} style={style}>
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
