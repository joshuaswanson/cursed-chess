import { useGameStore } from "../../stores/gameStore";
import "./Reinforcements.css";

const COPY = {
  time: {
    title: "Time's up!",
    you: "Too slow!",
    foe: "The foe ran out of time. Your turn again!",
  },
  stuck: {
    title: "No moves!",
    you: "None of your pieces can move, so your turn is skipped.",
    foe: "The foe has nothing that can move. Your turn again!",
  },
};

/** Announces over the board that a side has missed its turn, and why */
export function SkipBanner() {
  const skipped = useGameStore((s) => s.skippedTurn);
  const seat = useGameStore((s) => s.seat);
  if (!skipped) return null;
  const copy = COPY[skipped.reason];
  return (
    <div
      key={skipped.id}
      className="reinforce-banner skip-banner"
      role="status"
    >
      <span className="reinforce-title">{copy.title}</span>
      <span className="reinforce-sub">
        {skipped.color === seat ? copy.you : copy.foe}
      </span>
    </div>
  );
}
