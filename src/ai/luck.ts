import { Color } from "../engine/types";
import { TARGET_LEAD } from "./skill";

/** How many wins away from the target lead the luck leans all the way */
const LEAN_SPAN = 3;
/** How many times better one side's odds are than the other's when the luck leans all the way */
const FULL_ODDS = 2;

let lean = () => 0;

/**
 * In Story Mode the chance in each mode quietly leans toward whoever the
 * score is running against, from -1, all Chessbot's way, to 1, all the
 * player's, so the run stays close with the player about a win in front
 */
export function storyLean(playerWins: number, botWins: number): number {
  const behind = TARGET_LEAD - (playerWins - botWins);
  return Math.min(1, Math.max(-1, behind / LEAN_SPAN));
}

/** Where the lean comes from, which is 0, even, until it is set */
export function setLean(source: () => number): void {
  lean = source;
}

/** The player is White */
const toward = (color: Color) => (color === Color.White ? lean() : -lean());

/** How much likelier than even a stroke of luck for `color` is, and a stroke of bad luck its inverse */
export const fortune = (color: Color): number =>
  FULL_ODDS ** (toward(color) / 2);

/** `chance`, of something going well for `color`, leaned by the score */
export function luckyChance(chance: number, color: Color): number {
  if (chance <= 0 || chance >= 1) return chance;
  const odds = (chance / (1 - chance)) * fortune(color) ** 2;
  return odds / (1 + odds);
}

/** One of `items` at random, each as many times likelier than the rest as its weight */
export function pickWeighted<T>(
  items: readonly T[],
  weight: (item: T) => number,
): T | undefined {
  const weights = items.map(weight);
  let roll = Math.random() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}
