import { useRef, useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import "./MoveHistory.css";

export function MoveHistory() {
  const { moveHistory } = useGameStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moveHistory.length]);

  // Group moves into pairs (white + black)
  const pairs: { number: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moveHistory.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: moveHistory[i].san,
      black: moveHistory[i + 1]?.san,
    });
  }

  return (
    <div className="move-history" ref={scrollRef}>
      <div className="move-history-header">Moves</div>
      {pairs.length === 0 ? (
        <div className="move-history-empty">No moves yet</div>
      ) : (
        <div className="move-list">
          {pairs.map((pair) => (
            <div key={pair.number} className="move-pair">
              <span className="move-number">{pair.number}.</span>
              <span className="move-san white-move">{pair.white}</span>
              {pair.black && (
                <span className="move-san black-move">{pair.black}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
