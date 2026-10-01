import { useLayoutEffect, useRef, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { toIndex } from "../../utils/squareUtils";
import { Color, GameStatus, PieceType } from "../../engine";
import { pieceImage } from "../../utils/pieceImages";
import { Portal } from "./Portal";
import { PortalArrows } from "./PortalArrows";
import { PortalTravelPiece } from "./PortalTravelPiece";
import { DraggedPiece, ReturningPiece } from "./FloatingPieces";
import { FogOverlay } from "./FogOverlay";
import { readOverlays } from "./readOverlays";
import { usePieceDrag } from "./usePieceDrag";
import { phaseDurationMs, usePortalTravel } from "./usePortalTravel";
import type { PortalPhase } from "./usePortalTravel";
import { sfx } from "../../audio/sfx";
import {
  useFogExit,
  useGravityFalls,
  useMineExplosions,
  useSlideAnimation,
} from "./useBoardEffects";
import "./Board.css";

function playPortalPhase(phase: PortalPhase): void {
  if (phase.type === "shrink") sfx.portalEnter();
  if (phase.type === "pop" || phase.type === "fly") {
    sfx.portalExit(phaseDurationMs(phase));
  }
}

function CooldownPie({ total, gen }: { total: number; gen: number }) {
  return (
    <svg key={gen} className="cooldown-pie" viewBox="0 0 36 36">
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
          animationDuration: `${total}ms`,
          animationTimingFunction: "linear",
          animationFillMode: "forwards",
        }}
      />
    </svg>
  );
}

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
    game,
    pluginManager,
    timeWhite,
    turn,
    deployPieceType,
    resolveExplosion,
  } = useGameStore();

  const boardRef = useRef<HTMLDivElement>(null);
  const [squareSize, setSquareSize] = useState(72);
  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const observer = new ResizeObserver(() =>
      setSquareSize(board.offsetWidth / 8),
    );
    observer.observe(board);
    return () => observer.disconnect();
  }, []);

  const overlays = readOverlays(pluginManager.getAllOverlays());

  const {
    drag,
    returnAnim,
    dragImgRef,
    wasDropRef,
    droppedMoveRef,
    onPiecePointerDown,
    onPointerMove,
    onPointerUp,
  } = usePieceDrag({
    boardRef,
    squareSize,
    turn: game.turn,
    onFrame: sfx.portalProximity,
  });

  const {
    travel,
    closingPortals,
    openingPortals,
    surgingPortal,
    portalCharge,
  } = usePortalTravel({
    lastPortalMove,
    droppedMoveRef,
    portalSquares: overlays.portalSquares,
    drag,
    primedPortal: selectedSquare !== null ? portalEntrance : null,
    onPhase: playPortalPhase,
  });

  const slides = useSlideAnimation({
    lastMove,
    lastAutonomousMoves,
    isPortalMove: lastPortalMove !== null,
    wasDropRef,
    flipped,
    squareSize,
  });
  const gravityFalls = useGravityFalls(
    overlays.gravityMoves,
    flipped,
    squareSize,
  );
  const explosions = useMineExplosions(
    overlays.pendingExplosions,
    resolveExplosion,
  );
  const fogExiting = useFogExit(overlays.hasFog);
  const showFog = overlays.hasFog || fogExiting;

  const rows = [];
  for (let visualRow = 0; visualRow < 8; visualRow++) {
    const rank = flipped ? visualRow : 7 - visualRow;
    const cols = [];
    for (let visualCol = 0; visualCol < 8; visualCol++) {
      const file = flipped ? 7 - visualCol : visualCol;
      const sq = toIndex(file, rank);
      const piece = game.board.get(sq);
      const squareMods = pluginManager.getSquareModifiers(sq);
      const isDead = squareMods.some((m) => m.className === "dead-square");
      const isLegalTarget = legalMoveSquares.includes(sq);
      const isLastMove =
        lastMove && (sq === lastMove.from || sq === lastMove.to);
      const isCheck =
        gravityFalls.size === 0 &&
        piece?.type === PieceType.King &&
        piece.color === game.turn &&
        (status === GameStatus.Check || status === GameStatus.Checkmate);
      const isDeployTarget =
        overlays.hasRally && deployPieceType && !piece && !isDead && rank <= 3;
      // Floating copies of the piece are drawn above the board instead
      const isLifted =
        (drag?.isDragging && drag.sq === sq) ||
        returnAnim?.sq === sq ||
        travel?.info.landing === sq;

      let className = `square ${(rank + file) % 2 !== 0 ? "light" : "dark"}`;
      for (const mod of squareMods) {
        if (mod.className) className += ` ${mod.className}`;
      }
      if (sq === selectedSquare) className += " selected";
      if (isLastMove && !isDead) className += " last-move";
      if (isCheck) className += " in-check";
      if (drag?.isDragging && isLegalTarget) className += " drag-target";
      if (isDeployTarget) className += " deploy-target";

      const slide = slides.get(sq);
      const fall = gravityFalls.get(sq);
      const pieceStyle = slide
        ? ({
            "--slide-from-x": `${slide.x}px`,
            "--slide-from-y": `${slide.y}px`,
            animation: "slide-in 0.2s ease-out forwards",
          } as React.CSSProperties)
        : fall
          ? ({
              "--grav-x": `${fall.x}px`,
              "--grav-y": `${fall.y}px`,
              animation: "gravity-fall 0.6s ease-in-out 1.05s both",
            } as React.CSSProperties)
          : undefined;

      const portalColor = overlays.portalSquares.get(sq);
      const closingColor = closingPortals.get(sq);
      const isHidden = overlays.strategoHidden.has(sq);
      const cooldown = overlays.rallyCooldowns[sq];

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
                openingPortals.has(sq)
                  ? "spawn"
                  : surgingPortal === sq
                    ? "surge"
                    : "idle"
              }
              {...portalCharge(sq)}
            />
          )}
          {closingColor && <Portal color={closingColor} state="despawn" />}

          {isLegalTarget && !drag?.isDragging && (
            <div className={piece ? "capture-hint" : "move-hint"} />
          )}

          {overlays.strategoLakes.has(sq) && (
            <div className="stratego-lake-tile" />
          )}

          {piece && !isLifted && !isDead && (
            <>
              <img
                src={pieceImage(piece)}
                alt={`${piece.color}${piece.type}`}
                className={`piece-img${isHidden ? " stratego-piece-hidden" : ""}`}
                style={pieceStyle}
                draggable={false}
                onPointerDown={(e) => onPiecePointerDown(e, sq, piece)}
              />
              {isHidden && (
                <div className="stratego-mask" style={pieceStyle}>
                  ?
                </div>
              )}
              {cooldown && (
                <CooldownPie total={cooldown.total} gen={cooldown.gen} />
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

  const countdown =
    turn === Color.White && timeWhite <= 5 && timeWhite > 0
      ? Math.ceil(timeWhite)
      : null;

  const boardClass =
    "board" +
    (showFog ? " fog-active" : "") +
    (overlays.portalPairs.length > 0 ? " portal-active" : "") +
    (overlays.gravityDirection ? " gravity-active" : "");

  const { shrinkRing, dangerProgress, gravityAngle } = overlays;
  const boardStyle = {
    ...((shrinkRing > 0 || dangerProgress > 0) && {
      "--shrink-ring": shrinkRing,
      "--danger-speed": `${Math.max(0.2, 1 - dangerProgress * 0.8)}s`,
    }),
    ...(gravityAngle !== null && {
      "--gravity-rotation": `${gravityAngle}deg`,
      transform: `rotate(${gravityAngle}deg)`,
    }),
  } as React.CSSProperties;

  return (
    <div
      className={boardClass}
      ref={boardRef}
      style={boardStyle}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {rows}
      {overlays.hasRally && (
        <div
          className={`deploy-zone-border${deployPieceType ? " dragging" : ""}`}
        />
      )}
      {hasPortalMoves && selectedSquare !== null && portalEntrance !== null && (
        <PortalArrows
          pairs={overlays.portalPairs}
          entrance={portalEntrance}
          flipped={flipped}
        />
      )}
      {travel && (
        <PortalTravelPiece
          travel={travel}
          flipped={flipped}
          squareSize={squareSize}
        />
      )}
      {showFog && <FogOverlay enemyOnTop={!flipped} exiting={fogExiting} />}
      {drag?.isDragging && (
        <DraggedPiece drag={drag} imgRef={dragImgRef} squareSize={squareSize} />
      )}
      {returnAnim && (
        <ReturningPiece anim={returnAnim} squareSize={squareSize} />
      )}
      {countdown !== null && (
        <div className="countdown-overlay" key={countdown}>
          <span className="countdown-number">{countdown}</span>
        </div>
      )}
    </div>
  );
}
