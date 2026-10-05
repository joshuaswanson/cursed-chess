import { useEffect } from "react";

/** How far the rope gives toward whichever team is winning, in pixels at full strength */
const SHIFT_PX = 15;
/** How quickly a team's pull comes on and dies away, in seconds */
const RISE_S = 0.09;
const FALL_S = 0.32;

interface Team {
  /** How hard they are pulling right now, 0 to 1 */
  strength: number;
  /** How hard they mean to pull */
  target: number;
  /** When they next change what they are doing, in seconds */
  until: number;
}

const rest = (now: number): Team => ({
  strength: 0,
  target: 0,
  until: now + 0.3 + Math.random() * 1.6,
});

/** A team decides to heave, for a while and with a will of its own */
function startPull(team: Team, now: number): void {
  team.target = 0.55 + Math.random() * 0.45;
  team.until = now + 0.45 + Math.random() * 1.3;
}

/**
 * The idle tug of war: each team pulls on its own random timer, so sometimes
 * one heaves while the other holds and the rope gives its way, and sometimes
 * both heave at once and the rope stretches thin and shakes between them.
 * Writes the state to CSS variables on the board for the rope, flag, and
 * pieces to follow.
 */
export function useTugStruggle(
  root: React.RefObject<HTMLElement | null>,
  contested: boolean,
  flipped: boolean,
): void {
  useEffect(() => {
    const board = root.current?.closest<HTMLElement>(".board");
    if (!board) return;
    let last = performance.now() / 1000;
    const white = rest(last);
    const black = rest(last);
    let frame = 0;

    const tick = (ms: number) => {
      const now = ms / 1000;
      const dt = Math.min(0.05, now - last);
      last = now;
      for (const [team, other] of [
        [white, black],
        [black, white],
      ]) {
        if (!contested) {
          team.target = 0;
        } else if (now >= team.until) {
          if (team.target > 0) {
            team.target = 0;
            team.until = now + 0.25 + Math.random() * 1.8;
          } else {
            startPull(team, now);
            // Now and then the other side answers straight back, and both heave together
            if (other.target === 0 && Math.random() < 0.35) {
              other.until = Math.min(other.until, now + Math.random() * 0.18);
            }
          }
        }
        const tau = team.target > team.strength ? RISE_S : FALL_S;
        team.strength +=
          (team.target - team.strength) * (1 - Math.exp(-dt / tau));
      }

      const both = Math.min(white.strength, black.strength);
      const shake = both * (Math.random() - 0.5) * 3;
      const toWhite = (white.strength - black.strength) * SHIFT_PX + shake;
      const shift = flipped ? -toWhite : toWhite;
      const tension = Math.max(
        both,
        Math.max(white.strength, black.strength) * 0.25,
      );
      // A team leans back hard while it heaves and is dragged upright while the other one does
      const lean = (own: number, rival: number) =>
        9 + 11 * own - 7 * Math.max(0, rival - own);
      const squash = (own: number) => 1 - 0.08 * own;

      const s = board.style;
      s.setProperty("--rope-shift", `${shift.toFixed(2)}px`);
      // From -1, hauled fully up the screen, to 1, hauled fully down it
      s.setProperty("--rope-pull", (shift / SHIFT_PX).toFixed(3));
      s.setProperty("--rope-thin", (1 - 0.42 * tension).toFixed(3));
      s.setProperty("--rope-long", (1 + 0.04 * tension).toFixed(3));
      s.setProperty(
        "--lean-white",
        `${lean(white.strength, black.strength).toFixed(2)}deg`,
      );
      s.setProperty(
        "--lean-black",
        `${lean(black.strength, white.strength).toFixed(2)}deg`,
      );
      s.setProperty("--squash-white", squash(white.strength).toFixed(3));
      s.setProperty("--squash-black", squash(black.strength).toFixed(3));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      for (const name of [
        "--rope-shift",
        "--rope-pull",
        "--rope-thin",
        "--rope-long",
        "--lean-white",
        "--lean-black",
        "--squash-white",
        "--squash-black",
      ]) {
        board.style.removeProperty(name);
      }
    };
  }, [root, contested, flipped]);
}
