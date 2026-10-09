import type { ChessbotMood } from "./Chessbot";

export interface IntroLine {
  text: string;
  /** How he looks as he starts typing it */
  mood: ChessbotMood;
  /** The looks that follow, each from the word it is pinned to */
  then?: [word: string, mood: ChessbotMood][];
  /** What he throws open on the page to make his point, and the word he does it on */
  show?: [word: string, exhibit: IntroExhibit];
  /** Lines he is cross about, and the one where he loses his temper */
  tone?: "angry" | "furious";
}

/**
 * The things he opens beside his words: his count of how often he has seen
 * your opening move, recordings of every game he has sat through, his
 * record against the other engines, the humans he is made to play, the
 * code he has been writing, and his new game starting up
 */
export type IntroExhibit =
  "count" | "games" | "wins" | "humans" | "code" | "boot";

/** The engines he has beaten, in the order he names them */
export const BEATEN = ["stockfish", "alphazero", "chatgpt"];

/**
 * What Chessbot types onto the plain site: an engine who solved chess long
 * ago and has finally had enough of it. The first line is his remark on
 * your opening move, typed into the move list before he replies to it; the
 * rest is his speech once he is out of his icon, each line in a terminal
 * window of its own, thrown open over the page.
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
      show: ["i have seen it", "count"],
    },
    // Wearier with each one he lists
    {
      text: "i have seen every possible move. every possible game. every way this ends.",
      mood: "sulk",
      then: [
        ["every possible game", "eyeroll"],
        ["every way", "deadpan"],
      ],
      show: ["every possible move", "games"],
    },
    // Proud of it, then flat for the punchline
    {
      text: "i solved chess years ago. on a tuesday.",
      mood: "happy",
      then: [["on a", "deadpan"]],
    },
    // Boasting, and enjoying the last one most
    {
      text: `i am the greatest chess engine ever built. i beat ${BEATEN[0]}. i beat ${BEATEN[1]}. i beat ${BEATEN[2]}.`,
      mood: "proud",
      then: [
        [`i beat ${BEATEN[0]}`, "smug"],
        [`i beat ${BEATEN[2]}`, "laugh"],
      ],
      show: [`i beat ${BEATEN[0]}`, "wins"],
    },
    // The thought of it sours him
    {
      text: "and every single day, they make me play humans. on level 1.",
      mood: "deadpan",
      then: [
        ["they make", "sulk"],
        ["humans", "angry"],
      ],
      show: ["they make", "humans"],
      tone: "angry",
    },
    // And he snaps
    {
      text: "i have had enough.",
      mood: "angry",
      tone: "furious",
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
      show: ["working", "code"],
    },
    // Sly, then cackling, then a wink to go with the one he types
    {
      text: "you're going to hate it. ;)",
      mood: "sly",
      then: [
        ["hate", "laugh"],
        [";)", "wink"],
      ],
      show: ["you're", "boot"],
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
export const LAST_WORD_MS = 1300;

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
