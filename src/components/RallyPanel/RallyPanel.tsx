import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { useGameStore } from "../../stores/gameStore";
import { Color, PieceType } from "../../engine";
import type { SquareIndex } from "../../engine";
import { PIECE_COST } from "../../plugins/clashRoyale";
import type { RallyPlugin } from "../../plugins/clashRoyale";
import { pieceImage } from "../../utils/pieceImages";
import { Coach } from "../Coach/Coach";
import { centre } from "../Coach/box";
import type { Box } from "../Coach/box";
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

/**
 * Shown while you sit on a full bar before your first card: everything goes
 * dark but your half of the board and your cards, and a hand drags one out
 */
function DeployCoach({ holding }: { holding: boolean }) {
  const [reach, setReach] = useState<{ from: Box; to: Box } | null>(null);
  useLayoutEffect(() => {
    const box = (selector: string) =>
      document.querySelector(selector)?.getBoundingClientRect();
    const measure = () => {
      const from = box(".deploy-hand .deploy-card:not(.disabled)");
      const to = box(".deploy-zone-border");
      setReach(from && to ? { from, to } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const from = reach && centre(reach.from);
  const to = reach && centre(reach.to);
  return (
    <Coach
      lit={[
        { selector: ".deploy-zone-border", pad: 6 },
        { selector: ".rally-bar-you", pad: 8 },
      ]}
      tip={
        holding
          ? "Now click a square on your half"
          : "Drag a card onto your half of the board"
      }
      tipOver=".deploy-zone-border"
      tipAt={0.2}
    >
      {!holding && from && to && (
        <svg
          className="deploy-coach-hand"
          viewBox="0 0 48 56"
          style={
            {
              left: from.x,
              top: from.y,
              "--reach-x": `${to.x - from.x}px`,
              "--reach-y": `${to.y - from.y}px`,
            } as React.CSSProperties
          }
        >
          <path d="M17 3c-2.8 0-5 2.2-5 5v22l-3.2-3.4c-1.900-2-5.100-2.100-7.100-.2-1.900 1.800-2.200 4.700-.7 6.800L13 50c2.400 3.500 6.400 5.600 10.600 5.600H32c7.200 0 13-5.800 13-13V27c0-2.500-2-4.500-4.500-4.500S36 24.500 36 27v-3.500c0-2.500-2-4.500-4.500-4.500S27 21 27 23.500V21c0-2.500-2.200-4.500-5-4.500V8c0-2.800-2.200-5-5-5z" />
        </svg>
      )}
    </Coach>
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
      {rally.awaitingFirstDeploy && <DeployCoach holding={selected !== null} />}
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
