import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { pieceImage } from "../../utils/pieceImages";
import { PIECE_SIZE } from "./usePieceDrag";
import type { DragState, ReturnAnim } from "./usePieceDrag";

/** The piece held by the cursor, held at the point where it was grabbed */
export function DraggedPiece({
  drag,
  imgRef,
  squareSize,
}: {
  drag: DragState;
  imgRef: RefObject<HTMLImageElement | null>;
  squareSize: number;
}) {
  const size = squareSize * PIECE_SIZE;
  const pull = drag.pull;
  // Lives on the body so board transforms never pull it away from the cursor
  return createPortal(
    <img
      ref={imgRef}
      src={pieceImage(drag.piece)}
      className={`piece-dragging${pull ? ` portal-${pull.color}` : ""}`}
      style={{
        ...(pull && {
          filter:
            `brightness(${1 + pull.strength * 0.5}) ` +
            `drop-shadow(0 0 ${4 + pull.strength * 12}px rgba(var(--p-glow), ${pull.strength})) ` +
            "drop-shadow(2px 4px 8px rgba(0, 0, 0, 0.6))",
        }),
        left: drag.x - drag.grabX * size,
        top: drag.y - drag.grabY * size,
        width: size,
        height: size,
        transformOrigin: `${drag.grabX * 100}% ${drag.grabY * 100}%`,
      }}
      draggable={false}
    />,
    document.body,
  );
}

/** A piece dropped on an illegal square, flying back to where it came from */
export function ReturningPiece({
  anim,
  squareSize,
}: {
  anim: ReturnAnim;
  squareSize: number;
}) {
  const home = anim.started;
  const x = home ? anim.toX : anim.fromX;
  const y = home ? anim.toY : anim.fromY;
  const size = home ? squareSize * PIECE_SIZE : anim.fromSize;
  return createPortal(
    <img
      src={pieceImage(anim.piece)}
      className="piece-returning"
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        transform: `rotate(${home ? 0 : anim.startAngle}deg)`,
      }}
      draggable={false}
    />,
    document.body,
  );
}
