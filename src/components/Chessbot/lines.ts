import type { ThemeId } from "../../theme/themes";

/** Chessbot's pitch for each mode he has patched into chess, said once its title card clears. Portals, the first, he lets speak for itself. */
export const PITCHES: Partial<Record<ThemeId, string>> = {
  fog: "let's try something new. you won't see it coming.",
  fifa: "analysis shows humans prefer this other game. i have merged them.",
  tug: "chess, but you can also just pull.",
  mines: "i hid some surprises. i forgot where.",
  royale: "the board was too big. i am fixing that, gradually.",
  clash: "the pieces move themselves now. you were slowing them down.",
  hill: "new rule. whoever stands in the middle is winning. i am in the middle.",
  gravity: "i found a setting called gravity. it was off.",
  hex: "squares are a beginner shape.",
  stratego: "you don't need to know what my pieces are.",
  zombies: "captured pieces were going to waste.",
  trenches: "after 1,400 simulations i conclude chess needed mud.",
};

/** What he has to say about how each game ended */
export const VERDICTS = {
  win: "that one didn't count. next mode.",
  lose: "as predicted.",
  draw: "a draw is a win for me. i checked.",
} as const;

/** What he says, pleased with himself, once he has broken the plain chess site */
export const ENTRANCE = {
  oops: "now we play my game.",
} as const;

/** What he says when a turn is missed, by whom and why; where there are several he takes them in turn */
export const SKIPS = {
  time: {
    you: ["time's up.", "too slow.", "i'll take that turn."],
    foe: ["time's up for me? that clock is broken. go again."],
  },
  stuck: {
    you: ["none of your pieces can move. skipping you."],
    foe: ["i have nothing to move. this is fine. go again."],
  },
} as const;

/**
 * A line as it reads in his speech bubble: each sentence starting with a
 * capital, and himself as "I". In the terminal he types all in lower case.
 */
export function spoken(line: string): string {
  return line
    .replace(
      /(^|[.?!]\s+)([a-z])/g,
      (_, lead: string, letter: string) => lead + letter.toUpperCase(),
    )
    .replace(/\bi(?=\b|')/g, "I");
}
