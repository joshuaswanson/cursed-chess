import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { useGameStore } from "../../stores/gameStore";
import { Color, PieceType } from "../../engine";
import { pieceImage } from "../../utils/pieceImages";
import { isValidHex, hexColor, coordKey } from "../../engine/hex";
import type { HexCoord } from "../../engine/hex";
import "./HexBoard.css";

/** Generate all 91 valid hex coordinates */
function allHexCoords(): HexCoord[] {
  const coords: HexCoord[] = [];
  for (let q = -5; q <= 5; q++) {
    for (let r = -5; r <= 5; r++) {
      if (isValidHex(q, r)) {
        coords.push({ q, r });
      }
    }
  }
  return coords;
}

const ALL_HEXES = allHexCoords();

const HEX_SIZE = 34; // hex radius in px
const SQRT3 = Math.sqrt(3);

function hexToPixel(q: number, r: number): { x: number; y: number } {
  return {
    x: HEX_SIZE * 1.5 * q,
    y: HEX_SIZE * (SQRT3 * 0.5 * q + SQRT3 * r),
  };
}

const BOARD_WIDTH = HEX_SIZE * 1.5 * 10 + HEX_SIZE * 2;
const BOARD_HEIGHT = HEX_SIZE * SQRT3 * 10 + HEX_SIZE * SQRT3;
const OFFSET_X = BOARD_WIDTH / 2;
const OFFSET_Y = BOARD_HEIGHT / 2;
const HEX_W = HEX_SIZE * 2;
const HEX_H = HEX_SIZE * SQRT3;

