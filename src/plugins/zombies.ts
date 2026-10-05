import { Color, GameStatus, MoveFlag, PieceType } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import { QUEEN_DIRECTIONS, isSquareAttacked, opponent } from "../engine/moves";
import type {
  ModePlugin,
  PluginContext,
  BoardOverlay,
  SquareModifier,
} from "./types";
import {
  ALL_SQUARES,
  fileOf,
  isValidSquare,
  rankOf,
} from "../utils/squareUtils";

/** Rounds a buried piece lies under its tombstone before it rises */
const RISE_AFTER_ROUNDS = 2;
/** How many headstone designs there are to pick from */
export const HEADSTONE_LOOKS = 4;
/** How far a capturing piece may bounce off the fresh grave */
const BOUNCE_REACH = 2;

export interface Grave {
  sq: SquareIndex;
  /** The piece buried there, which rises as a zombie */
  type: PieceType;
  /** Rounds left before it rises */
  rounds: number;
  /** Which headstone design marks it */
  look: number;
}

export interface ZombieEvent {
  kind: "rise" | "shamble" | "bite";
  from?: SquareIndex;
  to: SquareIndex;
  /** The headstone a rising zombie climbs out from behind */
  look?: number;
  /** The piece a zombie bit, as it was before it turned */
  victim?: Piece;
}

/** A capturing piece knocked off the grave it just dug, from where it moved, via the grave, to where it landed */
export interface ZombieBounce {
  from: SquareIndex;
  via: SquareIndex;
  to: SquareIndex;
}

export interface ZombieView {
  /** The undead on the board, by square, with the piece each one used to be */
  zombies: Record<number, PieceType>;
  graves: Grave[];
  /** What the undead did at the end of the last round, numbered so each round animates once */
  round: number;
  events: ZombieEvent[];
  bounce: ZombieBounce | null;
  /** The king of the side to move, if a zombie stands next to it, and the zombies about to bite it */
  menace: { king: SquareIndex; zombies: SquareIndex[] } | null;
}

const reach = (a: SquareIndex, b: SquareIndex) =>
  Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));

/**
 * Zombies. A captured piece is buried under a tombstone and, two rounds later,
 * claws its way out as a zombie. Zombies belong to no one. After every round
 * each one shambles a square toward the nearest living piece of either army,
 * or bites a piece next to it and turns it into one of them. Either side can
 * put a zombie down by capturing it. A side whose king is bitten loses.
 *
 * Zombies bite at the end of every round, so a king may never end its side's
 * move next to one. A king with a zombie beside it is in check: it must step
 * away, or someone must put the zombie down. With no way out it is mated.
 */
export class ZombiesPlugin implements ModePlugin {
  id = "zombies";
  name = "Zombies";
  description =
    "Captured pieces rise from their graves as zombies that bite anyone they reach.";

  private zombies = new Map<SquareIndex, PieceType>();
  private graves: Grave[] = [];
  private round = 0;
  private events: ZombieEvent[] = [];
  private winner: Color | null = null;
  private bounce: ZombieBounce | null = null;

  onGameStart(): void {
    this.zombies.clear();
    this.graves = [];
    this.round = 0;
    this.events = [];
    this.winner = null;
    this.bounce = null;
  }

  /** Whether a zombie stands on a square */
  zombieAt(sq: SquareIndex): boolean {
    return this.zombies.has(sq);
  }

  /**
   * Zombies are not on the engine's board, so it would let pieces walk
   * through them. They block like any piece: nothing slides past one, a pawn
   * cannot step onto one, and landing on one puts it down. Pawns take
   * zombies diagonally.
   */
  modifyLegalMoves(ctx: PluginContext, moves: Move[], color: Color): Move[] {
    if (this.zombies.size === 0) return moves;
    const kept = moves.filter((move) => {
      if (this.pathThroughZombie(move)) return false;
      if (move.piece.type === PieceType.Pawn && this.zombies.has(move.to)) {
        return fileOf(move.to) !== fileOf(move.from);
      }
      return true;
    });
    // Pawns bite back: a zombie on a pawn's capturing diagonal can be taken
    const forward = color === Color.White ? 16 : -16;
    for (const sq of ALL_SQUARES) {
      const piece = ctx.board.get(sq);
      if (piece?.type !== PieceType.Pawn || piece.color !== color) continue;
      for (const side of [-1, 1]) {
        const to = sq + forward + side;
        if (!isValidSquare(to) || !this.zombies.has(to)) continue;
        if (kept.some((m) => m.from === sq && m.to === to)) continue;
        const last = rankOf(to) === (color === Color.White ? 7 : 0);
        kept.push({
          from: sq,
          to,
          piece,
          flags:
            MoveFlag.ModeMove | (last ? MoveFlag.Promotion : MoveFlag.Normal),
          promotion: last ? PieceType.Queen : undefined,
        });
      }
    }
    return kept.filter((move) => this.leavesKingSafe(ctx.board, move, color));
  }

