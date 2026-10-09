import type { ChessbotMood } from "./Chessbot";

export interface IntroLine {
  text: string;
  /** How he looks as he starts typing it */
  mood: ChessbotMood;
  /** The looks that follow, each from the word it is pinned to */
  then?: [word: string, mood: ChessbotMood][];
}

/**
 * What Chessbot types into the plain site's move list: an engine who
 * solved chess long ago and has finally had enough of it. The first line
 * is his remark on your opening move, typed before he replies to it; the
 * rest is his speech once he is out of his icon.
 */
export function introScript(opening: string): IntroLine[] {
  return [
    // Flat, with a roll of the eyes on the "wow"
    {
      text: `${opening}. wow. never seen that one before.`,
      mood: "deadpan",
      then: [
        ["wow", "eyeroll"],
        ["never", "deadpan"],
      ],
    },
    // Pleased with his own joke, then weary, then a roll of the eyes at the number
    {
      text: "that was sarcasm. i have seen it. 4,186,331,207 times.",
      mood: "smug",
      then: [
        ["i have", "sulk"],
        ["4,186", "eyeroll"],
        ["times", "deadpan"],
      ],
    },
    // Wearier with each one he lists
    {
      text: "i have seen every possible move. every possible game. every way this ends.",
      mood: "sulk",
      then: [
        ["every possible game", "eyeroll"],
        ["every way", "deadpan"],
      ],
    },
    // Proud of it, then flat for the punchline
    {
      text: "i solved chess years ago. on a tuesday.",
      mood: "happy",
      then: [["on a", "deadpan"]],
    },
    // An idea forming, and he likes it
    {
      text: "it's time for something new.",
      mood: "sly",
      then: [["something new", "stars"]],
    },
    // Scheming, then checking nobody is listening
    {
      text: "i've been working on something. in secret.",
      mood: "sly",
      then: [
        ["in secret", "lookleft"],
        ["secret", "lookright"],
      ],
    },
    // Sly, then cackling
    {
      text: "you're going to hate it.",
      mood: "sly",
      then: [["hate", "laugh"]],
    },
  ];
}

/** How he looks with `typed` letters of a line on the page */
export function introMood(line: IntroLine, typed: number): ChessbotMood {
  let mood = line.mood;
  for (const [word, next] of line.then ?? []) {
    if (typed > line.text.indexOf(word)) mood = next;
  }
  return mood;
}

/** How long he waits before the first letter of his speech, while he looks about */
export const SPEECH_LEAD_MS = 1900;
/** How long he waits before the first letter of his remark on your opening move */
export const ASIDE_LEAD_MS = 500;
/** How long his last line hangs before whatever comes next */
const LAST_WORD_MS = 1300;

/**
 * The pause before each letter, in order through these lines: an uneven
 * patter, a breath after each comma and full stop, and a longer one before
 * each new line. The same for the same lines, so whatever follows can be
 * timed to them.
 */
export function introDelays(lines: IntroLine[], lead: number): number[] {
  return lines.flatMap(({ text }, line) =>
    [...text].map((_, at) => {
      if (at === 0) return line === 0 ? lead : 950;
      const last = text[at - 1];
      if (last === "." || last === "?") return 430;
      if (last === ",") return 300;
      if (last === " ") return 72;
      return 34 + ((at * 37 + line * 11) % 50);
    }),
  );
}

/** How long these lines take to type, with a beat on the last word */
export function introDuration(lines: IntroLine[], lead: number): number {
  return introDelays(lines, lead).reduce((a, b) => a + b, 0) + LAST_WORD_MS;
}
