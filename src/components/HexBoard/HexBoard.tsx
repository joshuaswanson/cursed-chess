import { useCallback, useEffect, useMemo, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { Color, PieceType } from "../../engine";
import { pieceImage } from "../../utils/pieceImages";
import { isValidHex, hexColor, coordKey } from "../../engine/hex";
import type { HexCoord } from "../../engine/hex";
import { SLIDE_MS, useCaptureBurst } from "../Board/useBoardEffects";
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

/** Room left beside the board on a narrow screen */
const SCREEN_MARGIN_PX = 24;

/** How much the board shrinks so it fits a narrow screen, 1 when it already fits */
function useFitScale(width: number) {
  const measure = () =>
    Math.min(1, (window.innerWidth - SCREEN_MARGIN_PX) / width);
  const [scale, setScale] = useState(measure);
  useEffect(() => {
    const onResize = () => setScale(measure());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  });
  return scale;
}

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
const PIECE_SIZE = HEX_H * 0.82;
/** Pointer travel that turns a press on a piece into a drag */
const DRAG_THRESHOLD_PX = 6;

interface HexDrag {
  from: HexCoord;
  piece: { type: PieceType; color: Color };
  startX: number;
  startY: number;
  x: number;
  y: number;
  moving: boolean;
}

function hexUnder(x: number, y: number): HexCoord | null {
  const key = document
    .elementFromPoint(x, y)
    ?.closest("[data-hex]")
    ?.getAttribute("data-hex");
  if (!key) return null;
  const [q, r] = key.split(",").map(Number);
  return { q, r };
}

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
  const seat = useGameStore((s) => s.seat);

  const [hovered, setHovered] = useState<string | null>(null);
  const [drag, setDrag] = useState<HexDrag | null>(null);
  const fit = useFitScale(BOARD_WIDTH);
  /** The move that was made by dropping a piece, which is already where it landed */
  const [droppedId, setDroppedId] = useState<number | null>(null);
  const dropped = lastHexMove !== null && droppedId === lastHexMove.id;

  const capture = useCaptureBurst(
    lastHexMove?.captured ? coordKey(lastHexMove.to) : null,
    lastHexMove?.id ?? 0,
    dropped ? 0 : SLIDE_MS,
  );

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

  const tryMove = useCallback(
    (from: HexCoord, to: HexCoord) => {
      const moves = hexGame?.getLegalMoves(from) ?? [];
      const options = moves.filter((m) => m.to.q === to.q && m.to.r === to.r);
      if (options.length === 0) return false;
      if (options.some((m) => m.promotion)) {
        useGameStore.setState({ hexPromotionPending: { from, to } });
        return true;
      }
      makeHexMove(from, to);
      return true;
    },
    [hexGame, makeHexMove],
  );

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      setDrag((d) =>
        d
          ? {
              ...d,
              x: e.clientX,
              y: e.clientY,
              moving:
                d.moving ||
                Math.hypot(e.clientX - d.startX, e.clientY - d.startY) >
                  DRAG_THRESHOLD_PX,
            }
          : null,
      );
    };
    const onUp = (e: PointerEvent) => {
      setDrag(null);
      const target = hexUnder(e.clientX, e.clientY);
      if (!drag.moving) {
        if (target && coordKey(target) !== coordKey(drag.from)) {
          handleHexClick(target);
        }
        return;
      }
      if (!target) return;
      const next = (useGameStore.getState().lastHexMove?.id ?? 0) + 1;
      if (tryMove(drag.from, target)) setDroppedId(next);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, handleHexClick, tryMove]);

  const onCellPointerDown = (e: React.PointerEvent, coord: HexCoord) => {
    if (!hexGame || hexPromotionPending) return;
    const piece = hexGame.board.getCoord(coord);
    const isLegalTarget = legalMoveKeys.has(coordKey(coord));
    const ownPiece = piece && piece.color === hexGame.turn && turn === seat;
    if (!ownPiece || isLegalTarget) {
      handleHexClick(coord);
      return;
    }
    e.preventDefault();
    if (!selectedHex || coordKey(selectedHex) !== coordKey(coord)) {
      selectHex(coord);
    }
    setDrag({
      from: coord,
      piece,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      moving: false,
    });
  };

  if (!hexGame) return null;
  const draggingKey = drag?.moving ? coordKey(drag.from) : null;
  const burstAt = capture ? capture.sq.split(",").map(Number) : null;

  return (
    <div className="hex-board-wrapper">
      <div
        className={`hex-board${capture ? " capture-jolt" : ""}`}
        style={
          {
            width: BOARD_WIDTH,
            height: BOARD_HEIGHT,
            zoom: fit,
            "--square-size": `${HEX_H}px`,
          } as React.CSSProperties
        }
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
          if (piece) className += " hex-occupied";

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
                // Rings out from the center, used when the board assembles
                ["--ring" as string]:
                  (Math.abs(coord.q) +
                    Math.abs(coord.r) +
                    Math.abs(coord.q + coord.r)) /
                  2,
              }}
              onPointerDown={(e) => onCellPointerDown(e, coord)}
              onPointerEnter={() => setHovered(key)}
              onPointerLeave={() => setHovered((h) => (h === key ? null : h))}
            >
              {isLegalTarget && !isCapture && !piece && (
                <div className="hex-move-dot" />
              )}
            </div>
          );
        })}

        {/* Pieces sit above the tiles, so a moving piece is never clipped to one hexagon */}
        {ALL_HEXES.map((coord) => {
          const piece = hexGame.board.getCoord(coord);
          if (!piece) return null;
          const key = coordKey(coord);
          const { x, y } = hexToPixel(coord.q, coord.r);
          const arriving =
            lastHexMove !== null &&
            coordKey(lastHexMove.to) === key &&
            !dropped;
          const from = arriving
            ? hexToPixel(lastHexMove.from.q, lastHexMove.from.r)
            : null;
          return (
            <img
              key={arriving ? `${key}-${lastHexMove.id}` : key}
              data-hex-piece={key}
              className={`hex-piece${hovered === key ? " hovered" : ""}${draggingKey === key ? " lifted" : ""}`}
              src={pieceImage(piece)}
              alt={piece.color + piece.type}
              draggable={false}
              style={
                {
                  left: OFFSET_X + x - PIECE_SIZE / 2,
                  top: OFFSET_Y + y - PIECE_SIZE / 2,
                  width: PIECE_SIZE,
                  height: PIECE_SIZE,
                  ...(from && {
                    "--slide-from-x": `${from.x - x}px`,
                    "--slide-from-y": `${from.y - y}px`,
                    animation: `slide-in ${SLIDE_MS}ms ease-out`,
                  }),
                } as React.CSSProperties
              }
            />
          );
        })}

        {capture && burstAt && (
          <div
            className="hex-burst-anchor"
            style={{
              left: OFFSET_X + hexToPixel(burstAt[0], burstAt[1]).x - HEX_W / 2,
              top: OFFSET_Y + hexToPixel(burstAt[0], burstAt[1]).y - HEX_H / 2,
              width: HEX_W,
              height: HEX_H,
            }}
          >
            <div className="capture-burst" key={capture.id} aria-hidden>
              <span
                className="capture-word"
                style={
                  {
                    "--tilt": `${(capture.id % 2 ? 1 : -1) * 10}deg`,
                  } as React.CSSProperties
                }
              >
                {capture.word}
              </span>
            </div>
          </div>
        )}
      </div>

      {drag?.moving && (
        <img
          className="hex-piece-dragging"
          src={pieceImage(drag.piece)}
          alt=""
          draggable={false}
          style={{
            left: drag.x - PIECE_SIZE * fit * 0.65,
            top: drag.y - PIECE_SIZE * fit * 0.65,
            width: PIECE_SIZE * fit * 1.3,
            height: PIECE_SIZE * fit * 1.3,
          }}
        />
      )}

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
