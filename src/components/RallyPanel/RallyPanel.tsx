import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "../../stores/gameStore";
import { Color, PieceType } from "../../engine";
import type { SquareIndex } from "../../engine";
import { PIECE_COST } from "../../plugins/clashRoyale";
import type { RallyPlugin } from "../../plugins/clashRoyale";
import { pieceImage } from "../../utils/pieceImages";
import "./RallyPanel.css";

const MAX_ELIXIR = 10;
const FOE_HAND_SIZE = 4;

const CARD_LABEL: Partial<Record<PieceType, string>> = {
  [PieceType.Pawn]: "Pawn",
  [PieceType.Knight]: "Knight",
  [PieceType.Bishop]: "Bishop",
  [PieceType.Rook]: "Rook",
  [PieceType.Queen]: "Queen",
};

/** Pointer travel that turns a press on a card into a drag */
const DRAG_THRESHOLD_PX = 6;

interface DeployDrag {
  type: PieceType;
  img: string;
  x: number;
  y: number;
  startX: number;
  startY: number;
  moved: boolean;
  wasSelected: boolean;
  /** Where on the card it was grabbed, so it stays under the same spot of the cursor */
  grabX: number;
  grabY: number;
}

function useRallyPlugin() {
  const pluginManager = useGameStore((s) => s.pluginManager);
  // Elixir changes inside the plugin every tick
  useGameStore((s) => s.autonomousTick);
  return pluginManager.find<RallyPlugin>("rally");
}

function ElixirMeter({
  amount,
  side,
}: {
  amount: number;
  side: "you" | "foe";
}) {
  const full = Math.floor(amount);
  return (
    <div
      className={`elixir elixir-${side}${full >= MAX_ELIXIR ? " full" : ""}`}
    >
      <span className="elixir-drop" aria-hidden>
        <span className="elixir-count">{full}</span>
      </span>
      <div
        className="elixir-bar"
        role="meter"
        aria-label={side === "you" ? "Your elixir" : "Foe elixir"}
        aria-valuemin={0}
        aria-valuemax={MAX_ELIXIR}
        aria-valuenow={full}
      >
        {Array.from({ length: MAX_ELIXIR }, (_, i) => (
          <div key={i} className={`elixir-cell${i < full ? " filled" : ""}`} />
        ))}
      </div>
    </div>
  );
}

/** The foe's side of the arena: their crown, elixir, and face-down hand */
export function FoeRallyBar() {
  const rally = useRallyPlugin();
  if (!rally) return null;
  return (
    <section
      className="rally-bar rally-bar-foe"
      aria-label="Foe reinforcements"
    >
      <img
        className="rally-crest"
        src={pieceImage({ type: PieceType.King, color: Color.Black })}
        alt=""
      />
      <ElixirMeter amount={rally.resourceBlack} side="foe" />
      <div className="foe-hand" aria-hidden>
        {Array.from({ length: FOE_HAND_SIZE }, (_, i) => (
          <span key={i} className="foe-card" />
        ))}
      </div>
    </section>
  );
}

/**
 * Your side of the arena: elixir and your cards. Drag a card onto your half,
 * or click a card and then click a square.
 */
export function YourRallyBar() {
  const rally = useRallyPlugin();
  const selected = useGameStore((s) => s.deployPieceType);
  const hand = useGameStore((s) => s.clashHand);
  const { deployPiece, setDeployPieceType } = useGameStore.getState();
  const [drag, setDrag] = useState<DeployDrag | null>(null);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!drag) return;
      setDrag((prev) =>
        prev
          ? {
              ...prev,
              x: e.clientX,
              y: e.clientY,
              moved:
                prev.moved ||
                Math.hypot(e.clientX - prev.startX, e.clientY - prev.startY) >
                  DRAG_THRESHOLD_PX,
            }
          : null,
      );
    },
    [drag],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (!drag) return;
      setDrag(null);
      if (!drag.moved) {
        setDeployPieceType(drag.wasSelected ? null : drag.type);
        return;
      }
      const sqEl = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest("[data-sq]");
      if (sqEl) {
        deployPiece(Number(sqEl.getAttribute("data-sq")) as SquareIndex);
      }
      setDeployPieceType(null);
    },
    [drag, deployPiece, setDeployPieceType],
  );

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDeployPieceType(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, setDeployPieceType]);

  useEffect(() => {
    if (!drag) return;
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [drag, handlePointerMove, handlePointerUp]);

  if (!rally) return null;
  const elixir = rally.resourceWhite;

  return (
    <section
      className="rally-bar rally-bar-you"
      aria-label="Your reinforcements"
    >
      <ElixirMeter amount={elixir} side="you" />
      {/* The card that comes into your hand when you play one */}
      <div className="deploy-next" aria-label="Next card">
        <span className="deploy-next-label">Next</span>
        <div className="deploy-card deploy-next-card" key={hand.next}>
          <img
            src={pieceImage({ type: hand.next, color: Color.White })}
            alt={CARD_LABEL[hand.next]}
            draggable={false}
          />
          <span className="deploy-cost">{PIECE_COST[hand.next]}</span>
        </div>
      </div>
      <div className={`deploy-hand${elixir >= MAX_ELIXIR ? " eager" : ""}`}>
        {hand.slots.map((type, slot) => {
          const label = CARD_LABEL[type] ?? "";
          const img = pieceImage({ type, color: Color.White });
          const cost = PIECE_COST[type];
          const canAfford = elixir >= cost;
          return (
            <div
              // A newly dealt card is a new element, so it comes in afresh
              key={`${slot}-${hand.dealt[slot]}`}
              title={`Click or drag onto your half to deploy a ${label.toLowerCase()} for ${cost} elixir`}
              className={`deploy-card${hand.dealt[slot] > 0 ? " dealt" : ""}${canAfford ? "" : " disabled"}${selected === type ? " selected" : ""}${drag?.moved && drag.type === type ? " lifted" : ""}`}
              style={{ "--slot": slot } as React.CSSProperties}
              aria-pressed={selected === type}
              onPointerDown={(e) => {
                if (!canAfford) return;
                e.preventDefault();
                setDeployPieceType(type);
                const card = e.currentTarget.getBoundingClientRect();
                setDrag({
                  grabX: e.clientX - card.left,
                  grabY: e.clientY - card.top,
                  type,
                  img,
                  x: e.clientX,
                  y: e.clientY,
                  startX: e.clientX,
                  startY: e.clientY,
                  moved: false,
                  wasSelected: selected === type,
                });
              }}
            >
              <img src={img} alt={label} draggable={false} />
              <span className="deploy-cost">{cost}</span>
            </div>
          );
        })}
      </div>
      {drag?.moved && (
        <div
          className="deploy-card deploy-floating-card"
          style={{ left: drag.x - drag.grabX, top: drag.y - drag.grabY }}
          aria-hidden
        >
          <img src={drag.img} alt="" draggable={false} />
          <span className="deploy-cost">{PIECE_COST[drag.type]}</span>
        </div>
      )}
    </section>
  );
}
