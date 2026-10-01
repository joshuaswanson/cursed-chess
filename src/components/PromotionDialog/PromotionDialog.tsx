import { useGameStore } from "../../stores/gameStore";
import { PieceType } from "../../engine";
import { pieceImage } from "../../utils/pieceImages";
import "./PromotionDialog.css";

const PROMOTION_PIECES = [
  PieceType.Queen,
  PieceType.Rook,
  PieceType.Bishop,
  PieceType.Knight,
];

export function PromotionDialog() {
  const promotionPending = useGameStore((s) => s.promotionPending);
  const turn = useGameStore((s) => s.turn);
  const { makeMove, clearSelection } = useGameStore.getState();

  if (!promotionPending) return null;

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
              src={pieceImage({ type, color: turn })}
              alt={type}
              className="promotion-piece-img"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
