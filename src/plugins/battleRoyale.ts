import { Color, GameStatus, PieceType } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import { PIECE_VALUE } from "../ai/chooseMove";
import type {
  ModePlugin,
  PluginContext,
  BoardOverlay,
  SquareModifier,
} from "./types";
import { fileOf, rankOf, ALL_SQUARES } from "../utils/squareUtils";

/** The part of the board still standing: its first and last file and rank */
export interface Zone {
  f0: number;
  f1: number;
  r0: number;
  r1: number;
}

/** One collapse: the file at either side, or both end ranks at once so neither side loses more of its home */
type Step = "left" | "right" | "ends";

/** Files that fall before the board stops shrinking, leaving four */
const FILE_DROPS = 4;
/** Rounds of warning before a line falls */
const STEP_ROUNDS: Record<Step, number> = { left: 2, right: 2, ends: 3 };
/** The first line gives an extra round, to get the pieces moving */
const FIRST_STEP_EXTRA = 1;
/** Rounds fought in the final zone before the material left decides it */
export const FINAL_ROUNDS = 3;

/** How much of a doomed piece's worth the computer sees in saving it, with one round left */
const ESCAPE_WORTH = 0.9;
/** What the computer sees in getting a piece into the final zone */
const FINAL_ZONE_PULL = 0.2;
/** What the computer counts his king as worth when the ground under it is about to fall, since losing it loses the game */
const KING_WORTH = 50;

/** What fell away the last time the board collapsed, for the board to animate */
export interface Collapse {
  /** Increments with every collapse so the board can tell them apart */
  id: number;
  squares: SquareIndex[];
  fallen: { sq: SquareIndex; piece: Piece }[];
}

export interface BattleRoyaleOverlay {
  zone: Zone;
  /** What will be left after the next collapse, if there is one to come */
  next: Zone | null;
  final: Zone;
  /** Rounds until the next line falls, or until the end once nothing is left to fall */
  roundsLeft: number;
  /** How many rounds that countdown started from */
  countdownRounds: number;
  /** 0 just after a collapse, approaching 1 as the next one nears */
  dangerProgress: number;
  doomed: SquareIndex[];
  lastCollapse: Collapse | null;
}

const inZone = (sq: SquareIndex, z: Zone) =>
  fileOf(sq) >= z.f0 &&
  fileOf(sq) <= z.f1 &&
  rankOf(sq) >= z.r0 &&
  rankOf(sq) <= z.r1;

function shrink(z: Zone, step: Step): Zone {
  if (step === "left") return { ...z, f0: z.f0 + 1 };
  if (step === "right") return { ...z, f1: z.f1 - 1 };
  return { ...z, r0: z.r0 + 1, r1: z.r1 - 1 };
}

/**
 * The files fall from either side at random, so the final zone can end up
 * anywhere across the board. The end ranks always fall in pairs.
 */
function planSteps(): Step[] {
  const left = Math.floor(Math.random() * (FILE_DROPS + 1));
  const sides: Step[] = Array.from({ length: FILE_DROPS }, (_, i) =>
    i < left ? "left" : "right",
  );
  for (let i = sides.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sides[i], sides[j]] = [sides[j], sides[i]];
  }
  return [sides[0], sides[1], "ends", sides[2], sides[3], "ends"];
}

const material = (board: Board, color: Color) =>
  ALL_SQUARES.reduce((sum, sq) => {
    const piece = board.get(sq);
    return piece?.color === color && piece.type !== PieceType.King
      ? sum + PIECE_VALUE[piece.type]
      : sum;
  }, 0);

/**
 * The board falls away a line at a time, each line marked rounds before it
 * goes, closing in on a final zone shown from the start. Whatever stands on
 * a line when it falls goes with it, and a side whose king falls loses. A
 * few rounds after the last line falls, whoever has more material left wins.
 */
export class BattleRoyalePlugin implements ModePlugin {
  id = "battle-royale";
  name = "Battle Royale";
  description =
    "The board falls away a line at a time. Most material left at the end wins.";

  private zone: Zone = { f0: 0, f1: 7, r0: 0, r1: 7 };
  private steps: Step[] = [];
  private roundsLeft = 0;
  private countdownRounds = 1;
  private deadSquares = new Set<SquareIndex>();
  private lastCollapse: Collapse | null = null;
  private result: Color | "draw" | null = null;

  onGameStart(): void {
    this.zone = { f0: 0, f1: 7, r0: 0, r1: 7 };
    this.steps = planSteps();
    this.countdown(STEP_ROUNDS[this.steps[0]] + FIRST_STEP_EXTRA);
    this.deadSquares.clear();
    this.lastCollapse = null;
    this.result = null;
  }

