import { useEffect, useState } from "react";
import { Color } from "../../engine";
import { useGameStore } from "../../stores/gameStore";
import type { FootballPlugin } from "../../plugins/football";
import { kickFlightMs } from "../Board/useBoardEffects";
import { rankOf } from "../../utils/squareUtils";

type Mood = "erupt" | "hush" | "groan" | null;

const MOOD_MS: Record<Exclude<Mood, null>, number> = {
  erupt: 3200,
  hush: 3200,
  groan: 1300,
};

/** How far up the pitch your carrier has to be before the stands start chanting */
const CHANT_RANK = 5;

/**
 * The stadium crowd: a wave goes round now and then, the stands erupt for
 * your goals, fall quiet for theirs, groan at near misses, and chant while
 * you attack
 */
export function Stands() {
  const kick = useGameStore(
    (s) => s.pluginManager.find<FootballPlugin>("football")?.lastKick ?? null,
  );
  const attacking = useGameStore((s) => {
    const football = s.pluginManager.find<FootballPlugin>("football");
    if (!football) return false;
    const carrier = s.game.board.get(football.ball);
    return (
      carrier?.color === Color.White && rankOf(football.ball) >= CHANT_RANK
    );
  });
  const [mood, setMood] = useState<Mood>(null);

  useEffect(() => {
    if (!kick || kick.kind !== "shot") return;
    const next: Mood =
      kick.outcome === "goal"
        ? kick.color === Color.White
          ? "erupt"
          : "hush"
        : kick.color === Color.White
          ? "groan"
          : null;
    if (!next) return;
    const land = kickFlightMs(kick);
    const timers = [
      setTimeout(() => setMood(next), land),
      setTimeout(() => setMood(null), land + MOOD_MS[next]),
    ];
    return () => timers.forEach(clearTimeout);
  }, [kick]);

  const crowd = `${mood ? ` ${mood}` : ""}${attacking && !mood ? " chanting" : ""}`;
  return (
    <>
      <div className={`stand stand-far${crowd}`}>
        <span className="stand-wave" />
        {attacking &&
          !mood &&
          ["left", "right"].map((side) => (
            <span
              key={side}
              className={`stand-chant chant-${side}`}
              aria-hidden
            >
              OLÉ! OLÉ!
            </span>
          ))}
      </div>
      <div className={`stand stand-near${crowd}`}>
        <span className="stand-wave" />
      </div>
    </>
  );
}
