import type { PieceType } from "../../engine";
import { zombieImage } from "../../utils/pieceImages";
import type { ZombieAct } from "./useBoardEffects";
import { ZOMBIE_DELAY_MS } from "./useBoardEffects";
import "./Zombies.css";

type Style = React.CSSProperties & Record<`--${string}`, string | number>;

/** A grave on the board: a mound of fresh earth and a leaning headstone, cracking open the round before its dead rise */
export function Tombstone({ stirring }: { stirring: boolean }) {
  return (
    <svg
      className={`tombstone${stirring ? " stirring" : ""}`}
      viewBox="0 0 100 100"
      aria-hidden
    >
      <ellipse cx="50" cy="80" rx="34" ry="11" className="grave-mound" />
      <path d="M22 80 Q34 70 50 72 Q66 70 78 80" className="grave-mound-lit" />
      <g className="headstone">
        <path
          d="M33 78 V40 Q33 22 50 22 Q67 22 67 40 V78 Z"
          className="headstone-face"
        />
        <path d="M37 76 V41 Q37 27 50 27" className="headstone-lit" />
        <text x="50" y="50" textAnchor="middle" className="headstone-rip">
          RIP
        </text>
        <path d="M40 60 H60 M42 66 H58" className="headstone-lines" />
        {stirring && (
          <path
            d="M50 23 L47 34 L53 42 L48 52 L54 61"
            className="headstone-crack"
          />
        )}
      </g>
    </svg>
  );
}

/** One of the undead, shambling about in a sickly green, with whatever it did this round */
export function ZombiePiece({
  type,
  act,
}: {
  type: PieceType;
  act: ZombieAct | undefined;
}) {
  const style: Style = {
    "--from-x": `${act?.x ?? 0}px`,
    "--from-y": `${act?.y ?? 0}px`,
    "--delay": `${ZOMBIE_DELAY_MS}ms`,
  };
  return (
    <div className={`zombie${act ? ` zombie-${act.kind}` : ""}`} style={style}>
      <img src={zombieImage(type)} alt="" draggable={false} />
      <span className="zombie-eyes" aria-hidden>
        <i />
        <i />
      </span>
      {act?.kind === "rise" && <span className="zombie-dirt" aria-hidden />}
      {act?.kind === "bitten" && (
        <span className="zombie-chomp" aria-hidden>
          CHOMP!
        </span>
      )}
    </div>
  );
}
