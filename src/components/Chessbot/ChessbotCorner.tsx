import { useEffect, useState } from "react";
import { GAME_MODES, useGameStore } from "../../stores/gameStore";
import { Chessbot } from "./Chessbot";
import type { ChessbotMood } from "./Chessbot";
import { Color, GameStatus, MoveFlag } from "../../engine";
import type { MinefieldPlugin } from "../../plugins/minefield";
import {
  ENTRANCE,
  FIRST_MINE,
  PITCHES,
  PORTAL_CAPTURE,
  QUIPS,
  SKIPS,
  VERDICTS,
  spoken,
} from "./lines";
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

/** How long a speech bubble takes to pop away */
const BUBBLE_OUT_MS = 260;
/** Lines longer than this are set on two lines */
const ONE_LINE_CHARS = 30;

/** What is in his speech bubble: the line he is saying, or the one just said while its bubble pops away */
function useBubble(line: string | undefined) {
  const [shown, setShown] = useState(line);
  useEffect(() => {
    if (line) return;
    const timer = window.setTimeout(() => setShown(undefined), BUBBLE_OUT_MS);
    return () => window.clearTimeout(timer);
  }, [line]);
  if (line && line !== shown) setShown(line);
  return { text: line ?? shown, leaving: !line };
}

/** How long a passing remark stays up, how often he reacts to the board out loud, and how long he goes between remarks of his own */
const QUIP_MS = 3400;
const QUIP_CHANCE = 0.6;
const IDLE_QUIP_MS: [number, number] = [16000, 30000];

const pick = (lines: readonly string[]) =>
  lines[Math.floor(Math.random() * lines.length)];

/**
 * The things he comes out with during play: a taunt out of nowhere every so
 * often, and something to say, more often than not, when a piece is taken
 * or a king is checked
 */
function useQuip(): string | undefined {
  const [line, setLine] = useState<string>();
  useEffect(() => {
    let clear: number | undefined;
    let idle: number | undefined;
    let saidPortals = false;
    let saidMines = false;
    let late: number | undefined;
    const say = (text: string) => {
      window.clearTimeout(clear);
      setLine(text);
      clear = window.setTimeout(() => setLine(undefined), QUIP_MS);
    };
    const muse = () => {
      const [least, most] = IDLE_QUIP_MS;
      idle = window.setTimeout(
        () => {
          const { paused, announcement, menuOpen } = useGameStore.getState();
          if (!paused && !announcement && !menuOpen) say(pick(QUIPS.idle));
          muse();
        },
        least + Math.random() * (most - least),
      );
    };
    muse();
    const stop = useGameStore.subscribe((now, before) => {
      // The first piece you take through a portal gets a nod, once an adventure
      if (now.moveHistory.length > before.moveHistory.length) {
        const { move } = now.moveHistory[now.moveHistory.length - 1];
        // The first of your pieces to find a mine gets his sympathy, a beat
        // after it goes up
        const mines = now.pluginManager.find<MinefieldPlugin>("minefield");
        if (
          !saidMines &&
          move.piece.color === Color.White &&
          mines?.pendingExplosions.has(move.to)
        ) {
          saidMines = true;
          window.clearTimeout(late);
          late = window.setTimeout(() => say(pick(FIRST_MINE)), 1100);
          return;
        }
        if (
          !saidPortals &&
          move.piece.color === Color.White &&
          move.captured &&
          move.flags & MoveFlag.Portal
        ) {
          saidPortals = true;
          say(PORTAL_CAPTURE);
          return;
        }
      }
      if (Math.random() > QUIP_CHANCE) return;
      const checked =
        now.status === GameStatus.Check &&
        (now.status !== before.status || now.turn !== before.turn);
      if (checked) {
        say(pick(now.turn === Color.White ? QUIPS.checks : QUIPS.checked));
        return;
      }
      if (now.moveHistory.length > before.moveHistory.length) {
        const { move } = now.moveHistory[now.moveHistory.length - 1];
        if (!move.captured || move.captured.color === move.piece.color) return;
        say(pick(move.piece.color === Color.White ? QUIPS.lost : QUIPS.took));
      }
    });
    return () => {
      stop();
      window.clearTimeout(clear);
      window.clearTimeout(idle);
      window.clearTimeout(late);
    };
  }, []);
  return line;
}

/** How long his pitch for a mode stays up once its title card has cleared */
const PITCH_MS = 5000;

