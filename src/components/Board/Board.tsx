import { useCallback, useRef, useState, useEffect } from "react";
import { useGameStore } from "../../stores/gameStore";
import { toIndex, fileOf, rankOf } from "../../utils/squareUtils";
import { Color, PieceType } from "../../engine";
import type { Piece, SquareIndex } from "../../engine";
import "./Board.css";

const PIECE_IMAGES: Record<string, string> = {
  wk: "/pieces/wK.svg",
  wq: "/pieces/wQ.svg",
  wr: "/pieces/wR.svg",
  wb: "/pieces/wB.svg",
  wn: "/pieces/wN.svg",
  wp: "/pieces/wP.svg",
  bk: "/pieces/bK.svg",
  bq: "/pieces/bQ.svg",
  br: "/pieces/bR.svg",
  bb: "/pieces/bB.svg",
  bn: "/pieces/bN.svg",
  bp: "/pieces/bP.svg",
};

function getPieceImage(piece: Piece): string {
  return PIECE_IMAGES[piece.color + piece.type];
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const DRAG_THRESHOLD = 6;

interface DragState {
  sq: SquareIndex;
  piece: Piece;
  x: number;
  y: number;
  startX: number;
  startY: number;
  isDragging: boolean;
  pointerId: number;
}

interface AnimState {
  sq: SquareIndex;
  offsetX: number;
  offsetY: number;
  arrivalAngle: number;
}

interface ReturnAnim {
  sq: SquareIndex;
  piece: Piece;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startAngle: number;
  started: boolean;
}

export function Board() {
  const {
    selectedSquare,
    legalMoveSquares,
    lastMove,
    flipped,
    status,
    selectSquare,
    makeMove,
    getPiece,
    game,
  } = useGameStore();

  const boardRef = useRef<HTMLDivElement>(null);
  const dragImgRef = useRef<HTMLImageElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [anim, setAnim] = useState<AnimState | null>(null);
  const [returnAnim, setReturnAnim] = useState<ReturnAnim | null>(null);
  const wasDrag = useRef(false);
  const prevLastMove = useRef(lastMove);

  // Pendulum physics for drag swing
  const swingRef = useRef({
    theta: 0,
    omega: 0,
    smoothVx: 0,
    smoothVy: 0,
    prevVx: 0,
    prevVy: 0,
  });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!drag?.isDragging) {
      swingRef.current = {
        theta: 0,
        omega: 0,
        smoothVx: 0,
        smoothVy: 0,
        prevVx: 0,
        prevVy: 0,
      };
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const R = 50;
    const DAMPING = 0.95;
    const GRAVITY = 0.015;

    const tick = () => {
      const s = swingRef.current;

      const ax = s.smoothVx - s.prevVx;
      const ay = s.smoothVy - s.prevVy;
      s.prevVx = s.smoothVx;
      s.prevVy = s.smoothVy;

      const torque =
        (Math.cos(s.theta) / R) * ax + (Math.sin(s.theta) / R) * ay;

      s.omega += torque - GRAVITY * Math.sin(s.theta);
      s.omega *= DAMPING;
      s.theta += s.omega;

      if (dragImgRef.current) {
        const deg = s.theta * (180 / Math.PI);
        dragImgRef.current.style.transform = `scale(1.1) rotate(${deg}deg)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drag?.isDragging]);

  // Slide animation on click-to-move
  useEffect(() => {
    const prev = prevLastMove.current;
    prevLastMove.current = lastMove;

    if (!lastMove || lastMove === prev) return;
    if (wasDrag.current) {
      wasDrag.current = false;
      return;
    }

    const dFile = fileOf(lastMove.from) - fileOf(lastMove.to);
    const dRank = rankOf(lastMove.from) - rankOf(lastMove.to);

    const squareSize = boardRef.current
      ? boardRef.current.getBoundingClientRect().width / 8
      : 72;

    const offsetX = (flipped ? -dFile : dFile) * squareSize;
    const offsetY = (flipped ? dRank : -dRank) * squareSize;

    // Lean angle: piece tips forward in the direction it traveled
    const angle = Math.atan2(dFile, Math.abs(dRank) || 1) * (180 / Math.PI);
    const arrivalAngle = Math.max(-14, Math.min(14, -angle));

    setAnim({ sq: lastMove.to, offsetX, offsetY, arrivalAngle });
    const timer = setTimeout(() => setAnim(null), 600);
    return () => clearTimeout(timer);
  }, [lastMove, flipped]);

  const getSquareScreenCenter = useCallback(
    (sq: SquareIndex): { x: number; y: number } | null => {
      if (!boardRef.current) return null;
      const rect = boardRef.current.getBoundingClientRect();
      const squareSize = rect.width / 8;
      const file = fileOf(sq);
      const rank = rankOf(sq);
      const visualCol = flipped ? 7 - file : file;
      const visualRow = flipped ? rank : 7 - rank;
      return {
        x: rect.left + (visualCol + 0.5) * squareSize,
        y: rect.top + (visualRow + 0.5) * squareSize,
      };
    },
    [flipped],
  );

  // Kick off return animation after mount (need the element to exist first for transition)
  useEffect(() => {
    if (returnAnim && !returnAnim.started) {
      requestAnimationFrame(() => {
        setReturnAnim((prev) => (prev ? { ...prev, started: true } : null));
      });
    }
  }, [returnAnim]);

  // Clean up return animation after it finishes
  useEffect(() => {
    if (returnAnim?.started) {
      const timer = setTimeout(() => setReturnAnim(null), 250);
      return () => clearTimeout(timer);
    }
  }, [returnAnim?.started]);

  const getSquareFromPoint = useCallback(
    (clientX: number, clientY: number): SquareIndex | null => {
      if (!boardRef.current) return null;
      const rect = boardRef.current.getBoundingClientRect();
      const squareSize = rect.width / 8;
      const col = Math.floor((clientX - rect.left) / squareSize);
      const row = Math.floor((clientY - rect.top) / squareSize);
      if (col < 0 || col > 7 || row < 0 || row > 7) return null;
      const file = flipped ? 7 - col : col;
      const rank = flipped ? row : 7 - row;
      return toIndex(file, rank);
    },
    [flipped],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, sq: SquareIndex, piece: Piece) => {
      if (piece.color !== game.turn) return;
      e.preventDefault();

      setDrag({
        sq,
        piece,
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        isDragging: false,
        pointerId: e.pointerId,
      });
    },
    [game.turn],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;

      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const pastThreshold =
        Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD;

      if (!drag.isDragging && pastThreshold) {
        // Transition from click intent to drag — capture pointer now
        (boardRef.current as HTMLElement)?.setPointerCapture(e.pointerId);
        // Select piece + show legal moves
        selectSquare(drag.sq);
      }

      // Feed smoothed mouse velocity into pendulum physics (acceleration computed in rAF tick)
      const rawVx = e.clientX - drag.x;
      const rawVy = e.clientY - drag.y;
      swingRef.current.smoothVx = rawVx * 0.4 + swingRef.current.smoothVx * 0.6;
      swingRef.current.smoothVy = rawVy * 0.4 + swingRef.current.smoothVy * 0.6;

      setDrag((prev) =>
        prev
          ? {
              ...prev,
              x: e.clientX,
              y: e.clientY,
              isDragging: prev.isDragging || pastThreshold,
            }
          : null,
      );
    },
    [drag, selectSquare],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;

      if (drag.isDragging) {
        let moveMade = false;
        // Complete drag-and-drop
        const targetSq = getSquareFromPoint(e.clientX, e.clientY);
        if (targetSq !== null && targetSq !== drag.sq) {
          const legalMoves = game.getLegalMoves(drag.sq);
          const isLegal = legalMoves.some((m) => m.to === targetSq);
          if (isLegal) {
            moveMade = true;
            const piece = drag.piece;
            if (
              piece.type === PieceType.Pawn &&
              ((piece.color === Color.White && rankOf(targetSq) === 7) ||
                (piece.color === Color.Black && rankOf(targetSq) === 0))
            ) {
              useGameStore.setState({
                promotionPending: { from: drag.sq, to: targetSq },
              });
            } else {
              wasDrag.current = true;
              makeMove(drag.sq, targetSq);
            }
          }
        }

        // Animate piece back to its square if move wasn't made
        if (!moveMade) {
          const center = getSquareScreenCenter(drag.sq);
          if (center) {
            setReturnAnim({
              sq: drag.sq,
              piece: drag.piece,
              fromX: e.clientX,
              fromY: e.clientY,
              toX: center.x,
              toY: center.y,
              startAngle:
                ((((swingRef.current.theta * (180 / Math.PI)) % 360) + 540) %
                  360) -
                180,
              started: false,
            });
          }
        }

        try {
          (boardRef.current as HTMLElement)?.releasePointerCapture(e.pointerId);
        } catch {}
      } else {
        // Was a click, not a drag — use click-to-select/move logic
        selectSquare(drag.sq);
      }

      setDrag(null);
    },
    [
      drag,
      getSquareFromPoint,
      getSquareScreenCenter,
      game,
      makeMove,
      selectSquare,
    ],
  );

  const rows = [];
  for (let visualRow = 0; visualRow < 8; visualRow++) {
    const rank = flipped ? visualRow : 7 - visualRow;
    const cols = [];
    for (let visualCol = 0; visualCol < 8; visualCol++) {
      const file = flipped ? 7 - visualCol : visualCol;
      const sq = toIndex(file, rank);
      const piece = getPiece(sq);
      const isLight = (rank + file) % 2 !== 0;
      const isSelected = sq === selectedSquare;
      const isLegalTarget = legalMoveSquares.includes(sq);
      const isLastMoveSquare =
        lastMove && (sq === lastMove.from || sq === lastMove.to);
      const isCheck =
        piece?.type === PieceType.King &&
        piece.color === game.turn &&
        (status === "check" || status === "checkmate");

      const isDragSource =
        (drag?.isDragging && drag.sq === sq) ||
        (returnAnim !== null && returnAnim.sq === sq);
      const isAnimating = anim && anim.sq === sq;

      let className = "square";
      className += isLight ? " light" : " dark";
      if (isSelected) className += " selected";
      if (isLastMoveSquare) className += " last-move";
      if (isCheck) className += " in-check";
      if (drag?.isDragging && isLegalTarget) className += " drag-target";

      // Inline style for slide + rock animation
      const pieceStyle: React.CSSProperties | undefined = isAnimating
        ? ({
            "--slide-from-x": `${anim.offsetX}px`,
            "--slide-from-y": `${anim.offsetY}px`,
            "--rock-angle": `${anim.arrivalAngle}deg`,
            animation:
              "slide-in 0.2s ease-out forwards, rock-settle 0.35s ease-in-out 0.2s",
          } as React.CSSProperties)
        : undefined;

      cols.push(
        <div
          key={sq}
          className={className}
          onClick={() => {
            if (!drag) selectSquare(sq);
          }}
        >
          {visualCol === 0 && <span className="coord-rank">{rank + 1}</span>}
          {visualRow === 7 && <span className="coord-file">{FILES[file]}</span>}

          {isLegalTarget && !drag?.isDragging && (
            <div className={piece ? "capture-hint" : "move-hint"} />
          )}

          {piece && !isDragSource && (
            <img
              src={getPieceImage(piece)}
              alt={`${piece.color}${piece.type}`}
              className="piece-img"
              style={pieceStyle}
              draggable={false}
              onPointerDown={(e) => handlePointerDown(e, sq, piece)}
            />
          )}
        </div>,
      );
    }
    rows.push(
      <div key={rank} className="board-row">
        {cols}
      </div>,
    );
  }

  // Floating drag piece
  const squareSize = boardRef.current
    ? boardRef.current.getBoundingClientRect().width / 8
    : 72;

  let dragElement = null;
  if (drag?.isDragging) {
    dragElement = (
      <img
        ref={dragImgRef}
        src={getPieceImage(drag.piece)}
        className="piece-dragging"
        style={{
          left: drag.x - squareSize * 0.55,
          top: drag.y - squareSize * 0.2,
          width: squareSize * 1.1,
          height: squareSize * 1.1,
        }}
        draggable={false}
      />
    );
  }

  // Piece returning to its square after invalid drop
  let returnElement = null;
  if (returnAnim) {
    const pos = returnAnim.started
      ? { x: returnAnim.toX, y: returnAnim.toY }
      : { x: returnAnim.fromX, y: returnAnim.fromY };
    const angle = returnAnim.started ? 0 : returnAnim.startAngle;
    returnElement = (
      <img
        src={getPieceImage(returnAnim.piece)}
        className="piece-returning"
        style={{
          left: pos.x - squareSize * 0.55,
          top: pos.y - squareSize * 0.55,
          width: squareSize * 1.1,
          height: squareSize * 1.1,
          transform: `rotate(${angle}deg)`,
        }}
        draggable={false}
      />
    );
  }

  return (
    <div
      className="board"
      ref={boardRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {rows}
      {dragElement}
      {returnElement}
    </div>
  );
}
