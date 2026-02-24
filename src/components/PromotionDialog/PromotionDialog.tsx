import { useGameStore } from "../../stores/gameStore";
import { PieceType, Color } from "../../engine";
import "./PromotionDialog.css";

const PROMOTION_PIECES = [
  PieceType.Queen,
  PieceType.Rook,
  PieceType.Bishop,
  PieceType.Knight,
];

export function PromotionDialog() {
  const { promotionPending, turn, makeMove, clearSelection } = useGameStore();

  if (!promotionPending) return null;

  const color = turn;
  const prefix = color === Color.White ? "w" : "b";

  return (
    <div className="promotion-overlay" onClick={clearSelection}>
      <div className="promotion-dialog" onClick={(e) => e.stopPropagation()}>
        {PROMOTION_PIECES.map((type) => (
          <button
            key={type}
            className="promotion-choice"
            onClick={() =>
              makeMove(promotionPending.from, promotionPending.to, type)
            }
          >
            <img
              src={`/pieces/${prefix}${type.toUpperCase()}.svg`}
              alt={type}
              className="promotion-piece-img"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