export function HexBoard() {
  const hexGame = useGameStore((s) => s.hexGame);
  const selectedHex = useGameStore((s) => s.selectedHex);
  const legalHexMoves = useGameStore((s) => s.legalHexMoves);
  const lastHexMove = useGameStore((s) => s.lastHexMove);
  const hexPromotionPending = useGameStore((s) => s.hexPromotionPending);
  const selectHex = useGameStore((s) => s.selectHex);
  const makeHexMove = useGameStore((s) => s.makeHexMove);
  const status = useGameStore((s) => s.status);
  const turn = useGameStore((s) => s.turn);

  // Animate piece movement via direct DOM manipulation
  const prevMoveRef = useRef(lastHexMove);

  useLayoutEffect(() => {
    const prev = prevMoveRef.current;
    prevMoveRef.current = lastHexMove;

    if (
      !lastHexMove ||
      (prev &&
        prev.from.q === lastHexMove.from.q &&
        prev.from.r === lastHexMove.from.r &&
        prev.to.q === lastHexMove.to.q &&
        prev.to.r === lastHexMove.to.r)
    ) {
      return;
    }

    const destKey = coordKey(lastHexMove.to);
    const el = document.querySelector(
      `[data-hex="${destKey}"] .hex-piece`,
    ) as HTMLElement | null;
    if (!el) return;

    const fromPx = hexToPixel(lastHexMove.from.q, lastHexMove.from.r);
    const toPx = hexToPixel(lastHexMove.to.q, lastHexMove.to.r);
    const dx = fromPx.x - toPx.x;
    const dy = fromPx.y - toPx.y;

    // Snap to old position without transition
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px)`;

    // Force reflow so the browser registers the initial position
    el.getBoundingClientRect();

    // Animate to final position
    el.style.transition = "transform 0.2s ease-out";
    el.style.transform = "translate(0, 0)";

    const timer = setTimeout(() => {
      el.style.transition = "";
      el.style.transform = "";
    }, 250);
    return () => clearTimeout(timer);
  }, [lastHexMove]);

  // Build sets for quick lookups
  const legalMoveKeys = useMemo(() => {
    const set = new Set<string>();
    for (const m of legalHexMoves) {
      set.add(coordKey(m.to));
    }
    return set;
  }, [legalHexMoves]);

  const legalCaptureKeys = useMemo(() => {
    const set = new Set<string>();
    for (const m of legalHexMoves) {
      if (m.captured || m.isEnPassant) {
        set.add(coordKey(m.to));
      }
    }
    return set;
  }, [legalHexMoves]);

  // Find king in check
  const kingInCheckKey = useMemo(() => {
    if (!hexGame) return null;
    if (status !== "check" && status !== "checkmate") return null;
    const king = hexGame.board.findKing(turn);
    return king ? coordKey(king) : null;
  }, [hexGame, status, turn]);

  const handleHexClick = useCallback(
    (coord: HexCoord) => {
      if (!hexGame) return;
      if (hexPromotionPending) return;

      const key = coordKey(coord);

      // If a legal move target is clicked, make the move
      if (selectedHex && legalMoveKeys.has(key)) {
        const piece = hexGame.board.getCoord(selectedHex);
        if (piece && piece.type === PieceType.Pawn) {
          const promoMoves = legalHexMoves.filter(
            (m) => m.to.q === coord.q && m.to.r === coord.r && m.promotion,
          );
          if (promoMoves.length > 0) {
            useGameStore.setState({
              hexPromotionPending: { from: selectedHex, to: coord },
            });
            return;
          }
        }
        makeHexMove(selectedHex, coord);
        return;
      }

      selectHex(coord);
    },
    [
      hexGame,
      selectedHex,
      legalMoveKeys,
      legalHexMoves,
      hexPromotionPending,
      selectHex,
      makeHexMove,
    ],
  );

  const handlePromotion = useCallback(
    (promoType: PieceType) => {
      const pending = hexPromotionPending;
      if (!pending) return;
      makeHexMove(pending.from, pending.to, promoType);
      useGameStore.setState({ hexPromotionPending: null });
    },
    [hexPromotionPending, makeHexMove],
  );

  if (!hexGame) return null;

  return (
    <div className="hex-board-wrapper">
      <div
        className="hex-board"
        style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}
      >
        {ALL_HEXES.map((coord) => {
          const { x, y } = hexToPixel(coord.q, coord.r);
          const key = coordKey(coord);
          const piece = hexGame.board.getCoord(coord);
          const color = hexColor(coord.q, coord.r);
          const isSelected =
            selectedHex &&
            selectedHex.q === coord.q &&
            selectedHex.r === coord.r;
          const isLegalTarget = legalMoveKeys.has(key);
          const isCapture = legalCaptureKeys.has(key);
          const isLastMove =
            lastHexMove &&
            ((lastHexMove.from.q === coord.q &&
              lastHexMove.from.r === coord.r) ||
              (lastHexMove.to.q === coord.q && lastHexMove.to.r === coord.r));
          const isCheck = key === kingInCheckKey;

          let className = `hex-cell hex-color-${color}`;
          if (isSelected) className += " hex-selected";
          if (isLastMove) className += " hex-last-move";
          if (isCapture && isLegalTarget) className += " hex-capture-target";
          if (isCheck) className += " hex-in-check";

          return (
            <div
              key={key}
              data-hex={key}
              className={className}
              style={{
                left: OFFSET_X + x - HEX_W / 2,
                top: OFFSET_Y + y - HEX_H / 2,
                width: HEX_W,
                height: HEX_H,
              }}
              onClick={() => handleHexClick(coord)}
            >
              {piece && (
                <img
                  className="hex-piece"
                  src={pieceImage(piece)}
                  alt={piece.color + piece.type}
                  draggable={false}
                />
              )}
              {isLegalTarget && !isCapture && !piece && (
                <div className="hex-move-dot" />
              )}
            </div>
          );
        })}
      </div>

      {/* Promotion dialog */}
      {hexPromotionPending && (
        <div className="hex-promotion-overlay">
          <div className="hex-promotion-choices">
            {[
              PieceType.Queen,
              PieceType.Rook,
              PieceType.Bishop,
              PieceType.Knight,
            ].map((pt) => (
              <button
                key={pt}
                className="hex-promotion-choice"
                onClick={() => handlePromotion(pt)}
              >
                <img
                  src={pieceImage({ type: pt, color: Color.White })}
                  alt={pt}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
