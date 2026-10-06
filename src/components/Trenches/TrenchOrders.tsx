import { memo, useEffect, useRef } from "react";
import { useGameStore } from "../../stores/gameStore";
import { Color, PieceType } from "../../engine";
import { SQUADS } from "../../plugins/trenches";
import type { TrenchesPlugin } from "../../plugins/trenches";
import { Soldier } from "../Board/Battle";
import { sfx } from "../../audio/sfx";
import "./Trenches.css";

/** Which of a squad's men stands at the front of its card: the one unlike the rest, or the first */
function leadIndex(men: PieceType[]): number {
  const odd = men.findIndex((t) => men.filter((u) => u === t).length === 1);
  return odd >= 0 ? odd : 0;
}

/** The squad standing in the card's window: drawn once, since it never changes */
const CardArt = memo(function CardArt({ men }: { men: PieceType[] }) {
  return (
    <span className="card-art" aria-hidden>
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
                "--slot": back,
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
    <div className="trench-orders" role="toolbar" aria-label="Squads">
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
            aria-label={`${squad.name}${ready ? "" : `, ready in ${Math.ceil(card.readyInMs / 1000)} seconds`}`}
            style={
              {
                "--charge": share,
                "--fan": `${(i - (SQUADS.length - 1) / 2) * 3.5}deg`,
              } as React.CSSProperties
            }
            onClick={() => trenchSend(squad.id)}
          >
            <span className="card-face">
              <CardArt men={squad.men} />
              <span className="card-charge" aria-hidden />
            </span>
            <span className="card-label" aria-hidden>
              {squad.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
