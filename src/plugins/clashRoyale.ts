import { Color, PieceType } from "../engine/types";
import type { Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import { generatePseudoLegalMoves, opponent } from "../engine/moves";
import type { ModePlugin, PluginContext, BoardOverlay } from "./types";
import { ALL_SQUARES, fileOf, rankOf } from "../utils/squareUtils";

interface UnitStats {
  hp: number;
  damage: number;
  /** Rest after a march, on top of the march itself */
  moveMs: number;
  attackMs: number;
}

const STATS: Record<PieceType, UnitStats> = {
  [PieceType.Pawn]: { hp: 4, damage: 1, moveMs: 1500, attackMs: 1100 },
  [PieceType.Knight]: { hp: 7, damage: 2, moveMs: 1000, attackMs: 1300 },
  [PieceType.Bishop]: { hp: 6, damage: 2, moveMs: 1300, attackMs: 1500 },
  [PieceType.Rook]: { hp: 11, damage: 3, moveMs: 2000, attackMs: 1900 },
  [PieceType.Queen]: { hp: 10, damage: 3, moveMs: 1200, attackMs: 1300 },
  [PieceType.King]: { hp: 30, damage: 1, moveMs: 0, attackMs: 900 },
};

export const PIECE_COST: Record<string, number> = {
  [PieceType.Pawn]: 1,
  [PieceType.Knight]: 3,
  [PieceType.Bishop]: 3,
  [PieceType.Rook]: 5,
  [PieceType.Queen]: 9,
};

const PIECE_VALUE: Record<PieceType, number> = {
  [PieceType.Pawn]: 1,
  [PieceType.Knight]: 3,
  [PieceType.Bishop]: 3,
  [PieceType.Rook]: 5,
  [PieceType.Queen]: 9,
  [PieceType.King]: 20,
};

const MAX_ELIXIR = 10;
const ELIXIR_MS = 1300;
/** How far a king tower can shoot, in squares */
const TOWER_RANGE = 2;
const MELEE_HIT_MS = 170;
/** A deployed unit falls this long before it lands */
export const DROP_MS = 520;
/** Events stay visible to the board for this long */
const EVENT_LIFE_MS = 2600;
const DEPLOY_CARDS: PieceType[] = [
  PieceType.Pawn,
  PieceType.Pawn,
  PieceType.Pawn,
  PieceType.Knight,
  PieceType.Bishop,
  PieceType.Rook,
  PieceType.Queen,
];

export interface Unit {
  id: number;
  hp: number;
  maxHp: number;
  readyIn: number;
}

export type BattleEvent =
  | {
      kind: "move";
      id: number;
      unitId: number;
      from: SquareIndex;
      to: SquareIndex;
      ms: number;
      delayMs: number;
    }
  | {
      kind: "attack";
      id: number;
      unitId: number;
      targetId: number;
      color: Color;
      from: SquareIndex;
      to: SquareIndex;
      damage: number;
      ranged: boolean;
      kill: boolean;
      hitMs: number;
      /** A gunshot, from a rifle or a machine gun, drawn as a tracer */
      weapon?: "rifle" | "mg";
      /** The shot or blow went wide, landing this far off the target in squares */
      miss?: boolean;
      impact?: { x: number; y: number };
      /** How long after the event the shot is fired, and which round of a burst it is */
      delayMs?: number;
      round?: number;
    }
  | {
      kind: "death";
      id: number;
      sq: SquareIndex;
      from: SquareIndex;
      piece: Piece;
      delayMs: number;
    }
  | {
      kind: "deploy";
      id: number;
      unitId: number;
      sq: SquareIndex;
      color: Color;
    }
  | {
      /** An artillery shell coming down on a square */
      kind: "shell";
      id: number;
      sq: SquareIndex;
      delayMs: number;
    };

export interface BattleView {
  units: Record<number, Unit>;
  events: BattleEvent[];
  /** What each unit carries, by unit id, where pieces are armed */
  arms?: Record<number, "rifle" | "mg">;
}

type Unstamped<E> = E extends BattleEvent ? Omit<E, "id"> : never;
type NewEvent = Unstamped<BattleEvent>;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const jitter = (ms: number) => ms * rand(0.75, 1.3);

function reach(a: SquareIndex, b: SquareIndex): number {
  return Math.max(
    Math.abs(fileOf(a) - fileOf(b)),
    Math.abs(rankOf(a) - rankOf(b)),
  );
}

function distance(a: SquareIndex, b: SquareIndex): number {
  return Math.hypot(fileOf(a) - fileOf(b), rankOf(a) - rankOf(b));
}

/** How long a unit takes to march from one square to another */
export function travelMs(from: SquareIndex, to: SquareIndex): number {
  return Math.round(280 + 190 * Math.sqrt(distance(from, to)));
}

function projectileMs(from: SquareIndex, to: SquareIndex): number {
  return Math.round(220 + 90 * distance(from, to));
}

/**
 * A real-time battle. Every piece is a unit with health and its own clock:
 * it marches toward the nearest enemy, attacks anything it could capture,
 * and steps into the square of a unit it finishes off. Kings are towers that
 * never move, shoot nearby enemies, and lose the game when they fall.
 */
export class RallyPlugin implements ModePlugin {
  id = "rally";
  name = "Clash Royale";
  description =
    "Pieces fight on their own. Spend elixir to drop in reinforcements.";
  isAutonomous = true;

  resourceWhite = 5;
  resourceBlack = 5;
  private units = new Map<SquareIndex, Unit>();
  private events: BattleEvent[] = [];
  private eventTimes = new Map<number, number>();
  private nextId = 1;
  private clock = 0;
  private elixirClock = 0;
  private foeCard = this.drawCard();
  private winner: Color | null = null;

  onGameStart(ctx: PluginContext): void {
    this.units.clear();
    this.events = [];
    this.eventTimes.clear();
    this.clock = 0;
    this.elixirClock = 0;
    this.resourceWhite = 5;
    this.resourceBlack = 5;
    this.winner = null;
    // Positions change outside normal moves, so old castling rights no longer hold
    for (const color of [Color.White, Color.Black]) {
      ctx.game.castling[color] = { kingSide: false, queenSide: false };
    }
    ctx.game.enPassant = null;
    this.enlist(ctx.board);
  }

  /** Returns the winner once a king tower falls */
  tickAutonomous(ctx: PluginContext, tickMs: number): Color | null {
    if (this.winner !== null) return this.winner;
    const { board } = ctx;
    this.clock += tickMs;
    this.gainElixir(tickMs);
    this.enlist(board);
    this.foeDeploy(board);

    const ready = [...this.units].filter(([, unit]) => {
      unit.readyIn -= tickMs;
      return unit.readyIn <= 0;
    });
    for (let i = ready.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ready[i], ready[j]] = [ready[j], ready[i]];
    }
    for (const [sq, unit] of ready) {
      if (this.winner !== null) break;
      if (this.units.get(sq) === unit) this.act(board, sq, unit);
    }

    this.events = this.events.filter((e) => {
      const keep =
        this.clock - (this.eventTimes.get(e.id) ?? 0) < EVENT_LIFE_MS;
      if (!keep) this.eventTimes.delete(e.id);
      return keep;
    });
    return this.winner;
  }

  /** Drop a new unit onto an empty square, paid for with that side's elixir */
  deploy(
    board: Board,
    sq: SquareIndex,
    type: PieceType,
    color: Color,
  ): boolean {
    const cost = PIECE_COST[type];
    const purse =
      color === Color.White ? this.resourceWhite : this.resourceBlack;
    if (cost === undefined || purse < cost || board.get(sq)) return false;
    if (color === Color.White) this.resourceWhite -= cost;
    else this.resourceBlack -= cost;

    board.put(sq, { type, color });
    const unit = this.recruit(type, DROP_MS + rand(150, 450));
    this.units.set(sq, unit);
    this.emit({ kind: "deploy", unitId: unit.id, sq, color });
    return true;
  }

  getBoardOverlays(): BoardOverlay[] {
    const view: BattleView = {
      units: Object.fromEntries(this.units),
      events: [...this.events],
    };
    return [
      {
        type: "rally-resources",
        squares: [],
        data: { white: this.resourceWhite, black: this.resourceBlack },
      },
      { type: "rally-battle", squares: [], data: view },
    ];
  }

  private recruit(type: PieceType, readyIn: number): Unit {
    const hp = STATS[type].hp;
    return { id: this.nextId++, hp, maxHp: hp, readyIn };
  }

  /** Every piece on the board without a unit becomes one, ready at a random moment */
  private enlist(board: Board): void {
    for (const [sq] of this.units) {
      if (!board.get(sq)) this.units.delete(sq);
    }
    for (const sq of ALL_SQUARES) {
      const piece = board.get(sq);
      if (piece && !this.units.has(sq)) {
        this.units.set(sq, this.recruit(piece.type, rand(200, 2800)));
      }
    }
  }

  private emit(event: NewEvent): void {
    const id = this.nextId++;
    this.events.push({ ...event, id } as BattleEvent);
    this.eventTimes.set(id, this.clock);
  }

  private gainElixir(tickMs: number): void {
    this.elixirClock += tickMs;
    while (this.elixirClock >= ELIXIR_MS) {
      this.elixirClock -= ELIXIR_MS;
      this.resourceWhite = Math.min(MAX_ELIXIR, this.resourceWhite + 1);
      this.resourceBlack = Math.min(MAX_ELIXIR, this.resourceBlack + 1);
    }
  }

  private drawCard(): PieceType {
    return DEPLOY_CARDS[Math.floor(Math.random() * DEPLOY_CARDS.length)];
  }

  private act(board: Board, sq: SquareIndex, unit: Unit): void {
    const piece = board.get(sq);
    if (!piece) return;
    const stats = STATS[piece.type];

    const target = this.pickTarget(board, sq, piece);
    if (target !== null) {
      this.attack(board, sq, target, piece);
      unit.readyIn = jitter(stats.attackMs);
      return;
    }
    if (piece.type === PieceType.King) {
      unit.readyIn = rand(250, 500);
      return;
    }

    const step = this.pickStep(board, sq, piece);
    if (step === null) {
      unit.readyIn = rand(400, 900);
      return;
    }
    const ms = travelMs(sq, step);
    this.relocate(board, sq, step, piece);
    this.emit({
      kind: "move",
      unitId: unit.id,
      from: sq,
      to: step,
      ms,
      delayMs: 0,
    });
    unit.readyIn = ms + jitter(stats.moveMs);
  }

  /** Squares this unit could hit right now */
  private reachable(
    board: Board,
    sq: SquareIndex,
    piece: Piece,
  ): SquareIndex[] {
    if (piece.type === PieceType.King) {
      return ALL_SQUARES.filter(
        (s) =>
          board.get(s)?.color === opponent(piece.color) &&
          reach(sq, s) <= TOWER_RANGE,
      );
    }
    return generatePseudoLegalMoves(board, piece.color, null)
      .filter((m) => m.from === sq && m.captured)
      .map((m) => m.to);
  }

  private pickTarget(
    board: Board,
    sq: SquareIndex,
    piece: Piece,
  ): SquareIndex | null {
    const damage = STATS[piece.type].damage;
    let best: SquareIndex | null = null;
    let bestScore = -Infinity;
    for (const to of this.reachable(board, sq, piece)) {
      const victim = board.get(to)!;
      const hp = this.units.get(to)?.hp ?? 1;
      const score =
        (hp <= damage ? 100 : 0) +
        (victim.type === PieceType.King ? 40 : 0) +
        PIECE_VALUE[victim.type] * 3 -
        hp +
        Math.random();
      if (score > bestScore) {
        bestScore = score;
        best = to;
      }
    }
    return best;
  }

  private attack(
    board: Board,
    from: SquareIndex,
    to: SquareIndex,
    piece: Piece,
  ): void {
    const attacker = this.units.get(from)!;
    const target = this.units.get(to)!;
    const victim = board.get(to)!;
    const damage = STATS[piece.type].damage;
    const isTower = piece.type === PieceType.King;
    const ranged =
      isTower ||
      (reach(from, to) > 1 &&
        piece.type !== PieceType.Knight &&
        piece.type !== PieceType.Pawn);
    target.hp -= damage;
    const kill = target.hp <= 0;
    const stepsIn = kill && !isTower && victim.type !== PieceType.King;
    const hitMs = ranged
      ? projectileMs(from, to)
      : stepsIn
        ? Math.round(travelMs(from, to) * 0.75)
        : MELEE_HIT_MS;

    this.emit({
      kind: "attack",
      unitId: attacker.id,
      targetId: target.id,
      color: piece.color,
      from,
      to,
      damage,
      ranged,
      kill,
      hitMs,
    });
    if (!kill) return;

    this.units.delete(to);
    board.remove(to);
    this.emit({ kind: "death", sq: to, from, piece: victim, delayMs: hitMs });
    if (victim.type === PieceType.King) {
      this.winner = piece.color;
      return;
    }
    if (!stepsIn) return;

    this.relocate(board, from, to, piece);
    this.emit({
      kind: "move",
      unitId: attacker.id,
      from,
      to,
      ms: travelMs(from, to),
      delayMs: ranged ? hitMs : 0,
    });
    attacker.readyIn += travelMs(from, to);
  }

  /** Moves a unit and its piece, promoting pawns that reach the far rank */
  private relocate(
    board: Board,
    from: SquareIndex,
    to: SquareIndex,
    piece: Piece,
  ): void {
    const unit = this.units.get(from)!;
    this.units.delete(from);
    board.remove(from);
    const lastRank = piece.color === Color.White ? 7 : 0;
    if (piece.type === PieceType.Pawn && rankOf(to) === lastRank) {
      board.put(to, { type: PieceType.Queen, color: piece.color });
      unit.maxHp = STATS[PieceType.Queen].hp;
      unit.hp = unit.maxHp;
    } else {
      board.put(to, piece);
    }
    this.units.set(to, unit);
  }

  /** The step that brings this unit closest to a fight, or null to hold its ground */
  private pickStep(
    board: Board,
    sq: SquareIndex,
    piece: Piece,
  ): SquareIndex | null {
    const foes = ALL_SQUARES.filter(
      (s) => board.get(s)?.color === opponent(piece.color),
    );
    const foeKing = board.findKing(opponent(piece.color));
    const appeal = (at: SquareIndex) => {
      const nearest = Math.min(...foes.map((f) => distance(at, f)), 16);
      const toKing = foeKing === null ? 0 : distance(at, foeKing);
      return -nearest * 2 - toKing * 0.6;
    };

    const steps = generatePseudoLegalMoves(board, piece.color, null).filter(
      (m) => m.from === sq && !m.captured,
    );
    const here = appeal(sq);
    let best: SquareIndex | null = null;
    let bestScore = here + 0.3;
    for (const { to } of steps) {
      const score = appeal(to) + Math.random() * 1.5;
      if (score > bestScore) {
        bestScore = score;
        best = to;
      }
    }
    return best;
  }

  /** The foe saves up for its next card, then drops it near the fighting */
  private foeDeploy(board: Board): void {
    if (this.resourceBlack < PIECE_COST[this.foeCard]) return;
    if (Math.random() > 0.08) return;

    const allies = ALL_SQUARES.filter(
      (s) => board.get(s)?.color === Color.White,
    );
    const open = ALL_SQUARES.filter((s) => rankOf(s) >= 4 && !board.get(s));
    if (open.length === 0) return;
    const score = (s: SquareIndex) =>
      -Math.min(...allies.map((a) => distance(s, a)), 16) + Math.random() * 3;
    const spot = open.reduce((a, b) => (score(b) > score(a) ? b : a));
    if (this.deploy(board, spot, this.foeCard, Color.Black)) {
      this.foeCard = this.drawCard();
    }
  }
}
