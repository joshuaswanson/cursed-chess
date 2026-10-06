import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { rankOf, toIndex } from "../../utils/squareUtils";
import { Color, GameStatus, PieceType, isGameOver } from "../../engine";
import type { SquareIndex } from "../../engine";
import { pieceImage } from "../../utils/pieceImages";
import { useKitImages } from "../../utils/kitImages";
import { Portal } from "./Portal";
import { Battlefield, WorldRiver } from "./Battlefield";
import { BoardShatter } from "../HexWarp/HexWarp";
import { MineBlast } from "./MineBlast";
import { Crater } from "./Crater";
import { FootballLayer, Goal, PassMarker, Pitch, Commentary } from "./Football";
import { ArrivingPiece, ReinforcementBanner } from "./Reinforcements";
import type { FootballPlugin } from "../../plugins/football";
import type { PortalChessPlugin } from "../../plugins/portalChess";
import type { GravityPlugin } from "../../plugins/gravity";
import { BattleEffects, BattleUnit, TrenchGuns } from "./Battle";
import {
  visualCol as colOnScreen,
  visualRow as rowOnScreen,
} from "./boardGeometry";
import { PortalArrows } from "./PortalArrows";
import { Sideline } from "./Sideline";
import { HillThrone } from "./HillThrone";
import { TugLayer } from "./TugOfWar";
import { Tombstone, ZombiePiece } from "./Zombies";
import type { TrenchView } from "../../plugins/trenches";
import { TRENCH_RANKS } from "../../plugins/trenches";
import { BoardCraters, TrenchField } from "./TrenchField";
import { behindSandbags } from "./trenchFront";
import { RainRipples } from "./RainRipples";
import { LineOrders } from "../Trenches/LineOrders";
import {
  WorldCraters,
  WorldTrenches,
  WorldTrenchesBank,
  WorldTrenchesFront,
} from "./WorldTrenches";
import { PortalTravelPiece } from "./PortalTravelPiece";
import { DraggedPiece, ReturningPiece } from "./FloatingPieces";
import { BoardFog } from "../Fog/Fog";
import { BrokenRim, CollapsingRing, DoomedTile, Fissure } from "./BattleRoyale";
import { useRingCollapse } from "./useRingCollapse";
import { offsetBetween } from "./boardGeometry";
import { readOverlays } from "./readOverlays";
import { usePieceDrag } from "./usePieceDrag";
import { phaseDurationMs, usePortalTravel } from "./usePortalTravel";
import type { PortalPhase } from "./usePortalTravel";
import { sfx } from "../../audio/sfx";
import {
  useGravityShift,
  useMineExplosions,
  useCaptureBurst,
  useSlideAnimation,
  useShotDives,
  useHeave,
  useTugDrags,
  useZombieActs,
  useGraveBounce,
  useZombieAmbience,
  DRAG_MS,
  RUNOFF_MS,
  CAPTURE_BURST_MS,
  usePlayCall,
  goalReaction,
  DIVE_MS,
  SLIDE_MS,
} from "./useBoardEffects";
import type { GravityFall } from "./useBoardEffects";
import "./Board.css";
import "./BoardSkins.css";

const FILES = "abcdefgh";
/** A beat after a move lands before the portals move */
const PORTAL_SETTLE_MS = 150;

/** Warns that gravity is turning: the arrow starts at the new fall direction and swings down with the board */
/** How a unit in the trenches stands: caught on the wire, charging, or just holding */
function trenchStance(
  view: TrenchView | null,
  unitId: number | undefined,
  inTrench: boolean,
): "snagged" | "charging" | "peeking" | "crouched" | undefined {
  if (!view || unitId === undefined) return undefined;
  if (view.snagged.includes(unitId)) return "snagged";
  if (view.charging.includes(unitId)) return "charging";
  if (!inTrench) return undefined;
  // Down in a trench a man stays crouched below the parapet, coming up only to look or fire
  return view.exposed.includes(unitId) ? "peeking" : "crouched";
}

/** Whether a square lies in one of the trench lines */
const inTrenchLine = (sq: SquareIndex) =>
  Object.values(TRENCH_RANKS).some(
    (t) => t.front === rankOf(sq) || t.back === rankOf(sq),
  );

