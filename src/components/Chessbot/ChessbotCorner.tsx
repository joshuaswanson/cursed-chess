import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { useTheme } from "../../theme/useTheme";
import { Chessbot } from "./Chessbot";
import type { ChessbotMood } from "./Chessbot";
import { PITCHES, VERDICTS } from "./lines";
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
  const line = !announcement
    ? undefined
    : kind === "mode"
      ? PITCHES[theme.id]
      : VERDICTS[kind];
  // Over a card he wears the look that goes with it, unless the game has just rattled him
  const cardMood: ChessbotMood | undefined = !announcement
    ? undefined
    : kind === "mode"
      ? "proud"
      : kind === "win"
        ? "sulk"
        : kind === "lose"
          ? "proud"
          : "smug";
  const mood = bot.idle ? (cardMood ?? emote ?? bot.mood) : bot.mood;
  // A blink is only his eyes; anything else is worth a hop
  const stirred = `${bot.idle ? (cardMood ?? "idle") : bot.mood}:${bot.says ?? ""}`;

  return (
    <aside className="chessbot-corner" aria-live="polite">
      {line && (
        <p className="chessbot-speech" key={line}>
          {line}
        </p>
      )}
      <div className="chessbot-float">
        <div className="chessbot-hop" key={stirred}>
          <Chessbot mood={mood} says={bot.says} grounded={false} />
        </div>
        <span className="chessbot-ground" aria-hidden />
      </div>
    </aside>
  );
}
