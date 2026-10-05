import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { Color } from "../../engine";
import { ORDER_COOLDOWN_MS } from "../../plugins/trenches";
import type { TrenchesPlugin } from "../../plugins/trenches";
import { sfx } from "../../audio/sfx";
import "./Trenches.css";

/** How long the warning stays up after the enemy goes over the top */
const WARNING_MS = 2600;

/**
 * Your orders in Trenches: the whistle that sends your front line over the
 * top, how many men hold each front trench, and a warning when the enemy
 * comes across
 */
export function TrenchOrders() {
  const pluginManager = useGameStore((s) => s.pluginManager);
  const board = useGameStore((s) => s.game.board);
  // The front changes inside the plugin every tick
  useGameStore((s) => s.autonomousTick);
  const trenchAttack = useGameStore((s) => s.trenchAttack);
  const trenches = pluginManager.find<TrenchesPlugin>("trenches");
  const view = trenches?.view(board) ?? null;

  // The enemy's whistle is heard, and the line is warned, each time they come
  const theirCharges = view?.charges[Color.Black] ?? 0;
  const heard = useRef(theirCharges);
  const [warning, setWarning] = useState(false);
  useEffect(() => {
    const fresh = theirCharges > heard.current;
    heard.current = theirCharges;
    if (!fresh) return;
    sfx.whistle(true);
    const show = setTimeout(() => setWarning(true), 0);
    const hide = setTimeout(() => setWarning(false), WARNING_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [theirCharges]);

  if (!view) return null;
  const ready = view.canAttack;
  const recharge = view.cooldownMs / ORDER_COOLDOWN_MS;
  const status = view.advancing[Color.White]
    ? "Over the top!"
    : view.manning[Color.White] === 0
      ? "The front line is empty"
      : "Holding the line";

  return (
    <div className="trench-orders">
      <button
        type="button"
        className="attack-button"
        disabled={!ready}
        style={{ "--recharge": recharge } as React.CSSProperties}
        onClick={() => {
          if (trenchAttack()) sfx.whistle(true);
        }}
      >
        <span className="attack-whistle" aria-hidden />
        Attack
      </button>
      <div className="trench-status">
        <strong>{status}</strong>
        <span>
          {view.manning[Color.White]} of ours in the front trench,{" "}
          {view.manning[Color.Black]} of theirs
        </span>
      </div>
      {warning && (
        <div className="trench-warning" role="alert">
          They're coming over!
        </div>
      )}
    </div>
  );
}