/** A one-square step from one square toward another, however far apart they are */
function oneSquareToward(
  target: number,
  from: number,
  flipped: boolean,
  squareSize: number,
) {
  const { x, y } = offsetBetween(target, from, flipped, 1);
  const longest = Math.max(Math.abs(x), Math.abs(y)) || 1;
  return { x: (x / longest) * squareSize, y: (y / longest) * squareSize };
}

/** A board offset as a pair of CSS custom properties, `name-x` and `name-y` */
function offsetVars(name: string, { x, y }: { x: number; y: number }) {
  return { [`${name}-x`]: `${x}px`, [`${name}-y`]: `${y}px` };
}

function GravityAlert({ delta }: { delta: number }) {
  return (
    <div className="gravity-alert" aria-live="polite">
      <div
        className="gravity-arrow"
        style={{ "--from": `${-delta}deg` } as React.CSSProperties}
        aria-hidden
      >
        <svg viewBox="0 0 60 60">
          <path d="M30 6 V44 M14 30 L30 48 L46 30" />
        </svg>
      </div>
      <span className="gravity-alert-label">Gravity shift!</span>
    </div>
  );
}

/** How long the board takes to swing back upright once gravity mode ends */
const UNSPIN_MS = 800;

/**
 * Turns the board frame with the gravity board's slow spin, every frame. At
 * diagonal angles the board shrinks so its corners stay inside its spot.
 */
function useGravitySpin(
  shellRef: React.RefObject<HTMLDivElement | null>,
  active: boolean,
) {
  useEffect(() => {
    const shell = shellRef.current;
    if (!active || !shell) return;
    let frame = 0;
    const draw = () => {
      const gravity = useGameStore
        .getState()
        .pluginManager.find<GravityPlugin>("gravity");
      if (gravity) {
        const angle = gravity.spinAt(performance.now());
        const t = (angle * Math.PI) / 180;
        const fit = 1 / (Math.abs(Math.cos(t)) + Math.abs(Math.sin(t)));
        shell.style.transform = `rotate(${angle}deg) scale(${fit})`;
      }
      frame = requestAnimationFrame(draw);
    };
    shell.style.transition = "none";
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      shell.style.transition = `transform ${UNSPIN_MS}ms cubic-bezier(0.34, 1.45, 0.64, 1)`;
      shell.style.transform = "";
      setTimeout(() => (shell.style.transition = ""), UNSPIN_MS);
    };
  }, [shellRef, active]);
}

