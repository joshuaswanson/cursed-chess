import { useEffect, useRef, useState } from "react";
import type { RingCollapse } from "../../plugins/battleRoyale";
import { sfx } from "../../audio/sfx";

/** Time from the first tile breaking loose to the last one vanishing */
const COLLAPSE_MS = 2000;

/**
 * The collapse currently playing, if any. Rumbles as danger builds and
 * booms when a ring falls.
 */
export function useRingCollapse(
  collapse: RingCollapse | null,
  dangerProgress: number,
): RingCollapse | null {
  // A collapse that already happened before the board mounted is not replayed
  const [played, setPlayed] = useState(collapse);
  const active = collapse && collapse !== played ? collapse : null;
  const prevProgress = useRef(dangerProgress);

  useEffect(() => {
    if (!active) return;
    sfx.collapse();
    const timer = setTimeout(() => setPlayed(active), COLLAPSE_MS);
    return () => clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (dangerProgress > prevProgress.current) sfx.rumble(dangerProgress);
    prevProgress.current = dangerProgress;
  }, [dangerProgress]);

  return active;
}
