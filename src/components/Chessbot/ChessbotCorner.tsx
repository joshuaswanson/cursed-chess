import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { useTheme } from "../../theme/useTheme";
import { Chessbot } from "./Chessbot";
import type { ChessbotMood } from "./Chessbot";
import { Color } from "../../engine";
import { ENTRANCE, PITCHES, SKIPS, VERDICTS } from "./lines";
import { useChessbot } from "./useChessbot";

interface Fidget {
  /** The look on his visor, if it changes */
  look?: ChessbotMood;
  /** The little move that goes with it, if any */
  move?: string;
  ms: number;
}

/** What he gets up to while he waits, a blink far the most often */
const FIDGETS: Fidget[] = [
  { look: "blink", ms: 140 },
  { look: "blink", ms: 140 },
  { look: "blink", ms: 140 },
  { look: "blink", ms: 140 },
  { look: "wink", move: "tilt", ms: 1200 },
  { look: "happy", move: "hops", ms: 1100 },
  { look: "love", move: "sway", ms: 1700 },
  { look: "stars", move: "spin", ms: 1100 },
  { look: "lookleft", move: "peek-left", ms: 1400 },
  { look: "lookright", move: "peek-right", ms: 1400 },
  { move: "shimmy", ms: 800 },
];

/** Something to do every few seconds while nothing is happening */
function useFidget(idle: boolean): Fidget | null {
  const [fidget, setFidget] = useState<Fidget | null>(null);
  useEffect(() => {
    if (!idle) return;
    let timer: number;
    const wait = () => {
      timer = window.setTimeout(
        () => {
          const next = FIDGETS[Math.floor(Math.random() * FIDGETS.length)];
          setFidget(next);
          timer = window.setTimeout(() => {
            setFidget(null);
            wait();
          }, next.ms);
        },
        1400 + Math.random() * 2600,
      );
    };
    wait();
    return () => {
      window.clearTimeout(timer);
      setFidget(null);
    };
  }, [idle]);
  return idle ? fidget : null;
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
 * Chessbot at home in the corner of the screen: drifting on the spot,
 * blinking, pulling faces, and fidgeting while he waits, acting out
 * whatever the game does to him, and saying his piece over each title and
 * result card
 */
export function ChessbotCorner() {
  const bot = useChessbot();
  const fidget = useFidget(!!bot.idle);
  const theme = useTheme();
  const announcement = useGameStore((s) => s.announcement);
  const kind = useGameStore((s) => s.announcementType);
  const entrance = useGameStore((s) => s.curseStage);
  const skipLine = useSkipLine();
  // While the site breaks he only peeks over the bottom of the screen,
  // glancing nervously from side to side; then he comes up the rest of the way
  const peeking = entrance === "glitch";
  const [glance, setGlance] = useState(false);
  // He first appeared peeking if he turned up while the plain site was breaking
  const [peeked] = useState(() => useGameStore.getState().curseStage !== null);
  useEffect(() => {
    if (!peeking) return;
    const timer = window.setInterval(() => setGlance((g) => !g), 520);
    return () => window.clearInterval(timer);
  }, [peeking]);

  const line =
    entrance === "glitch"
      ? ENTRANCE.glitch
      : announcement
        ? kind === "mode"
          ? PITCHES[theme.id]
          : VERDICTS[kind]
        : skipLine;
  // Over a card, or making his entrance, he wears the look that goes with
  // it, unless the game has just rattled him
  const staged: ChessbotMood | undefined =
    entrance === "glitch"
      ? glance
        ? "lookleft"
        : "lookright"
      : !announcement
        ? undefined
        : kind === "mode"
          ? "proud"
          : kind === "win"
            ? "sulk"
            : kind === "lose"
              ? "proud"
              : "smug";
  const mood = bot.idle ? (staged ?? fidget?.look ?? bot.mood) : bot.mood;
  const fidgeting = bot.idle && !staged ? fidget?.move : undefined;
  // A blink is only his eyes; anything else is worth a move of its own
  const act = peeking ? "peek" : bot.idle ? (staged ?? "idle") : bot.mood;
  const stirred = `${act}:${bot.says ?? ""}`;

  return (
    <aside
      className={`chessbot-corner${peeking ? " is-peeking" : peeked ? " has-peeked" : " arrives"}`}
      aria-live="polite"
    >
      {line && (
        <p className="chessbot-speech" key={line}>
          {line}
        </p>
      )}
      <div className="chessbot-float">
        <div
          className={`chessbot-fidget${fidgeting ? ` does-${fidgeting}` : ""}`}
        >
          <div className={`chessbot-hop is-${act}`} key={stirred}>
            <Chessbot mood={mood} says={bot.says} grounded={false} />
          </div>
        </div>
        <span className="chessbot-ground" aria-hidden />
      </div>
    </aside>
  );
}
