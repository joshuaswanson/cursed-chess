import { useGameStore } from "../../stores/gameStore";
import type { TugOfWarPlugin } from "../../plugins/tugOfWar";

/** How far the seam moves for each square the flag has been hauled, as a share of the screen height */
const SEAM_PER_SQUARE = 0.07;

/**
 * Tug of war's backdrop: the foe's red over your blue, meeting at a zigzag
 * seam that gives ground to whichever team is winning the rope
 */
export function TugField() {
  const flag = useGameStore(
    (s) => s.pluginManager.find<TugOfWarPlugin>("tug-of-war")?.flag ?? 0,
  );
  const flipped = useGameStore((s) => s.flipped);
  // Hauling the flag toward White lets blue push up into red, and the reverse
  const toWhite = flipped ? -flag : flag;
  return (
    <div
      className="tug-field"
      style={
        {
          "--seam": `${50 - toWhite * SEAM_PER_SQUARE * 100}%`,
        } as React.CSSProperties
      }
      aria-hidden
    >
      <div className="tug-field-red" />
      <div className="tug-field-blue" />
    </div>
  );
}
