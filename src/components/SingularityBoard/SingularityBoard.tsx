import { useEffect, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useGameStore } from "../../stores/gameStore";
import { Color, GameStatus } from "../../engine";
import type { Piece, SquareIndex } from "../../engine";
import { pieceImage } from "../../utils/pieceImages";
import { CELLS, placeOf, squareOf } from "../../plugins/singularity";
import type { Place, SingularityPlugin } from "../../plugins/singularity";
import { SLIDE_MS, useCaptureBurst } from "../Board/useBoardEffects";
import "./SingularityBoard.css";

/**
 * The board is drawn as the original is made: eight files laid side by side,
 * a to h, cut across by rings round the singularity at the middle. Along
 * the files it is squeezed to two thirds, so the whole board is as tall as
 * it is wide. Board units: the files are one wide, the board runs from -4
 * to 4 both ways, and White's end is at the bottom.
 */
const SQUEEZE = 2 / 3;
const EDGE_STEPS = 18;
/** Pointer travel that turns a press on a piece into a drag */
const DRAG_THRESHOLD_PX = 6;

interface Shape {
  sq: SquareIndex;
  path: string;
  /** Where its piece stands, and how big the piece can be there */
  x: number;
  y: number;
  size: number;
  light: boolean;
}

/** The outline of a square: across its file, between its two rings, on its half or both */
function outline({ file, ring, half }: Place): [number, number][] {
  // Distance across the board from its long middle line, and along it from the middle
  const from = 3 - file;
  const across = Array.from(
    { length: EDGE_STEPS + 1 },
    (_, i) => from + i / EDGE_STEPS,
  );
  const reach = (radius: number, v: number) =>
    Math.sqrt(Math.max(0, radius * radius - v * v));
  const span = (v: number): [number, number] => {
    const outer = reach(ring, v);
    const inner = reach(ring - 1, v);
    if (half === null) return [-outer, outer];
    // White's half is the near half, down the screen
    return half === Color.White ? [-outer, -inner] : [inner, outer];
  };
  const point = (u: number, v: number): [number, number] => [-v, -u * SQUEEZE];
  return [
    ...across.map((v) => point(span(v)[0], v)),
    ...[...across].reverse().map((v) => point(span(v)[1], v)),
  ];
}

