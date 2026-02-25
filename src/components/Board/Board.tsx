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

interface PortalAnimPhase {
  type: "approach" | "shrink" | "pop" | "slide";
  sq: SquareIndex;
  slideFrom?: SquareIndex;
}

export function Board() {
  const {
    selectedSquare,
    legalMoveSquares,
    hasPortalMoves,
    portalEntrance,
    lastMove,
    lastPortalMove,
    flipped,
    status,
    selectSquare,
    makeMove,
    getPiece,
    game,
    pluginManager,
    timeWhite,
    turn,
    deployPieceType,
    resolveExplosion,
  } = useGameStore();

  const boardRef = useRef<HTMLDivElement>(null);
  const dragImgRef = useRef<HTMLImageElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [anim, setAnim] = useState<AnimState | null>(null);
  const [returnAnim, setReturnAnim] = useState<ReturnAnim | null>(null);
  const [portalAnim, setPortalAnim] = useState<{
    phases: PortalAnimPhase[];
    phaseIndex: number;
    info: PortalMoveInfo;
  } | null>(null);
  const [pickupTransition, setPickupTransition] = useState(false);
  const [closingPortals, setClosingPortals] = useState<Map<number, string>>(
    new Map(),
  );
  const [openingPortals, setOpeningPortals] = useState<Set<number>>(new Set());
  const dragJustStarted = useRef(false);
  const wasDrag = useRef(false);
  const prevLastMove = useRef(lastMove);
  const prevPortalMove = useRef(lastPortalMove);
  const prevPortalKeys = useRef<string>("");
  const prevPortalColors = useRef<Map<number, string>>(new Map());
  const [fogExiting, setFogExiting] = useState(false);
  const prevFog = useRef(false);
  const [explosions, setExplosions] = useState<Set<number>>(new Set());
  const prevExploded = useRef<Set<number>>(new Set());
  const [gravityFalls, setGravityFalls] = useState<
    Map<number, { offsetX: number; offsetY: number }>
  >(new Map());
  const prevGravityKey = useRef("");

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
      setPickupTransition(false);
      dragJustStarted.current = false;
      cancelAnimationFrame(rafRef.current);
      return;
    }

    // Mark that drag just started so layoutEffect can set initial position
    dragJustStarted.current = true;
    setPickupTransition(true);
    const pickupTimer = setTimeout(() => setPickupTransition(false), 200);

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
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(pickupTimer);
    };
  }, [drag?.isDragging]);

  // Position drag element at board square before first paint, then let React move it to cursor
  useLayoutEffect(() => {
    if (!dragJustStarted.current || !dragImgRef.current || !drag?.isDragging)
      return;
    dragJustStarted.current = false;

    const center = getSquareScreenCenter(drag.sq);
    if (!center) return;

    const el = dragImgRef.current;
    const sqSize = boardRef.current
      ? boardRef.current.getBoundingClientRect().width / 8
      : 72;
    const boardPieceSize = sqSize * 0.9;

    // Position at board square before browser paints
    el.style.left = `${center.x - boardPieceSize / 2}px`;
    el.style.top = `${center.y - boardPieceSize / 2}px`;
    el.style.width = `${boardPieceSize}px`;
    el.style.height = `${boardPieceSize}px`;

    // Force reflow so the browser registers the starting position
    el.getBoundingClientRect();
  });

  // Slide animation on click-to-move (skip for portal moves)
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

    const dFile = fileOf(lastMove.from) - fileOf(lastMove.to);
    const dRank = rankOf(lastMove.from) - rankOf(lastMove.to);

    const squareSize = boardRef.current
      ? boardRef.current.getBoundingClientRect().width / 8
      : 72;

    const offsetX = (flipped ? -dFile : dFile) * squareSize;
    const offsetY = (flipped ? dRank : -dRank) * squareSize;

    setAnim({ sq: lastMove.to, offsetX, offsetY });
    const timer = setTimeout(() => setAnim(null), 600);
    return () => clearTimeout(timer);
  }, [lastMove, lastPortalMove, flipped]);

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
        slideFrom: from,
      });
    }

    for (let i = 0; i < transits.length; i++) {
      // Shrink at entrance
      phases.push({ type: "shrink", sq: transits[i].entrance });
      // Pop at exit
      phases.push({ type: "pop", sq: transits[i].exit });
      // Slide from exit to next entrance (if there's a next transit)
      if (i < transits.length - 1) {
        phases.push({
          type: "slide",
          sq: transits[i + 1].entrance,
          slideFrom: transits[i].exit,
        });
      }
    }

    // Final slide: from last exit to landing (skip if same square)
    const lastExit = transits[transits.length - 1].exit;
    if (lastExit !== landing) {
      phases.push({ type: "slide", sq: landing, slideFrom: lastExit });
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
      duration = 300;
    } else {
      // pop
      duration = 300;
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
          const rawMoves = game.getLegalMoves(drag.sq);
          const legalMoves = pluginManager.invokeModifyLegalMoves(
            rawMoves,
            game.turn,
          );
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

  // Collect overlay data for rendering
  const overlays = pluginManager.getAllOverlays();
  const portalSquares = new Map<number, string>();
  const portalPairs: { a: SquareIndex; b: SquareIndex; color: string }[] = [];
  let hasFogOverlay = false;
  let hasRallyOverlay = false;
  let shrinkRing = 0;
  let dangerProgress = 0;
  let gravityDirection: string | null = null;
  let gravityAngle: number | null = null;
  let gravityMovesFromOverlay: { from: number; to: number }[] = [];
  for (const overlay of overlays) {
    if (overlay.type === "portal" && overlay.squares.length === 2) {
      const color = (overlay.data as { color: string })?.color ?? "blue";
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
  }

  // Detect portal repositioning
  const portalKey = [...portalSquares.keys()].sort().join(",");
  useEffect(() => {
    const prev = prevPortalKeys.current;
    const prevColors = prevPortalColors.current;
    prevPortalKeys.current = portalKey;
    prevPortalColors.current = new Map(portalSquares);
    if (!prev || prev === portalKey || portalKey === "") return;

    const oldSquares = new Set(prev.split(",").map(Number));
    const newSquares = new Set(portalKey.split(",").map(Number));

    // Old squares that are no longer portals = closing (with their old color)
    const closing = new Map<number, string>();
    for (const sq of oldSquares) {
      if (!newSquares.has(sq)) {
        closing.set(sq, prevColors.get(sq) ?? "blue");
      }
    }

    // New squares that weren't portals before = opening
    const opening = new Set<number>();
    for (const sq of newSquares) {
      if (!oldSquares.has(sq)) {
        opening.add(sq);
      }
    }

    if (closing.size > 0) setClosingPortals(closing);
    if (opening.size > 0) setOpeningPortals(opening);

    const timer = setTimeout(() => {
      setClosingPortals(new Map());
      setOpeningPortals(new Set());
    }, 600);
    return () => clearTimeout(timer);
  }, [portalKey]);

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
  const pendingExplosionSquares = minefieldOverlay?.squares ?? [];
  const pendingKey = pendingExplosionSquares.join(",");

  useEffect(() => {
    if (pendingExplosionSquares.length === 0) return;

    // Wait for slide animation to finish, then show explosion
    const slideTimer = setTimeout(() => {
      setExplosions(new Set(pendingExplosionSquares));

      // After explosion animation, remove the pieces
      const resolveTimer = setTimeout(() => {
        for (const sq of pendingExplosionSquares) {
          resolveExplosion(sq);
        }
        setExplosions(new Set());
      }, 600);

      return () => clearTimeout(resolveTimer);
    }, 350);

    return () => clearTimeout(slideTimer);
  }, [pendingKey]);

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

    const sqSize = boardRef.current
      ? boardRef.current.getBoundingClientRect().width / 8
      : 72;

    const offsets = new Map<number, { offsetX: number; offsetY: number }>();
    for (const { from, to } of gravityMovesFromOverlay) {
      const fromCol = flipped ? 7 - fileOf(from) : fileOf(from);
      const fromRow = flipped ? rankOf(from) : 7 - rankOf(from);
      const toCol = flipped ? 7 - fileOf(to) : fileOf(to);
      const toRow = flipped ? rankOf(to) : 7 - rankOf(to);
      offsets.set(to, {
        offsetX: (fromCol - toCol) * sqSize,
        offsetY: (fromRow - toRow) * sqSize,
      });
    }

    setGravityFalls(offsets);

    // Clean up after rotation (1s) + slide (0.6s) + buffer
    const timer = setTimeout(() => setGravityFalls(new Map()), 1800);
    return () => clearTimeout(timer);
  }, [gravityMoveKey, flipped]);

  // Fog always covers the enemy half (human plays White, enemy = top)
  const showFog = hasFogOverlay || fogExiting;
  const fogOnTop = showFog && !flipped;

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
      const isAnimating = anim && anim.sq === sq;

      let className = "square";
      if (portalColor) {
        className += " portal-square";
      } else {
        className += isLight ? " light" : " dark";
      }
      // Apply plugin square modifier classes (dead-square, danger-square, etc.)
      for (const mod of squareMods) {
        if (mod.className) className += ` ${mod.className}`;
      }
      if (isSelected) className += " selected";
      if (isLastMoveSquare && !isDead) className += " last-move";
      if (isCheck) className += " in-check";
      if (drag?.isDragging && isLegalTarget) className += " drag-target";

      // Deploy zone indicator: player's half during rally mode
      if (hasRallyOverlay && !isDead && rank <= 3) className += " deploy-zone";

      // Deploy target highlight: empty square on player's half (ranks 0-3)
      const isDeployTarget = deployPieceType && !piece && !isDead && rank <= 3;
      if (isDeployTarget) className += " deploy-target";

      // Inline style for slide + rock animation
      const gravFall = gravityFalls.get(sq);
      const pieceStyle: React.CSSProperties | undefined = isAnimating
        ? ({
            "--slide-from-x": `${anim.offsetX}px`,
            "--slide-from-y": `${anim.offsetY}px`,
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
            <div
              className={`portal-overlay portal-${portalColor}${isOpeningPortal ? " portal-spawn" : ""}`}
            />
          )}

          {isClosingPortal && (
            <div
              className={`portal-overlay portal-${closingPortals.get(sq) ?? "blue"} portal-despawn`}
            />
          )}

          {isLegalTarget && !drag?.isDragging && (
            <div className={piece ? "capture-hint" : "move-hint"} />
          )}

          {piece && !isDragSource && !isDead && (
            <img
              src={getPieceImage(piece)}
              alt={`${piece.color}${piece.type}`}
              className="piece-img"
              style={pieceStyle}
              draggable={false}
              onPointerDown={(e) => handlePointerDown(e, sq, piece)}
            />
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

  // Floating drag piece
  const squareSize = boardRef.current
    ? boardRef.current.getBoundingClientRect().width / 8
    : 72;

  let dragElement = null;
  if (drag?.isDragging) {
    const dragClass = pickupTransition
      ? "piece-dragging piece-pickup"
      : "piece-dragging";

    dragElement = (
      <img
        ref={dragImgRef}
        src={getPieceImage(drag.piece)}
        className={dragClass}
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
    const isBack = returnAnim.started;
    const pos = isBack
      ? { x: returnAnim.toX, y: returnAnim.toY }
      : { x: returnAnim.fromX, y: returnAnim.fromY };
    const angle = isBack ? 0 : returnAnim.startAngle;
    const size = isBack ? squareSize * 0.9 : squareSize * 1.1;
    const offset = size / 2;
    returnElement = (
      <img
        src={getPieceImage(returnAnim.piece)}
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

  // Portal animation element (phase-based: approach/shrink/pop/slide)
  let portalAnimElement = null;
  if (portalAnim) {
    const currentPhase = portalAnim.phases[portalAnim.phaseIndex];
    const { info } = portalAnim;

    if (currentPhase) {
      let animSq: SquareIndex = currentPhase.sq;
      let animClass: string;
      let animStyle: React.CSSProperties = {};

      if (currentPhase.type === "approach" || currentPhase.type === "slide") {
        animClass = "portal-anim-piece portal-anim-slide";
        const fromSq = currentPhase.slideFrom ?? animSq;
        const dFile = fileOf(fromSq) - fileOf(animSq);
        const dRank = rankOf(fromSq) - rankOf(animSq);
        const dist = Math.max(Math.abs(dFile), Math.abs(dRank));
        const dur = Math.max(0.1, dist * 0.06);
        const sqSz = boardRef.current
          ? boardRef.current.getBoundingClientRect().width / 8
          : 72;
        const ox = (flipped ? -dFile : dFile) * sqSz;
        const oy = (flipped ? dRank : -dRank) * sqSz;
        animStyle = {
          "--slide-from-x": `${ox}px`,
          "--slide-from-y": `${oy}px`,
          animation: `slide-in ${dur}s ${currentPhase.type === "approach" ? "ease-in" : "ease-out"} forwards`,
        } as React.CSSProperties;
      } else if (currentPhase.type === "shrink") {
        animClass = "portal-anim-piece portal-anim-shrink";
      } else {
        // pop
        animClass = "portal-anim-piece portal-anim-pop";
      }

      const af = fileOf(animSq);
      const ar = rankOf(animSq);
      const ac = flipped ? 7 - af : af;
      const arw = flipped ? ar : 7 - ar;

      portalAnimElement = (
        <img
          src={getPieceImage(info.piece)}
          className={animClass}
          style={{
            left: `${ac * 12.5 + 0.625}%`,
            top: `${arw * 12.5 + 0.625}%`,
            width: "11.25%",
            height: "11.25%",
            ...animStyle,
          }}
          draggable={false}
        />
      );
    }
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
      {portalArrows}
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