  /** The zombies standing next to a square, leaving out one put down this move */
  private zombiesBeside(sq: SquareIndex, killed?: SquareIndex): SquareIndex[] {
    return [...this.zombies.keys()].filter(
      (z) => z !== killed && reach(z, sq) === 1,
    );
  }

  /**
   * Whether the mover's king ends the move clear of every zombie, and, for
   * the pawn captures the engine never checked, out of check
   */
  private leavesKingSafe(board: Board, move: Move, color: Color): boolean {
    const king =
      move.piece.type === PieceType.King ? move.to : board.findKing(color);
    if (king === null) return true;
    const killed = this.zombies.has(move.to) ? move.to : undefined;
    if (this.zombiesBeside(king, killed).length > 0) return false;
    if (!(move.flags & MoveFlag.ModeMove)) return true;
    const after = board.clone();
    after.remove(move.from);
    after.put(move.to, {
      type: move.promotion ?? move.piece.type,
      color: move.piece.color,
    });
    return !isSquareAttacked(after, king, opponent(color));
  }

  /** Whether a sliding or stepping move would pass over a zombie on its way */
  private pathThroughZombie(move: Move): boolean {
    if (move.piece.type === PieceType.Knight) return false;
    const df = Math.sign(fileOf(move.to) - fileOf(move.from));
    const dr = Math.sign(rankOf(move.to) - rankOf(move.from));
    const step = dr * 16 + df;
    for (let sq = move.from + step; sq !== move.to; sq += step) {
      if (this.zombies.has(sq)) return true;
    }
    return false;
  }

  /**
   * A fallen piece is buried where it fell, and the piece that took it
   * bounces off the fresh grave onto a free square nearby
   */
  onAfterMove(ctx: PluginContext, move: Move): void {
    this.bounce = null;
    // Landing on a zombie puts it down for good
    if (this.zombies.delete(move.to)) return;
    if (!move.captured) return;
    const { board } = ctx;
    if (move.flags & MoveFlag.EnPassant) {
      const fell = move.to + (move.piece.color === Color.White ? -16 : 16);
      this.dig(fell, move.captured.type);
      return;
    }
    const landing = this.bounceSquare(board, move.to);
    if (landing === null) {
      this.bury(board, move.captured.type, move.to);
      return;
    }
    board.put(landing, board.remove(move.to)!);
    this.dig(move.to, move.captured.type);
    this.bounce = { from: move.from, via: move.to, to: landing };
  }

  private dig(sq: SquareIndex, type: PieceType): void {
    const look = Math.floor(Math.random() * HEADSTONE_LOOKS);
    this.graves.push({ sq, type, rounds: RISE_AFTER_ROUNDS, look });
  }

  /** Buries a fallen piece on the nearest open ground to where it fell */
  private bury(board: Board, type: PieceType, near: SquareIndex): void {
    const open = ALL_SQUARES.filter((sq) => this.isOpen(board, sq)).sort(
      (a, b) => reach(a, near) - reach(b, near) || Math.random() - 0.5,
    );
    if (open.length > 0) this.dig(open[0], type);
  }

  /**
   * The nearest open square the capturer can be knocked onto without
   * leaving its own king attacked. Pawns never land on the back ranks.
   */
  private bounceSquare(board: Board, from: SquareIndex): SquareIndex | null {
    const piece = board.get(from)!;
    const candidates = ALL_SQUARES.filter(
      (sq) =>
        reach(sq, from) <= BOUNCE_REACH &&
        this.isOpen(board, sq) &&
        (piece.type !== PieceType.Pawn || (rankOf(sq) > 0 && rankOf(sq) < 7)),
    ).sort((a, b) => reach(a, from) - reach(b, from) || Math.random() - 0.5);
    for (const sq of candidates) {
      board.remove(from);
      board.put(sq, piece);
      const king = board.findKing(piece.color);
      const safe =
        king === null ||
        (!isSquareAttacked(board, king, opponent(piece.color)) &&
          this.zombiesBeside(king).length === 0);
      board.remove(sq);
      board.put(from, piece);
      if (safe) return sq;
    }
    return null;
  }

  /** Free of pieces, zombies, and other graves */
  private isOpen(board: Board, sq: SquareIndex): boolean {
    return (
      !board.get(sq) &&
      !this.zombies.has(sq) &&
      !this.graves.some((g) => g.sq === sq)
    );
  }

