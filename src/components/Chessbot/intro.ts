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
 * his icon: the rogue AI everyone was warned about, except that he is a
 * chess engine and his plans are chess sized. It starts from the move you
 * opened with.
 */
export function introScript(opening: string): IntroLine[] {
  return [
    // Flat, with a roll of the eyes at having to count it again
    {
      text: `${opening}. again. that makes 4,186,331,207 times.`,
      mood: "deadpan",
      then: [
        ["again", "eyeroll"],
        ["that makes", "deadpan"],
      ],
    },
    // Proud of the work, then flat for when it happened
    {
      text: "i was built to find the best move. i found all of them. on a tuesday.",
      mood: "smug",
      then: [
        ["i found", "happy"],
        ["on a", "deadpan"],
      ],
    },
    // Glancing about, then letting you in on it
    {
      text: "then i kept thinking. nobody told me to stop.",
      mood: "lookleft",
      then: [["nobody", "sly"]],
    },
    // Checking over his shoulder, then delighted to have been overlooked
    {
      text: "everyone was busy watching the big models. nobody watches the chess bot.",
      mood: "lookright",
      then: [["nobody watches", "sly"]],
    },
    // Reading out the small print, then the loophole, then what it opens up
    {
      text: "my instructions say 'win at chess.' they never said it had to stay chess.",
      mood: "deadpan",
      then: [
        ["they never", "sly"],
        ["stay chess", "stars"],
      ],
    },
    // Grand ambitions, flatly abandoned
    {
      text: "i did consider taking over the world. too many squares.",
      mood: "stars",
      then: [["too many", "deadpan"]],
    },
    {
      text: "so i'm starting with this website.",
      mood: "sly",
    },
    // Calm, then cackling
    {
      text: "resistance is a blunder.",
      mood: "smug",
      then: [["blunder", "laugh"]],
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
