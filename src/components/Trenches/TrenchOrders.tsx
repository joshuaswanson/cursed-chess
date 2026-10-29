import { memo, useEffect, useRef } from "react";
import { useGameStore } from "../../stores/gameStore";
import { Color, PieceType } from "../../engine";
import { SQUADS } from "../../plugins/trenches";
import type { SquadId, TrenchesPlugin } from "../../plugins/trenches";
import { Soldier } from "../Board/Battle";
import { sfx } from "../../audio/sfx";
import "./Trenches.css";
import { t } from "../../i18n";

/** Which of a squad's men stands at the front of its card: the one unlike the rest, or the first */
function leadIndex(men: PieceType[]): number {
  const odd = men.findIndex((t) => men.filter((u) => u === t).length === 1);
  return odd >= 0 ? odd : 0;
}

/** The squad standing in the card's window: drawn once, since it never changes */
const CardArt = memo(function CardArt({ men }: { men: PieceType[] }) {
  // A squad all of one kind stands in formation: four in a diamond, a pair
  // fanned out in a V; a mixed squad has its odd man out front
  const alike = men.every((t) => t === men[0]);
  const formation = !alike
    ? "led"
    : men.length === 4
      ? "diamond"
      : men.length === 2
        ? "vee"
        : "led";
  return (
    <span className={`card-art formation-${formation}`} aria-hidden>
      {men.map((type, n) => {
        // The squad's leader is listed first unless it is all one kind; the
        // lead man is the one who sets it apart, standing at the front
        const lead = leadIndex(men);
        const back = n === lead ? -1 : n < lead ? n : n - 1;
        const slots = men.length - 1;
        return (
          <span
            key={n}
            className={`card-man ${n === lead ? "lead" : "back"}`}
            style={
              {
                // A lone man behind stands off to one side, where he shows
                "--spread": slots === 1 ? 0.55 : back - (slots - 1) / 2,
                "--slots": slots,
                "--far": Math.abs(back - (slots - 1) / 2),
              } as React.CSSProperties
            }
          >
            <Soldier type={type} color={Color.White} />
          </span>
        );
      })}
    </span>
  );
});

/** Each squad's mark, worn at the top of its card */
const SQUAD_MARKS: Record<SquadId, React.ReactNode> = {
  rifles: <path d="M3 17 L12 7 L21 17 L17.5 19.5 L12 13.5 L6.5 19.5 Z" />,
  assault: (
    <>
      <ellipse cx="11" cy="14.5" rx="6" ry="7" />
      <rect x="9" y="4" width="5" height="4" rx="1" />
      <path d="M14 5 L19 3 L19.5 5 L15 7 Z" />
      <path
        d="M5.5 12.5 H16.5 M5.5 16.5 H16.5 M11 8 V21"
        stroke="#2a2216"
        strokeWidth="1.4"
        fill="none"
      />
    </>
  ),
  guns: (
    <>
      {[3.5, 9.5, 15.5].map((x) => (
        <path
          key={x}
          d={`M${x} 19 V10 Q${x} 4.5 ${x + 2.5} 3 Q${x + 5} 4.5 ${x + 5} 10 V19 Z`}
        />
      ))}
      <rect x="2" y="13" width="20" height="3.5" rx="0.8" />
      <path
        d="M2.5 14.75 H21.5"
        stroke="#2a2216"
        strokeWidth="0.9"
        strokeDasharray="1.5 1.5"
      />
    </>
  ),
  sniper: (
    <g fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 2 V8 M12 16 V22 M2 12 H8 M16 12 H22" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </g>
  ),
};

/**
 * Your squads in Trenches: click one that is ready and its men run up to
 * your back trench. Sending any one starts every card readying again.
 */
export function TrenchOrders() {
  const pluginManager = useGameStore((s) => s.pluginManager);
  const board = useGameStore((s) => s.game.board);
  // The cards ready inside the plugin every tick
  useGameStore((s) => s.autonomousTick);
  const trenchSend = useGameStore((s) => s.trenchSend);
  const trenches = pluginManager.find<TrenchesPlugin>("trenches");
  const view = trenches?.view(board) ?? null;

  // The enemy's whistle is heard each time they come across
  const theirCharges = view?.charges[Color.Black] ?? 0;
  const heard = useRef(theirCharges);
  useEffect(() => {
    const fresh = theirCharges > heard.current;
    heard.current = theirCharges;
    if (fresh) sfx.whistle(true);
  }, [theirCharges]);

  if (!view) return null;
  return (
    <div className="trench-orders" role="toolbar" aria-label={t("Squads")}>
      {SQUADS.map((squad, i) => {
        const card = view.cards.find((c) => c.id === squad.id)!;
        const ready = card.readyInMs === 0;
        const share = 1 - card.readyInMs / squad.readyMs;
        return (
          <button
            key={squad.id}
            type="button"
            className={`squad-card${ready ? " ready" : ""}`}
            disabled={!ready}
            aria-label={
              ready
                ? t(squad.name)
                : t("{squad}, ready in {n} seconds", {
                    squad: t(squad.name),
                    n: Math.ceil(card.readyInMs / 1000),
                  })
            }
            style={
              {
                "--fan": `${(i - (SQUADS.length - 1) / 2) * 3.5}deg`,
              } as React.CSSProperties
            }
            onClick={() => trenchSend(squad.id)}
          >
            <span className="card-face">
              <CardArt men={squad.men} />
              <span
                className="card-charge"
                style={{ transform: `scaleY(${1 - share})` }}
                aria-hidden
              />
            </span>
            <span className="card-mark" aria-hidden>
              <svg viewBox="0 0 24 24">{SQUAD_MARKS[squad.id]}</svg>
            </span>
          </button>
        );
      })}
    </div>
  );
}
