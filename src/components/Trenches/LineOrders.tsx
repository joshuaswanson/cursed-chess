import { useGameStore } from "../../stores/gameStore";
import type { TrenchView } from "../../plugins/trenches";
import { sfx } from "../../audio/sfx";
import "./Trenches.css";

/**
 * A button beside each of your trench lines that holds men: Attack sends
 * them over the top for the enemy's trench ahead, Advance sends them up to
 * your own line in front.
 */
export function LineOrders({
  view,
  flipped,
}: {
  view: TrenchView;
  flipped: boolean;
}) {
  const trenchAdvance = useGameStore((s) => s.trenchAdvance);
  const rowOf = (rank: number) => (flipped ? rank : 7 - rank);
  return (
    <div className="line-orders">
      {view.lines.map((line) => (
        <button
          key={line.rank}
          type="button"
          className={`line-order ${line.kind}`}
          style={{ top: `${(rowOf(line.rank) + 0.5) * 12.5}%` }}
          onClick={() => {
            if (trenchAdvance(line.rank)) sfx.whistle(true);
          }}
        >
          {line.kind === "attack" ? "Attack" : "Advance"}
        </button>
      ))}
    </div>
  );
}
