import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { useTheme } from "../../theme/useTheme";
import { Chessbot } from "./Chessbot";
import type { ChessbotMood } from "./Chessbot";
import { Color } from "../../engine";
import { ENTRANCE, PITCHES, SKIPS, VERDICTS } from "./lines";
import { useChessbot } from "./useChessbot";

/** The looks that cross his visor while he waits, a blink far the most often, and how long each holds */
const EMOTES: [ChessbotMood, number][] = [
  ["blink", 140],
  ["blink", 140],
  ["blink", 140],
  ["wink", 900],
  ["happy", 1300],
  ["love", 1300],
  ["stars", 1300],
];

/** A passing look on his visor every few seconds while nothing is happening */
function useIdleEmote(idle: boolean): ChessbotMood | null {
  const [emote, setEmote] = useState<ChessbotMood | null>(null);
  useEffect(() => {
    if (!idle) return;
    let timer: number;
    const wait = () => {
      timer = window.setTimeout(
        () => {
          const [look, ms] = EMOTES[Math.floor(Math.random() * EMOTES.length)];
          setEmote(look);
          timer = window.setTimeout(() => {
            setEmote(null);
            wait();
          }, ms);
        },
        1800 + Math.random() * 3200,
      );
    };
    wait();
    return () => {
      window.clearTimeout(timer);
      setEmote(null);
    };
  }, [idle]);
  return idle ? emote : null;
}

/** How long he talks about a missed turn */
const SKIP_LINE_MS = 3200;

/** His word on the turn that was just missed, for a few seconds after it */
function useSkipLine(): string | undefined {
  const [line, setLine] = useState<string>();
  useEffect(() => {
    let timer: number | undefined;
    const stop = useGameStore.subscribe((now, before) => {
      const skipped = now.skippedTurn;
      if (!skipped || skipped.id === before.skippedTurn?.id) return;
      window.clearTimeout(timer);
      setLine(
        SKIPS[skipped.reason][skipped.color === Color.White ? "you" : "foe"],
      );
      timer = window.setTimeout(() => setLine(undefined), SKIP_LINE_MS);
    });
    return () => {
      stop();
      window.clearTimeout(timer);
    };
  }, []);
  return line;
}

/**
 * Chessbot at home in the corner of the screen: bobbing on the spot,
 * blinking and pulling faces while he waits, hopping at whatever the game
 * does to him, and saying his piece over each title and result card
 */
export function ChessbotCorner() {
  const bot = useChessbot();
  const emote = useIdleEmote(!!bot.idle);
  const theme = useTheme();
  const announcement = useGameStore((s) => s.announcement);
  const kind = useGameStore((s) => s.announcementType);
  const entrance = useGameStore((s) => s.curseStage);
  const skipLine = useSkipLine();
  const line =
    entrance === "hello" || entrance === "glitch"
      ? ENTRANCE[entrance]
      : announcement
        ? kind === "mode"
          ? PITCHES[theme.id]
          : VERDICTS[kind]
        : skipLine;
  // Over a card, or making his entrance, he wears the look that goes with
  // it, unless the game has just rattled him
  const staged: ChessbotMood | undefined =
    entrance === "hello"
      ? "smug"
      : entrance === "glitch"
        ? "laugh"
        : !announcement
          ? undefined
          : kind === "mode"
            ? "proud"
            : kind === "win"
              ? "sulk"
              : kind === "lose"
                ? "proud"
                : "smug";
  const mood = bot.idle ? (staged ?? emote ?? bot.mood) : bot.mood;
  // A blink is only his eyes; anything else is worth a move of its own
  const act = bot.idle ? (staged ?? "idle") : bot.mood;
  const stirred = `${act}:${bot.says ?? ""}`;

  return (
    <aside className="chessbot-corner" aria-live="polite">
      {line && (
        <p className="chessbot-speech" key={line}>
          {line}
        </p>
      )}
      <div className="chessbot-float">
        <div className={`chessbot-hop is-${act}`} key={stirred}>
          <Chessbot mood={mood} says={bot.says} grounded={false} />
        </div>
        <span className="chessbot-ground" aria-hidden />
      </div>
    </aside>
  );
}
