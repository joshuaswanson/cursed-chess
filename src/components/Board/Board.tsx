import { useLayoutEffect, useRef, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { rankOf, toIndex } from "../../utils/squareUtils";
import { Color, GameStatus, PieceType } from "../../engine";
import type { SquareIndex } from "../../engine";
import { pieceImage } from "../../utils/pieceImages";
import { Portal } from "./Portal";
import { PortalArrows } from "./PortalArrows";
import { PortalTravelPiece } from "./PortalTravelPiece";
import { DraggedPiece, ReturningPiece } from "./FloatingPieces";
import { BoardFog } from "../Fog/Fog";
import { CollapsingRing, DoomedTile, Fissure } from "./BattleRoyale";
import { useRingCollapse } from "./useRingCollapse";
import { offsetBetween } from "./boardGeometry";
import { readOverlays } from "./readOverlays";
import { usePieceDrag } from "./usePieceDrag";
import { phaseDurationMs, usePortalTravel } from "./usePortalTravel";
import type { PortalPhase } from "./usePortalTravel";
import { sfx } from "../../audio/sfx";
import {
  useGravityFalls,
  useMineExplosions,
  useSlideAnimation,
} from "./useBoardEffects";
import "./Board.css";
import "./BoardSkins.css";

const FILES = "abcdefgh";

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

  const battleRoyale = overlays.battleRoyale;
  const dangerProgress = battleRoyale?.dangerProgress ?? 0;
  const collapse = useRingCollapse(
    battleRoyale?.lastCollapse ?? null,
    dangerProgress,
  );
  const doomed = new Set(battleRoyale?.doomed ?? []);
  const kingLeaps = new Map(
    (collapse?.kingLeaps ?? []).map((leap) => [
      leap.to,
      offsetBetween(leap.from, leap.to, flipped, squareSize),
    ]),
  );

  // Stratego's lakes sit in a river across the middle; the other squares there are bridges
  const lakes = overlays.strategoLakes;
  const riverRanks = new Set([...lakes].map(rankOf));
  const riverClasses = (file: number, rank: number, sq: SquareIndex) => {
    if (riverRanks.size === 0) return "";
    if (riverRanks.has(rank)) {
      if (lakes.has(sq)) return "";
      const isOpen = (f: number) =>
        f < 0 || f > 7 || lakes.has(toIndex(f, rank));
      const left = flipped ? file + 1 : file - 1;
      const right = flipped ? file - 1 : file + 1;
      return (
        " bridge" +
        (isOpen(left) ? " bridge-rail-left" : "") +
        (isOpen(right) ? " bridge-rail-right" : "")
      );
    }
    const above = flipped ? rank - 1 : rank + 1;
    const below = flipped ? rank + 1 : rank - 1;
    return (
      (riverRanks.has(above) ? " bank-top" : "") +
      (riverRanks.has(below) ? " bank-bottom" : "")
    );
  };

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
      className += riverClasses(file, rank, sq);

      const slide = slides.get(sq);
      const fall = gravityFalls.get(sq);
      const leap = kingLeaps.get(sq);
      const pieceStyle = leap
        ? ({
            "--slide-from-x": `${leap.x}px`,
            "--slide-from-y": `${leap.y}px`,
            animation: "br-king-leap 0.75s cubic-bezier(0.3, 0, 0.3, 1) both",
          } as React.CSSProperties)
        : slide
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

          {doomed.has(sq) && <DoomedTile sq={sq} progress={dangerProgress} />}

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

          {visualCol === 0 && (
            <span className="coord coord-rank">{rank + 1}</span>
          )}
          {visualRow === 7 && (
            <span className="coord coord-file">{FILES[file]}</span>
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

  const countdown =
    turn === Color.White && timeWhite <= 5 && timeWhite > 0
      ? Math.ceil(timeWhite)
      : null;

  const boardClass =
    "board" +
    (overlays.hasFog ? " fog-active" : "") +
    (overlays.portalPairs.length > 0 ? " portal-active" : "") +
    (overlays.gravityDirection ? " gravity-active" : "") +
    (battleRoyale ? " battle-royale" : "") +
    (collapse ? " br-quake" : "") +
    (dangerProgress >= 0.6 ? " br-trembling" : "");

  const { gravityAngle } = overlays;
  const boardStyle = {
    ...(battleRoyale && {
      "--shrink-ring": battleRoyale.shrinkRing,
    }),
  } as React.CSSProperties;
  // The frame turns with the board so the board never pokes through it
  const shellStyle = {
    ...(gravityAngle !== null && {
      "--gravity-rotation": `${gravityAngle}deg`,
      transform: `rotate(${gravityAngle}deg)`,
    }),
  } as React.CSSProperties;

  return (
    <div
      className={`board-shell${overlays.gravityDirection ? " gravity-active" : ""}`}
      style={shellStyle}
    >
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
        {hasPortalMoves &&
          selectedSquare !== null &&
          portalEntrance !== null && (
            <PortalArrows
              pairs={overlays.portalPairs}
              entrance={portalEntrance}
              flipped={flipped}
            />
          )}
        {battleRoyale && (
          <Fissure
            ring={Math.max(1, battleRoyale.shrinkRing)}
            progress={dangerProgress}
            collapsed={battleRoyale.shrinkRing > 0}
          />
        )}
        {collapse && <CollapsingRing collapse={collapse} flipped={flipped} />}
        {travel && (
          <PortalTravelPiece
            travel={travel}
            flipped={flipped}
            squareSize={squareSize}
          />
        )}
        <BoardFog active={overlays.hasFog} enemyOnTop={!flipped} />
        {drag?.isDragging && (
          <DraggedPiece
            drag={drag}
            imgRef={dragImgRef}
            squareSize={squareSize}
          />
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
    </div>
  );
}
