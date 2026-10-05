import { Color, PieceType } from "../engine/types";
import type { Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import { opponent } from "../engine/moves";
import type { ModePlugin, PluginContext, BoardOverlay } from "./types";
import type { BattleEvent, BattleView, Unit } from "./clashRoyale";
import { travelMs } from "./clashRoyale";
import {
  ALL_SQUARES,
  fileOf,
  isValidSquare,
  rankOf,
} from "../utils/squareUtils";

/** Each side's trench lines, by rank, front line first */
export const TRENCH_RANKS: Record<Color, { front: number; back: number }> = {
  [Color.White]: { front: 2, back: 0 },
  [Color.Black]: { front: 5, back: 7 },
};
/** The ranks between the front lines, strung with barbed wire */
export const NO_MANS_LAND = [3, 4];
/** Where each side's machine gun is dug in, in its front trench */
export const GUN_NESTS: Record<Color, SquareIndex> = {
  [Color.White]: 0x23,
  [Color.Black]: 0x54,
};

const HP: Record<PieceType, number> = {
  [PieceType.Pawn]: 3,
  [PieceType.Knight]: 4,
  [PieceType.Bishop]: 4,
  [PieceType.Rook]: 5,
  [PieceType.Queen]: 5,
  [PieceType.King]: 6,
};

/** How often a rifleman fires, and a machine gunner opens up */
const RIFLE_MS = 2000;
const BURST_MS = 1700;
const BURST_ROUNDS = 6;
const ROUND_GAP_MS = 85;
/** A shot's chance of hitting, by where its target stands */
const RIFLE_HIT = { trench: 0.07, reserve: 0.18, open: 0.5 };
const ROUND_HIT = { trench: 0.025, reserve: 0.07, open: 0.3 };
/** The ranks men fire from: the front trenches and no man's land between them */
const FIRING_RANKS = [2, 3, 4, 5];
/** With every enemy down in a trench, a man only fires this often when his turn comes */
const IDLE_FIRE = 0.3;
/** How long a rifleman takes to bring his rifle up onto the target before firing */
export const AIM_MS = 130;
/** Men caught in the wire are sitting ducks */
const SNAGGED_HIT_BONUS = 0.2;
/** Running men fire less often and less well */
const RUNNING_AIM = 0.5;
const MELEE_HIT = 0.7;
const MELEE_DAMAGE = 2;
const MELEE_MS = 900;
/** How long a dash takes from one square to the next, and how long the wire holds a man */
const STEP_MS = 700;
const WIRE_MS: [number, number] = [1600, 2600];
/** Reserves wait a while before moving up to fill a gap in the line */
const RESERVE_CHANCE = 0.35;
/** After an order to attack, the whistle cannot blow again for this long */
export const ORDER_COOLDOWN_MS = 6000;
/** The foe waits between attacks of its own */
const FOE_FIRST_ATTACK_MS = 25000;
const FOE_ATTACK_MS: [number, number] = [28000, 45000];
/** How often the guns behind the lines open up, and how many shells each barrage throws */
const BARRAGE_MS: [number, number] = [5000, 9000];
const BARRAGE_SHELLS: [number, number] = [2, 5];
/** Shells land over this long, each one screaming in before it hits */
const BARRAGE_SPREAD_MS = 1800;
export const SHELL_FALL_MS = 900;
/** A direct hit's chance of wounding, by where the man is, and the blast's on the squares around */
const SHELL_HIT = { trench: 0.3, reserve: 0.5, open: 0.8 };
const SHELL_DAMAGE = 2;
const BLAST_HIT = { trench: 0.08, reserve: 0.2, open: 0.35 };
/** The widest a crater grows as shell holes run together, in squares */
const MAX_CRATER = 1.4;
/** A shell that lands on the wire sometimes blows a gap in it */
const WIRE_CUT_CHANCE = 0.35;
/** Events stay visible to the board for this long */
const EVENT_LIFE_MS = 2600;
const QUIET_START_MS: [number, number] = [1800, 3600];

type Cover = "trench" | "reserve" | "open";

export interface TrenchUnit extends Unit {
  /** Holding a trench, or charging for the next one across no man's land */
  order: "hold" | "charge";
  /** The rank a charging man is making for */
  goal: number;
  /** Caught on the wire until the clock passes this */
  snaggedUntil: number;
}

export interface Crater {
  /** Its middle, in files and ranks from a1's corner */
  x: number;
  y: number;
  /** Its radius, in squares */
  r: number;
  /** Seeds its own torn outline */
  seed: number;
}

export interface TrenchView {
  wire: SquareIndex[];
  /** Shell holes churned into the ground, where each shell actually burst, in squares from the board's corner */
  craters: Crater[];
  /** Where men have fallen, and whose they were, left lying in the mud */
  fallen: { sq: SquareIndex; color: Color; tilt: number }[];
  /** Units that are charging, and those tangled in the wire */
  charging: number[];
  snagged: number[];
  /** How many times each side has gone over the top, so each order is heard once */
  charges: Record<Color, number>;
  /** Whether you can blow the whistle, and how long until you can again */
  canAttack: boolean;
  cooldownMs: number;
  /** Whether each side has men out charging, and how many hold its front trench */
  advancing: Record<Color, boolean>;
  manning: Record<Color, number>;
}

type Unstamped<E> = E extends BattleEvent ? Omit<E, "id"> : never;
type NewEvent = Unstamped<BattleEvent>;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const jitter = (ms: number) => ms * rand(0.6, 1.4);
const forward = (color: Color) => (color === Color.White ? 16 : -16);

function distance(a: SquareIndex, b: SquareIndex): number {
  return Math.hypot(fileOf(a) - fileOf(b), rankOf(a) - rankOf(b));
}

function coverAt(sq: SquareIndex): Cover {
  const rank = rankOf(sq);
  if (rank === 1 || rank === 6) return "reserve";
  return NO_MANS_LAND.includes(rank) ? "open" : "trench";
}

/** How long a bullet takes to cross from one square to another */
function bulletMs(from: SquareIndex, to: SquareIndex): number {
  return Math.round(90 + 30 * distance(from, to));
}

/**
 * Trenches. Each side digs two trench lines, pawns in the front one and the
 * rest of the army in the back, with barbed wire strung across no man's land
 * between. Everyone fights on their own: riflemen pick off the enemy, mostly
 * missing men down in their trenches and seldom missing men caught in the
 * open, and each front trench has a machine gun that hoses down anyone who
 * leaves cover. Reserves move up to fill gaps in the line. A side that blows
 * its whistle sends its front line over the top to take the next enemy
 * trench, through the wire and the fire. Artillery shells both lines all the
 * while, churning no man's land into craters, and the fallen are left where
 * they lie. The side that kills the enemy king wins.
 */
export class TrenchesPlugin implements ModePlugin {
  id = "trenches";
  name = "Trenches";
  description =
    "Pieces dig in and fight on their own. Send your front line over the top to take the enemy trench.";
  isAutonomous = true;

  private units = new Map<SquareIndex, TrenchUnit>();
  private events: BattleEvent[] = [];
  private eventTimes = new Map<number, number>();
  private nextId = 1;
  private clock = 0;
  private wire = new Set<SquareIndex>();
  private incoming: { sq: SquareIndex; at: number }[] = [];
  private craters: Crater[] = [];
  private fallen: TrenchView["fallen"] = [];
  private barrageAt = 0;
  private charges: Record<Color, number> = {
    [Color.White]: 0,
    [Color.Black]: 0,
  };
  private lastOrder: Record<Color, number> = {
    [Color.White]: -Infinity,
    [Color.Black]: -Infinity,
  };
  private foeAttackAt = FOE_FIRST_ATTACK_MS;
  private winner: Color | null = null;

  onGameStart(ctx: PluginContext): void {
    this.units.clear();
    this.events = [];
    this.eventTimes.clear();
    this.clock = 0;
    this.charges = { [Color.White]: 0, [Color.Black]: 0 };
    this.lastOrder = { [Color.White]: -Infinity, [Color.Black]: -Infinity };
    this.foeAttackAt = FOE_FIRST_ATTACK_MS;
    this.winner = null;
    this.craters = [];
    this.fallen = [];
    this.incoming = [];
    this.barrageAt = rand(...BARRAGE_MS);
    for (const color of [Color.White, Color.Black]) {
      ctx.game.castling[color] = { kingSide: false, queenSide: false };
    }
    ctx.game.enPassant = null;
    this.stringWire();
    this.digIn(ctx.board);
  }

  /** Coils of wire across both ranks of no man's land, with a few gaps cut through */
  private stringWire(): void {
    this.wire.clear();
    for (const rank of NO_MANS_LAND) {
      const gaps = new Set<number>();
      while (gaps.size < 3) gaps.add(Math.floor(Math.random() * 8));
      for (let file = 0; file < 8; file++) {
        if (!gaps.has(file)) this.wire.add(rank * 16 + file);
      }
    }
  }

  /**
   * Each army files into its trenches: pawns into the front line, with one
   * on the machine gun, and everyone else into the back line, the king in
   * the middle of it
   */
  private digIn(board: Board): void {
    const moves: { from: SquareIndex; to: SquareIndex; piece: Piece }[] = [];
    for (const color of [Color.White, Color.Black]) {
      const army = ALL_SQUARES.filter((sq) => board.get(sq)?.color === color)
        .map((sq) => ({ sq, piece: board.get(sq)! }))
        .sort((a, b) => fileOf(a.sq) - fileOf(b.sq));
      const { front, back } = TRENCH_RANKS[color];
      const reserve = color === Color.White ? 1 : 6;
      const taken = new Set<SquareIndex>();
      const claim = (rank: number, file: number) => {
        const sq = rank * 16 + file;
        if (taken.has(sq)) return null;
        taken.add(sq);
        return sq;
      };
      // Nearest free square to a file along the given ranks, in order
      const place = (ranks: number[], file: number) => {
        for (const rank of ranks) {
          for (let off = 0; off < 8; off++) {
            for (const f of [file - off, file + off]) {
              if (f < 0 || f > 7) continue;
              const sq = claim(rank, f);
              if (sq !== null) return sq;
            }
          }
        }
        return null;
      };
      const pawns = army.filter((a) => a.piece.type === PieceType.Pawn);
      const officers = army.filter((a) => a.piece.type !== PieceType.Pawn);
      // The gunner takes the nest first
      const nest = GUN_NESTS[color];
      if (pawns.length > 0) {
        const gunner = pawns.reduce((a, b) =>
          Math.abs(fileOf(a.sq) - fileOf(nest)) <=
          Math.abs(fileOf(b.sq) - fileOf(nest))
            ? a
            : b,
        );
        taken.add(nest);
        moves.push({ from: gunner.sq, to: nest, piece: gunner.piece });
        pawns.splice(pawns.indexOf(gunner), 1);
      }
      for (const { sq, piece } of pawns) {
        const to = place([front, reserve, back], fileOf(sq));
        if (to !== null) moves.push({ from: sq, to, piece });
      }
      const home: Partial<Record<PieceType, number[]>> = {
        [PieceType.King]: [4],
        [PieceType.Queen]: [3],
        [PieceType.Bishop]: [2, 5],
        [PieceType.Knight]: [1, 6],
        [PieceType.Rook]: [0, 7],
      };
      // The king first, so it always gets the middle of the back line
      officers.sort(
        (a, b) =>
          Number(b.piece.type === PieceType.King) -
          Number(a.piece.type === PieceType.King),
      );
      for (const { sq, piece } of officers) {
        const files = home[piece.type] ?? [fileOf(sq)];
        const file = files.find((f) => !taken.has(back * 16 + f)) ?? fileOf(sq);
        const to = place([back, reserve, front], file);
        if (to !== null) moves.push({ from: sq, to, piece });
      }
    }

    for (const { from } of moves) board.remove(from);
    moves.forEach(({ from, to, piece }, i) => {
      board.put(to, piece);
      const unit = this.recruit(piece.type);
      this.units.set(to, unit);
      if (from === to) return;
      const ms = travelMs(from, to);
      const delayMs = (i % 8) * 90;
      this.emit({ kind: "move", unitId: unit.id, from, to, ms, delayMs });
      unit.readyIn = delayMs + ms + rand(...QUIET_START_MS);
    });
  }

  private recruit(type: PieceType): TrenchUnit {
    const hp = HP[type];
    return {
      id: this.nextId++,
      hp,
      maxHp: hp,
      readyIn: rand(...QUIET_START_MS),
      order: "hold",
      goal: 0,
      snaggedUntil: 0,
    };
  }

  /** Returns the winner once a king falls */
  tickAutonomous(ctx: PluginContext, tickMs: number): Color | null {
    if (this.winner !== null) return this.winner;
    const { board } = ctx;
    this.clock += tickMs;
    // Pieces placed by anything else join the fight
    for (const [sq] of this.units) {
      if (!board.get(sq)) this.units.delete(sq);
    }
    for (const sq of ALL_SQUARES) {
      const piece = board.get(sq);
      if (piece && !this.units.has(sq)) {
        this.units.set(sq, this.recruit(piece.type));
      }
    }

    if (this.clock >= this.barrageAt) {
      this.barrageAt = this.clock + rand(...BARRAGE_MS);
      this.barrage();
    }
    this.landShells(board);

    if (this.clock >= this.foeAttackAt) {
      this.foeAttackAt = this.clock + rand(...FOE_ATTACK_MS);
      this.attack(board, Color.Black);
    }

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

    for (const color of [Color.White, Color.Black]) {
      const left = ALL_SQUARES.some((sq) => board.get(sq)?.color === color);
      if (!left && this.winner === null) this.winner = opponent(color);
    }

    this.events = this.events.filter((e) => {
      const keep =
        this.clock - (this.eventTimes.get(e.id) ?? 0) < EVENT_LIFE_MS;
      if (!keep) this.eventTimes.delete(e.id);
      return keep;
    });
    return this.winner;
  }

  /** How long until a side can blow its whistle again */
  cooldown(color: Color): number {
    return Math.max(0, this.lastOrder[color] + ORDER_COOLDOWN_MS - this.clock);
  }

  /** The trench rank a side's most forward men hold, and the enemy trench beyond it */
  private frontage(
    board: Board,
    color: Color,
  ): { from: number; to: number } | null {
    const lines =
      color === Color.White
        ? [
            {
              from: TRENCH_RANKS[Color.Black].front,
              to: TRENCH_RANKS[Color.Black].back,
            },
            {
              from: TRENCH_RANKS[Color.White].front,
              to: TRENCH_RANKS[Color.Black].front,
            },
          ]
        : [
            {
              from: TRENCH_RANKS[Color.White].front,
              to: TRENCH_RANKS[Color.White].back,
            },
            {
              from: TRENCH_RANKS[Color.Black].front,
              to: TRENCH_RANKS[Color.White].front,
            },
          ];
    return (
      lines.find(({ from }) =>
        ALL_SQUARES.some(
          (sq) =>
            rankOf(sq) === from &&
            board.get(sq)?.color === color &&
            this.units.get(sq)?.order === "hold" &&
            sq !== GUN_NESTS[color],
        ),
      ) ?? null
    );
  }

  /**
   * Over the top: everyone in the side's most forward trench, but the man on
   * the machine gun, charges for the next enemy trench
   */
  attack(board: Board, color: Color): boolean {
    if (this.winner !== null || this.cooldown(color) > 0) return false;
    const line = this.frontage(board, color);
    if (!line) return false;
    let going = 0;
    for (const [sq, unit] of this.units) {
      if (rankOf(sq) !== line.from || board.get(sq)?.color !== color) continue;
      if (sq === GUN_NESTS[color] || unit.order !== "hold") continue;
      unit.order = "charge";
      unit.goal = line.to;
      unit.readyIn = rand(0, 450);
      going++;
    }
    if (going === 0) return false;
    this.lastOrder[color] = this.clock;
    this.charges[color]++;
    return true;
  }

  /** Whether a side has anyone in a trench who could go over the top */
  canAttack(board: Board, color: Color): boolean {
    return this.cooldown(color) === 0 && this.frontage(board, color) !== null;
  }

  private act(board: Board, sq: SquareIndex, unit: TrenchUnit): void {
    const piece = board.get(sq);
    if (!piece) return;
    if (unit.snaggedUntil > this.clock) {
      unit.readyIn = unit.snaggedUntil - this.clock;
      return;
    }

    // Anyone close enough is fought hand to hand
    const foe = this.adjacentFoe(board, sq, piece.color);
    if (foe !== null) {
      this.melee(board, sq, foe, piece, unit);
      unit.readyIn = jitter(MELEE_MS);
      return;
    }

    if (unit.order === "charge") {
      if (rankOf(sq) === unit.goal) {
        unit.order = "hold";
      } else if (this.advance(board, sq, unit, piece)) {
        return;
      } else if (Math.random() < 0.5) {
        this.fire(board, sq, piece, true);
        unit.readyIn = jitter(RIFLE_MS * 1.6);
        return;
      } else {
        unit.readyIn = rand(300, 700);
        return;
      }
    }

    if (this.fightInTrench(board, sq, unit, piece)) return;
    if (this.moveUp(board, sq, unit, piece)) return;

    // Only the front line fires; the back trenches and the reserves keep their heads down
    if (!FIRING_RANKS.includes(rankOf(sq))) {
      unit.readyIn = rand(800, 1600);
      return;
    }
    // With nobody showing above the parapets, the line mostly holds its fire
    if (!this.anyoneExposed(board, piece.color) && Math.random() > IDLE_FIRE) {
      unit.readyIn = jitter(RIFLE_MS);
      return;
    }

    if (sq === GUN_NESTS[piece.color] && piece.type === PieceType.Pawn) {
      if (this.burst(board, sq, piece)) {
        unit.readyIn = jitter(BURST_MS);
        return;
      }
    }
    this.fire(board, sq, piece, false);
    unit.readyIn = jitter(RIFLE_MS);
  }

  /** Whether any of the enemy is out of a trench, in the open or moving up behind the lines */
  private anyoneExposed(board: Board, color: Color): boolean {
    return ALL_SQUARES.some(
      (s) => board.get(s)?.color === opponent(color) && coverAt(s) !== "trench",
    );
  }

  private adjacentFoe(
    board: Board,
    sq: SquareIndex,
    color: Color,
  ): SquareIndex | null {
    const around = [-17, -16, -15, -1, 1, 15, 16, 17]
      .map((d) => sq + d)
      .filter(
        (s) => isValidSquare(s) && board.get(s)?.color === opponent(color),
      );
    if (around.length === 0) return null;
    return around[Math.floor(Math.random() * around.length)];
  }

  /** A dash one square toward the goal, through the wire if it must */
  private advance(
    board: Board,
    sq: SquareIndex,
    unit: TrenchUnit,
    piece: Piece,
  ): boolean {
    const step = forward(piece.color);
    const options = [step, step - 1, step + 1]
      .map((d) => sq + d)
      .filter(
        (to) =>
          isValidSquare(to) &&
          Math.abs(fileOf(to) - fileOf(sq)) <= 1 &&
          !board.get(to),
      )
      .map((to) => ({
        to,
        score:
          (to === sq + step ? 1 : 0) -
          (this.wire.has(to) ? 1.5 : 0) +
          Math.random(),
      }))
      .sort((a, b) => b.score - a.score);
    const to = options[0]?.to;
    if (to === undefined) return false;
    const ms = Math.round(STEP_MS * rand(0.85, 1.2));
    this.relocate(board, sq, to);
    this.emit({ kind: "move", unitId: unit.id, from: sq, to, ms, delayMs: 0 });
    unit.readyIn = ms;
    if (this.wire.has(to)) {
      unit.snaggedUntil = this.clock + ms + rand(...WIRE_MS);
      unit.readyIn = unit.snaggedUntil - this.clock;
    }
    return true;
  }

  /** Reserves move up to fill a gap in their side's front line */
  private moveUp(
    board: Board,
    sq: SquareIndex,
    unit: TrenchUnit,
    piece: Piece,
  ): boolean {
    if (piece.type === PieceType.King) return false;
    const { front, back } = TRENCH_RANKS[piece.color];
    const reserve = piece.color === Color.White ? 1 : 6;
    const rank = rankOf(sq);
    if (rank !== back && rank !== reserve) return false;
    const gap = ALL_SQUARES.some((s) => rankOf(s) === front && !board.get(s));
    if (!gap || (rank === back && Math.random() > RESERVE_CHANCE)) return false;
    const step = forward(piece.color);
    const to = [step, step - 1, step + 1]
      .map((d) => sq + d)
      .find(
        (s) =>
          isValidSquare(s) &&
          Math.abs(fileOf(s) - fileOf(sq)) <= 1 &&
          !board.get(s) &&
          (rankOf(s) === reserve || rankOf(s) === front),
      );
    if (to === undefined) return false;
    const ms = Math.round(STEP_MS * 1.2);
    this.relocate(board, sq, to);
    this.emit({ kind: "move", unitId: unit.id, from: sq, to, ms, delayMs: 0 });
    unit.readyIn = ms + rand(300, 900);
    return true;
  }

  /** A target worth shooting at: anyone, but men in the open most of all */
  private pickTarget(
    board: Board,
    sq: SquareIndex,
    color: Color,
    weights: Record<Cover, number>,
  ): SquareIndex | null {
    const foes = ALL_SQUARES.filter(
      (s) => board.get(s)?.color === opponent(color),
    );
    if (foes.length === 0) return null;
    const weighted = foes.map((s) => ({
      s,
      w: weights[coverAt(s)] / (1 + distance(sq, s) * 0.15),
    }));
    let roll = Math.random() * weighted.reduce((t, x) => t + x.w, 0);
    for (const { s, w } of weighted) {
      roll -= w;
      if (roll <= 0) return s;
    }
    return weighted[weighted.length - 1].s;
  }

  private fire(
    board: Board,
    sq: SquareIndex,
    piece: Piece,
    running: boolean,
  ): void {
    const target = this.pickTarget(board, sq, piece.color, {
      trench: 1,
      reserve: 2,
      open: 6,
    });
    if (target === null) return;
    const chance =
      this.hitChance(sq, target, RIFLE_HIT) * (running ? RUNNING_AIM : 1);
    this.shoot(board, sq, target, piece, "rifle", chance, AIM_MS, 0);
  }

  /** The machine gun rakes one target with a burst; returns false if there is nobody to fire at */
  private burst(
    board: Board,
    sq: SquareIndex,
    piece: Piece,
    at?: SquareIndex,
  ): boolean {
    const target =
      at ??
      this.pickTarget(board, sq, piece.color, {
        trench: 1,
        reserve: 3,
        open: 14,
      });
    if (target === null) return false;
    for (let round = 0; round < BURST_ROUNDS; round++) {
      if (!board.get(target)) break;
      this.shoot(
        board,
        sq,
        target,
        piece,
        "mg",
        this.hitChance(sq, target, ROUND_HIT),
        round * ROUND_GAP_MS,
        round,
      );
    }
    return true;
  }

  /** A trench gives no cover from fire down its own length */
  private hitChance(
    from: SquareIndex,
    target: SquareIndex,
    table: Record<Cover, number>,
  ): number {
    const snagged = (this.units.get(target)?.snaggedUntil ?? 0) > this.clock;
    const cover = rankOf(from) === rankOf(target) ? "open" : coverAt(target);
    return table[cover] + (snagged ? SNAGGED_HIT_BONUS : 0);
  }

  /**
   * With the enemy in the same trench, the fight is fought along it: each man
   * makes his way toward the nearest of them to close with him, and shoots
   * down the trench when he cannot get past. The machine gunner stays on his
   * gun and rakes the trench.
   */
  private fightInTrench(
    board: Board,
    sq: SquareIndex,
    unit: TrenchUnit,
    piece: Piece,
  ): boolean {
    if (coverAt(sq) !== "trench") return false;
    const rank = rankOf(sq);
    const rivals = ALL_SQUARES.filter(
      (s) =>
        rankOf(s) === rank && board.get(s)?.color === opponent(piece.color),
    );
    if (rivals.length === 0) return false;
    const gap = (s: SquareIndex) => Math.abs(fileOf(s) - fileOf(sq));
    const nearest = rivals.reduce((a, b) => (gap(b) < gap(a) ? b : a));
    const gunner =
      sq === GUN_NESTS[piece.color] && piece.type === PieceType.Pawn;
    if (gunner) {
      this.burst(board, sq, piece, nearest);
      unit.readyIn = jitter(BURST_MS);
      return true;
    }
    const step = sq + Math.sign(fileOf(nearest) - fileOf(sq));
    if (!board.get(step)) {
      const ms = Math.round(STEP_MS * rand(0.9, 1.2));
      this.relocate(board, sq, step);
      this.emit({
        kind: "move",
        unitId: unit.id,
        from: sq,
        to: step,
        ms,
        delayMs: 0,
      });
      unit.readyIn = ms;
      return true;
    }
    this.shoot(
      board,
      sq,
      nearest,
      piece,
      "rifle",
      this.hitChance(sq, nearest, RIFLE_HIT),
      AIM_MS,
      0,
    );
    unit.readyIn = jitter(RIFLE_MS * 0.7);
    return true;
  }

  private shoot(
    board: Board,
    from: SquareIndex,
    to: SquareIndex,
    piece: Piece,
    weapon: "rifle" | "mg",
    chance: number,
    delayMs: number,
    round: number,
  ): void {
    const shooter = this.units.get(from)!;
    const target = this.units.get(to);
    if (!target) return;
    const hit = Math.random() < chance;
    const hitMs = bulletMs(from, to);
    // A miss kicks up the mud somewhere near the target
    const impact = hit
      ? { x: 0, y: 0 }
      : { x: rand(-0.45, 0.45), y: rand(-0.45, 0.45) };
    if (hit) target.hp -= 1;
    const kill = hit && target.hp <= 0;
    this.emit({
      kind: "attack",
      unitId: shooter.id,
      targetId: target.id,
      color: piece.color,
      from,
      to,
      damage: hit ? 1 : 0,
      ranged: true,
      kill,
      hitMs,
      weapon,
      miss: !hit,
      impact,
      delayMs,
      round,
    });
    if (kill) this.fall(board, to, from, delayMs + hitMs);
  }

  private melee(
    board: Board,
    from: SquareIndex,
    to: SquareIndex,
    piece: Piece,
    unit: TrenchUnit,
  ): void {
    const target = this.units.get(to);
    if (!target) return;
    const hit = Math.random() < MELEE_HIT;
    if (hit) target.hp -= MELEE_DAMAGE;
    const kill = hit && target.hp <= 0;
    const hitMs = 170;
    this.emit({
      kind: "attack",
      unitId: unit.id,
      targetId: target.id,
      color: piece.color,
      from,
      to,
      damage: hit ? MELEE_DAMAGE : 0,
      ranged: false,
      kill,
      hitMs,
      miss: !hit,
      weapon: "bayonet",
    });
    if (!kill) return;
    this.fall(board, to, from, hitMs);
    // A charging man takes the ground of the one he cut down, if it is on his way
    const ahead =
      piece.color === Color.White
        ? rankOf(to) >= rankOf(from)
        : rankOf(to) <= rankOf(from);
    if (unit.order === "charge" && ahead) {
      const ms = travelMs(from, to);
      this.relocate(board, from, to);
      this.emit({
        kind: "move",
        unitId: unit.id,
        from,
        to,
        ms,
        delayMs: hitMs,
      });
      unit.readyIn = hitMs + ms;
    }
  }

  private fall(
    board: Board,
    sq: SquareIndex,
    from: SquareIndex,
    delayMs: number,
  ): void {
    const victim = board.get(sq);
    if (!victim) return;
    this.units.delete(sq);
    board.remove(sq);
    this.emit({ kind: "death", sq, from, piece: victim, delayMs });
    // Where a man falls, his helmet stays
    if (!this.fallen.some((f) => f.sq === sq)) {
      this.fallen.push({ sq, color: victim.color, tilt: rand(-40, 40) });
    }
    if (victim.type === PieceType.King) this.winner = opponent(victim.color);
  }

  /**
   * The guns behind the lines open up: shells scream in on no man's land and
   * on both sides' trenches
   */
  private barrage(): void {
    const shells = Math.round(rand(...BARRAGE_SHELLS));
    for (let i = 0; i < shells; i++) {
      const roll = Math.random();
      const ranks =
        roll < 0.5
          ? NO_MANS_LAND
          : roll < 0.85
            ? [TRENCH_RANKS[Color.White].front, TRENCH_RANKS[Color.Black].front]
            : [
                1,
                6,
                TRENCH_RANKS[Color.White].back,
                TRENCH_RANKS[Color.Black].back,
              ];
      const rank = ranks[Math.floor(Math.random() * ranks.length)];
      const sq = rank * 16 + Math.floor(Math.random() * 8);
      const delayMs = Math.round(rand(0, BARRAGE_SPREAD_MS));
      this.incoming.push({ sq, at: this.clock + delayMs + SHELL_FALL_MS });
      this.emit({ kind: "shell", sq, delayMs });
    }
  }

  /** Shells that have come down blast whoever is under them and churn the ground */
  private landShells(board: Board): void {
    const landed = this.incoming.filter((s) => s.at <= this.clock);
    if (landed.length === 0) return;
    this.incoming = this.incoming.filter((s) => s.at > this.clock);
    for (const { sq } of landed) {
      if (NO_MANS_LAND.includes(rankOf(sq))) {
        // Shells burst where they fall, not in the middle of a square
        this.blastCrater({
          x: fileOf(sq) + rand(0.1, 0.9),
          y: rankOf(sq) + rand(0.1, 0.9),
          r: rand(0.32, 0.62),
          seed: Math.floor(Math.random() * 1e9),
        });
        if (this.wire.has(sq) && Math.random() < WIRE_CUT_CHANCE) {
          this.wire.delete(sq);
        }
      }
      const around = [0, -17, -16, -15, -1, 1, 15, 16, 17]
        .map((d) => sq + d)
        .filter(
          (s) => isValidSquare(s) && Math.abs(fileOf(s) - fileOf(sq)) <= 1,
        );
      for (const s of around) {
        const unit = this.units.get(s);
        if (!unit || !board.get(s)) continue;
        const odds = (s === sq ? SHELL_HIT : BLAST_HIT)[coverAt(s)];
        if (Math.random() >= odds) continue;
        unit.hp -= s === sq ? SHELL_DAMAGE : 1;
        if (unit.hp <= 0) this.fall(board, s, sq, 0);
      }
    }
  }

  /**
   * A new shell hole. Where it breaks into others, the blasts run together
   * into one bigger crater, opened out to take in all of them.
   */
  private blastCrater(fresh: Crater): void {
    let crater = fresh;
    let merged = true;
    while (merged) {
      merged = false;
      for (const other of this.craters) {
        const gap = Math.hypot(other.x - crater.x, other.y - crater.y);
        if (gap >= other.r + crater.r) continue;
        // The smallest circle around both, a touch wider for the churned edge
        const r = Math.min(
          MAX_CRATER,
          Math.max(crater.r, other.r, (gap + crater.r + other.r) / 2) * 1.05,
        );
        const t = gap > 0 ? (r - crater.r) / gap : 0;
        crater = {
          x: crater.x + (other.x - crater.x) * Math.min(1, Math.max(0, t)),
          y: crater.y + (other.y - crater.y) * Math.min(1, Math.max(0, t)),
          r,
          seed: other.seed ^ crater.seed,
        };
        this.craters = this.craters.filter((c) => c !== other);
        merged = true;
        break;
      }
    }
    this.craters.push(crater);
  }

  private relocate(board: Board, from: SquareIndex, to: SquareIndex): void {
    const unit = this.units.get(from)!;
    const piece = board.get(from)!;
    this.units.delete(from);
    board.remove(from);
    board.put(to, piece);
    this.units.set(to, unit);
  }

  private emit(event: NewEvent): void {
    const id = this.nextId++;
    this.events.push({ ...event, id } as BattleEvent);
    this.eventTimes.set(id, this.clock);
  }

  getSquareModifiers(_ctx: PluginContext, sq: SquareIndex) {
    const rank = rankOf(sq);
    const classes = ["trench-ground"];
    const side = (Object.keys(TRENCH_RANKS) as Color[]).find(
      (c) => TRENCH_RANKS[c].front === rank || TRENCH_RANKS[c].back === rank,
    );
    if (side)
      classes.push(`trench trench-${side === Color.White ? "white" : "black"}`);
    else if (NO_MANS_LAND.includes(rank)) {
      classes.push(`no-mans-land crater-${(sq * 7 + rank) % 4}`);
    } else classes.push("reserve-ground");
    if (this.wire.has(sq)) classes.push("wire");
    return [{ className: classes.join(" ") }];
  }

  getBoardOverlays(ctx: PluginContext): BoardOverlay[] {
    const battle: BattleView = {
      units: Object.fromEntries(this.units),
      events: [...this.events],
      arms: Object.fromEntries(
        [...this.units].map(([sq, unit]) => [
          unit.id,
          sq === GUN_NESTS[ctx.board.get(sq)?.color ?? Color.White] &&
          ctx.board.get(sq)?.type === PieceType.Pawn
            ? "mg"
            : "rifle",
        ]),
      ),
    };
    return [
      { type: "rally-battle", squares: [], data: battle },
      { type: "trenches", squares: [], data: this.view(ctx.board) },
    ];
  }

  /** The state of the front, for the board and for your orders */
  view(board: Board): TrenchView {
    const units = [...this.units];
    const charging = (color: Color) =>
      units.some(
        ([sq, u]) => u.order === "charge" && board.get(sq)?.color === color,
      );
    const manning = (color: Color) =>
      ALL_SQUARES.filter(
        (sq) =>
          rankOf(sq) === TRENCH_RANKS[color].front &&
          board.get(sq)?.color === color,
      ).length;
    return {
      wire: [...this.wire],
      craters: this.craters.map((c) => ({ ...c })),
      fallen: [...this.fallen],
      charging: units
        .filter(([, u]) => u.order === "charge")
        .map(([, u]) => u.id),
      snagged: units
        .filter(([, u]) => u.snaggedUntil > this.clock)
        .map(([, u]) => u.id),
      charges: { ...this.charges },
      canAttack: this.canAttack(board, Color.White),
      cooldownMs: this.cooldown(Color.White),
      advancing: {
        [Color.White]: charging(Color.White),
        [Color.Black]: charging(Color.Black),
      },
      manning: {
        [Color.White]: manning(Color.White),
        [Color.Black]: manning(Color.Black),
      },
    };
  }
}
