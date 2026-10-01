import {
  useCallback,
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
} from "react";
import { useGameStore } from "../../stores/gameStore";
import type { PortalMoveInfo } from "../../stores/gameStore";
import { toIndex, fileOf, rankOf } from "../../utils/squareUtils";
import { Color, PieceType } from "../../engine";
import { pieceImage } from "../../utils/pieceImages";
import type { Piece, SquareIndex } from "../../engine";
import type { PortalColor } from "../../plugins/portalChess";
import { Portal, PortalBurst } from "./Portal";
import "./Board.css";

const DRAG_THRESHOLD = 6;
const PIECE_SIZE = 0.9;
const PICKUP_SCALE = 1.35;

interface DragState {
  sq: SquareIndex;
  piece: Piece;
  x: number;
  y: number;
  startX: number;
  startY: number;
  isDragging: boolean;
  pointerId: number;
  /** Where the piece was grabbed, as a fraction of its width and height */
  grabX: number;
  grabY: number;
}

interface ReturnAnim {
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

interface PortalAnimPhase {
  type: "approach" | "shrink" | "pop" | "slide";
  sq: SquareIndex;
  color: PortalColor;
  slideFrom?: SquareIndex;
}

const PORTAL_ENTER_MS = 400;
const PORTAL_EXIT_MS = 450;

export function Board() {
  const {
    selectedSquare,
    legalMoveSquares,
    hasPortalMoves,
    portalEntrance,
    lastMove,
    lastAutonomousMoves,
    lastPortalMove,
    flipped,
    status,
    selectSquare,
    requestMove,
    game,
    pluginManager,
    timeWhite,
    turn,
    deployPieceType,
    resolveExplosion,
  } = useGameStore();

  const boardRef = useRef<HTMLDivElement>(null);
  const [squareSize, setSquareSize] = useState(72);
  const dragImgRef = useRef<HTMLImageElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [animMap, setAnimMap] = useState<
    Map<number, { offsetX: number; offsetY: number }>
  >(new Map());
  const [returnAnim, setReturnAnim] = useState<ReturnAnim | null>(null);
  const [portalAnim, setPortalAnim] = useState<{
    phases: PortalAnimPhase[];
    phaseIndex: number;
    info: PortalMoveInfo;
  } | null>(null);
  const [closingPortals, setClosingPortals] = useState<
    Map<number, PortalColor>
  >(
    new Map(),
  );
  const [openingPortals, setOpeningPortals] = useState<Set<number>>(new Set());
  const wasDrag = useRef(false);
  const prevLastMove = useRef(lastMove);
  const prevPortalMove = useRef(lastPortalMove);
  const prevPortalKeys = useRef<string>("");
  const prevPortalColors = useRef<Map<number, PortalColor>>(new Map());
  const [fogExiting, setFogExiting] = useState(false);
  const prevFog = useRef(false);
  const [explosions, setExplosions] = useState<Set<number>>(new Set());
  const [gravityFalls, setGravityFalls] = useState<
    Map<number, { offsetX: number; offsetY: number }>
  >(new Map());
  const prevGravityKey = useRef("");

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const observer = new ResizeObserver(() =>
      setSquareSize(board.offsetWidth / 8),
    );
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  // Pendulum physics for drag swing
  const swingRef = useRef({
    scale: 1,
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
        scale: 1,
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
      s.scale += (PICKUP_SCALE - s.scale) * 0.35;

      if (dragImgRef.current) {
        const deg = s.theta * (180 / Math.PI);
        dragImgRef.current.style.transform = `scale(${s.scale}) rotate(${deg}deg)`;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drag?.isDragging]);

  const getSquareScreenCenter = useCallback(
    (sq: SquareIndex): { x: number; y: number } | null => {
      const el = boardRef.current?.querySelector(`[data-sq="${sq}"]`);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    },
    [],
  );

  // Slide animation on click-to-move or autonomous moves
  useEffect(() => {
    const prev = prevLastMove.current;
    prevLastMove.current = lastMove;

    if (!lastMove || lastMove === prev) return;
    if (wasDrag.current) {
      wasDrag.current = false;
      return;
    }
    // Skip normal slide for portal moves — portal anim handles it
    if (lastPortalMove) return;

    // Autonomous batch: animate all moves
    const movesToAnimate =
      lastAutonomousMoves.length > 0 ? lastAutonomousMoves : [lastMove];

    const newMap = new Map<number, { offsetX: number; offsetY: number }>();
    for (const m of movesToAnimate) {
      const dFile = fileOf(m.from) - fileOf(m.to);
      const dRank = rankOf(m.from) - rankOf(m.to);
      const offsetX = (flipped ? -dFile : dFile) * squareSize;
      const offsetY = (flipped ? dRank : -dRank) * squareSize;
      newMap.set(m.to, { offsetX, offsetY });
    }

    setAnimMap(newMap);
    const timer = setTimeout(() => setAnimMap(new Map()), 600);
    return () => clearTimeout(timer);
  }, [lastMove, lastAutonomousMoves, lastPortalMove, flipped, squareSize]);

  // Portal move animation: build phase array from transits
  useEffect(() => {
    const prev = prevPortalMove.current;
    prevPortalMove.current = lastPortalMove;
    if (!lastPortalMove || lastPortalMove === prev) return;

    const { from, transits, landing } = lastPortalMove;
    const phases: PortalAnimPhase[] = [];

    // Approach: slide from `from` to first entrance (skip if same square)
    if (from !== transits[0].entrance) {
      phases.push({
        type: "approach",
        sq: transits[0].entrance,
        color: transits[0].color,
        slideFrom: from,
      });
    }

    for (let i = 0; i < transits.length; i++) {
      const { entrance, exit, color } = transits[i];
      phases.push({ type: "shrink", sq: entrance, color });
      phases.push({ type: "pop", sq: exit, color });
      if (i < transits.length - 1) {
        phases.push({
          type: "slide",
          sq: transits[i + 1].entrance,
          color,
          slideFrom: exit,
        });
      }
    }

    const last = transits[transits.length - 1];
    if (last.exit !== landing) {
      phases.push({
        type: "slide",
        sq: landing,
        color: last.color,
        slideFrom: last.exit,
      });
    }

    if (phases.length > 0) {
      setPortalAnim({ phases, phaseIndex: 0, info: lastPortalMove });
    }
  }, [lastPortalMove]);

  useEffect(() => {
    if (!portalAnim) return;
    const currentPhase = portalAnim.phases[portalAnim.phaseIndex];
    if (!currentPhase) {
      setPortalAnim(null);
      return;
    }

    // Compute duration for current phase
    let duration: number;
    if (currentPhase.type === "approach" || currentPhase.type === "slide") {
      if (currentPhase.slideFrom !== undefined) {
        const dFile = Math.abs(
          fileOf(currentPhase.slideFrom) - fileOf(currentPhase.sq),
        );
        const dRank = Math.abs(
          rankOf(currentPhase.slideFrom) - rankOf(currentPhase.sq),
        );
        const dist = Math.max(dFile, dRank);
        duration = Math.max(100, dist * 60);
      } else {
        duration = 200;
      }
    } else if (currentPhase.type === "shrink") {
      duration = PORTAL_ENTER_MS;
    } else {
      duration = PORTAL_EXIT_MS;
    }

    const timer = setTimeout(() => {
      const nextIndex = portalAnim.phaseIndex + 1;
      if (nextIndex >= portalAnim.phases.length) {
        setPortalAnim(null);
      } else {
        setPortalAnim({ ...portalAnim, phaseIndex: nextIndex });
      }
    }, duration);
    return () => clearTimeout(timer);
  }, [portalAnim]);

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

  // Hit-testing the square elements stays correct while gravity rotates the board
  const getSquareFromPoint = useCallback(
    (clientX: number, clientY: number): SquareIndex | null => {
      const el = document
        .elementFromPoint(clientX, clientY)
        ?.closest<HTMLElement>("[data-sq]");
      if (!el || !boardRef.current?.contains(el)) return null;
      return Number(el.dataset.sq);
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, sq: SquareIndex, piece: Piece) => {
      if (piece.color !== game.turn) return;
      e.preventDefault();

      const rect = e.currentTarget.getBoundingClientRect();
      setDrag({
        grabX: (e.clientX - rect.left) / rect.width,
        grabY: (e.clientY - rect.top) / rect.height,
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
          // A dropped piece is already at its target, so skip the slide animation
          wasDrag.current = true;
          const result = requestMove(drag.sq, targetSq);
          if (result !== "moved") wasDrag.current = false;
          moveMade = result !== null;
        }

        // Animate piece back to its square if move wasn't made
        if (!moveMade) {
          const center = getSquareScreenCenter(drag.sq);
          const floating = dragImgRef.current?.getBoundingClientRect();
          if (center && floating) {
            setReturnAnim({
              sq: drag.sq,
              piece: drag.piece,
              fromX: floating.left + floating.width / 2,
              fromY: floating.top + floating.height / 2,
              fromSize: squareSize * PIECE_SIZE * swingRef.current.scale,
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

        const board = boardRef.current;
        if (board?.hasPointerCapture(e.pointerId)) {
          board.releasePointerCapture(e.pointerId);
        }
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
      squareSize,
      requestMove,
      selectSquare,
    ],
  );

  // Collect overlay data for rendering
  const overlays = pluginManager.getAllOverlays();
  const portalSquares = new Map<number, PortalColor>();
  const portalPairs: { a: SquareIndex; b: SquareIndex; color: PortalColor }[] =
    [];
  let hasFogOverlay = false;
  let hasRallyOverlay = false;
  let shrinkRing = 0;
  let dangerProgress = 0;
  let gravityDirection: string | null = null;
  let gravityAngle: number | null = null;
  let gravityMovesFromOverlay: { from: number; to: number }[] = [];
  let strategoHidden = new Set<number>();
  let strategoLakes = new Set<number>();
  let rallyCooldowns: Record<number, { total: number; gen: number }> = {};
  for (const overlay of overlays) {
    if (overlay.type === "portal" && overlay.squares.length === 2) {
      const color = (overlay.data as { color: PortalColor })?.color ?? "blue";
      portalPairs.push({ a: overlay.squares[0], b: overlay.squares[1], color });
      for (const sq of overlay.squares) {
        portalSquares.set(sq, color);
      }
    }
    if (overlay.type === "fog-overlay") {
      hasFogOverlay = true;
    }
    if (overlay.type === "rally-resources") {
      hasRallyOverlay = true;
    }
    if (overlay.type === "rally-cooldowns") {
      rallyCooldowns = overlay.data as Record<
        number,
        { total: number; gen: number }
      >;
    }
    if (overlay.type === "gravity") {
      const gData = overlay.data as {
        direction: string;
        angle?: number;
        moves?: { from: number; to: number }[];
      };
      gravityDirection = gData?.direction ?? null;
      gravityAngle = gData?.angle ?? null;
      gravityMovesFromOverlay = gData?.moves ?? [];
    }
    if (overlay.type === "battle-royale") {
      const brData = overlay.data as {
        shrinkRing: number;
        dangerProgress: number;
      };
      shrinkRing = brData?.shrinkRing ?? 0;
      dangerProgress = brData?.dangerProgress ?? 0;
    }
    if (overlay.type === "stratego-hidden") {
      strategoHidden = new Set(overlay.squares);
    }
    if (overlay.type === "stratego-lake") {
      strategoLakes = new Set(overlay.squares);
    }
  }

  // Animate portals that open, close, or move
  const portalKey = [...portalSquares.keys()].sort().join(",");
  useEffect(() => {
    const prev = prevPortalKeys.current;
    const prevColors = prevPortalColors.current;
    prevPortalKeys.current = portalKey;
    prevPortalColors.current = new Map(portalSquares);
    if (prev === portalKey) return;

    const parse = (key: string) =>
      new Set(key === "" ? [] : key.split(",").map(Number));
    const oldSquares = parse(prev);
    const newSquares = parse(portalKey);

    const closing = new Map<number, PortalColor>();
    for (const sq of oldSquares) {
      if (!newSquares.has(sq)) closing.set(sq, prevColors.get(sq) ?? "blue");
    }
    const opening = new Set<number>();
    for (const sq of newSquares) {
      if (!oldSquares.has(sq)) opening.add(sq);
    }

    setClosingPortals(closing);
    setOpeningPortals(opening);
  }, [portalKey]);

  useEffect(() => {
    if (closingPortals.size === 0 && openingPortals.size === 0) return;
    const timer = setTimeout(() => {
      setClosingPortals(new Map());
      setOpeningPortals(new Set());
    }, 600);
    return () => clearTimeout(timer);
  }, [closingPortals, openingPortals]);

  // Detect fog mode ending — keep fog visible while fading out
  useEffect(() => {
    if (prevFog.current && !hasFogOverlay) {
      setFogExiting(true);
      const timer = setTimeout(() => setFogExiting(false), 1500);
      return () => clearTimeout(timer);
    }
    prevFog.current = hasFogOverlay;
  }, [hasFogOverlay]);

  // Detect mine pending explosions from overlay data
  const minefieldOverlay = overlays.find((o) => o.type === "minefield");
  const pendingKey = (minefieldOverlay?.squares ?? []).join(",");

  useEffect(() => {
    if (pendingKey === "") return;
    const squares = pendingKey.split(",").map(Number);

    // Explode after the slide animation, then remove the pieces
    let resolveTimer: ReturnType<typeof setTimeout> | undefined;
    const slideTimer = setTimeout(() => {
      setExplosions(new Set(squares));
      resolveTimer = setTimeout(() => {
        for (const sq of squares) resolveExplosion(sq);
        setExplosions(new Set());
      }, 600);
    }, 350);

    return () => {
      clearTimeout(slideTimer);
      clearTimeout(resolveTimer);
    };
  }, [pendingKey, resolveExplosion]);

  // Gravity piece slide animation
  // Uses CSS `translate` (separate from `transform`) so it doesn't conflict with
  // the counter-rotation or normal move animations.
  // CSS animation with delay: pieces hold at old positions during board rotation,
  // then slide to new positions after rotation completes.
  const gravityMoveKey = gravityMovesFromOverlay
    .map((m) => `${m.from}-${m.to}`)
    .join(",");
  useLayoutEffect(() => {
    if (gravityMoveKey === prevGravityKey.current || gravityMoveKey === "")
      return;
    prevGravityKey.current = gravityMoveKey;

    const offsets = new Map<number, { offsetX: number; offsetY: number }>();
    for (const pair of gravityMoveKey.split(",")) {
      const [from, to] = pair.split("-").map(Number);
      const fromCol = flipped ? 7 - fileOf(from) : fileOf(from);
      const fromRow = flipped ? rankOf(from) : 7 - rankOf(from);
      const toCol = flipped ? 7 - fileOf(to) : fileOf(to);
      const toRow = flipped ? rankOf(to) : 7 - rankOf(to);
      offsets.set(to, {
        offsetX: (fromCol - toCol) * squareSize,
        offsetY: (fromRow - toRow) * squareSize,
      });
    }

    setGravityFalls(offsets);

    // Clean up after rotation (1s) + slide (0.6s) + buffer
    const timer = setTimeout(() => setGravityFalls(new Map()), 1800);
    return () => clearTimeout(timer);
  }, [gravityMoveKey, flipped, squareSize]);

  // Fog always covers the enemy half (human plays White, enemy = top)
  const showFog = hasFogOverlay || fogExiting;
  const fogOnTop = showFog && !flipped;

  const currentPortalPhase = portalAnim?.phases[portalAnim.phaseIndex];
  const surgingPortal =
    currentPortalPhase?.type === "shrink" || currentPortalPhase?.type === "pop"
      ? currentPortalPhase.sq
      : null;

  const rows = [];
  for (let visualRow = 0; visualRow < 8; visualRow++) {
    const rank = flipped ? visualRow : 7 - visualRow;
    const cols = [];
    for (let visualCol = 0; visualCol < 8; visualCol++) {
      const file = flipped ? 7 - visualCol : visualCol;
      const sq = toIndex(file, rank);
      const piece = game.board.get(sq);
      const isLight = (rank + file) % 2 !== 0;
      const isSelected = sq === selectedSquare;
      const isLegalTarget = legalMoveSquares.includes(sq);
      const isLastMoveSquare =
        lastMove && (sq === lastMove.from || sq === lastMove.to);
      const isCheck =
        gravityFalls.size === 0 &&
        piece?.type === PieceType.King &&
        piece.color === game.turn &&
        (status === "check" || status === "checkmate");
      const portalColor = portalSquares.get(sq);
      const squareMods = pluginManager.getSquareModifiers(sq);
      const isDead = squareMods.some((m) => m.className === "dead-square");

      const isDragSource =
        (drag?.isDragging && drag.sq === sq) ||
        (returnAnim !== null && returnAnim.sq === sq) ||
        (portalAnim !== null && portalAnim.info.landing === sq);
      const animEntry = animMap.get(sq);
      const isAnimating = !!animEntry;

      let className = `square ${isLight ? "light" : "dark"}`;
      // Apply plugin square modifier classes (dead-square, danger-square, etc.)
      for (const mod of squareMods) {
        if (mod.className) className += ` ${mod.className}`;
      }
      if (isSelected) className += " selected";
      if (isLastMoveSquare && !isDead) className += " last-move";
      if (isCheck) className += " in-check";
      if (drag?.isDragging && isLegalTarget) className += " drag-target";

      // Deploy target highlight: empty square on player's half (ranks 0-3)
      const isDeployTarget =
        hasRallyOverlay && deployPieceType && !piece && !isDead && rank <= 3;
      if (isDeployTarget) className += " deploy-target";

      // Inline style for slide + rock animation
      const gravFall = gravityFalls.get(sq);
      const pieceStyle: React.CSSProperties | undefined = isAnimating
        ? ({
            "--slide-from-x": `${animEntry!.offsetX}px`,
            "--slide-from-y": `${animEntry!.offsetY}px`,
            animation: "slide-in 0.2s ease-out forwards",
          } as React.CSSProperties)
        : gravFall
          ? ({
              "--grav-x": `${gravFall.offsetX}px`,
              "--grav-y": `${gravFall.offsetY}px`,
              animation: "gravity-fall 0.6s ease-in-out 1.05s both",
            } as React.CSSProperties)
          : undefined;

      const isClosingPortal = closingPortals.has(sq);
      const isOpeningPortal = openingPortals.has(sq);

      cols.push(
        <div
          key={sq}
          data-sq={sq}
          className={className}
          onClick={() => {
            if (!drag) selectSquare(sq);
          }}
        >
          {portalColor && (
            <Portal
              color={portalColor}
              state={
                isOpeningPortal
                  ? "spawn"
                  : surgingPortal === sq
                    ? "surge"
                    : "idle"
              }
            />
          )}

          {isClosingPortal && (
            <Portal color={closingPortals.get(sq) ?? "blue"} state="despawn" />
          )}

          {isLegalTarget && !drag?.isDragging && (
            <div className={piece ? "capture-hint" : "move-hint"} />
          )}

          {strategoLakes.has(sq) && <div className="stratego-lake-tile" />}

          {piece && !isDragSource && !isDead && (
            <>
              <img
                src={pieceImage(piece)}
                alt={`${piece.color}${piece.type}`}
                className={`piece-img${strategoHidden.has(sq) ? " stratego-piece-hidden" : ""}`}
                style={pieceStyle}
                draggable={false}
                onPointerDown={(e) => handlePointerDown(e, sq, piece)}
              />
              {strategoHidden.has(sq) && (
                <div className="stratego-mask" style={pieceStyle}>
                  ?
                </div>
              )}
              {rallyCooldowns[sq] != null && (
                <svg
                  key={`cd-${sq}-${rallyCooldowns[sq].gen}`}
                  className="cooldown-pie"
                  viewBox="0 0 36 36"
                >
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="3"
                    strokeDasharray="100.53"
                    style={{
                      animationName: "cooldown-fill",
                      animationDuration: `${rallyCooldowns[sq].total}ms`,
                      animationTimingFunction: "linear",
                      animationFillMode: "forwards",
                    }}
                  />
                </svg>
              )}
            </>
          )}

          {explosions.has(sq) && <div className="mine-explosion" />}
        </div>,
      );
    }
    rows.push(
      <div key={rank} className="board-row">
        {cols}
      </div>,
    );
  }

  // Floating drag piece, held at the point where it was grabbed
  let dragElement = null;
  if (drag?.isDragging) {
    const size = squareSize * PIECE_SIZE;
    dragElement = (
      <img
        ref={dragImgRef}
        src={pieceImage(drag.piece)}
        className="piece-dragging"
        style={{
          left: drag.x - drag.grabX * size,
          top: drag.y - drag.grabY * size,
          width: size,
          height: size,
          transformOrigin: `${drag.grabX * 100}% ${drag.grabY * 100}%`,
        }}
        draggable={false}
      />
    );
  }

  // Piece returning to its square after invalid drop
  let returnElement = null;
  if (returnAnim) {
    const isBack = returnAnim.started;
    const pos = isBack
      ? { x: returnAnim.toX, y: returnAnim.toY }
      : { x: returnAnim.fromX, y: returnAnim.fromY };
    const angle = isBack ? 0 : returnAnim.startAngle;
    const size = isBack ? squareSize * PIECE_SIZE : returnAnim.fromSize;
    const offset = size / 2;
    returnElement = (
      <img
        src={pieceImage(returnAnim.piece)}
        className="piece-returning"
        style={{
          left: pos.x - offset,
          top: pos.y - offset,
          width: size,
          height: size,
          transform: `rotate(${angle}deg)`,
        }}
        draggable={false}
      />
    );
  }

  // Portal arrow: only when selected piece can use portals
  // Portal arrows: one per pair, only when selected piece can use them
  let portalArrows = null;
  if (
    portalPairs.length > 0 &&
    hasPortalMoves &&
    selectedSquare !== null &&
    portalEntrance !== null
  ) {
    // Find which pair the entrance belongs to
    const activePair = portalPairs.find(
      (p) => p.a === portalEntrance || p.b === portalEntrance,
    );
    if (activePair) {
      const entrance = portalEntrance;
      const exit = entrance === activePair.a ? activePair.b : activePair.a;

      const colFrom = flipped ? 7 - fileOf(entrance) : fileOf(entrance);
      const rowFrom = flipped ? rankOf(entrance) : 7 - rankOf(entrance);
      const colTo = flipped ? 7 - fileOf(exit) : fileOf(exit);
      const rowTo = flipped ? rankOf(exit) : 7 - rankOf(exit);
      const x1 = (colFrom + 0.5) * 12.5;
      const y1 = (rowFrom + 0.5) * 12.5;
      const x2 = (colTo + 0.5) * 12.5;
      const y2 = (rowTo + 0.5) * 12.5;
      const arrowColor =
        activePair.color === "blue"
          ? "rgba(30, 144, 255, 0.6)"
          : "rgba(255, 140, 0, 0.6)";

      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const motionPath = `M${x1},${y1} L${x2},${y2}`;
      const spacing = 2.5;
      const numChevrons = Math.max(4, Math.round(dist / spacing));
      const duration = numChevrons * 0.2;
      const chevrons = [];
      for (let i = 0; i < numChevrons; i++) {
        const delay = (i * duration) / numChevrons;
        chevrons.push(
          <g
            key={i}
            className="portal-chevron"
            style={
              {
                "--chevron-dur": `${duration}s`,
                animationDelay: `-${duration - delay}s`,
              } as React.CSSProperties
            }
          >
            <animateMotion
              dur={`${duration}s`}
              repeatCount="indefinite"
              begin={`-${delay}s`}
              path={motionPath}
            />
            <text
              textAnchor="middle"
              dy="0.35em"
              fill={arrowColor}
              fontSize="6"
              fontWeight="bold"
              transform={`rotate(${angle})`}
            >
              {"\u203A"}
            </text>
          </g>,
        );
      }

      portalArrows = (
        <svg className="portal-arrow-svg" viewBox="0 0 100 100">
          {chevrons}
        </svg>
      );
    }
  }

  // Piece traveling through portals, plus the burst at each portal it touches
  let portalAnimElement = null;
  let portalBurstElement = null;
  if (portalAnim && currentPortalPhase) {
    const phase = currentPortalPhase;
    const col = flipped ? 7 - fileOf(phase.sq) : fileOf(phase.sq);
    const row = flipped ? rankOf(phase.sq) : 7 - rankOf(phase.sq);
    let animClass = `portal-anim-piece portal-${phase.color}`;
    let animStyle: React.CSSProperties = {};

    if (phase.type === "approach" || phase.type === "slide") {
      const fromSq = phase.slideFrom ?? phase.sq;
      const dFile = fileOf(fromSq) - fileOf(phase.sq);
      const dRank = rankOf(fromSq) - rankOf(phase.sq);
      const dist = Math.max(Math.abs(dFile), Math.abs(dRank));
      const dur = Math.max(0.1, dist * 0.06);
      // Only pieces that have already been through a portal glow
      if (phase.type === "slide") animClass += " portal-anim-trail";
      animStyle = {
        "--slide-from-x": `${(flipped ? -dFile : dFile) * squareSize}px`,
        "--slide-from-y": `${(flipped ? dRank : -dRank) * squareSize}px`,
        animation: `slide-in ${dur}s ${phase.type === "approach" ? "ease-in" : "ease-out"} forwards`,
      } as React.CSSProperties;
    } else {
      animClass +=
        phase.type === "shrink" ? " portal-anim-enter" : " portal-anim-exit";
      portalBurstElement = (
        <PortalBurst
          key={`burst-${portalAnim.phaseIndex}`}
          color={phase.color}
          direction={phase.type === "shrink" ? "in" : "out"}
          style={
            {
              left: `${col * 12.5}%`,
              top: `${row * 12.5}%`,
              width: "12.5%",
              height: "12.5%",
              "--reach": `${squareSize * 0.8}px`,
            } as React.CSSProperties
          }
        />
      );
    }

    portalAnimElement = (
      <img
        key={`piece-${portalAnim.phaseIndex}`}
        src={pieceImage(portalAnim.info.piece)}
        className={animClass}
        style={{
          left: `${col * 12.5 + 0.625}%`,
          top: `${row * 12.5 + 0.625}%`,
          width: "11.25%",
          height: "11.25%",
          ...animStyle,
        }}
        draggable={false}
      />
    );
  }

  // Countdown overlay for player (White) only
  const countdownNumber =
    turn === Color.White && timeWhite <= 5 && timeWhite > 0
      ? Math.ceil(timeWhite)
      : null;

  const gravityRotation = gravityAngle;

  return (
    <div
      className={`board${showFog ? " fog-active" : ""}${portalPairs.length > 0 ? " portal-active" : ""}${gravityDirection ? " gravity-active" : ""}`}
      ref={boardRef}
      style={
        {
          ...(shrinkRing > 0 || dangerProgress > 0
            ? {
                "--shrink-ring": shrinkRing,
                "--danger-speed": `${Math.max(0.2, 1 - dangerProgress * 0.8)}s`,
              }
            : {}),
          ...(gravityRotation !== null
            ? {
                "--gravity-rotation": `${gravityRotation}deg`,
                transform: `rotate(${gravityRotation}deg)`,
              }
            : {}),
        } as React.CSSProperties
      }
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {rows}
      {hasRallyOverlay && (
        <div
          className={`deploy-zone-border${deployPieceType ? " dragging" : ""}`}
        />
      )}
      {portalArrows}
      {portalBurstElement}
      {portalAnimElement}
      {showFog && (
        <>
          <div
            className={`fog-overlay ${fogOnTop ? "fog-top" : "fog-bottom"}${fogExiting ? " fog-exit" : ""}`}
          >
            <div className="fog-layer fog-layer-1" />
            <div className="fog-layer fog-layer-2" />
            <div className="fog-layer fog-layer-3" />
            <div className="fog-layer fog-layer-4" />
            <div className="fog-layer fog-layer-5" />
            <div className="fog-layer fog-layer-6" />
            <div className="fog-layer fog-layer-7" />
            <div className="fog-layer fog-layer-8" />
            <div className="fog-layer fog-layer-9" />
            <div className="fog-layer fog-layer-10" />
            <div className="fog-layer fog-layer-11" />
            <div className="fog-layer fog-layer-12" />
            <div className="fog-layer-static fog-layer-13" />
            <div className="fog-layer-static fog-layer-14" />
            <div className="fog-layer-static fog-layer-15" />
            <div className="fog-layer-static fog-layer-16" />
            <div className="fog-layer-static fog-layer-17" />
          </div>
          <div
            className={`fog-overlay fog-friendly ${fogOnTop ? "fog-bottom" : "fog-top"}${fogExiting ? " fog-exit" : ""}`}
          >
            <div className="fog-layer fog-layer-1" />
            <div className="fog-layer fog-layer-3" />
            <div className="fog-layer fog-layer-5" />
            <div className="fog-layer fog-layer-8" />
          </div>
        </>
      )}
      {dragElement}
      {returnElement}
      {countdownNumber !== null && (
        <div className="countdown-overlay" key={countdownNumber}>
          <span className="countdown-number">{countdownNumber}</span>
        </div>
      )}
    </div>
  );
}