function shapeOf(c: number, r: number): Shape {
  const place = placeOf({ c, r });
  const points = outline(place);
  let area = 0;
  let cx = 0;
  let cy = 0;
  points.forEach(([x0, y0], i) => {
    const [x1, y1] = points[(i + 1) % points.length];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  });
  area /= 2;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return {
    sq: squareOf(c, r),
    path:
      points
        .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(3)} ${y.toFixed(3)}`)
        .join(" ") + "Z",
    x: cx / (6 * area),
    y: cy / (6 * area),
    size: Math.min(0.8, 0.9 * Math.min(width, height)),
    light: (place.file + place.ring) % 2 === 1,
  };
}

const SHAPES = CELLS.map(({ c, r }) => shapeOf(c, r));
const SHAPE_OF = new Map(SHAPES.map((shape) => [shape.sq, shape]));

/** A share of the board's width or height, from a position in board units */
const pct = (units: number) => `${((units + 4) / 8) * 100}%`;

interface Drag {
  from: SquareIndex;
  piece: Piece;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moving: boolean;
}

const squareUnder = (x: number, y: number): SquareIndex | null => {
  const sq = document
    .elementFromPoint(x, y)
    ?.closest("[data-sq]")
    ?.getAttribute("data-sq");
  return sq == null ? null : (Number(sq) as SquareIndex);
};

/** The Singularity Chess board, round its singularity, with the game on it */
export function SingularityBoard() {
  const game = useGameStore((s) => s.game);
  // Read so the board is drawn again after every move
  const history = useGameStore((s) => s.moveHistory);
  const selected = useGameStore((s) => s.selectedSquare);
  const targets = useGameStore((s) => s.legalMoveSquares);
  const lastMove = useGameStore((s) => s.lastMove);
  const status = useGameStore((s) => s.status);
  const plugin = useGameStore((s) =>
    s.pluginManager.find<SingularityPlugin>("singularity"),
  );
  const { selectSquare, requestMove } = useGameStore.getState();
  const [drag, setDrag] = useState<Drag | null>(null);
  /** The move made by dropping a piece, which is already where it landed */
  const [droppedAt, setDroppedAt] = useState<number | null>(null);
  const moveCount = history.length;
  const dropped = droppedAt === moveCount;

  const capture = useCaptureBurst(
    lastMove && history[history.length - 1]?.move.captured ? lastMove.to : null,
    moveCount,
    dropped ? 0 : SLIDE_MS,
  );

  const checked =
    status === GameStatus.Check || status === GameStatus.Checkmate
      ? (plugin?.checkedKing(game.board, game.turn) ?? null)
      : null;

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) =>
      setDrag(
        (d) =>
          d && {
            ...d,
            x: e.clientX,
            y: e.clientY,
            moving:
              d.moving ||
              Math.hypot(e.clientX - d.startX, e.clientY - d.startY) >
                DRAG_THRESHOLD_PX,
          },
      );
    const onUp = (e: PointerEvent) => {
      setDrag(null);
      const to = squareUnder(e.clientX, e.clientY);
      if (to === null || to === drag.from) return;
      if (!drag.moving) {
        selectSquare(to);
        return;
      }
      if (requestMove(drag.from, to) === "moved") setDroppedAt(moveCount + 1);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, moveCount, requestMove, selectSquare]);

  const press = (e: ReactPointerEvent, sq: SquareIndex) => {
    const piece = game.board.get(sq);
    const mine =
      piece?.color === game.turn && game.turn === useGameStore.getState().seat;
    if (!piece || !mine || targets.includes(sq)) {
      selectSquare(sq);
      return;
    }
    e.preventDefault();
    if (selected !== sq) selectSquare(sq);
    setDrag({
      from: sq,
      piece,
      startX: e.clientX,
      startY: e.clientY,
      x: e.clientX,
      y: e.clientY,
      moving: false,
    });
  };

  const burst = capture ? SHAPE_OF.get(capture.sq) : undefined;

  return (
    <div className="board-shell singularity-shell">
      <div
        className={`singularity-board${capture ? " capture-jolt" : ""}`}
        aria-label="Singularity Chess"
      >
        <svg className="singularity-squares" viewBox="-4 -4 8 8">
          <defs>
            <radialGradient id="singularity-glow">
              <stop offset="0" stopColor="#000" />
              <stop offset="0.35" stopColor="#000" />
              <stop offset="0.55" stopColor="#ff9d2e" stopOpacity="0.9" />
              <stop offset="1" stopColor="#ff5a1f" stopOpacity="0" />
            </radialGradient>
          </defs>
          {SHAPES.map((shape) => {
            const { sq } = shape;
            const target = targets.includes(sq);
            let className = shape.light ? "sing-sq light" : "sing-sq dark";
            if (lastMove && (lastMove.from === sq || lastMove.to === sq)) {
              className += " last";
            }
            if (selected === sq) className += " picked";
            if (target && game.board.get(sq)) className += " takes";
            if (checked === sq) className += " checked";
            return (
              <path
                key={sq}
                d={shape.path}
                data-sq={sq}
                className={className}
                onPointerDown={(e) => press(e, sq)}
              />
            );
          })}
          {SHAPES.filter(
            ({ sq }) => targets.includes(sq) && !game.board.get(sq),
          ).map(({ sq, x, y, size }) => (
            <circle
              key={sq}
              className="sing-dot"
              cx={x}
              cy={y}
              r={Math.min(0.15, size * 0.22)}
            />
          ))}
          <ellipse
            className="singularity-hole"
            cx="0"
            cy="0"
            rx="0.28"
            ry={0.28 * SQUEEZE}
            fill="url(#singularity-glow)"
          />
        </svg>
        {SHAPES.map(({ sq, x, y, size }) => {
          const piece = game.board.get(sq);
          if (!piece) return null;
          const arriving = lastMove?.to === sq && !dropped;
          const from = arriving ? SHAPE_OF.get(lastMove.from) : undefined;
          const lifted = drag?.moving && drag.from === sq;
          return (
            <img
              key={arriving ? `${sq}-${moveCount}` : sq}
              className={`sing-piece${lifted ? " lifted" : ""}`}
              src={pieceImage(piece)}
              alt=""
              draggable={false}
              style={
                {
                  left: pct(x - size / 2),
                  top: pct(y - size / 2),
                  width: `${(size / 8) * 100}%`,
                  ...(from && {
                    "--slide-from-x": `${((from.x - x) / size) * 100}%`,
                    "--slide-from-y": `${((from.y - y) / size) * 100}%`,
                    animation: `slide-in ${SLIDE_MS}ms ease-out`,
                  }),
                } as CSSProperties
              }
            />
          );
        })}
        {capture && burst && (
          <div
            className="sing-burst"
            style={{ left: pct(burst.x), top: pct(burst.y) }}
          >
            <div className="capture-burst" key={capture.id} aria-hidden>
              <span
                className="capture-word"
                style={
                  {
                    "--tilt": `${(capture.id % 2 ? 1 : -1) * 10}deg`,
                  } as CSSProperties
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
          className="sing-piece-dragging"
          src={pieceImage(drag.piece)}
          alt=""
          draggable={false}
          style={{ left: drag.x, top: drag.y }}
        />
      )}
    </div>
  );
}
