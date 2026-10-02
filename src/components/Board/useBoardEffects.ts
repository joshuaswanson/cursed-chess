import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SquareIndex } from "../../engine";
import { offsetBetween } from "./boardGeometry";
import { sfx } from "../../audio/sfx";

type Move = { from: SquareIndex; to: SquareIndex };
type Offsets = Map<SquareIndex, { x: number; y: number }>;

const SLIDE_CLEAR_MS = 600;
/** How long a moved piece takes to slide onto its square */
export const SLIDE_MS = 200;
const EXPLOSION_DELAY_MS = 350;
const EXPLOSION_MS = 1300;
/** The mine pops up and beeps before it goes off */
const MINE_ARMED_MS = 620;

/** The moved piece slides in from where it came from */
export function useSlideAnimation({
  lastMove,
  isPortalMove,
  wasDropRef,
  flipped,
  squareSize,
}: {
  lastMove: Move | null;
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

    setSlides(
      new Map([
        [
          lastMove.to,
          offsetBetween(lastMove.from, lastMove.to, flipped, squareSize),
        ],
      ]),
    );
    const timer = setTimeout(() => setSlides(new Map()), SLIDE_CLEAR_MS);
    return () => clearTimeout(timer);
  }, [lastMove, isPortalMove, wasDropRef, flipped, squareSize]);

  return slides;
}

export interface GravityFall {
  x: number;
  y: number;
  delayMs: number;
  durationMs: number;
}

export interface GravityShift {
  id: number;
  /** Degrees the board turns this shift */
  delta: number;
  falls: Map<SquareIndex, GravityFall>;
}

/** The board finishes spinning and the pieces come loose at this point */
export const GRAVITY_RELEASE_MS = 1250;
const GRAVITY_SHIFT_MS = 2900;

/**
 * When gravity changes direction: the board spins, then each piece drops from
 * where it was, taking longer to land the farther it falls.
 */
export function useGravityShift(
  gravityMoves: Move[],
  angle: number | null,
  flipped: boolean,
  squareSize: number,
): GravityShift | null {
  const [shift, setShift] = useState<GravityShift | null>(null);
  const prevAngle = useRef(angle);
  const moveKey = gravityMoves.map((m) => `${m.from}-${m.to}`).join(",");

  useLayoutEffect(() => {
    const before = prevAngle.current;
    prevAngle.current = angle;
    if (angle === null || before === null || angle === before) return;

    const falls = new Map<SquareIndex, GravityFall>();
    const landings = new Set<number>();
    for (const pair of moveKey === "" ? [] : moveKey.split(",")) {
      const [from, to] = pair.split("-").map(Number);
      const offset = offsetBetween(from, to, flipped, squareSize);
      const distance = Math.hypot(offset.x, offset.y) / squareSize;
      const durationMs = Math.round(260 + 140 * Math.sqrt(distance));
      const delayMs = GRAVITY_RELEASE_MS + Math.round(Math.random() * 120);
      falls.set(to, { ...offset, delayMs, durationMs });
      landings.add(Math.round((delayMs + durationMs * 0.78) / 60) * 60);
    }
    setShift({ id: Date.now(), delta: angle - before, falls });
    sfx.gravityShift();
    const timers = [...landings].map((ms) => setTimeout(() => sfx.thud(), ms));
    timers.push(setTimeout(() => setShift(null), GRAVITY_SHIFT_MS));
    return () => timers.forEach(clearTimeout);
  }, [angle, moveKey, flipped, squareSize]);

  return shift;
}

/**
 * A stepped-on mine pops up and beeps, then detonates and launches the piece;
 * the piece is removed once the blast has played out.
 */
export function useMineExplosions(
  pendingExplosions: SquareIndex[],
  resolveExplosion: (square: SquareIndex) => void,
): { armed: Set<SquareIndex>; blasting: Set<SquareIndex> } {
  const [armed, setArmed] = useState<Set<SquareIndex>>(new Set());
  const [blasting, setBlasting] = useState<Set<SquareIndex>>(new Set());
  const key = pendingExplosions.join(",");

  useEffect(() => {
    if (key === "") return;
    const squares = key.split(",").map(Number);
    const timers = [
      setTimeout(() => {
        setArmed(new Set(squares));
        sfx.mineArm();
      }, EXPLOSION_DELAY_MS),
      setTimeout(() => {
        setArmed(new Set());
        setBlasting(new Set(squares));
        sfx.mineBlast();
      }, EXPLOSION_DELAY_MS + MINE_ARMED_MS),
      setTimeout(
        () => {
          for (const sq of squares) resolveExplosion(sq);
          setBlasting(new Set());
        },
        EXPLOSION_DELAY_MS + MINE_ARMED_MS + EXPLOSION_MS,
      ),
    ];
    return () => timers.forEach(clearTimeout);
  }, [key, resolveExplosion]);

  return { armed, blasting };
}

const CAPTURE_WORDS = ["POW!", "BAM!", "KO!", "WHAM!", "CRUNCH!", "BONK!"];
const CAPTURE_BURST_MS = 700;

/** A comic burst on the square where a piece was just taken */
export function useCaptureBurst<Sq extends string | number = SquareIndex>(
  captureSquare: Sq | null,
  moveCount: number,
  /** Waits for the capturing piece to finish arriving */
  delayMs: number = 0,
): { sq: Sq; word: string; id: number } | null {
  const [burst, setBurst] = useState<{
    sq: Sq;
    word: string;
    id: number;
  } | null>(null);

  useEffect(() => {
    if (captureSquare === null) return;
    const timers = [
      setTimeout(() => {
        setBurst({
          sq: captureSquare,
          word: CAPTURE_WORDS[moveCount % CAPTURE_WORDS.length],
          id: moveCount,
        });
        sfx.capture();
      }, delayMs),
      setTimeout(() => setBurst(null), delayMs + CAPTURE_BURST_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [captureSquare, moveCount, delayMs]);

  return burst;
}
