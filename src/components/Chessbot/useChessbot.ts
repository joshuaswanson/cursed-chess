import { useEffect, useState } from "react";
import { Color, GameStatus, PieceType } from "../../engine";
import { useGameStore } from "../../stores/gameStore";
import type { ChessbotMood } from "./Chessbot";

interface Reaction {
  mood: ChessbotMood;
  says?: string;
  /** Nothing has stirred him lately */
  idle?: boolean;
}

/** The pieces he cannot stand to lose */
const PRIZED: PieceType[] = [PieceType.Queen, PieceType.Rook];

/**
 * How Chessbot is taking the game: smug by default, proud of each new mode
 * and each point he takes, sulking over each one he loses, and rattled
 * when you check him or take a piece he prizes. His visor flashes CHECK as
 * he checks you and UH OH when it goes against him.
 */
export function useChessbot(): Reaction {
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const cornered = useGameStore(
    (s) => s.status === GameStatus.Check && s.turn === Color.Black,
  );

  useEffect(() => {
    let timer: number | undefined;
    const react = (mood: ChessbotMood, ms: number, says?: string) => {
      window.clearTimeout(timer);
      setReaction({ mood, says });
      timer = window.setTimeout(() => setReaction(null), ms);
    };
    const stop = useGameStore.subscribe((now, before) => {
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
          : react("panic", 1800, "UH OH");
      }
      if (now.moveHistory.length > before.moveHistory.length) {
        const { move } = now.moveHistory[now.moveHistory.length - 1];
        const lost = move.captured;
        if (
          move.piece.color === Color.White &&
          lost?.color === Color.Black &&
          PRIZED.includes(lost.type)
        ) {
          react("panic", 2200, "UH OH");
        }
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