  private countdown(rounds: number): void {
    this.roundsLeft = rounds;
    this.countdownRounds = rounds;
  }

  private next(): Zone | null {
    return this.steps.length > 0 ? shrink(this.zone, this.steps[0]) : null;
  }

  private final(): Zone {
    return this.steps.reduce(shrink, this.zone);
  }

  onTurnEnd(ctx: PluginContext, color: Color): void {
    if (color !== Color.Black || this.result !== null) return;
    this.roundsLeft--;
    if (this.roundsLeft > 0) return;
    const next = this.next();
    if (!next) {
      const white = material(ctx.board, Color.White);
      const black = material(ctx.board, Color.Black);
      this.result =
        white > black ? Color.White : black > white ? Color.Black : "draw";
      return;
    }
    this.collapse(ctx);
    this.zone = next;
    this.steps.shift();
    this.countdown(
      this.steps.length > 0 ? STEP_ROUNDS[this.steps[0]] : FINAL_ROUNDS,
    );
  }

  modifyLegalMoves(_ctx: PluginContext, moves: Move[]): Move[] {
    return moves.filter((m) => !this.deadSquares.has(m.to));
  }

  modifyGameStatus(_ctx: PluginContext, status: GameStatus): GameStatus {
    if (this.result === null) return status;
    return this.result === "draw" ? GameStatus.Stalemate : GameStatus.Checkmate;
  }

  getWinner(): Color | null {
    return this.result === "draw" ? null : this.result;
  }

  getSquareModifiers(
    _ctx: PluginContext,
    square: SquareIndex,
  ): SquareModifier[] {
    if (this.deadSquares.has(square)) {
      return [{ className: "dead-square" }];
    }
    if (this.doomedSquares().includes(square)) {
      return [{ className: "danger-square" }];
    }
    return [];
  }

  getBoardOverlays(): BoardOverlay[] {
    const data: BattleRoyaleOverlay = {
      zone: this.zone,
      next: this.next(),
      final: this.final(),
      roundsLeft: this.roundsLeft,
      countdownRounds: this.countdownRounds,
      dangerProgress: this.next()
        ? 1 - this.roundsLeft / this.countdownRounds
        : 0,
      doomed: this.doomedSquares(),
      lastCollapse: this.lastCollapse,
    };
    return [{ type: "battle-royale", squares: [], data }];
  }

  /**
   * What a move is worth to the computer for the sake of the ground under
   * it: getting a piece off a line before it falls, more so the sooner it
   * falls, and a little for getting into the final zone. His king also
   * keeps off a line that is going to fall.
   */
  squareBonus(to: SquareIndex, piece: Piece, from: SquareIndex): number {
    const isKing = piece.type === PieceType.King;
    const doomed = this.doomedSquares();
    const final = this.final();
    const saving =
      ((isKing ? KING_WORTH : PIECE_VALUE[piece.type]) * ESCAPE_WORTH) /
      Math.max(1, this.roundsLeft);
    let bonus = 0;
    if (doomed.includes(from) && !doomed.includes(to)) bonus += saving;
    if (isKing && doomed.includes(to) && !doomed.includes(from)) {
      bonus -= saving;
    }
    if (inZone(to, final) && !inZone(from, final)) bonus += FINAL_ZONE_PULL;
    return bonus;
  }

  private doomedSquares(): SquareIndex[] {
    const next = this.next();
    if (!next) return [];
    return ALL_SQUARES.filter(
      (sq) => inZone(sq, this.zone) && !inZone(sq, next),
    );
  }

  private collapse(ctx: PluginContext): void {
    const squaresToRemove = this.doomedSquares();
    const fallen: Collapse["fallen"] = [];
    for (const sq of squaresToRemove) {
      this.deadSquares.add(sq);
      const piece = ctx.board.remove(sq);
      if (piece) fallen.push({ sq, piece });
    }

    const kingFell = (color: Color) =>
      fallen.some(
        (f) => f.piece.type === PieceType.King && f.piece.color === color,
      );
    const whiteFell = kingFell(Color.White);
    const blackFell = kingFell(Color.Black);
    if (whiteFell || blackFell) {
      this.result =
        whiteFell && blackFell ? "draw" : whiteFell ? Color.Black : Color.White;
    }

    this.lastCollapse = {
      id: (this.lastCollapse?.id ?? 0) + 1,
      squares: squaresToRemove,
      fallen,
    };
  }
}
