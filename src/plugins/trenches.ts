import { Color, PieceType } from "../engine/types";
import type { Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import { opponent } from "../engine/moves";
import type { ModePlugin, PluginContext, BoardOverlay } from "./types";
import type { Arms, BattleEvent, BattleView, Unit } from "./clashRoyale";
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
export type SquadId = "rifles" | "guns" | "sniper" | "assault";

/** A squad that can be sent up to the line, and how long after the last one went it takes to ready */
export interface Squad {
  id: SquadId;
  name: string;
  men: PieceType[];
  readyMs: number;
}

/** The squads either side can send up; sending any one starts every card readying again */
export const SQUADS: Squad[] = [
  {
    id: "rifles",
    name: "Rifle squad",
    men: [PieceType.Pawn, PieceType.Pawn, PieceType.Pawn, PieceType.Pawn],
    readyMs: 9000,
  },
  {
    id: "guns",
    name: "Machine gun team",
    men: [PieceType.Rook, PieceType.Pawn, PieceType.Pawn],
    readyMs: 16000,
  },
  { id: "sniper", name: "Sniper", men: [PieceType.Bishop], readyMs: 11000 },
  {
    id: "assault",
    name: "Assault team",
    men: [PieceType.Knight, PieceType.Knight],
    readyMs: 12000,
  },
];

/** How often the enemy looks to move men up from its back trench */
const FOE_MOVE_UP_MS: [number, number] = [9000, 16000];
/** How often, on each tick a card is ready, the enemy sends one up */
const FOE_SEND_CHANCE = 0.015;

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
/** With every enemy down in a trench, a man only fires this often when his turn comes */
const IDLE_FIRE = 0.3;
/** How long a rifleman takes to bring his rifle up onto the target before firing */
export const AIM_MS = 130;
/** How long a man takes to come up over the parapet before he fires, and how long he stays up */
export const RISE_MS = 260;
const PEEK_MS = 1500;
/** Now and then a man puts his head up just to look, for a moment */
const LOOK_CHANCE = 0.3;
const LOOK_MS = 900;
/** A sniper takes his time, and when he fires at a man who shows himself, he rarely misses */
const SNIPE_MS = 3400;
const SNIPER_HIT = { trench: 0.55, reserve: 0.6, open: 0.8 };
const SNIPER_DAMAGE = 2;
/** How far a grenade can be thrown, in squares, how long between throws, and what its blast does */
const GRENADE_RANGE = 2.4;
const GRENADE_MS = 5200;
const GRENADE_HIT = 0.75;
const GRENADE_DAMAGE = 2;
const SHRAPNEL_HIT = 0.35;
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
/** A shell that lands on the wire sometimes blows a gap in it */
const WIRE_CUT_CHANCE = 0.35;
/** Events stay visible to the board for this long */
/** Events stay visible this long, enough for a shell to fall, burst, and its smoke to clear */
const EVENT_LIFE_MS = 6000;
const QUIET_START_MS: [number, number] = [1800, 3600];

type Cover = "trench" | "reserve" | "open";

export interface TrenchUnit extends Unit {
  /** Holding a trench, or charging for the next one across no man's land */
  order: "hold" | "charge";
  /** The rank a charging man is making for */
  goal: number;
  /** Caught on the wire until the clock passes this */
  snaggedUntil: number;
  /** Up and looking over the parapet until the clock passes this; crouched below it otherwise */
  exposedUntil: number;
  /** When a grenadier has his next grenade ready */
  grenadeAt: number;
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
  /** How long until each of your squads is ready to send up */
  cards: { id: SquadId; readyInMs: number }[];
  /** Your trench lines with men in them who can be ordered forward, and whether forward is into the enemy or up to your own line */
  lines: { rank: number; kind: "attack" | "advance"; men: number }[];
  /** Your men who can be sent forward on their own, by square */
  movable: SquareIndex[];
  /** Men up looking over the parapet, the rest of those in the trenches crouched below it */
  exposed: number[];
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

/**
 * What a soldier carries, by what he is: bishops are snipers, knights assault
 * troops with grenades, and the rest riflemen. Whoever stands in a gun nest,
 * whatever he is, mans the machine gun fixed there.
 */
function armsFor(sq: SquareIndex, piece: Piece, nests: Set<SquareIndex>): Arms {
  if (nests.has(sq)) return "mg";
  switch (piece.type) {
    case PieceType.King:
      return "general";
    case PieceType.Rook:
      return "vickers";
    case PieceType.Bishop:
      return "sniper";
    case PieceType.Knight:
      return "grenadier";
    default:
      return "rifle";
  }
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
  /** Where machine guns are dug in; whoever stands in one mans it */
  private nests = new Set<SquareIndex>();
  private foeMoveUpAt = 0;
  /** When each side last sent a squad up; every card readies again from then */
  private sentAt: Record<Color, number> = {
    [Color.White]: 0,
    [Color.Black]: 0,
  };
  private incoming: {
    sq: SquareIndex;
    at: number;
    spot: { x: number; y: number };
  }[] = [];
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
    this.nests = new Set();
    this.sentAt = { [Color.White]: 0, [Color.Black]: 0 };
    this.foeMoveUpAt = rand(...FOE_MOVE_UP_MS);
    this.craters = [];
    this.pockMark();
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
   * Each army files into its trenches: pawns into the front line, and
   * everyone else into the back line, the king in the middle of it
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
      exposedUntil: 0,
      grenadeAt: 0,
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

    this.foeSends(board);
    this.foeReinforces(board);

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
            !this.nests.has(sq),
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
      if (this.nests.has(sq) || unit.order !== "hold") continue;
      // The general directs the war from the rear; he never goes over the top
      if (board.get(sq)?.type === PieceType.King) continue;
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

  /** A machine gunner who settles in a trench he can fire from digs his gun in there, for good */
  private digGun(board: Board, sq: SquareIndex, piece: Piece): void {
    if (
      piece.type === PieceType.Rook &&
      coverAt(sq) === "trench" &&
      this.canFire(board, sq, piece.color)
    ) {
      this.nests.add(sq);
    }
  }

  /**
   * Whether a man may fire from where he is. Anyone caught out of a trench
   * fights where he stands. In the trenches the line nearest the enemy
   * fires: a side's front trench, or its back trench once the front has
   * fallen or emptied, and any enemy trench it has taken.
   */
  private canFire(board: Board, sq: SquareIndex, color: Color): boolean {
    if (coverAt(sq) !== "trench") return true;
    const { front, back } = TRENCH_RANKS[color];
    const rank = rankOf(sq);
    if (rank !== back) return true;
    const frontLine = ALL_SQUARES.filter((s) => rankOf(s) === front);
    const lost = frontLine.some((s) => board.get(s)?.color === opponent(color));
    const empty = !frontLine.some((s) => board.get(s)?.color === color);
    return lost || empty;
  }

  /**
   * A summary of everything the board and your orders show, which changes
   * whenever any of it does: every event, arrival, and death bumps the id
   * count, men come up or duck down, charge or snag, and the cards' seconds
   * tick down
   */
  signature(): string {
    let exposed = 0;
    let charging = 0;
    let snagged = 0;
    for (const [sq, u] of this.units) {
      if (u.exposedUntil > this.clock) exposed += sq + 1;
      if (u.order === "charge") charging += sq + 1;
      if (u.snaggedUntil > this.clock) snagged += sq + 1;
    }
    const cards = SQUADS.map((s) =>
      Math.ceil(this.readyIn(Color.White, s) / 1000),
    ).join();
    return `${this.nextId}|${this.events.length}|${exposed}|${charging}|${snagged}|${cards}|${this.nests.size}`;
  }

  /** How long until a side's squad is ready to go */
  readyIn(color: Color, squad: Squad): number {
    return Math.max(0, this.sentAt[color] + squad.readyMs - this.clock);
  }

  /** The ranks a side can send men up to: its own trenches and the ground between them */
  private ownGround(color: Color): number[] {
    return color === Color.White ? [0, 1, 2] : [5, 6, 7];
  }

  /**
   * Sends a squad up the line: the men file in from the rear to free spots
   * in the side's back trench, then the ground in front of it if that is
   * full. Every card then starts readying again.
   */
  sendSquad(board: Board, color: Color, id: SquadId): boolean {
    const squad = SQUADS.find((s) => s.id === id);
    if (!squad || this.winner !== null || this.readyIn(color, squad) > 0) {
      return false;
    }
    const { back } = TRENCH_RANKS[color];
    const ground = this.ownGround(color);
    const free = (rank: number) =>
      ALL_SQUARES.filter((s) => rankOf(s) === rank && !board.get(s)).sort(
        () => Math.random() - 0.5,
      );
    const order = [...ground].sort(
      (a, b) => Math.abs(a - back) - Math.abs(b - back),
    );
    const spots = order.flatMap(free);
    if (spots.length < squad.men.length) return false;
    const rearRank = color === Color.White ? -1 : 8;
    squad.men.forEach((type, i) => {
      const to = spots[i];
      board.put(to, { type, color });
      const unit = this.recruit(type);
      this.units.set(to, unit);
      // Up the communication trench from behind the lines
      const from = rearRank * 16 + fileOf(to);
      const ms = Math.round(travelMs(from, to) * 1.6);
      const delayMs = i * 260;
      this.emit({ kind: "move", unitId: unit.id, from, to, ms, delayMs });
      unit.readyIn = delayMs + ms + rand(300, 900);
    });
    this.sentAt[color] = this.clock;
    return true;
  }

  /** The enemy sends up one of its ready squads now and then */
  private foeSends(board: Board): void {
    const ready = SQUADS.filter((s) => this.readyIn(Color.Black, s) === 0);
    if (ready.length === 0 || Math.random() > FOE_SEND_CHANCE) return;
    this.sendSquad(
      board,
      Color.Black,
      ready[Math.floor(Math.random() * ready.length)].id,
    );
  }

  /** The enemy moves men up from its back trench when its front line thins */
  private foeReinforces(board: Board): void {
    if (this.clock < this.foeMoveUpAt) return;
    this.foeMoveUpAt = this.clock + rand(...FOE_MOVE_UP_MS);
    const { front, back } = TRENCH_RANKS[Color.Black];
    const gaps = ALL_SQUARES.filter(
      (s) => rankOf(s) === front && !board.get(s),
    ).length;
    if (gaps >= 2) this.advanceLine(board, Color.Black, back);
  }

  /** Every trench line, in order from a side's own rear toward the enemy's */
  private trenchRanks(color: Color): number[] {
    const ranks = [
      TRENCH_RANKS[Color.White].back,
      TRENCH_RANKS[Color.White].front,
      TRENCH_RANKS[Color.Black].front,
      TRENCH_RANKS[Color.Black].back,
    ];
    return color === Color.White ? ranks : ranks.reverse();
  }

  /**
   * The men of a side holding a trench line who could be ordered out of it,
   * by square. A machine gunner packs up his own gun and goes with them;
   * anyone else on a gun stays on it.
   */
  private holding(
    board: Board,
    color: Color,
    rank: number,
  ): [SquareIndex, TrenchUnit][] {
    return [...this.units].filter(([sq, unit]) => {
      const piece = board.get(sq);
      return (
        rankOf(sq) === rank &&
        piece?.color === color &&
        piece.type !== PieceType.King &&
        (!this.nests.has(sq) || piece.type === PieceType.Rook) &&
        unit.order === "hold"
      );
    });
  }

  /** The trench lines a side holds men in that it can send forward, to the next line ahead */
  orderLines(board: Board, color: Color): TrenchView["lines"] {
    const ranks = this.trenchRanks(color);
    const theirs = [
      TRENCH_RANKS[opponent(color)].front,
      TRENCH_RANKS[opponent(color)].back,
    ];
    return ranks.slice(0, -1).flatMap((rank, i) => {
      const men = this.holding(board, color, rank).length;
      if (men === 0) return [];
      const kind: "attack" | "advance" = theirs.includes(ranks[i + 1])
        ? "attack"
        : "advance";
      return [{ rank, kind, men }];
    });
  }

  /**
   * Everyone holding one trench line goes forward for the next one ahead.
   * Where they find it full they are left out in the open.
   */
  advanceLine(board: Board, color: Color, rank: number): boolean {
    if (this.winner !== null) return false;
    const ranks = this.trenchRanks(color);
    const next = ranks[ranks.indexOf(rank) + 1];
    if (next === undefined) return false;
    const men = this.holding(board, color, rank);
    for (const [sq, unit] of men) {
      if (board.get(sq)?.type === PieceType.Rook) this.nests.delete(sq);
      unit.order = "charge";
      unit.goal = next;
      unit.readyIn = rand(0, 450);
    }
    if (men.length === 0) return false;
    this.charges[color]++;
    return true;
  }

  /** The next trench line ahead of a rank, toward the enemy, if there is one */
  private trenchAhead(color: Color, rank: number): number | undefined {
    const ahead = (r: number) => (color === Color.White ? r > rank : r < rank);
    return this.trenchRanks(color).find(ahead);
  }

  /** One man holding a trench line goes forward on his own for the next one ahead */
  advanceMan(board: Board, color: Color, sq: SquareIndex): boolean {
    if (this.winner !== null) return false;
    const next = this.trenchAhead(color, rankOf(sq));
    const man = this.holding(board, color, rankOf(sq)).find(
      ([at]) => at === sq,
    );
    if (next === undefined || !man) return false;
    const [, unit] = man;
    if (board.get(sq)?.type === PieceType.Rook) this.nests.delete(sq);
    unit.order = "charge";
    unit.goal = next;
    unit.readyIn = 0;
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
      // A trench ahead full of his own side is no place to stop: he goes on through it
      if (
        rankOf(sq) !== unit.goal &&
        this.fullOfFriends(board, unit.goal, piece.color)
      ) {
        unit.goal = this.trenchAhead(piece.color, unit.goal) ?? unit.goal;
      }
      if (rankOf(sq) === unit.goal) {
        unit.order = "hold";
        this.digGun(board, sq, piece);
      } else if (this.advance(board, sq, unit, piece)) {
        return;
      } else if (
        coverAt(sq) !== "trench" &&
        this.edgeToward(board, sq, unit, unit.goal, 0.9)
      ) {
        // Blocked straight ahead, out of cover: along the ground to a free spot in the line
        return;
      } else if (this.lobGrenade(board, sq, piece, unit)) {
        return;
      } else if (Math.random() < 0.5) {
        // Stuck short of the line, a machine gunner opens up from the ground
        if (piece.type === PieceType.Rook && this.burst(board, sq, piece)) {
          unit.readyIn = jitter(BURST_MS * 1.4);
          return;
        }
        this.fire(board, sq, piece, true);
        unit.readyIn = jitter(RIFLE_MS * 1.6);
        return;
      } else {
        unit.readyIn = rand(300, 700);
        return;
      }
    }

    // A machine gunner holding a firing trench digs his gun in where he stands
    this.digGun(board, sq, piece);
    if (this.fightInTrench(board, sq, unit, piece)) return;
    if (this.moveUp(board, sq, unit, piece)) return;

    // Only the line nearest the enemy fires; the back trench keeps its head down
    if (!this.canFire(board, sq, piece.color)) {
      unit.readyIn = rand(800, 1600);
      return;
    }
    // With nobody showing above the parapets, the line mostly holds its fire,
    // a man now and then putting his head up for a look
    if (!this.anyoneExposed(board, piece.color) && Math.random() > IDLE_FIRE) {
      if (Math.random() < LOOK_CHANCE) this.raise(unit, LOOK_MS);
      unit.readyIn = jitter(RIFLE_MS);
      return;
    }

    // To fire he has to come up over the parapet, and while up he can be hit
    this.raise(unit, PEEK_MS);
    switch (armsFor(sq, piece, this.nests)) {
      case "mg":
        if (this.burst(board, sq, piece)) {
          // With men out in the open in front of him, he never lets up: one
          // burst runs straight into the next
          unit.readyIn = this.enemyInTheOpen(board, piece.color)
            ? BURST_ROUNDS * ROUND_GAP_MS + rand(40, 120)
            : jitter(BURST_MS);
          return;
        }
        break;
      case "sniper":
        if (this.snipe(board, sq, piece)) {
          unit.readyIn = jitter(SNIPE_MS);
          return;
        }
        break;
      case "grenadier":
        if (this.lobGrenade(board, sq, piece, unit)) return;
        break;
      case "general":
        // The general does not fight; he watches through his field glasses
        unit.readyIn = jitter(RIFLE_MS);
        return;
      case "vickers":
        // Caught in the open, he throws himself down and fires the gun off the
        // ground where he is; in a trench he digs it in properly first
        if (coverAt(sq) !== "trench" && this.burst(board, sq, piece)) {
          unit.readyIn = jitter(BURST_MS * 1.4);
          return;
        }
        unit.readyIn = jitter(RIFLE_MS * 0.5);
        return;
    }
    this.fire(board, sq, piece, false);
    unit.readyIn = jitter(RIFLE_MS);
  }

  /**
   * A sniper watches for anyone who shows himself, over a parapet or in the
   * open, and picks him off; returns false if nobody is showing
   */
  private snipe(board: Board, sq: SquareIndex, piece: Piece): boolean {
    const showing = ALL_SQUARES.filter(
      (s) => board.get(s)?.color === opponent(piece.color) && !this.crouched(s),
    );
    if (showing.length === 0) return false;
    const target = showing.reduce((a, b) =>
      distance(sq, a) <= distance(sq, b) ? a : b,
    );
    this.shoot(
      board,
      sq,
      target,
      piece,
      "sniper",
      this.hitChance(sq, target, SNIPER_HIT),
      RISE_MS + AIM_MS * 2,
      0,
      SNIPER_DAMAGE,
    );
    return true;
  }

  /**
   * A grenadier lobs a bomb at the enemy nearest him, if one is within
   * throwing range, over any parapet and into the trench behind it; returns
   * false if he has none ready or nobody is close enough
   */
  private lobGrenade(
    board: Board,
    sq: SquareIndex,
    piece: Piece,
    unit: TrenchUnit,
  ): boolean {
    if (piece.type !== PieceType.Knight || unit.grenadeAt > this.clock) {
      return false;
    }
    const near = ALL_SQUARES.filter(
      (s) =>
        board.get(s)?.color === opponent(piece.color) &&
        distance(sq, s) <= GRENADE_RANGE,
    );
    if (near.length === 0) return false;
    const target = near[Math.floor(Math.random() * near.length)];
    const flightMs = Math.round(650 + 140 * distance(sq, target));
    const delayMs = RISE_MS;
    const bursts = delayMs + flightMs;
    this.raise(unit, PEEK_MS);
    this.emit({
      kind: "grenade",
      unitId: unit.id,
      color: piece.color,
      from: sq,
      to: target,
      flightMs,
      delayMs,
    });
    // The blast catches whoever is in the trench it lands in, crouched or not
    const around = [0, -17, -16, -15, -1, 1, 15, 16, 17]
      .map((d) => target + d)
      .filter(
        (s) => isValidSquare(s) && Math.abs(fileOf(s) - fileOf(target)) <= 1,
      );
    for (const s of around) {
      const victim = this.units.get(s);
      if (!victim || !board.get(s)) continue;
      const direct = s === target;
      if (Math.random() >= (direct ? GRENADE_HIT : SHRAPNEL_HIT)) continue;
      const damage = direct ? GRENADE_DAMAGE : 1;
      victim.hp -= damage;
      const kill = victim.hp <= 0;
      this.emit({
        kind: "attack",
        unitId: unit.id,
        targetId: victim.id,
        color: piece.color,
        from: target,
        to: s,
        damage,
        ranged: true,
        kill,
        hitMs: bursts,
        weapon: "shrapnel",
      });
      if (kill) this.fall(board, s, target, bursts);
    }
    unit.grenadeAt = this.clock + jitter(GRENADE_MS);
    unit.readyIn = bursts + jitter(RIFLE_MS * 0.6);
    return true;
  }

  /** Whether any of the enemy are out of their trenches, crossing no man's land */
  private enemyInTheOpen(board: Board, color: Color): boolean {
    return ALL_SQUARES.some(
      (s) => board.get(s)?.color === opponent(color) && coverAt(s) === "open",
    );
  }

  /** Brings a man up to look over the parapet, for a while, if he is not already up for longer */
  private raise(unit: TrenchUnit, ms: number): void {
    unit.exposedUntil = Math.max(unit.exposedUntil, this.clock + ms);
  }

  /** Whether a man is down in a trench, crouched where no bullet can reach him */
  private crouched(sq: SquareIndex): boolean {
    const unit = this.units.get(sq);
    return (
      coverAt(sq) === "trench" &&
      unit !== undefined &&
      unit.order === "hold" &&
      unit.exposedUntil <= this.clock
    );
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
    const to = options[0]?.to ?? this.through(board, sq, unit, piece);
    if (to === undefined) return false;
    const leap = Math.abs(rankOf(to) - rankOf(sq)) > 1;
    const ms = Math.round(STEP_MS * rand(0.85, 1.2) * (leap ? 1.8 : 1));
    this.relocate(board, sq, to);
    this.emit({ kind: "move", unitId: unit.id, from: sq, to, ms, delayMs: 0 });
    unit.readyIn = ms;
    if (this.wire.has(to)) {
      unit.snaggedUntil = this.clock + ms + rand(...WIRE_MS);
      unit.readyIn = unit.snaggedUntil - this.clock;
    }
    return true;
  }

  /** Whether every square on a rank is held by a side's own men */
  private fullOfFriends(board: Board, rank: number, color: Color): boolean {
    return ALL_SQUARES.filter((s) => rankOf(s) === rank).every(
      (s) => board.get(s)?.color === color,
    );
  }

  /**
   * Where a man blocked by his own side's trench, short of the trench he is
   * making for, lands after dropping into it and climbing out the far side
   */
  private through(
    board: Board,
    sq: SquareIndex,
    unit: TrenchUnit,
    piece: Piece,
  ): SquareIndex | undefined {
    const step = forward(piece.color);
    const trench = rankOf(sq + step);
    if (
      trench === unit.goal ||
      !this.trenchRanks(piece.color).includes(trench) ||
      !this.fullOfFriends(board, trench, piece.color)
    ) {
      return undefined;
    }
    return [0, -1, 1]
      .map((d) => sq + step * 2 + d)
      .find(
        (to) =>
          isValidSquare(to) &&
          Math.abs(fileOf(to) - fileOf(sq)) <= 1 &&
          !board.get(to),
      );
  }

  /**
   * Men out of a trench make for a gap in their own front line: from the
   * back trench now and then, from the ground behind the line, and anyone
   * left stranded in no man's land, edging sideways along the ground to
   * reach it
   */
  private moveUp(
    board: Board,
    sq: SquareIndex,
    unit: TrenchUnit,
    piece: Piece,
  ): boolean {
    if (piece.type === PieceType.King) return false;
    const { front } = TRENCH_RANKS[piece.color];
    const stranded = coverAt(sq) === "open" && unit.order === "hold";
    const behind = coverAt(sq) === "reserve";
    // Nobody leaves a trench unless ordered; only men caught out of one move by themselves
    if (!behind && !stranded) return false;
    return this.edgeToward(board, sq, unit, front, stranded ? 0.9 : 1.2);
  }

  /**
   * A step toward the nearest free square on a rank: forward when he can,
   * sideways along the ground when the way ahead is blocked. False if
   * every square on the rank is taken or nothing brings him closer.
   */
  private edgeToward(
    board: Board,
    sq: SquareIndex,
    unit: TrenchUnit,
    rank: number,
    pace: number,
  ): boolean {
    const gaps = ALL_SQUARES.filter((s) => rankOf(s) === rank && !board.get(s));
    if (gaps.length === 0) return false;
    const reach = (a: SquareIndex, b: SquareIndex) =>
      Math.max(
        Math.abs(fileOf(a) - fileOf(b)),
        Math.abs(rankOf(a) - rankOf(b)),
      );
    const goal = gaps.reduce((a, b) =>
      reach(sq, a) + Math.random() * 0.5 <= reach(sq, b) ? a : b,
    );
    // The neighbouring square that brings him closest, sideways if that is all there is
    const to = [-17, -16, -15, -1, 1, 15, 16, 17]
      .map((d) => sq + d)
      .filter(
        (s) =>
          isValidSquare(s) &&
          Math.abs(fileOf(s) - fileOf(sq)) <= 1 &&
          !board.get(s) &&
          reach(s, goal) < reach(sq, goal),
      )
      .sort(
        (a, b) =>
          reach(a, goal) - reach(b, goal) ||
          Math.abs(rankOf(a) - rank) - Math.abs(rankOf(b) - rank),
      )[0];
    if (to === undefined) return false;
    const ms = Math.round(STEP_MS * pace);
    this.relocate(board, sq, to);
    this.digGun(board, to, board.get(to)!);
    this.emit({ kind: "move", unitId: unit.id, from: sq, to, ms, delayMs: 0 });
    unit.readyIn = ms + (pace < 1 ? rand(50, 200) : rand(300, 900));
    if (this.wire.has(to)) {
      unit.snaggedUntil = this.clock + ms + rand(...WIRE_MS);
      unit.readyIn = unit.snaggedUntil - this.clock;
    }
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
    // A crouched man offers nothing to aim at; he draws only the odd hopeful shot
    const weighted = foes.map((s) => ({
      s,
      w:
        (weights[coverAt(s)] * (this.crouched(s) ? 0.1 : 1)) /
        (1 + distance(sq, s) * 0.15),
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
    this.shoot(board, sq, target, piece, "rifle", chance, RISE_MS + AIM_MS, 0);
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
        RISE_MS + round * ROUND_GAP_MS,
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
    const enfilade = rankOf(from) === rankOf(target);
    // A man crouched below the parapet cannot be hit, unless he is fired on down the trench
    if (!enfilade && this.crouched(target)) return 0;
    const cover = enfilade ? "open" : coverAt(target);
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
    const gunner = this.nests.has(sq);
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
    weapon: "rifle" | "mg" | "sniper",
    chance: number,
    delayMs: number,
    round: number,
    damage = 1,
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
    if (hit) target.hp -= damage;
    const kill = hit && target.hp <= 0;
    this.emit({
      kind: "attack",
      unitId: shooter.id,
      targetId: target.id,
      color: piece.color,
      from,
      to,
      damage: hit ? damage : 0,
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
      // It bursts somewhere in the square, not dead on its middle
      const spot = { x: rand(0.1, 0.9), y: rand(0.1, 0.9) };
      this.incoming.push({
        sq,
        at: this.clock + delayMs + SHELL_FALL_MS,
        spot,
      });
      this.emit({ kind: "shell", sq, at: spot, delayMs });
    }
  }

  /** Shells that have come down blast whoever is under them and churn the ground */
  private landShells(board: Board): void {
    const landed = this.incoming.filter((s) => s.at <= this.clock);
    if (landed.length === 0) return;
    this.incoming = this.incoming.filter((s) => s.at > this.clock);
    for (const { sq } of landed) {
      if (NO_MANS_LAND.includes(rankOf(sq))) {
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
   * No man's land as the fighting finds it, already shelled to ruin: a few
   * big craters and a scatter of small ones, and they stay as they are
   */
  private pockMark(): void {
    const big = 2 + Math.floor(Math.random() * 2);
    const small = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < big + small; i++) {
      const r = i < big ? rand(0.6, 0.85) : rand(0.28, 0.42);
      // Each in ground of its own, clear of the others
      for (let tries = 0; tries < 30; tries++) {
        const hole = {
          x: rand(r, 8 - r),
          y: rand(NO_MANS_LAND[0] + 0.15, NO_MANS_LAND[1] + 0.85),
          r,
          seed: Math.floor(Math.random() * 1e9),
        };
        const clear = this.craters.every(
          (c) => Math.hypot(c.x - hole.x, c.y - hole.y) > c.r + hole.r + 0.05,
        );
        if (clear) {
          this.craters.push(hole);
          break;
        }
      }
    }
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
        [...this.units].flatMap(([sq, unit]) => {
          const piece = ctx.board.get(sq);
          return piece ? [[unit.id, armsFor(sq, piece, this.nests)]] : [];
        }),
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
      exposed: units
        .filter(([, u]) => u.exposedUntil > this.clock)
        .map(([, u]) => u.id),
      charges: { ...this.charges },
      lines: this.orderLines(board, Color.White),
      movable: this.trenchRanks(Color.White)
        .filter((rank) => this.trenchAhead(Color.White, rank) !== undefined)
        .flatMap((rank) => this.holding(board, Color.White, rank))
        .map(([sq]) => sq),
      cards: SQUADS.map((squad) => ({
        id: squad.id,
        readyInMs: this.readyIn(Color.White, squad),
      })),
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
