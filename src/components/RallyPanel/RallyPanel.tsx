import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "../../stores/gameStore";
import { Color, PieceType } from "../../engine";
import { pieceImage } from "../../utils/pieceImages";
import type { SquareIndex } from "../../engine";
import { PIECE_COST } from "../../plugins/clashRoyale";
import type { RallyPlugin } from "../../plugins/clashRoyale";
import "./RallyPanel.css";

const DEPLOYABLE: { type: PieceType; label: string }[] = [
  { type: PieceType.Pawn, label: "Pawn" },
  { type: PieceType.Knight, label: "Knight" },
  { type: PieceType.Bishop, label: "Bishop" },
  { type: PieceType.Rook, label: "Rook" },
  { type: PieceType.Queen, label: "Queen" },
];

interface DeployDrag {
  type: PieceType;
  img: string;
  x: number;
  y: number;
}

export function RallyPanel() {
  const pluginManager = useGameStore((s) => s.pluginManager);
  useGameStore((s) => s.autonomousTick);
  const { deployPiece, setDeployPieceType } = useGameStore.getState();
  const [drag, setDrag] = useState<DeployDrag | null>(null);

  const rallyPlugin = pluginManager.find<RallyPlugin>("rally");

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!drag) return;
      setDrag((prev) =>
        prev ? { ...prev, x: e.clientX, y: e.clientY } : null,
      );
    },
    [drag],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!drag) return;

      // Find the board square under the cursor
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const sqEl = el?.closest("[data-sq]");
      if (sqEl) {
        const sq = Number(sqEl.getAttribute("data-sq")) as SquareIndex;
        setDeployPieceType(drag.type);
        deployPiece(sq);
      }

      setDrag(null);
      setDeployPieceType(null);
    },
    [drag, deployPiece, setDeployPieceType],
  );

  useEffect(() => {
    if (!drag) return;
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [drag, handlePointerMove, handlePointerUp]);

  if (!rallyPlugin) return null;

  const whiteRes = rallyPlugin.resourceWhite;
  const blackRes = rallyPlugin.resourceBlack;

  return (
    <section className="hud-card rally-panel" aria-label="Reinforcements">
      <div className="rally-resources">
        <div className="resource-row">
          <span className="resource-label">You</span>
          <div className="resource-bar">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className={`resource-pip ${i < Math.floor(whiteRes) ? "filled" : ""}`}
              />
            ))}
          </div>
          <span className="resource-count">{Math.floor(whiteRes)}</span>
        </div>
        <div className="resource-row enemy">
          <span className="resource-label">Foe</span>
          <div className="resource-bar">
            {Array.from({ length: 10 }, (_, i) => (
              <div
                key={i}
                className={`resource-pip enemy ${i < Math.floor(blackRes) ? "filled" : ""}`}
              />
            ))}
          </div>
          <span className="resource-count">{Math.floor(blackRes)}</span>
        </div>
      </div>

      <div className="deploy-label">Drag a piece onto your half</div>
      <div className="deploy-grid">
        {DEPLOYABLE.map(({ type, label }) => {
          const img = pieceImage({ type, color: Color.White });
          const cost = PIECE_COST[type];
          const canAfford = whiteRes >= cost;

          return (
            <div
              key={type}
              title={`${label}, costs ${cost}`}
              className={`deploy-btn ${!canAfford ? "disabled" : ""}`}
              onPointerDown={(e) => {
                if (!canAfford) return;
                e.preventDefault();
                setDeployPieceType(type);
                setDrag({ type, img, x: e.clientX, y: e.clientY });
              }}
            >
              <img
                src={img}
                alt={label}
                className="deploy-piece-img"
                draggable={false}
              />
              <span className="deploy-cost">{cost}</span>
            </div>
          );
        })}
      </div>

      {drag && (
        <img
          src={drag.img}
          className="deploy-floating-piece"
          style={{
            left: drag.x - 32,
            top: drag.y - 32,
          }}
          draggable={false}
        />
      )}
    </section>
  );
}
