import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useGameStore } from "../../stores/gameStore";
import type { Color, Piece, SquareIndex } from "../../engine";
import type { PortalColor } from "../../plugins/portalChess";

const DRAG_THRESHOLD = 6;
export const PIECE_SIZE = 0.9;
const PICKUP_SCALE = 1.35;
/** Distance in squares at which a portal starts reacting to a dragged piece */
const PORTAL_PULL_RANGE = 2.2;

const SWING_RADIUS = 50;
const SWING_DAMPING = 0.95;
const SWING_GRAVITY = 0.015;

export interface DragState {
  sq: SquareIndex;
  piece: Piece;
  x: number;
  y: number;
  startX: number;
  startY: number;
  isDragging: boolean;
  /** Where the piece was grabbed, as a fraction of its width and height */
  grabX: number;
  grabY: number;
  /** How strongly each nearby portal is stirred by the dragged piece, 0 to 1 */
  portalCharges?: Record<number, number>;
  /** The portal pulling the piece in, if the piece can legally enter one */
  pull?: { color: PortalColor; strength: number };
}

export interface ReturnAnim {
  sq: SquareIndex;
  piece: Piece;
  fromX: number;
  fromY: number;
  fromSize: number;
  toX: number;
  toY: number;
  startAngle: number;
  started: boolean;
}

export interface DroppedMove {
  from: SquareIndex;
  to: SquareIndex;
}

function freshSwing() {
  return {
    scale: 1,
    theta: 0,
    omega: 0,
    smoothVx: 0,
    smoothVy: 0,
    prevVx: 0,
    prevVy: 0,
    /** Vector from the cursor to the pulling portal's center, in px */
    pullTargetX: 0,
    pullTargetY: 0,
    pullTargetStrength: 0,
    pullX: 0,
    pullY: 0,
    pullStrength: 0,
  };
}

type Swing = ReturnType<typeof freshSwing>;

/** One animation frame of pendulum swing and portal pull, written straight to the element */
function stepSwing(s: Swing, el: HTMLElement | null): void {
  const ax = s.smoothVx - s.prevVx;
  const ay = s.smoothVy - s.prevVy;
  s.prevVx = s.smoothVx;
  s.prevVy = s.smoothVy;

  s.pullX += (s.pullTargetX - s.pullX) * 0.2;
  s.pullY += (s.pullTargetY - s.pullY) * 0.2;
  s.pullStrength += (s.pullTargetStrength - s.pullStrength) * 0.15;
  const p = s.pullStrength;
  const pullDist = Math.hypot(s.pullX, s.pullY);

  // The base swings to point at the portal: the pendulum hangs along the
  // sum of gravity and the portal's pull, which dominates as it nears
  const toward = Math.max(pullDist, 30);
  const forceX = (s.pullX / toward) * 4 * p;
  const forceY = (s.pullY / toward) * 4 * p + 1;
  const restAngle = Math.atan2(-forceX, forceY);
  const torque =
    (Math.cos(s.theta) / SWING_RADIUS) * ax +
    (Math.sin(s.theta) / SWING_RADIUS) * ay;
  s.omega +=
    torque - SWING_GRAVITY * (1 + 4 * p) * Math.sin(s.theta - restAngle);
  s.omega *= SWING_DAMPING;
  s.theta += s.omega;
  s.scale += (PICKUP_SCALE * (1 - 0.15 * p) - s.scale) * 0.35;

  if (!el) return;
  const deg = s.theta * (180 / Math.PI);
  const drift = 0.35 * p * p;
  const tremble = 1.5 * p * p;
  const shakeX = (Math.random() - 0.5) * tremble;
  const shakeY = (Math.random() - 0.5) * tremble;
  // Stretched lengthwise in the piece's own frame, so the base reaches for the hole
  const stretch = p ** 1.5;
  el.style.transform =
    `translate(${s.pullX * drift + shakeX}px, ${s.pullY * drift + shakeY}px) ` +
    `scale(${s.scale}) rotate(${deg}deg) ` +
    `scale(${1 - 0.18 * stretch}, ${1 + 0.45 * stretch})`;
}

