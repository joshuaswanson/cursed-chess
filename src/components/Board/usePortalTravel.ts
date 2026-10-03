import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SquareIndex } from "../../engine";
import type { PortalColor, PortalMoveInfo } from "../../plugins/portalChess";
import { fileOf, rankOf } from "../../utils/squareUtils";
import type { DragState, DroppedMove } from "./usePieceDrag";

/**
 * approach: slide into the first portal. shrink: get swallowed by an entrance.
 * pop: emerge in place when the exit is the destination. fly: launch out of
 * the exit (`slideFrom`) and fly to `sq`.
 */
export interface PortalPhase {
  type: "approach" | "shrink" | "pop" | "fly";
  sq: SquareIndex;
  color: PortalColor;
  slideFrom?: SquareIndex;
}

export interface PortalTravel {
  phases: PortalPhase[];
  phaseIndex: number;
  info: PortalMoveInfo;
}

const PORTAL_ENTER_MS = 800;
const PORTAL_EXIT_MS = 450;
const PORTAL_LIFECYCLE_MS = 600;

function phaseDistance(phase: PortalPhase): number {
  if (phase.slideFrom === undefined) return 0;
  return Math.max(
    Math.abs(fileOf(phase.slideFrom) - fileOf(phase.sq)),
    Math.abs(rankOf(phase.slideFrom) - rankOf(phase.sq)),
  );
}

export function phaseDurationMs(phase: PortalPhase): number {
  switch (phase.type) {
    case "approach":
      return Math.max(100, phaseDistance(phase) * 60);
    case "shrink":
      return PORTAL_ENTER_MS;
    case "pop":
      return PORTAL_EXIT_MS;
    case "fly":
      return 340 + phaseDistance(phase) * 70;
  }
}

function buildPhases(
  { from, transits, landing }: PortalMoveInfo,
  dropped: DroppedMove | null,
): PortalPhase[] {
  const phases: PortalPhase[] = [];
  // A piece dropped onto the entrance is already there, so it skips the approach
  const droppedOnEntrance =
    dropped?.from === from && dropped.to === transits[0].entrance;
  if (from !== transits[0].entrance && !droppedOnEntrance) {
    phases.push({
      type: "approach",
      sq: transits[0].entrance,
      color: transits[0].color,
      slideFrom: from,
    });
  }
  for (let i = 0; i < transits.length; i++) {
    const { entrance, exit, color } = transits[i];
    const target = i < transits.length - 1 ? transits[i + 1].entrance : landing;
    phases.push({ type: "shrink", sq: entrance, color });
    phases.push(
      target === exit
        ? { type: "pop", sq: exit, color }
        : { type: "fly", sq: target, color, slideFrom: exit },
    );
  }
  return phases;
}

/**
 * Plays a portal move phase by phase, animates portals opening and closing,
 * and works out how charged each portal is by nearby pieces.
 */
