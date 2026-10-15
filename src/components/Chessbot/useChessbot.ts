import { useEffect, useState } from "react";
import { Color, GameStatus, PieceType } from "../../engine";
import { useGameStore } from "../../stores/gameStore";
import type { MinefieldPlugin } from "../../plugins/minefield";
import type { ThunderstormPlugin } from "../../plugins/thunderstorm";
import type { ChessbotMood } from "./Chessbot";

interface Reaction {
  mood: ChessbotMood;
  says?: string;
  /** Nothing has stirred him lately */
  idle?: boolean;
  /** Which of his ways of showing it this is, for moods he has several of */
  variant?: number;
  /** Counts up with each reaction, so the same one twice running still counts as a new one */
  id?: number;
}

/** What his visor flashes when the game turns on him. He is too rattled to say anything else while it does. */
export const RATTLED = "UH OH";
/** How long it stays there */
export const RATTLED_MS = 2200;

/** How many different ways he has of being angry */
const ANGRY_WAYS = 5;

/** How long he cackles at you for running out of time */
const TOO_SLOW_MS = 1600;

/** How long he cackles over a mine you stepped on if the blast never finishes */
const MINE_GLOAT_MS = 4000;

/** The pieces he cannot stand to lose */
export const PRIZED: PieceType[] = [PieceType.Queen, PieceType.Rook];

/**
 * How Chessbot is taking the game: smug by default, proud of each new mode
 * and each point he takes, sulking over each one he loses, cross when you
 * take one of his pieces and rattled when it is one he prizes or you check
 * him, and cackling when he takes one of yours or one of yours finds a
 * mine, until it has gone off, or you run out of time. His visor flashes CHECK as
 * he checks you, UH OH when it goes against him, and HA HA over a prize.
 */
export function useChessbot(): Reaction {
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const cornered = useGameStore(
    (s) => s.status === GameStatus.Check && s.turn === Color.Black,
  );

  useEffect(() => {
    let timer: number | undefined;
    let gloating = false;
    let reactions = 0;
    const react = (mood: ChessbotMood, ms: number, says?: string) => {
      window.clearTimeout(timer);
      setReaction({
        mood,
        says,
        variant: Math.floor(Math.random() * ANGRY_WAYS),
        id: ++reactions,
      });
      timer = window.setTimeout(() => setReaction(null), ms);
    };
    const stop = useGameStore.subscribe((now, before) => {
      const mines = now.pluginManager.find<MinefieldPlugin>("minefield");
      if (gloating && !mines?.pendingExplosions.size) {
        gloating = false;
        window.clearTimeout(timer);
        setReaction(null);
      }
      // Gravity turns, and he is thrown about with everything else
      if (now.gravityFalling && !before.gravityFalling) {
        return react("dizzy", 2600);
      }
      // Lightning killing one of yours is the funniest thing he has seen, and one of his is a scandal
      if (now.stormStrike !== before.stormStrike) {
        const burnt = now.pluginManager
          .find<ThunderstormPlugin>("thunderstorm")
          ?.lastStrike()?.killed;
        if (burnt) {
          return burnt.color === Color.White
            ? react("laugh", 1900)
            : react("angry", 2100);
        }
      }
      const skipped = now.skippedTurn;
      if (
        skipped &&
        skipped.id !== before.skippedTurn?.id &&
        skipped.color === Color.White &&
        skipped.reason === "time"
      ) {
        return react("laugh", TOO_SLOW_MS);
      }
      if (now.scoreWhite > before.scoreWhite) return react("sulk", 5000);
      if (now.scoreBlack > before.scoreBlack) return react("proud", 4000);
      if (now.currentModeIndex !== before.currentModeIndex) {
        return react("proud", 3500);
      }
      const checked =
        now.status === GameStatus.Check &&
        (now.status !== before.status || now.turn !== before.turn);
      if (checked) {
        return now.turn === Color.White
          ? react("smug", 1800, "CHECK")
          : react("panic", RATTLED_MS, RATTLED);
      }
      if (now.moveHistory.length > before.moveHistory.length) {
        const { move } = now.moveHistory[now.moveHistory.length - 1];
        if (
          move.piece.color === Color.White &&
          mines?.pendingExplosions.has(move.to)
        ) {
          gloating = true;
          return react("laugh", MINE_GLOAT_MS);
        }
        const lost = move.captured;
        if (!lost || lost.color === move.piece.color) return;
        // You took one of his: a prized piece rattles him, anything else makes him cross
        if (move.piece.color === Color.White) {
          return PRIZED.includes(lost.type)
            ? react("panic", RATTLED_MS, RATTLED)
            : react("angry", 2100);
        }
        // He took one of yours, and finds it very funny
        react("laugh", 1900, PRIZED.includes(lost.type) ? "HA HA" : undefined);
      }
    });
    return () => {
      stop();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    reaction ?? (cornered ? { mood: "panic" } : { mood: "smug", idle: true })
  );
}
