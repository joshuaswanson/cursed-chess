import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useGameStore } from "../../stores/gameStore";
import { Color, GameStatus } from "../../engine";
import type { Piece, SquareIndex } from "../../engine";
import { pieceImage } from "../../utils/pieceImages";
import { CELLS, placeOf, squareOf, travelMs } from "../../plugins/singularity";
import type { Place, SingularityPlugin } from "../../plugins/singularity";
import { useCaptureBurst } from "../Board/useBoardEffects";
import { RING_DARK, RING_LIGHT, SQUEEZE } from "./rings";
import "./SingularityBoard.css";

/**
 * The board is drawn as the original is made: eight files laid side by side,
 * a to h, cut across by rings round the singularity at the middle. Board
 * units: the files are one wide, the board runs from -4 to 4 both ways,
 * and White's end is at the bottom.
 */
const EDGE_STEPS = 24;
/** Pointer travel that turns a press on a piece into a drag */
const DRAG_THRESHOLD_PX = 6;
/** How big a piece is for the room round where it stands, and the most of a file it ever takes */
const PIECE_FILL = 2.2;
const PIECE_MAX = 0.86;
const FILES = "abcdefgh";

type Point = [number, number];

interface Shape {
  sq: SquareIndex;
  path: string;
  /** Where its piece stands: on its file's middle line, halfway across the square */
  x: number;
  y: number;
  size: number;
  ring: number;
  light: boolean;
}