/** His pitch for the mode that has just begun, held back until its title card is out of the way */
function usePitch(): string | undefined {
  const [line, setLine] = useState<string>();
  useEffect(() => {
    let timer: number | undefined;
    const stop = useGameStore.subscribe((now, before) => {
      const cleared =
        before.announcement !== null &&
        now.announcement === null &&
        before.announcementType === "mode";
      if (!cleared) return;
      const mode = GAME_MODES[now.currentModeIndex];
      window.clearTimeout(timer);
      setLine(mode && PITCHES[mode.theme]);
      timer = window.setTimeout(() => setLine(undefined), PITCH_MS);
    });
    return () => {
      stop();
      window.clearTimeout(timer);
    };
  }, []);
  return line;
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
      const lines =
        SKIPS[skipped.reason][skipped.color === Color.White ? "you" : "foe"];
      setLine(lines[skipped.id % lines.length]);
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
 * Chessbot where he lives: docked at the top of the panel beside the board
 * during play, and in the corner of the screen while he is breaking the
 * plain site. Drifting on the spot,
 * blinking, pulling faces, and fidgeting while he waits, acting out
 * whatever the game does to him, and saying his piece over each title and
 * result card
 */
export function ChessbotCorner({ docked = false }: { docked?: boolean }) {
  const bot = useChessbot();
  const fidget = useFidget(!!bot.idle);
  const announcement = useGameStore((s) => s.announcement);
  const kind = useGameStore((s) => s.announcementType);
  const entrance = useGameStore((s) => s.curseStage);
  const skipLine = useSkipLine();
  // How many games have been settled, so he works through his verdicts in turn
  const played = useGameStore((s) => s.scoreWhite + s.scoreBlack);
  const pitch = usePitch();
  const quip = useQuip();
  // He peeks over the bottom of the screen, glancing nervously from side to
  // side, while the site breaks and he owns up to it; then he comes up the
  // rest of the way
  const peeking = entrance === "peek";
  const [glance, setGlance] = useState(false);
  // He first appeared peeking if he turned up while the plain site was breaking
  const [peeked] = useState(() => useGameStore.getState().curseStage !== null);
  useEffect(() => {
    if (!peeking) return;
    const timer = window.setInterval(() => setGlance((g) => !g), 520);
    return () => window.clearInterval(timer);
  }, [peeking]);

  const line =
    entrance === "oops"
      ? ENTRANCE.oops
      : announcement
        ? kind === "mode"
          ? undefined
          : VERDICTS[kind][played % VERDICTS[kind].length]
        : (skipLine ?? pitch ?? quip);
  // Over a card, or making his entrance, he wears the look that goes with
  // it, unless the game has just rattled him
  const staged: ChessbotMood | undefined = peeking
    ? glance
      ? "lookleft"
      : "sly"
    : entrance === "glitch"
      ? "laugh"
      : entrance === "oops"
        ? "smug"
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

  // How many moves he has made, so each one can nudge him afresh
  const moves = useGameStore(
    (s) =>
      s.moveHistory.filter((m) => m.move.piece.color === Color.Black).length,
  );
  const bubble = useBubble(line);

  return (
    <aside
      className={
        docked
          ? "chessbot-dock"
          : `chessbot-corner${peeking ? " is-peeking" : peeked ? " has-peeked" : " arrives"}`
      }
      aria-live="polite"
    >
      {bubble.text && (
        <p
          className={`chessbot-speech${bubble.leaving ? " is-leaving" : ""}`}
          key={bubble.text}
          style={
            bubble.text.length > ONE_LINE_CHARS
              ? { maxWidth: `${Math.ceil(bubble.text.length / 2) + 4}ch` }
              : undefined
          }
        >
          {spoken(bubble.text)}
        </p>
      )}
      <div className="chessbot-float">
        {/* A little dip toward the board each time he makes a move */}
        <div className={moves > 0 ? "chessbot-nudge" : undefined} key={moves}>
          <div
            className={`chessbot-fidget${fidgeting ? ` does-${fidgeting}` : ""}`}
          >
            <div
              className={`chessbot-hop is-${act}${act === "angry" ? ` angry-${bot.variant ?? 0}` : ""}`}
              key={stirred}
            >
              <Chessbot mood={mood} says={bot.says} grounded={false} />
            </div>
          </div>
        </div>
        {/* Steam comes off him when he fumes or boils over */}
        {act === "angry" && (bot.variant ?? 0) % 3 === 0 && (
          <span className="chessbot-steam" key={stirred} aria-hidden>
            <i />
            <i />
            <i />
            <i />
          </span>
        )}
        <span className="chessbot-ground" aria-hidden />
      </div>
    </aside>
  );
}