/**
 * Drag-and-drop for board pieces: a lifted piece swings from where it was
 * grabbed, portals it can enter pull it in, and an illegal drop flies back.
 */
export function usePieceDrag({
  boardRef,
  squareSize,
  turn,
  onFrame,
}: {
  boardRef: RefObject<HTMLDivElement | null>;
  squareSize: number;
  turn: Color;
  /** Called each animation frame of a drag with the current portal pull, 0 to 1 */
  onFrame?: (pullStrength: number) => void;
}) {
  const { selectSquare, requestMove, kick } = useGameStore.getState();
  const [drag, setDrag] = useState<DragState | null>(null);
  const [returnAnim, setReturnAnim] = useState<ReturnAnim | null>(null);
  const dragImgRef = useRef<HTMLImageElement>(null);
  const swingRef = useRef(freshSwing());
  const rafRef = useRef(0);
  const onFrameRef = useRef(onFrame);
  /** Set when a drop makes a move, so the board skips its slide animation */
  const wasDropRef = useRef(false);
  /** The last move made by dropping a piece, for the portal animation */
  const droppedMoveRef = useRef<DroppedMove | null>(null);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!drag?.isDragging) {
      swingRef.current = freshSwing();
      onFrameRef.current?.(0);
      return;
    }
    const tick = () => {
      stepSwing(swingRef.current, dragImgRef.current);
      onFrameRef.current?.(swingRef.current.pullStrength);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drag?.isDragging]);

  // The return element must mount before its transition can start
  useEffect(() => {
    if (!returnAnim || returnAnim.started) return;
    const frame = requestAnimationFrame(() =>
      setReturnAnim((prev) => (prev ? { ...prev, started: true } : null)),
    );
    return () => cancelAnimationFrame(frame);
  }, [returnAnim]);

  useEffect(() => {
    if (!returnAnim?.started) return;
    const timer = setTimeout(() => setReturnAnim(null), 250);
    return () => clearTimeout(timer);
  }, [returnAnim?.started]);

  const squareCenter = useCallback(
    (sq: SquareIndex) => {
      const el = boardRef.current?.querySelector(`[data-sq="${sq}"]`);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    },
    [boardRef],
  );

  // Hit-testing the square elements stays correct while gravity rotates the board
  const squareAt = useCallback(
    (clientX: number, clientY: number): SquareIndex | null => {
      const el = document
        .elementFromPoint(clientX, clientY)
        ?.closest<HTMLElement>("[data-sq]");
      if (!el || !boardRef.current?.contains(el)) return null;
      return Number(el.dataset.sq);
    },
    [boardRef],
  );

  // Portals the dragged piece can legally enter pull it in like a black hole
  const measurePortalPull = useCallback(
    (clientX: number, clientY: number) => {
      const legalTargets = useGameStore.getState().legalMoveSquares;
      const portalCharges: Record<number, number> = {};
      let pull: DragState["pull"];
      let pullVector = { x: 0, y: 0 };
      const portals = boardRef.current?.querySelectorAll<HTMLElement>(
        ".portal-overlay:not(.portal-despawn)",
      );
      for (const portal of portals ?? []) {
        const squareEl = portal.closest<HTMLElement>("[data-sq]");
        if (!squareEl) continue;
        const sq = Number(squareEl.dataset.sq);
        const rect = squareEl.getBoundingClientRect();
        const dx = rect.left + rect.width / 2 - clientX;
        const dy = rect.top + rect.height / 2 - clientY;
        const distance = Math.hypot(dx, dy) / rect.width;
        const closeness = Math.max(
          0,
          Math.min(
            1,
            (PORTAL_PULL_RANGE - distance) / (PORTAL_PULL_RANGE - 0.3),
          ),
        );
        if (closeness === 0) continue;

        const canEnter = legalTargets.includes(sq);
        portalCharges[sq] = canEnter ? closeness : closeness * 0.3;
        const strength = closeness ** 1.3;
        if (canEnter && strength > (pull?.strength ?? 0)) {
          const color = portal.classList.contains("portal-orange")
            ? "orange"
            : "blue";
          pull = { color, strength };
          pullVector = { x: dx, y: dy };
        }
      }

      const swing = swingRef.current;
      swing.pullTargetX = pullVector.x;
      swing.pullTargetY = pullVector.y;
      swing.pullTargetStrength = pull?.strength ?? 0;
      return { portalCharges, pull };
    },
    [boardRef],
  );

  const onPiecePointerDown = useCallback(
    (e: React.PointerEvent, sq: SquareIndex, piece: Piece) => {
      if (piece.color !== turn) return;
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      setDrag({
        sq,
        piece,
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        isDragging: false,
        grabX: (e.clientX - rect.left) / rect.width,
        grabY: (e.clientY - rect.top) / rect.height,
      });
    },
    [turn],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const pastThreshold =
        Math.abs(e.clientX - drag.startX) > DRAG_THRESHOLD ||
        Math.abs(e.clientY - drag.startY) > DRAG_THRESHOLD;

      if (!drag.isDragging && pastThreshold) {
        boardRef.current?.setPointerCapture(e.pointerId);
        selectSquare(drag.sq);
      }

      const { portalCharges, pull } = measurePortalPull(e.clientX, e.clientY);

      // Smoothed velocity feeds the pendulum; its acceleration is taken per frame
      const swing = swingRef.current;
      swing.smoothVx = (e.clientX - drag.x) * 0.4 + swing.smoothVx * 0.6;
      swing.smoothVy = (e.clientY - drag.y) * 0.4 + swing.smoothVy * 0.6;

      setDrag((prev) =>
        prev
          ? {
              ...prev,
              x: e.clientX,
              y: e.clientY,
              isDragging: prev.isDragging || pastThreshold,
              portalCharges,
              pull,
            }
          : null,
      );
    },
    [drag, boardRef, selectSquare, measurePortalPull],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;

      if (!drag.isDragging) {
        selectSquare(drag.sq);
        setDrag(null);
        return;
      }

      let moveMade = false;
      const targetSq = squareAt(e.clientX, e.clientY);
      const overGoal = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest(".goal.shootable");
      if (overGoal) {
        kick("goal");
      } else if (targetSq !== null && targetSq !== drag.sq) {
        wasDropRef.current = true;
        droppedMoveRef.current = { from: drag.sq, to: targetSq };
        const result = requestMove(drag.sq, targetSq);
        if (result !== "moved") wasDropRef.current = false;
        moveMade = result === "moved" || result === "promotion";
      }

      if (!moveMade) {
        const center = squareCenter(drag.sq);
        const floating = dragImgRef.current?.getBoundingClientRect();
        if (center && floating) {
          const swing = swingRef.current;
          setReturnAnim({
            sq: drag.sq,
            piece: drag.piece,
            fromX: floating.left + floating.width / 2,
            fromY: floating.top + floating.height / 2,
            fromSize: squareSize * PIECE_SIZE * swing.scale,
            toX: center.x,
            toY: center.y,
            startAngle:
              (((((swing.theta * 180) / Math.PI) % 360) + 540) % 360) - 180,
            started: false,
          });
        }
      }

      const board = boardRef.current;
      if (board?.hasPointerCapture(e.pointerId)) {
        board.releasePointerCapture(e.pointerId);
      }
      setDrag(null);
    },
    [
      drag,
      boardRef,
      squareAt,
      squareCenter,
      squareSize,
      requestMove,
      selectSquare,
      kick,
    ],
  );

  return {
    drag,
    returnAnim,
    dragImgRef,
    wasDropRef,
    droppedMoveRef,
    onPiecePointerDown,
    onPointerMove,
    onPointerUp,
  };
}
