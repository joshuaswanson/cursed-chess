import { useEffect, useRef } from "react";
import { useGameStore } from "../../stores/gameStore";
import { Color } from "../../engine";
import { SQUADS } from "../../plugins/trenches";
import type { TrenchesPlugin } from "../../plugins/trenches";
import { pieceImage } from "../../utils/pieceImages";
import { sfx } from "../../audio/sfx";
import "./Trenches.css";

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
      {SQUADS.map((squad) => {
        const card = view.cards.find((c) => c.id === squad.id)!;
        const ready = card.readyInMs === 0;
        const share = 1 - card.readyInMs / squad.readyMs;
        return (
          <button
            key={squad.id}
            type="button"
            className={`squad-card${ready ? " ready" : ""}`}
            disabled={!ready}
            style={{ "--charge": share } as React.CSSProperties}
            onClick={() => trenchSend(squad.id)}
          >
            <span className="squad-men" aria-hidden>
              {squad.men.map((type, i) => (
                <img
                  key={i}
                  src={pieceImage({ type, color: Color.White })}
                  alt=""
                  draggable={false}
                />
              ))}
            </span>
            <span className="squad-name">{squad.name}</span>
            <span className="squad-time">
              {ready ? "Ready" : `${Math.ceil(card.readyInMs / 1000)}s`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
