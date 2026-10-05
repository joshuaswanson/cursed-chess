import { useEffect } from "react";

/** How far the rope gives toward whichever team is winning, in pixels at full strength */
const SHIFT_PX = 15;
/** How the pennant swings on the rope: stiffness, how fast it settles, how hard the rope's jolts kick it, and how far it can go */
const SWING_SPRING = 38;
const SWING_DAMPING = 3.5;
const SWING_KICK = 5;
const SWING_MAX = 38;
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
 * Writes the state to CSS variables on the rope's layer and the pieces on the
 * rope for them to follow.
 */
export function useTugStruggle(
  root: React.RefObject<HTMLElement | null>,
  contested: boolean,
  flipped: boolean,
): void {
  useEffect(() => {
    const layer = root.current;
    const board = layer?.closest<HTMLElement>(".board");
    if (!layer || !board) return;
    // Only the rope's layer and the pieces gripping it follow the struggle, so
    // the rest of the board is left alone every frame
    const targets = () => [
      layer,
      ...board.querySelectorAll<HTMLElement>(".rope-square .piece-img"),
    ];
    let last = performance.now() / 1000;
    // The pennant swings on its knots like a weight on a spring, kicked by the rope's jolts
    let swing = 0;
    let swingSpeed = 0;
    let ropeAt = 0;
    let ropeSpeed = 0;
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
      const steady =
        (white.strength - black.strength) * SHIFT_PX * (flipped ? -1 : 1);
      const shift = steady + shake * (flipped ? -1 : 1);

      // The rope's jolts kick the pennant the other way, and it swings back and settles
      const speed = dt > 0 ? (steady - ropeAt) / dt : 0;
      const jolt = dt > 0 ? (speed - ropeSpeed) / dt : 0;
      ropeAt = steady;
      ropeSpeed = speed;
      swingSpeed +=
        (-SWING_SPRING * swing -
          SWING_DAMPING * swingSpeed -
          jolt * SWING_KICK) *
        dt;
      swing = Math.max(
        -SWING_MAX,
        Math.min(SWING_MAX, swing + swingSpeed * dt),
      );
      const flutter = both * (Math.random() - 0.5) * 6;
      const tension = Math.max(
        both,
        Math.max(white.strength, black.strength) * 0.25,
      );
      // A team leans back hard while it heaves and is dragged upright while the other one does
      const lean = (own: number, rival: number) =>
        9 + 11 * own - 7 * Math.max(0, rival - own);
      const squash = (own: number) => 1 - 0.08 * own;

      const vars: [string, string][] = [
        ["--rope-shift", `${shift.toFixed(2)}px`],
        ["--flag-swing", `${(swing + flutter).toFixed(2)}deg`],
        // From -1, hauled fully up the screen, to 1, hauled fully down it
        ["--rope-pull", (shift / SHIFT_PX).toFixed(3)],
        ["--rope-thin", (1 - 0.42 * tension).toFixed(3)],
        ["--rope-long", (1 + 0.04 * tension).toFixed(3)],
        [
          "--lean-white",
          `${lean(white.strength, black.strength).toFixed(2)}deg`,
        ],
        [
          "--lean-black",
          `${lean(black.strength, white.strength).toFixed(2)}deg`,
        ],
        ["--squash-white", squash(white.strength).toFixed(3)],
        ["--squash-black", squash(black.strength).toFixed(3)],
      ];
      for (const el of targets()) {
        for (const [name, value] of vars) el.style.setProperty(name, value);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      for (const name of [
        "--rope-shift",
        "--flag-swing",
        "--rope-pull",
        "--rope-thin",
        "--rope-long",
        "--lean-white",
        "--lean-black",
        "--squash-white",
        "--squash-black",
      ]) {
        for (const el of targets()) el.style.removeProperty(name);
      }
    };
  }, [root, contested, flipped]);
}
