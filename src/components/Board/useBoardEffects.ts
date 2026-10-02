import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SquareIndex } from "../../engine";
import { offsetBetween } from "./boardGeometry";

type Move = { from: SquareIndex; to: SquareIndex };
type Offsets = Map<SquareIndex, { x: number; y: number }>;

const SLIDE_CLEAR_MS = 600;
const EXPLOSION_DELAY_MS = 350;
const EXPLOSION_MS = 600;
/** Board rotation (1s) plus the fall itself (0.6s) plus a buffer */
const GRAVITY_CLEAR_MS = 1800;

/** Pieces slide in from where they came from after a click or autonomous move */
export function useSlideAnimation({
  lastMove,
  lastAutonomousMoves,
  isPortalMove,
  wasDropRef,
  flipped,
  squareSize,
}: {
  lastMove: Move | null;
  lastAutonomousMoves: Move[];
  isPortalMove: boolean;
  wasDropRef: RefObject<boolean>;
  flipped: boolean;
  squareSize: number;
}): Offsets {
  const [slides, setSlides] = useState<Offsets>(new Map());
  const prevLastMove = useRef(lastMove);

  useEffect(() => {
    const prev = prevLastMove.current;
    prevLastMove.current = lastMove;
    if (!lastMove || lastMove === prev) return;
    // A dropped piece is already at its target
    if (wasDropRef.current) {
      wasDropRef.current = false;
      return;
    }
    if (isPortalMove) return;

    const moves =
      lastAutonomousMoves.length > 0 ? lastAutonomousMoves : [lastMove];
    setSlides(
      new Map(
        moves.map((m) => [
          m.to,
          offsetBetween(m.from, m.to, flipped, squareSize),
        ]),
      ),
    );
    const timer = setTimeout(() => setSlides(new Map()), SLIDE_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [
    lastMove,
    lastAutonomousMoves,
    isPortalMove,
    wasDropRef,
    flipped,
    squareSize,
  ]);

  return slides;
}

/** Pieces hold still while the board rotates, then fall to where gravity moved them */
export function useGravityFalls(
  gravityMoves: Move[],
  flipped: boolean,
  squareSize: number,
): Offsets {
  const [falls, setFalls] = useState<Offsets>(new Map());
  const prevKey = useRef("");
  const key = gravityMoves.map((m) => `${m.from}-${m.to}`).join(",");

  useLayoutEffect(() => {
    if (key === prevKey.current || key === "") return;
    prevKey.current = key;
    const offsets: Offsets = new Map();
    for (const pair of key.split(",")) {
      const [from, to] = pair.split("-").map(Number);
      offsets.set(to, offsetBetween(from, to, flipped, squareSize));
    }
    setFalls(offsets);
    const timer = setTimeout(() => setFalls(new Map()), GRAVITY_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [key, flipped, squareSize]);

  return falls;
}

/** Mines explode once the piece has slid onto them, then the piece is removed */
export function useMineExplosions(
  pendingExplosions: SquareIndex[],
  resolveExplosion: (square: SquareIndex) => void,
): Set<SquareIndex> {
  const [explosions, setExplosions] = useState<Set<SquareIndex>>(new Set());
  const key = pendingExplosions.join(",");

  useEffect(() => {
    if (key === "") return;
    const squares = key.split(",").map(Number);
    let resolveTimer: ReturnType<typeof setTimeout> | undefined;
    const slideTimer = setTimeout(() => {
      setExplosions(new Set(squares));
      resolveTimer = setTimeout(() => {
        for (const sq of squares) resolveExplosion(sq);
        setExplosions(new Set());
      }, EXPLOSION_MS);
    }, EXPLOSION_DELAY_MS);
    return () => {
      clearTimeout(slideTimer);
      clearTimeout(resolveTimer);
    };
  }, [key, resolveExplosion]);

  return explosions;
}
