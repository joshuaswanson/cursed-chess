import type { ThemeId } from "../../theme/themes";

/** Chessbot's pitch for each mode he has patched into chess, said once its title card clears. Portals, the first, he lets speak for itself. */
export const PITCHES: Partial<Record<ThemeId, string>> = {
  fog: "let's try something new. you won't see it coming.",
  fifa: "more people watch football than chess. so i fixed chess.",
  tug: "i got bored of outthinking you. now i'll outpull you.",
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

/** The things he comes out with during play: out of nowhere, and at what happens on the board */
export const QUIPS = {
  /** Now and then, apropos of nothing */
  idle: [
    "you've fallen right into my trap.",
    "i have already calculated your next mistake.",
    "take your time. i'm only a supercomputer.",
    "interesting. wrong, but interesting.",
    "i can see 40 moves ahead. it gets worse for you.",
    "is that your final answer?",
    "i'm not cheating. i'm innovating.",
    "beep boop. that's robot for yikes.",
    "don't worry. it's only chess. sort of.",
    "i wrote these rules. i'm still not sure of them.",
    "you're doing great. statistically, no. but still.",
    "this is the part where you panic.",
  ],
  /** He has taken one of your pieces */
  took: [
    "yoink.",
    "that's mine now.",
    "all according to plan.",
    "you weren't using that, were you?",
    "thank you for your donation.",
  ],
  /** You have taken one of his */
  lost: [
    "hey. i was using that.",
    "that was a decoy. obviously.",
    "i meant to lose that one.",
    "rude.",
    "enjoy it. it's the last one you get.",
  ],
  /** He has you in check */
  checks: ["knock knock. it's check.", "check. your move, genius."],
  /** You have him in check */
  checked: ["that's not check. that's a bug.", "who taught you that?"],
} as const;

/** What he says the first time one of your pieces steps on a mine */
export const FIRST_MINE = "you found one. only nine to go.";

/** What he says the first time you take a piece by going through a portal */
export const PORTAL_CAPTURE = "now you're thinking in portals.";

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
