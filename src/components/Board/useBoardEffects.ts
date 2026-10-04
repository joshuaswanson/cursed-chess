import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SquareIndex } from "../../engine";
import { offsetBetween } from "./boardGeometry";
import { sfx } from "../../audio/sfx";
import { GRAVITY_SHIFT_MS } from "../../plugins/gravity";
import type { Kick } from "../../plugins/football";

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

/** The pieces stand upright and come loose at this point */
export const GRAVITY_RELEASE_MS = 750;

/**
 * When gravity changes direction: the pieces pop upright, then each one drops
 * from where it was, taking longer to land the farther it falls.
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

/** How long a slide tackle takes to reach the player on the ball */
export const TACKLE_MS = 320;

/** How long a shot takes to cover one square */
export const SHOT_MS_PER_SQUARE = 55;
const PASS_MS_PER_SQUARE = 95;
const MIN_FLIGHT_MS = 260;

/** How long the ball is in the air for a kick */
export function kickFlightMs(kick: Kick): number {
  let total = 0;
  for (let i = 1; i < kick.waypoints.length; i++) {
    const a = kick.waypoints[i - 1];
    const b = kick.waypoints[i];
    total += Math.hypot(b.file - a.file, b.rank - a.rank);
  }
  const perSquare =
    kick.kind === "shot" ? SHOT_MS_PER_SQUARE : PASS_MS_PER_SQUARE;
  return Math.max(MIN_FLIGHT_MS, Math.round(total * perSquare + 120));
}

const CELEBRATIONS = ["fifa-hop", "fifa-twirl", "fifa-wiggle"] as const;

/**
 * How a piece reacts once a goal goes in: the scorer leaps and spins, their
 * teammates jump about each in their own way, and the other side slumps
 */
export function goalReaction(
  kick: Kick | null,
  sq: SquareIndex,
  color: string,
): React.CSSProperties | undefined {
  if (kick?.outcome !== "goal") return undefined;
  const scored = kickFlightMs(kick);
  if (color !== kick.color) {
    return { animation: `fifa-slump 0.9s ${scored + 250}ms ease-out both` };
  }
  const start = kick.waypoints[0];
  if ((sq & 7) === start.file && sq >> 4 === start.rank) {
    return {
      animation: `fifa-scorer 0.9s ${scored}ms cubic-bezier(0.3, 0, 0.3, 1) 2`,
    };
  }
  const kind = CELEBRATIONS[(sq * 7) % CELEBRATIONS.length];
  const stagger = ((sq * 37) % 5) * 70;
  return {
    animation: `${kind} 0.55s ${scored + 120 + stagger}ms ease-in-out 3`,
  };
}
/** A diver leaves this long before the ball reaches them */
const DIVE_LEAD_MS = 180;
export const DIVE_MS = 380;

export interface DiveSlide {
  /** How far the defender leaps from, or nothing for one jumping on the spot */
  x: number;
  y: number;
  delayMs: number;
}

/**
 * Defenders throwing themselves at a shot: those beside its path leap from
 * where they stood to where they land, and those already in it jump on the
 * spot, each timed to meet the ball as it comes past.
 */
export function useShotDives(
  kick: Kick | null,
  flipped: boolean,
  squareSize: number,
): Map<SquareIndex, DiveSlide> {
  const id = kick?.id ?? 0;
  const [seen, setSeen] = useState(id);
  const [dives, setDives] = useState<Map<SquareIndex, DiveSlide>>(new Map());
  if (id !== seen) {
    setSeen(id);
    const next = new Map<SquareIndex, DiveSlide>();
    const start = kick?.waypoints[0];
    const meetsBallAt = (sq: SquareIndex) => {
      const squares = start
        ? Math.hypot((sq & 7) - start.file, (sq >> 4) - start.rank)
        : 0;
      return Math.max(0, squares * SHOT_MS_PER_SQUARE - DIVE_LEAD_MS);
    };
    for (const { from, to } of kick?.dives ?? []) {
      next.set(to, {
        ...offsetBetween(from, to, flipped, squareSize),
        delayMs: meetsBallAt(to),
      });
    }
    for (const sq of kick?.jumps ?? []) {
      next.set(sq, { x: 0, y: 0, delayMs: meetsBallAt(sq) });
    }
    setDives(next);
  }
  useEffect(() => {
    if (dives.size === 0) return;
    const longest = Math.max(...[...dives.values()].map((d) => d.delayMs));
    const done = setTimeout(() => setDives(new Map()), longest + DIVE_MS + 100);
    return () => clearTimeout(done);
  }, [dives]);
  return dives;
}

/** How long a slide tackle's skid stays torn into the turf */
const SKID_LIFE_MS = 5400;

export interface SkidMark {
  id: number;
  from: SquareIndex;
  to: SquareIndex;
}

/** Skid marks from recent slide tackles, which outlast the moves after them */
export function useSkidMarks(
  tackle: { from: SquareIndex; to: SquareIndex } | null,
  moveCount: number,
): SkidMark[] {
  const [marks, setMarks] = useState<SkidMark[]>([]);
  const [seen, setSeen] = useState(moveCount);
  if (moveCount !== seen) {
    setSeen(moveCount);
    if (tackle) {
      setMarks((now) => [
        ...now,
        { id: moveCount, from: tackle.from, to: tackle.to },
      ]);
    }
  }
  useEffect(() => {
    if (marks.length === 0) return;
    const fade = setTimeout(
      () => setMarks((now) => now.slice(1)),
      SKID_LIFE_MS,
    );
    return () => clearTimeout(fade);
  }, [marks]);
  return marks;
}