function playPortalPhase(phase: PortalPhase): void {
  if (phase.type === "shrink") sfx.portalEnter();
  if (phase.type === "pop" || phase.type === "fly") {
    sfx.portalExit(phaseDurationMs(phase));
  }
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
    game,
    pluginManager,
    deployPieceType,
    resolveExplosion,
    hexTransition,
    moveHistory,
    cursed,
    kickOptions,
    kick,
    reinforcements,
    sidelineKings,
    sidelineBench,
    arrivalStyle,
    introDone,
  } = useGameStore();

  const boardRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
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
    landing,
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

  useEffect(() => {
    if (openingPortals.size > 0) sfx.portalOpen();
  }, [openingPortals]);

  // Nobody's clock runs while a piece is still on its way through a portal
  const travelling = travel !== null;
  useEffect(() => {
    useGameStore.setState({ portalTravelling: travelling });
  }, [travelling]);
  useEffect(() => () => useGameStore.setState({ portalTravelling: false }), []);

  // Portals only move once the last move has finished sliding or flying
  const portalsDue =
    pluginManager.find<PortalChessPlugin>("portal-chess")?.respawnDue ?? false;
  const settlePortals = useGameStore((s) => s.settlePortals);

  const slides = useSlideAnimation({
    lastMove,
    isPortalMove: lastPortalMove !== null,
    wasDropRef,
    flipped,
    squareSize,
  });
  useEffect(() => {
    if (!portalsDue || travel || slides.size > 0) return;
    const timer = setTimeout(settlePortals, PORTAL_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [portalsDue, travel, slides, settlePortals]);

  useGravitySpin(shellRef, overlays.gravityDirection !== null);
  // A heave waits for the move that ended the round to land, and for any capture's burst
  const heaveDelay = moveHistory[moveHistory.length - 1]?.move.captured
    ? SLIDE_MS + CAPTURE_BURST_MS
    : SLIDE_MS + 100;
  const tugDrags = useTugDrags(
    overlays.tug?.heave ?? 0,
    overlays.tug?.heaveDir ?? 0,
    overlays.tug?.dragged ?? [],
    flipped,
    squareSize,
    heaveDelay,
  );
  const tugYank = useHeave(
    overlays.tug?.heave ?? 0,
    overlays.tug?.heaveDir ?? 0,
    flipped,
    heaveDelay,
  );
  const shotDives = useShotDives(
    overlays.football?.lastKick ?? null,
    flipped,
    squareSize,
  );
  const gravityShift = useGravityShift(
    overlays.gravityMoves,
    overlays.gravityAngle,
    flipped,
    squareSize,
  );
  const gravityFalls =
    gravityShift?.falls ?? new Map<SquareIndex, GravityFall>();
  const lastRecord = moveHistory[moveHistory.length - 1];
  const kitFor = useKitImages(
    Object.entries(overlays.football?.shirts ?? {}).flatMap(([sq, number]) => {
      const piece = game.board.get(Number(sq));
      return piece ? [{ piece, number }] : [];
    }),
    pieceImage,
  );
  // In FIFA, taking the player on the ball wins it
  const ballWon =
    overlays.football !== null &&
    lastRecord?.move.captured &&
    overlays.football.ball === lastRecord.move.to
      ? lastRecord.move
      : null;
  const playCall = usePlayCall(
    overlays.football?.lastKick ?? null,
    ballWon,
    moveHistory.length,
    overlays.football?.shirts ?? {},
  );
  const zombieActs = useZombieActs(overlays.zombies, flipped, squareSize);
  const zombiesActing = zombieActs.size > 0;
  useEffect(() => {
    useGameStore.setState({ zombiesActing });
  }, [zombiesActing]);
  useEffect(() => () => useGameStore.setState({ zombiesActing: false }), []);
  const graveBounce =
    overlays.zombies?.bounce &&
    lastMove?.to === overlays.zombies.bounce.via &&
    lastMove.from === overlays.zombies.bounce.from
      ? overlays.zombies.bounce
      : null;
  useGraveBounce(graveBounce);
  useZombieAmbience(Object.keys(overlays.zombies?.zombies ?? {}).length);
  const menace = overlays.zombies?.menace ?? null;
  const capture = useCaptureBurst(
    cursed && lastPortalMove === null && lastRecord?.move.captured
      ? lastRecord.move.to
      : null,
    moveHistory.length,
    SLIDE_MS,
  );
  // A capture through a portal bursts once the piece has flown out and landed
  const portalCapture = useCaptureBurst(
    cursed && landing?.info.capture ? landing.info.landing : null,
    landing?.seq ?? 0,
  );
  const bursts = [capture, portalCapture].filter((b) => b !== null);

  const { armed: minesArmed, blasting: minesBlasting } = useMineExplosions(
    overlays.pendingExplosions,
    resolveExplosion,
  );

  const battle = overlays.rallyBattle;
  const hill = overlays.hillSquares;
  const hillHolders = hill.map((sq) => game.board.get(sq)?.color);
  const hillWhite = hillHolders.filter((c) => c === Color.White).length;
  const hillBlack = hillHolders.filter((c) => c === Color.Black).length;
  const hillLeader =
    hillWhite > hillBlack ? "white" : hillBlack > hillWhite ? "black" : null;
  const arrivals = new Map(reinforcements.map((r) => [r.sq, r]));
  const football = overlays.football;
  const footballRules = pluginManager.find<FootballPlugin>("football");
  const ourBall =
    football !== null && game.board.get(football.ball)?.color === Color.White;
  const canShoot =
    footballRules !== undefined &&
    ourBall &&
    game.turn === Color.White &&
    !isGameOver(status) &&
    !game.isInCheck();
  const shotChance = canShoot
    ? (footballRules.shotOption(game.board, footballRules.ball)?.chance ?? null)
    : null;
  const noShotReason = !ourBall
    ? "Win the ball first!"
    : game.turn !== Color.White
      ? "Wait for your turn!"
      : "No clear shot!";
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
      // A mine marks its square the moment it is stepped on; the crater waits for the blast
      const hasCrater =
        squareMods.some((m) => m.className === "mine-exploded") &&
        (minesBlasting.has(sq) || !overlays.pendingExplosions.includes(sq));
      const isLegalTarget = legalMoveSquares.includes(sq);
      const zombie = overlays.zombies?.zombies[sq];
      const grave = overlays.zombies?.graves.find((g) => g.sq === sq);
      const zombieAct = zombieActs.get(sq);
      const rising = zombieAct?.kind === "rise" ? zombieAct : null;
      const isLastMove =
        !battle && lastMove && (sq === lastMove.from || sq === lastMove.to);
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
        travel?.info.landing === sq ||
        minesBlasting.has(sq);

      let className = `square ${(rank + file) % 2 !== 0 ? "light" : "dark"}`;
      for (const mod of squareMods) {
        if (mod.className) className += ` ${mod.className}`;
      }
      if (sq === selectedSquare) className += " selected";
      if (isLastMove && !isDead) className += " last-move";
      if (isCheck) className += " in-check";
      if (menace?.king === sq) className += " zombie-target";
      if (drag?.isDragging && isLegalTarget) className += " drag-target";
      if (isDeployTarget) className += " deploy-target";
      if (minesArmed.has(sq)) className += " mine-armed";
      const passChance = kickOptions.find((k) => k.to === sq)?.chance;
      if (passChance !== undefined) className += " kick-target";
      className += riverClasses(file, rank, sq);

      const slide = slides.get(sq);
      const fall = gravityFalls.get(sq);
      const leap = kingLeaps.get(sq);
      const dive = shotDives.get(sq);
      const hauled = tugDrags.get(sq);
      const bounceFrom = graveBounce?.to === sq ? graveBounce : null;
      const pieceStyle = bounceFrom
        ? ({
            ...offsetVars(
              "--slide-from",
              offsetBetween(bounceFrom.from, sq, flipped, squareSize),
            ),
            ...offsetVars(
              "--via",
              offsetBetween(bounceFrom.via, sq, flipped, squareSize),
            ),
            "--hop": `${squareSize * 0.6}px`,
            "--spin": `${offsetBetween(bounceFrom.via, sq, flipped, 1).x > 0 ? -360 : 360}deg`,
            animation: `grave-bounce ${SLIDE_MS + 560}ms linear both`,
          } as React.CSSProperties)
        : leap
          ? ({
              "--slide-from-x": `${leap.x}px`,
              "--slide-from-y": `${leap.y}px`,
              animation: "br-king-leap 0.75s cubic-bezier(0.3, 0, 0.3, 1) both",
            } as React.CSSProperties)
          : hauled
            ? ({
                "--slide-from-x": `${hauled.x}px`,
                "--slide-from-y": `${hauled.y}px`,
                ...(hauled.off && {
                  "--off-x": `${hauled.off.x}px`,
                  "--off-y": `${hauled.off.y}px`,
                }),
                animation: hauled.off
                  ? `tug-runoff ${RUNOFF_MS}ms linear ${heaveDelay}ms both`
                  : `tug-haul ${DRAG_MS}ms cubic-bezier(0.3, 1.4, 0.5, 1) ${heaveDelay}ms both`,
              } as React.CSSProperties)
            : slide
              ? ({
                  "--slide-from-x": `${slide.x}px`,
                  "--slide-from-y": `${slide.y}px`,
                  animation: `slide-in ${SLIDE_MS}ms ease-out forwards`,
                } as React.CSSProperties)
              : fall
                ? ({
                    "--grav-x": `${fall.x}px`,
                    "--grav-y": `${fall.y}px`,
                    animation: `gravity-drop ${fall.durationMs}ms ${fall.delayMs}ms both`,
                  } as React.CSSProperties)
                : dive
                  ? ({
                      "--slide-from-x": `${dive.x}px`,
                      "--slide-from-y": `${dive.y}px`,
                      "--dive-tilt": `${dive.x > 0 ? -1 : 1}`,
                      animation: `${dive.x === 0 && dive.y === 0 ? "fifa-jump" : "fifa-dive"} ${DIVE_MS}ms ${dive.delayMs}ms both`,
                    } as React.CSSProperties)
                  : piece
                    ? goalReaction(
                        overlays.football?.lastKick ?? null,
                        sq,
                        piece.color,
                      )
                    : undefined;

      // Pieces next to a detonating mine are shoved away from it
      const blastFrom = [...minesBlasting].find(
        (m) =>
          m !== sq &&
          Math.abs((m & 7) - file) <= 1 &&
          Math.abs((m >> 4) - rank) <= 1,
      );
      const shove =
        blastFrom !== undefined
          ? offsetBetween(sq, blastFrom, flipped, squareSize * 0.35)
          : null;
      const finalPieceStyle = shove
        ? ({
            ...pieceStyle,
            "--shove-x": `${shove.x}px`,
            "--shove-y": `${shove.y}px`,
            animation: "blast-shove 0.5s cubic-bezier(0.2, 0.8, 0.3, 1)",
          } as React.CSSProperties)
        : pieceStyle;

      const portalColor = overlays.portalSquares.get(sq);
      const closingColor = closingPortals.get(sq);
      const isHidden = overlays.strategoHidden.has(sq);

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
            <div
              className={
                piece || zombie !== undefined ? "capture-hint" : "move-hint"
              }
            />
          )}

          {doomed.has(sq) && <DoomedTile sq={sq} progress={dangerProgress} />}
          {hasCrater && <Crater sq={sq} />}

          {piece && battle && !isDead && (
            <BattleUnit
              key={battle.units[sq]?.id}
              sq={sq}
              piece={piece}
              view={battle}
              flipped={flipped}
              squareSize={squareSize}
              stance={trenchStance(
                overlays.trenches,
                battle.units[sq]?.id,
                inTrenchLine(sq),
              )}
              aiming={
                overlays.trenches !== null &&
                overlays.trenches.exposed.includes(
                  battle.units[sq]?.id ?? -1,
                ) &&
                inTrenchLine(sq)
              }
              entrenched={
                // Only the trench's own side takes cover behind its sandbags;
                // men who have taken it shelter against its far wall
                !!overlays.trenches &&
                (piece.color === Color.White) === flipped &&
                behindSandbags(flipped, rowOnScreen(sq, flipped))
              }
            />
          )}
          {piece && arrivals.has(sq) && (
            <ArrivingPiece
              arrival={arrivals.get(sq)!}
              style={arrivalStyle}
              flipped={flipped}
              squareSize={squareSize}
            />
          )}
          {grave ? (
            <Tombstone look={grave.look} stirring={grave.rounds <= 1} />
          ) : (
            rising && (
              <Tombstone
                look={rising.look ?? 0}
                rising
                part="stone"
                staggerMs={rising.stagger}
              />
            )
          )}
          {zombie !== undefined && (
            <ZombiePiece
              type={zombie}
              sq={sq}
              act={zombieActs.get(sq)}
              reach={
                menace?.zombies.includes(sq)
                  ? oneSquareToward(menace.king, sq, flipped, squareSize)
                  : undefined
              }
            />
          )}
          {!grave && rising && (
            <Tombstone
              look={rising.look ?? 0}
              rising
              part="heap"
              staggerMs={rising.stagger}
            />
          )}
          {piece && !battle && !arrivals.has(sq) && !isLifted && !isDead && (
            <>
              <img
                src={kitFor(piece, football?.shirts[sq])}
                alt={`${piece.color}${piece.type}`}
                className={`piece-img${isHidden ? " stratego-piece-hidden" : ""}`}
                style={finalPieceStyle}
                draggable={false}
                onPointerDown={(e) => onPiecePointerDown(e, sq, piece)}
              />
              {isHidden && (
                <div className="stratego-mask" style={pieceStyle}>
                  ?
                </div>
              )}
            </>
          )}

          {minesArmed.has(sq) && <span className="mine-pop" aria-hidden />}
          {passChance !== undefined && <PassMarker chance={passChance} />}
          {fall && piece && (
            <span
              key={`dust-${gravityShift?.id}`}
              className="gravity-dust"
              style={{
                animationDelay: `${fall.delayMs + fall.durationMs * 0.78}ms`,
              }}
              aria-hidden
            />
          )}
          {bursts
            .filter((burst) => burst.sq === sq)
            .map((burst, i) => (
              <div
                className="capture-burst"
                key={`${i}-${burst.id}`}
                aria-hidden
              >
                <span
                  className="capture-word"
                  style={
                    {
                      "--tilt": `${(burst.id % 2 ? 1 : -1) * 10}deg`,
                    } as React.CSSProperties
                  }
                >
                  {burst.word}
                </span>
              </div>
            ))}
          {isCheck && cursed && (
            <span className="square-anchor">
              <span className="check-sticker">Check!</span>
            </span>
          )}

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

  const boardClass =
    "board" +
    (tugYank !== 0 ? " tug-heave" : "") +
    (overlays.hasFog ? " fog-active" : "") +
    (overlays.portalPairs.length > 0 ? " portal-active" : "") +
    (overlays.gravityDirection ? " gravity-active" : "") +
    (gravityShift ? " gravity-shifting" : "") +
    (battleRoyale ? " battle-royale" : "") +
    (battleRoyale && battleRoyale.shrinkRing > 0 ? " br-broken" : "") +
    (collapse ? " br-quake" : "") +
    (minesBlasting.size > 0 ? " mine-quake" : "") +
    (bursts.length > 0 ? " capture-jolt" : "") +
    (dangerProgress >= 0.6 ? " br-trembling" : "");

  const { gravityAngle } = overlays;
  const boardStyle = {
    "--yank": tugYank,
    "--heave-delay": `${heaveDelay}ms`,
    "--flip": flipped ? -1 : 1,
    ...(deployPieceType && {
      "--deploy-preview": `url(${pieceImage({ type: deployPieceType, color: Color.White })})`,
    }),
    ...(battleRoyale && {
      "--shrink-ring": battleRoyale.shrinkRing,
    }),
  } as React.CSSProperties;
  // Pieces stay at the angle gravity last settled at, so they tilt with the
  // turning board until the next shift stands them upright again
  const shellStyle = {
    ...(gravityAngle !== null && {
      "--gravity-rotation": `${gravityAngle}deg`,
    }),
  } as React.CSSProperties;

  return (
    <>
      <div
        ref={shellRef}
        className={`board-shell${overlays.gravityDirection ? " gravity-active" : ""}${battleRoyale && battleRoyale.shrinkRing > 0 ? " br-broken" : ""}`}
        style={shellStyle}
      >
        <div
          className={boardClass}
          ref={boardRef}
          style={boardStyle}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {lakes.size > 0 && <WorldRiver rows={riverRanks.size} />}
          {overlays.trenches && <WorldCraters flipped={flipped} />}
          {overlays.trenches && <RainRipples within="world-craters" />}
          {overlays.trenches && <WorldTrenches flipped={flipped} />}
          {overlays.trenches && <WorldTrenchesBank flipped={flipped} />}
          {overlays.trenches && (
            <BoardCraters view={overlays.trenches} flipped={flipped} />
          )}
          {overlays.trenches && <RainRipples within="board-craters" />}
          {overlays.trenches && <WorldTrenchesFront flipped={flipped} />}
          {overlays.trenches && (
            <LineOrders view={overlays.trenches} flipped={flipped} />
          )}
          {overlays.trenches && battle && (
            <>
              <TrenchGuns
                view={battle}
                board={game.board}
                flipped={flipped}
                facing="away"
              />
              <TrenchGuns
                view={battle}
                board={game.board}
                flipped={flipped}
                facing="toward"
              />
            </>
          )}
          {lakes.size > 0 && (
            <Battlefield
              riverRows={[...riverRanks].map((r) => (flipped ? r : 7 - r))}
              lakeCols={[
                ...new Set(
                  [...lakes].map((sq) => (flipped ? 7 - (sq & 7) : sq & 7)),
                ),
              ]}
            />
          )}
          {hexTransition === "morph-out" && <BoardShatter flipped={flipped} />}
          {overlays.tug && (
            <TugLayer
              view={overlays.tug}
              flipped={flipped}
              delayMs={heaveDelay}
            />
          )}
          {overlays.trenches && (
            <TrenchField view={overlays.trenches} flipped={flipped} />
          )}
          {hill.length > 0 && (
            <HillThrone
              left={Math.min(...hill.map((sq) => colOnScreen(sq, flipped)))}
              top={Math.min(...hill.map((sq) => rowOnScreen(sq, flipped)))}
              leader={hillLeader}
              streak={overlays.hillStreak}
            />
          )}
          {rows}
          {sidelineKings.length > 0 && (
            <Sideline
              coaching={football !== null}
              coaches={sidelineKings}
              bench={sidelineBench}
              lastKick={football?.lastKick ?? null}
              flipped={flipped}
              squareSize={squareSize}
            />
          )}
          {reinforcements.length > 0 && (
            <ReinforcementBanner
              key={reinforcements.map((r) => r.sq).join()}
              arrivals={reinforcements}
              style={arrivalStyle}
            />
          )}
          {football && <Pitch />}
          {football &&
            [Color.Black, Color.White].map((defender) => (
              <Goal
                key={defender}
                atTop={(defender === Color.Black) !== flipped}
                flipped={flipped}
                defender={defender}
                attacked={defender === Color.Black}
                shotChance={defender === Color.Black ? shotChance : null}
                noShotReason={noShotReason}
                scoredKick={
                  football.lastKick?.outcome === "goal" &&
                  football.lastKick.color !== defender
                    ? football.lastKick
                    : null
                }
                postKick={
                  football.lastKick?.outcome === "post" &&
                  football.lastKick.color !== defender
                    ? football.lastKick
                    : null
                }
                onShoot={() => kick("goal")}
              />
            ))}
          {football && (
            <FootballLayer
              view={football}
              carried={game.board.get(football.ball) !== null}
              flipped={flipped}
              squareSize={squareSize}
            />
          )}
          {battle && (
            <BattleEffects
              view={battle}
              flipped={flipped}
              squareSize={squareSize}
            />
          )}
          {[...minesBlasting].map((sq) => {
            const piece = game.board.get(sq);
            const col = colOnScreen(sq, flipped);
            const row = rowOnScreen(sq, flipped);
            return (
              <div key={sq}>
                <MineBlast col={col} row={row} squareSize={squareSize} />
                {piece && (
                  <img
                    src={pieceImage(piece)}
                    className="launched-piece"
                    style={
                      {
                        left: `${col * 12.5 + 0.625}%`,
                        top: `${row * 12.5 + 0.625}%`,
                        "--fly-x": `${(col < 4 ? -1 : 1) * squareSize * 3.5}px`,
                        "--fly-y": `${-squareSize * 6}px`,
                      } as React.CSSProperties
                    }
                    draggable={false}
                    alt=""
                  />
                )}
              </div>
            );
          })}
          {minesBlasting.size > 0 && (
            <div className="board-flash" aria-hidden />
          )}
          {overlays.hasRally && (
            <>
              <div
                className={`deploy-no-go${deployPieceType ? " active" : ""}${flipped ? " flipped" : ""}`}
                aria-hidden
              />
              <div
                className={`deploy-zone-border${deployPieceType ? " dragging" : ""}${flipped ? " flipped" : ""}`}
              />
            </>
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
          {battleRoyale &&
            (battleRoyale.shrinkRing > 0 ? (
              <BrokenRim ring={battleRoyale.shrinkRing} />
            ) : (
              <Fissure ring={1} progress={dangerProgress} />
            ))}
          {collapse && <CollapsingRing collapse={collapse} flipped={flipped} />}
          {travel && (
            <PortalTravelPiece
              travel={travel}
              flipped={flipped}
              squareSize={squareSize}
            />
          )}
          <BoardFog
            active={overlays.hasFog && introDone}
            enemyOnTop={!flipped}
          />
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
        </div>
      </div>
      {overlays.football && <Commentary call={playCall} />}
      {gravityShift && (
        <GravityAlert key={gravityShift.id} delta={gravityShift.delta} />
      )}
    </>
  );
}