const toPath = (points: Point[]) =>
  points
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(3)} ${y.toFixed(3)}`)
    .join(" ") + "Z";

const reach = (radius: number, v: number) =>
  Math.sqrt(Math.max(0, radius * radius - v * v));

/** How far along the board a square runs, at `v` across it, from its inner ring to its outer one */
function span({ ring, half }: Place, v: number): [number, number] {
  const outer = reach(ring, v);
  const inner = reach(ring - 1, v);
  if (half === null) return [-outer, outer];
  // White's half is the near half, down the screen
  return half === Color.White ? [-outer, -inner] : [inner, outer];
}

const onScreen = (u: number, v: number): Point => [-v, -u * SQUEEZE];

/** The outline of a square: across its file, between its two rings, on its half or both */
function outline(place: Place): Point[] {
  // Distance across the board from its long middle line, and along it from the middle
  const from = 3 - place.file;
  const across = Array.from(
    { length: EDGE_STEPS + 1 },
    (_, i) => from + i / EDGE_STEPS,
  );
  return [
    ...across.map((v) => onScreen(span(place, v)[0], v)),
    ...[...across].reverse().map((v) => onScreen(span(place, v)[1], v)),
  ];
}

function distanceToEdge([x, y]: Point, points: Point[]): number {
  let nearest = Infinity;
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    const dx = bx - ax;
    const dy = by - ay;
    const along = Math.max(
      0,
      Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)),
    );
    nearest = Math.min(
      nearest,
      Math.hypot(x - (ax + along * dx), y - (ay + along * dy)),
    );
  }
  return nearest;
}

function shapeOf(c: number, r: number): Shape {
  const place = placeOf({ c, r });
  const points = outline(place);
  // Down the middle of its file, halfway between its two rings
  const middle = 3.5 - place.file;
  const [near, far] = span(place, middle);
  const at = onScreen((near + far) / 2, middle);
  const room = distanceToEdge(at, points);
  return {
    sq: squareOf(c, r),
    path: toPath(points),
    x: at[0],
    y: at[1],
    size: Math.min(PIECE_MAX, room * PIECE_FILL),
    ring: place.ring,
    light: (place.file + place.ring) % 2 === 1,
  };
}

const SHAPES = CELLS.map(({ c, r }) => shapeOf(c, r));
const SHAPE_OF = new Map(SHAPES.map((shape) => [shape.sq, shape]));

/** The edge of the whole board: the eight files, rounded off at each end by the outermost ring */
const RIM = (() => {
  const end = (sign: number) =>
    Array.from({ length: 65 }, (_, i) => {
      const x = -4 + (i / 64) * 8;
      return [x, sign * SQUEEZE * Math.sqrt(36 - x * x)] as Point;
    });
  return toPath([...end(1), ...end(-1).reverse()]);
})();

/** How far down from the middle White's end of a file is, where its letter goes */
const fileEnd = (file: number) =>
  SQUEEZE * Math.sqrt(36 - (file - 3.5) * (file - 3.5));

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
  // The way the last move went, which the piece travels square by square
  const route = plugin?.route ?? [];
  const travel = travelMs(route.length);
  const travelled = useRef(0);

  const capture = useCaptureBurst(
    lastMove && history[history.length - 1]?.move.captured ? lastMove.to : null,
    moveCount,
    dropped ? 0 : travel,
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
  /** How a square is marked, if at all: the king in check, the piece picked up, a piece it could take, or the last move */
  const mark = ({ sq }: Shape) => {
    if (checked === sq) return " checked";
    if (selected === sq) return " picked";
    if (targets.includes(sq) && game.board.get(sq)) return " takes";
    if (lastMove && (lastMove.from === sq || lastMove.to === sq)) {
      return " last";
    }
    return "";
  };

  return (
    <div className="singularity-shell">
      <div
        className={`singularity-board${capture ? " capture-jolt" : ""}`}
        aria-label="Singularity Chess"
      >
        {/* The glow round the board on a layer of its own, so it is not redrawn with the squares */}
        <svg className="singularity-glow" viewBox="-4 -4 8 8" aria-hidden>
          <path className="sing-rim-glow" d={RIM} />
        </svg>
        <svg className="singularity-squares" viewBox="-4 -4 8 8">
          <defs>
            <clipPath id="sing-rim">
              <path d={RIM} />
            </clipPath>
            <linearGradient id="sing-rim-metal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#ffe2a3" />
              <stop offset="0.5" stopColor="#c07a30" />
              <stop offset="1" stopColor="#6b3a12" />
            </linearGradient>
          </defs>
          <g clipPath="url(#sing-rim)">
            {SHAPES.map((shape) => (
              <path
                key={shape.sq}
                d={shape.path}
                data-sq={shape.sq}
                className={`sing-sq${mark(shape)}`}
                style={{
                  fill: (shape.light ? RING_LIGHT : RING_DARK)[shape.ring],
                  stroke: (shape.light ? RING_LIGHT : RING_DARK)[shape.ring],
                }}
                onPointerDown={(e) => press(e, shape.sq)}
              />
            ))}
            {SHAPES.filter(
              ({ sq }) => targets.includes(sq) && !game.board.get(sq),
            ).map(({ sq, x, y, size }) => (
              <circle
                key={sq}
                className="sing-dot"
                cx={x}
                cy={y}
                r={Math.max(0.08, Math.min(0.14, size * 0.18))}
              />
            ))}
          </g>
          <path className="sing-rim" d={RIM} stroke="url(#sing-rim-metal)" />
          {[...FILES].map((letter, file) => (
            <text
              key={letter}
              className="sing-file"
              x={file - 3.5}
              y={fileEnd(file) + 0.3}
            >
              {letter}
            </text>
          ))}
        </svg>
        <div className="sing-hole" aria-hidden>
          <span className="sing-core" />
        </div>
        {SHAPES.map(({ sq, x, y, size }) => {
          const piece = game.board.get(sq);
          if (!piece) return null;
          const arriving = lastMove?.to === sq && !dropped;
          const lifted = drag?.moving && drag.from === sq;
          /** Sends the piece along every square of the way it went, not straight across */
          const travelThrough = (img: HTMLImageElement | null) => {
            if (!img || !arriving || travelled.current === moveCount) return;
            travelled.current = moveCount;
            const stops = [lastMove.from, ...route, sq].flatMap(
              (stop, i, all) =>
                i > 0 && all[i - 1] === stop ? [] : [SHAPE_OF.get(stop)!],
            );
            img.animate(
              stops.map((stop) => ({
                translate: `calc(-50% + ${((stop.x - x) / size) * 100}%) calc(-50% + ${((stop.y - y) / size) * 100}%)`,
              })),
              { duration: travel, easing: "ease-in-out" },
            );
          };
          return (
            <img
              key={arriving ? `${sq}-${moveCount}` : sq}
              ref={travelThrough}
              className={`sing-piece${lifted ? " lifted" : ""}`}
              src={pieceImage(piece)}
              alt=""
              draggable={false}
              style={
                {
                  left: pct(x),
                  top: pct(y),
                  width: `${(size / 8) * 100}%`,
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
