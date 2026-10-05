import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { SquareIndex } from "../../engine";
import { offsetBetween, visualRow } from "./boardGeometry";
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
export const CAPTURE_BURST_MS = 700;

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
 * teammates jump about each in their own way
 */
export function goalReaction(
  kick: Kick | null,
  sq: SquareIndex,
  color: string,
): React.CSSProperties | undefined {
  if (kick?.outcome !== "goal") return undefined;
  const scored = kickFlightMs(kick);
  if (color !== kick.color) return undefined;
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

/** Something worth a word from the commentary box */
export interface PlayCall {
  /** Changes with every new piece of play */
  key: string;
  kind: string;
  /** The shirt number of the player involved */
  number?: number;
  /** When the moment lands, after the ball or the player gets there */
  delayMs: number;
}

/**
 * The latest bit of FIFA play for the commentary box: the newest kick, or a
 * the ball being won off its carrier if that came after it
 */
export function usePlayCall(
  kick: Kick | null,
  ballWon: { to: SquareIndex } | null,
  moveCount: number,
  shirts: Record<number, number>,
): PlayCall | null {
  const [call, setCall] = useState<PlayCall | null>(null);
  const [seenKick, setSeenKick] = useState(kick?.id ?? 0);
  const [seenMove, setSeenMove] = useState(moveCount);
  if (kick && kick.id !== seenKick) {
    setSeenKick(kick.id);
    const start = kick.waypoints[0];
    const kind =
      kick.outcome === "goal"
        ? kick.color === "w"
          ? "goal-ours"
          : "goal-theirs"
        : kick.outcome;
    setCall({
      key: `kick-${kick.id}`,
      kind,
      number: shirts[start.rank * 16 + start.file],
      delayMs: kickFlightMs(kick),
    });
  }
  if (moveCount !== seenMove) {
    setSeenMove(moveCount);
    if (ballWon) {
      setCall({
        key: `won-${moveCount}`,
        kind: "won",
        number: shirts[ballWon.to],
        delayMs: SLIDE_MS,
      });
    }
  }
  return call;
}

const HEAVE_MS = 700;

/**
 * Which way the pieces on the rope are being dragged, on screen, while a tug
 * of war heave plays out: 1 down, -1 up, or 0 between heaves
 */
export function useHeave(
  heave: number,
  heaveDir: number,
  flipped: boolean,
  /** The heave waits for the move that set it off to finish */
  delayMs: number,
): number {
  const [seen, setSeen] = useState(heave);
  const [yank, setYank] = useState(0);
  if (heave !== seen) {
    setSeen(heave);
    if (heave > 0) setYank(heaveDir * (flipped ? -1 : 1));
  }
  useEffect(() => {
    if (yank === 0) return;
    const done = setTimeout(() => setYank(0), delayMs + HEAVE_MS);
    return () => clearTimeout(done);
  }, [yank, heave, delayMs]);
  return yank;
}

const DRAG_MS = 560;

/** How long a piece jammed at the end of the line takes to run off the board and back on */
export const RUNOFF_MS = 1500;

export interface TugDrag {
  /** Where the piece was before the heave, from where it is now */
  x: number;
  y: number;
  /** Jammed at the end of the line, it runs off the board this far from where it is now, then back on */
  off: { x: number; y: number } | null;
}

/** Pieces a tug of war heave just moved, with where they came from */
export function useTugDrags(
  heave: number,
  heaveDir: number,
  dragged: { from: SquareIndex; to: SquareIndex; hop: boolean }[],
  flipped: boolean,
  squareSize: number,
  delayMs: number,
): Map<SquareIndex, TugDrag> {
  const [seen, setSeen] = useState(heave);
  const [drags, setDrags] = useState<Map<SquareIndex, TugDrag>>(new Map());
  if (heave !== seen) {
    setSeen(heave);
    // Toward White's end is down the screen, unless the board is flipped
    const down = heaveDir * (flipped ? -1 : 1) > 0;
    setDrags(
      new Map<SquareIndex, TugDrag>(
        dragged.map(({ from, to, hop }): [SquareIndex, TugDrag] => {
          const back = offsetBetween(from, to, flipped, squareSize);
          if (!hop) return [to, { ...back, off: null }];
          // Off past the edge the rope was hauled toward, in the piece's own file
          const row = visualRow(from, flipped);
          const edgeRow = down ? 8.1 : -1.1;
          return [
            to,
            {
              ...back,
              off: { x: back.x, y: back.y + (edgeRow - row) * squareSize },
            },
          ];
        }),
      ),
    );
  }
  useEffect(() => {
    if (drags.size === 0) return;
    const longest = [...drags.values()].some((d) => d.off)
      ? RUNOFF_MS
      : DRAG_MS;
    const done = setTimeout(() => setDrags(new Map()), delayMs + longest + 100);
    return () => clearTimeout(done);
  }, [drags, delayMs]);
  return drags;
}

export { DRAG_MS };
