import { useGameStore } from "../../stores/gameStore";
import type { TrenchView } from "../../plugins/trenches";
import { sfx } from "../../audio/sfx";
import "./Trenches.css";

/**
 * A button beside each of your trench lines that holds men, sending them
 * forward for the next trench ahead, and over a man you have picked out,
 * one that sends him forward alone
 */
export function LineOrders({
  view,
  flipped,
}: {
  view: TrenchView;
  flipped: boolean;
}) {
  const trenchAdvance = useGameStore((s) => s.trenchAdvance);
  const trenchAdvanceMan = useGameStore((s) => s.trenchAdvanceMan);
  const picked = useGameStore((s) => s.trenchPicked);
  const rowOf = (rank: number) => (flipped ? rank : 7 - rank);
  const colOf = (file: number) => (flipped ? 7 - file : file);
  return (
    <div className="line-orders">
      {view.lines.map((line) => (
        <button
          key={line.rank}
          type="button"
          className="line-order advance"
          style={{ top: `${(rowOf(line.rank) + 0.5) * 12.5}%` }}
          onClick={() => {
            if (trenchAdvance(line.rank)) sfx.whistle(true);
          }}
        >
          Advance
        </button>
      ))}
      {picked !== null && view.movable.includes(picked) && (
        <button
          type="button"
          className="line-order man-order advance"
          style={{
            left: `${(colOf(picked & 7) + 0.5) * 12.5}%`,
            top: `${rowOf(picked >> 4) * 12.5}%`,
          }}
          onClick={() => {
            if (trenchAdvanceMan(picked)) sfx.whistle(true);
          }}
        >
          Advance
        </button>
      )}
    </div>
  );
}