  /** After each full round the dead rise, then every zombie bites or shambles */
  onTurnEnd(ctx: PluginContext, color: Color): void {
    if (color !== Color.Black) return;
    const { board } = ctx;
    this.round++;
    this.events = [];

    for (const grave of this.graves) grave.rounds--;
    const rising = this.graves.filter(
      (g) => g.rounds <= 0 && !board.get(g.sq) && !this.zombies.has(g.sq),
    );
    this.graves = this.graves.filter((g) => !rising.includes(g));
    for (const grave of rising) {
      this.zombies.set(grave.sq, grave.type);
      this.events.push({ kind: "rise", to: grave.sq, look: grave.look });
    }

    // Zombies that rose this round need a moment before they act
    const acting = [...this.zombies.keys()].filter(
      (sq) => !rising.some((g) => g.sq === sq),
    );
    for (const sq of acting) {
      if (!this.zombies.has(sq)) continue;
      const victim = this.biteTarget(board, sq);
      if (victim !== null) {
        this.bite(board, sq, victim);
        continue;
      }
      const to = this.shambleTarget(board, sq);
      if (to === null) continue;
      const type = this.zombies.get(sq)!;
      this.zombies.delete(sq);
      this.zombies.set(to, type);
      this.events.push({ kind: "shamble", from: sq, to });
    }
  }

  /** A living piece next to the zombie, if any, kings first */
  private biteTarget(board: Board, from: SquareIndex): SquareIndex | null {
    const near = QUEEN_DIRECTIONS.map((d) => from + d).filter(
      (sq) => isValidSquare(sq) && board.get(sq),
    );
    if (near.length === 0) return null;
    const king = near.find((sq) => board.get(sq)?.type === PieceType.King);
    return king ?? near[Math.floor(Math.random() * near.length)];
  }

  /** The open neighboring square that brings the zombie closest to the nearest living piece */
  private shambleTarget(board: Board, from: SquareIndex): SquareIndex | null {
    const living = ALL_SQUARES.filter((sq) => board.get(sq));
    if (living.length === 0) return null;
    const nearest = (sq: SquareIndex) =>
      Math.min(...living.map((p) => reach(p, sq)));
    const here = nearest(from);
    const steps = QUEEN_DIRECTIONS.map((d) => from + d).filter(
      (sq) =>
        isValidSquare(sq) &&
        !board.get(sq) &&
        !this.zombies.has(sq) &&
        !this.graves.some((g) => g.sq === sq),
    );
    const better = steps
      .map((sq) => ({ sq, d: nearest(sq) }))
      .filter((s) => s.d < here)
      .sort((a, b) => a.d - b.d || Math.random() - 0.5);
    return better[0]?.sq ?? null;
  }

  /** The bitten piece turns; a bitten king costs its side the game */
  private bite(board: Board, from: SquareIndex, victim: SquareIndex): void {
    const piece = board.get(victim)!;
    this.events.push({ kind: "bite", from, to: victim, victim: piece });
    board.remove(victim);
    this.zombies.set(victim, piece.type);
    this.graves = this.graves.filter((g) => g.sq !== victim);
    if (piece.type === PieceType.King) this.winner = opponent(piece.color);
  }

  /** A zombie beside the king to move is check, and with no way out, mate */
  modifyGameStatus(ctx: PluginContext, status: GameStatus): GameStatus {
    if (this.winner !== null) return GameStatus.Checkmate;
    if (status !== GameStatus.Active && status !== GameStatus.Check) {
      return status;
    }
    const color = ctx.game.turn;
    const menaced = this.menace(ctx.board, color) !== null;
    const moves = this.modifyLegalMoves(ctx, ctx.game.getLegalMoves(), color);
    if (moves.length === 0) {
      return menaced || status === GameStatus.Check
        ? GameStatus.Checkmate
        : GameStatus.Stalemate;
    }
    return menaced ? GameStatus.Check : status;
  }

  private menace(board: Board, color: Color): ZombieView["menace"] {
    const king = board.findKing(color);
    if (king === null) return null;
    const zombies = this.zombiesBeside(king);
    return zombies.length > 0 ? { king, zombies } : null;
  }

  getWinner(): Color | null {
    return this.winner;
  }

  getSquareModifiers(
    _ctx: PluginContext,
    square: SquareIndex,
  ): SquareModifier[] {
    return this.zombies.has(square) ? [{ className: "zombie-square" }] : [];
  }

  /**
   * The computer puts zombies down when it can and keeps its pieces from
   * standing where one could bite them
   */
  squareBonus(square: SquareIndex, piece: Piece): number {
    if (this.zombies.has(square)) return 2.5;
    const bitable = [...this.zombies.keys()].some(
      (z) => reach(z, square) === 1,
    );
    if (!bitable) return 0;
    return piece.type === PieceType.King ? -50 : -1.5;
  }

  getBoardOverlays(ctx: PluginContext): BoardOverlay[] {
    const view: ZombieView = {
      zombies: Object.fromEntries(this.zombies),
      graves: this.graves.map((g) => ({ ...g })),
      round: this.round,
      events: this.events,
      bounce: this.bounce,
      menace: this.menace(ctx.board, ctx.game.turn),
    };
    return [{ type: "zombies", squares: [...this.zombies.keys()], data: view }];
  }
}