export function usePortalTravel({
  lastPortalMove,
  droppedMoveRef,
  portalSquares,
  drag,
  primedPortal,
  onPhase,
}: {
  lastPortalMove: PortalMoveInfo | null;
  droppedMoveRef: RefObject<DroppedMove | null>;
  portalSquares: Map<SquareIndex, PortalColor>;
  drag: DragState | null;
  /** Entrance portal of the selected piece, which glows in anticipation */
  primedPortal: SquareIndex | null;
  onPhase?: (phase: PortalPhase) => void;
}) {
  const [travel, setTravel] = useState<PortalTravel | null>(null);
  /** The latest portal move to finish arriving, numbered so each landing is distinct */
  const [landing, setLanding] = useState<{
    info: PortalMoveInfo;
    seq: number;
  } | null>(null);
  const [closingPortals, setClosingPortals] = useState<
    Map<SquareIndex, PortalColor>
  >(new Map());
  const [openingPortals, setOpeningPortals] = useState<Set<SquareIndex>>(
    new Set(),
  );
  const prevPortalMove = useRef(lastPortalMove);
  const prevPortalKey = useRef("");
  const prevPortalColors = useRef<Map<SquareIndex, PortalColor>>(new Map());
  const onPhaseRef = useRef(onPhase);

  useEffect(() => {
    onPhaseRef.current = onPhase;
  }, [onPhase]);

  useEffect(() => {
    const prev = prevPortalMove.current;
    prevPortalMove.current = lastPortalMove;
    if (!lastPortalMove || lastPortalMove === prev) return;

    const dropped = droppedMoveRef.current;
    droppedMoveRef.current = null;
    const phases = buildPhases(lastPortalMove, dropped);
    setTravel({ phases, phaseIndex: 0, info: lastPortalMove });
  }, [lastPortalMove, droppedMoveRef]);

  const currentPhase = travel?.phases[travel.phaseIndex] ?? null;

  useEffect(() => {
    if (!travel || !currentPhase) return;
    onPhaseRef.current?.(currentPhase);
    const timer = setTimeout(() => {
      const nextIndex = travel.phaseIndex + 1;
      if (nextIndex < travel.phases.length) {
        setTravel({ ...travel, phaseIndex: nextIndex });
      } else {
        setTravel(null);
        setLanding((prev) => ({
          info: travel.info,
          seq: (prev?.seq ?? 0) + 1,
        }));
      }
    }, phaseDurationMs(currentPhase));
    return () => clearTimeout(timer);
  }, [travel, currentPhase]);

  // Animate portals that open, close, or move
  const portalKey = [...portalSquares.keys()].sort().join(",");
  useEffect(() => {
    const prev = prevPortalKey.current;
    const prevColors = prevPortalColors.current;
    prevPortalKey.current = portalKey;
    prevPortalColors.current = new Map(portalSquares);
    if (prev === portalKey) return;

    const parse = (key: string) =>
      new Set(key === "" ? [] : key.split(",").map(Number));
    const oldSquares = parse(prev);
    const newSquares = parse(portalKey);

    const closing = new Map<SquareIndex, PortalColor>();
    for (const sq of oldSquares) {
      if (!newSquares.has(sq)) closing.set(sq, prevColors.get(sq) ?? "blue");
    }
    const opening = new Set<SquareIndex>();
    for (const sq of newSquares) {
      if (!oldSquares.has(sq)) opening.add(sq);
    }
    setClosingPortals(closing);
    setOpeningPortals(opening);
  }, [portalKey, portalSquares]);

  useEffect(() => {
    if (closingPortals.size === 0 && openingPortals.size === 0) return;
    const timer = setTimeout(() => {
      setClosingPortals(new Map());
      setOpeningPortals(new Set());
    }, PORTAL_LIFECYCLE_MS);
    return () => clearTimeout(timer);
  }, [closingPortals, openingPortals]);

  const surgingPortal =
    currentPhase?.type === "shrink" || currentPhase?.type === "pop"
      ? currentPhase.sq
      : currentPhase?.type === "fly"
        ? (currentPhase.slideFrom ?? null)
        : null;

  // A portal swells as a piece nears it: a piece traveling toward it, a
  // dragged piece, or a selected piece that can enter it
  const portalCharge = (
    sq: SquareIndex,
  ): { charge: number; chargeMs: number } => {
    const phase = currentPhase;
    if (phase) {
      const isTarget = phase.sq === sq;
      if ((phase.type === "approach" || phase.type === "fly") && isTarget) {
        return { charge: 1, chargeMs: phaseDurationMs(phase) };
      }
      if (phase.type === "shrink" && isTarget) {
        return { charge: 1, chargeMs: 150 };
      }
      if (
        (phase.type === "pop" && isTarget) ||
        (phase.type === "fly" && phase.slideFrom === sq)
      ) {
        return { charge: 0.8, chargeMs: 120 };
      }
    }
    const dragCharge = drag?.isDragging ? (drag.portalCharges?.[sq] ?? 0) : 0;
    const selectCharge = primedPortal === sq ? 0.3 : 0;
    return { charge: Math.max(dragCharge, selectCharge), chargeMs: 180 };
  };

  return {
    travel,
    landing,
    currentPhase,
    closingPortals,
    openingPortals,
    surgingPortal,
    portalCharge,
  };
}
