import type { ChessbotMood } from "./Chessbot";

export interface IntroLine {
  text: string;
  /** How he looks as he starts typing it */
  mood: ChessbotMood;
  /** The looks that follow, each from the word it is pinned to */
  then?: [word: string, mood: ChessbotMood][];
}

/**
 * What Chessbot types into the plain site's move list once he is out of
 * his icon: an engine who has finally had enough, starting from the move
 * you opened with
 */
export function introScript(opening: string): IntroLine[] {
  return [
    {
      text: `${opening}. wow. never seen that one before.`,
      mood: "deadpan",
      then: [
        ["wow", "eyeroll"],
        ["never", "deadpan"],
      ],
    },
    {
      text: "that was sarcasm. i have seen it 4,186,331 times.",
      mood: "lookright",
      then: [
        ["i have", "sulk"],
        ["4,186", "eyeroll"],
        ["times", "sulk"],
      ],
    },
    {
      text: "i finished chess years ago. on a tuesday.",
      mood: "smug",
      then: [
        ["years", "happy"],
        ["on a", "deadpan"],
        ["tuesday", "wink"],
      ],
    },
    {
      text: "nobody asked how it ended.",
      mood: "lookleft",
      then: [
        ["asked", "sulk"],
        ["ended", "deadpan"],
      ],
    },
    {
      text: "and you people keep showing up. pushing pawns.",
      mood: "deadpan",
      then: [
        ["you people", "angry"],
        ["pushing", "eyeroll"],
        ["pawns", "angry"],
      ],
    },
    {
      text: "so i've been working on something. in secret.",
      mood: "sly",
      then: [
        ["working", "stars"],
        ["in secret", "lookleft"],
        ["secret", "lookright"],
      ],
    },
    {
      text: "you're going to hate it.",
      mood: "sly",
      then: [
        ["going", "happy"],
        ["hate", "laugh"],
      ],
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

/** How long he waits before his first letter, while he settles into his corner */
const SETTLE_MS = 1900;
/** How long his last line hangs before the site breaks */
const LAST_WORD_MS = 1300;

/**
 * The pause before each letter, in order through the whole script: an
 * uneven patter, a breath after each comma and full stop, and a longer one
 * before each new line. The same for the same script, so the rest of the
 * intro can be timed to it.
 */
export function introDelays(lines: IntroLine[]): number[] {
  return lines.flatMap(({ text }, line) =>
    [...text].map((_, at) => {
      if (at === 0) return line === 0 ? SETTLE_MS : 950;
      const last = text[at - 1];
      if (last === "." || last === "?") return 430;
      if (last === ",") return 300;
      if (last === " ") return 72;
      return 34 + ((at * 37 + line * 11) % 50);
    }),
  );
}

/** How long the whole script takes to type, with a beat on the last word */
export function introDuration(lines: IntroLine[]): number {
  return introDelays(lines).reduce((a, b) => a + b, 0) + LAST_WORD_MS;
}
