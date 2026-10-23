import { Color, MoveFlag, PieceType } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import { isSquareAttacked, opponent } from "../engine/moves";
import type {
  BoardOverlay,
  ModePlugin,
  PluginContext,
  SquareModifier,
} from "./types";
import type { PluginManager } from "./manager";
import { ALL_SQUARES, fileOf, rankOf, toIndex } from "../utils/squareUtils";
import { fortune, pickWeighted } from "../ai/luck";
import { PIECE_VALUE } from "../ai/chooseMove";
import { PortalChessPlugin } from "./portalChess";
import { MinefieldPlugin } from "./minefield";
import type { Strike } from "./thunderstorm";
import type { Collapse } from "./battleRoyale";

/** A callback to one of the modes of Story Mode, glitched into part of the board */
export type FinaleAct =
  | "portals"
  | "fog"
  | "mines"
  | "hill"
  | "storm"
  | "hex"
  | "gravity"
  | "stratego"
  | "clash"
  | "royale"
  | "zombies"
  | "lanterns"
  | "tug"
  | "conveyor"
  | "fifa";

/** What Chessbot throws at the player, a few modes at a time, as the deletion runs */
const STAGES: FinaleAct[][] = [
  ["portals", "fog"],
  ["mines", "hill", "storm"],
  ["hex", "gravity", "stratego"],
  ["clash", "royale"],
  ["zombies", "lanterns", "tug"],
  ["conveyor", "fifa", "storm"],
];

/** How long the deletion takes with no help from the player */
const DELETE_MS = 120_000;
/** How much of the deletion each point of a piece the player takes is worth */
const CAPTURE_SHARE = 0.012;

export interface Box {
  f0: number;
  f1: number;
  r0: number;
  r1: number;
}

export const inBox = (sq: SquareIndex, box: Box) =>
  fileOf(sq) >= box.f0 &&
  fileOf(sq) <= box.f1 &&
  rankOf(sq) >= box.r0 &&
  rankOf(sq) <= box.r1;

const squaresIn = (box: Box) => ALL_SQUARES.filter((sq) => inBox(sq, box));

/** A box `width` files by `height` ranks at a random spot, kept to ranks `low` to `high` */
function anywhere(width: number, height: number, low = 0, high = 7): Box {
  const f0 = Math.floor(Math.random() * (9 - width));
  const r0 = low + Math.floor(Math.random() * (high - low + 2 - height));
  return { f0, f1: f0 + width - 1, r0, r1: r0 + height - 1 };
}

/** One of the board's four corners, four squares across */
function corner(): Box {
  const f0 = Math.random() < 0.5 ? 0 : 4;
  const r0 = Math.random() < 0.5 ? 0 : 4;
  return { f0, f1: f0 + 3, r0, r1: r0 + 3 };
}

/** Where each mode lands on the board as it glitches in, somewhere new each time */
const ZONES: Partial<Record<FinaleAct, () => Box>> = {
  fog: () => anywhere(3, 3),
  lanterns: () => anywhere(3, 3),
  gravity: () => anywhere(3, 3, 1, 6),
  hex: corner,
  mines: () => anywhere(4, 2, 2, 5),
  clash: () => anywhere(4, 2, 2, 5),
  storm: () => anywhere(4, 3, 1, 6),
  tug: () => anywhere(4, 2, 2, 5),
  conveyor: () => anywhere(4, 1, 2, 5),
  // In front of the goal glitched onto the far edge
  fifa: () => ({ f0: 2, f1: 5, r0: 5, r1: 7 }),
};

/** The four middle squares, raised into a hill */
export const HILL: SquareIndex[] = [
  toIndex(3, 3),
  toIndex(4, 3),
  toIndex(3, 4),
  toIndex(4, 4),
];
/** How long after one mode of a stage glitches in the next one does */
const STAGGER_MS = 3500;

/** Hex directions as steps in axial coordinates, the board's odd ranks being the shifted rows */
const HEX_STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];
const HEX_DIAGONALS = [
  [2, -1],
  [-2, 1],
  [1, 1],
  [-1, -1],
  [1, -2],
  [-1, 2],
];
const HEX_KNIGHT = [
  [1, 2],
  [2, 1],
  [3, -1],
  [3, -2],
  [2, -3],
  [1, -3],
  [-1, -2],
  [-2, -1],
  [-3, 1],
  [-3, 2],
  [-2, 3],
  [-1, 3],
];

const toAxial = (sq: SquareIndex): [number, number] => {
  const r = rankOf(sq);
  return [fileOf(sq) - (r - (r & 1)) / 2, r];
};

const fromAxial = (q: number, r: number): SquareIndex | null => {
  if (r < 0 || r > 7) return null;
  const f = q + (r - (r & 1)) / 2;
  return f < 0 || f > 7 ? null : toIndex(f, r);
};

/**
 * The moves of a piece standing in the hex corner `hex`, as it would move on
 * a hex board. Sliding pieces stop on the first square past its edge.
 */
function hexMoves(
  board: Board,
  hex: Box,
  from: SquareIndex,
  piece: Piece,
): Move[] {
  const [q, r] = toAxial(from);
  const moves: Move[] = [];
  const add = (to: SquareIndex) => {
    const target = board.get(to);
    if (target?.color === piece.color) return false;
    const promotes =
      piece.type === PieceType.Pawn &&
      rankOf(to) === (piece.color === Color.White ? 7 : 0);
    moves.push({
      from,
      to,
      piece,
      captured: target ?? undefined,
      promotion: promotes ? PieceType.Queen : undefined,
      flags: MoveFlag.ModeMove | (target ? MoveFlag.Capture : 0),
    });
    return !target;
  };
  const slide = (dirs: number[][]) => {
    for (const [dq, dr] of dirs) {
      for (let k = 1; ; k++) {
        const to = fromAxial(q + dq * k, r + dr * k);
        if (to === null || !add(to) || !inBox(to, hex)) break;
      }
    }
  };
  const step = (dirs: number[][]) => {
    for (const [dq, dr] of dirs) {
      const to = fromAxial(q + dq, r + dr);
      if (to !== null) add(to);
    }
  };
  switch (piece.type) {
    case PieceType.Rook:
      slide(HEX_STEPS);
      break;
    case PieceType.Bishop:
      slide(HEX_DIAGONALS);
      break;
    case PieceType.Queen:
      slide([...HEX_STEPS, ...HEX_DIAGONALS]);
      break;
    case PieceType.King:
      step([...HEX_STEPS, ...HEX_DIAGONALS]);
      break;
    case PieceType.Knight:
      step(HEX_KNIGHT);
      break;
    case PieceType.Pawn: {
      // A pawn steps or takes on either of the two hexes ahead of it
      const ahead =
        piece.color === Color.White
          ? [
              [0, 1],
              [-1, 1],
            ]
          : [
              [0, -1],
              [1, -1],
            ];
      step(ahead);
      break;
    }
  }
  return moves.filter((move) => {
    const taken = board.remove(move.to);
    board.remove(from);
    board.put(move.to, piece);
    const king = board.findKing(piece.color);
    const safe =
      king === null || !isSquareAttacked(board, king, opponent(piece.color));
    board.remove(move.to);
    board.put(from, piece);
    if (taken) board.put(move.to, taken);
    return safe;
  });
}

/** A trooper of either side dropped in to brawl, standing on the board but no part of the game */
export interface Brawler {
  id: number;
  sq: SquareIndex;
  type: PieceType;
  color: Color;
  hp: number;
}

export interface BrawlHit {
  id: number;
  from: SquareIndex;
  to: SquareIndex;
  /** Whether the blow finished the one it hit */
  fatal: boolean;
}

export interface Zombie {
  id: number;
  sq: SquareIndex;
  risen: boolean;
}

export interface FinaleView {
  stage: number;
  /** Counts every mode that glitches in, so each one can be seen to */
  wave: number;
  /** The mode that glitched in last */
  arrived: FinaleAct | null;
  acts: FinaleAct[];
  zones: Partial<Record<FinaleAct, Box>>;
  progress: number;
  strikes: Strike[];
  brawlers: Brawler[];
  hits: BrawlHit[];
  collapse: Collapse | null;
  holes: SquareIndex[];
  zombies: Zombie[];
  ball: SquareIndex;
  /** Counts the shifts of gravity in its patch of the board, and the rope's heaves */
  tilts: number;
  heaves: number;
}

export const BRAWLER_HP = 5;
/** How many of Chessbot's pieces are face down at a time in the Stratego stage */
const HIDDEN = 3;
const BRAWL_TICK_MS = 850;
/** How long into the brawl the ground under it gives way, or after one side is wiped out, if that is sooner */
const COLLAPSE_AFTER_MS = 14_000;
const COLLAPSE_AFTER_WIN_MS = 2_000;
const STRIKE_GAP_MS: [number, number] = [2400, 4200];
/** The share of bolts that kill a piece */
const STRIKE_KILL_CHANCE = 0.3;
const ZOMBIE_RISE_MS = 1800;
const SHAMBLE_MS = 2400;
const BALL_MS = 1300;
const TILT_MS = 5200;
const HEAVE_MS = 3600;
const RECENT_STRIKES = 4;
const BRAWLER_TYPES = [
  PieceType.Pawn,
  PieceType.Knight,
  PieceType.Bishop,
  PieceType.Rook,
];

const between = ([low, high]: [number, number]) =>
  low + Math.random() * (high - low);

const near = (a: SquareIndex, b: SquareIndex, reach: number) =>
  Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b))) <=
  reach;

const around = (sq: SquareIndex) =>
  ALL_SQUARES.filter((s) => s !== sq && near(s, sq, 1));

let strikesEver = 0;

/**
 * The final battle. Chessbot, enraged and coming apart, throws every mode of
 * Story Mode at the player at once, a few at a time, each in a small part of
 * the board. Meanwhile Stephen deletes him: the deletion runs on its own,
 * faster for every piece the player takes, and when it is done so is he.
 */
export class FinalePlugin implements ModePlugin {
  id = "finale";
  name = "Final Battle";
  description = "Every mode at once.";

  private manager: PluginManager | null = null;
  private helpers: ModePlugin[] = [];
  private elapsed = 0;
  private stageMs = 0;
  private bonus = 0;
  private stage = -1;
  private wave = 0;
  /** The modes of this stage that have glitched in so far */
  private live: FinaleAct[] = [];
  private zones: Partial<Record<FinaleAct, Box>> = {};
  private strikes: Strike[] = [];
  private untilStrike = 1200;
  private brawlers: Brawler[] = [];
  private hits: BrawlHit[] = [];
  private nextId = 1;
  private untilBrawl = BRAWL_TICK_MS;
  private brawlWonAt: number | null = null;
  private collapse: Collapse | null = null;
  private holes: SquareIndex[] = [];
  private zombies: Zombie[] = [];
  private untilShamble = SHAMBLE_MS;
  private untilRise = ZOMBIE_RISE_MS;
  private hidden = new Set<SquareIndex>();
  private ball: SquareIndex = toIndex(4, 4);
  private untilBall = BALL_MS;
  private tilts = 0;
  private untilTilt = TILT_MS / 2;
  private heaves = 0;
  private untilHeave = HEAVE_MS / 2;

  /** The plugins of the modes it borrows whole, which have to sit with the others to be found */
  attach(manager: PluginManager): void {
    this.manager = manager;
  }

  get progress(): number {
    return Math.min(1, this.elapsed / DELETE_MS + this.bonus);
  }

  get acts(): FinaleAct[] {
    return this.live;
  }

  /** Whether `act` has glitched into the stage being played */
  private has(act: FinaleAct): boolean {
    return this.acts.includes(act);
  }

  onGameStart(): void {
    this.elapsed = 0;
    this.bonus = 0;
    this.stage = -1;
  }

  onAfterMove(ctx: PluginContext, move: Move): void {
    if (move.captured && move.piece.color === Color.White) {
      this.bonus += CAPTURE_SHARE * PIECE_VALUE[move.captured.type];
    }
    if (this.hidden.delete(move.from)) this.hidden.add(move.to);
    if (move.captured) this.hidden.delete(move.to);
    if (this.has("stratego")) this.hideSome(ctx.board);
  }

  /**
   * Runs the battle on by `ms`. A new stage waits for `settled`, so nothing
   * the last one started is cut off. Says whether a piece on the board was
   * killed, whether anything to be seen changed, and whether a new stage
   * began.
   */
  advance(
    ctx: PluginContext,
    ms: number,
    settled: boolean,
  ): { killed: boolean; struck: boolean; changed: boolean; restaged: boolean } {
    this.elapsed += ms;
    this.stageMs += ms;
    const before = this.look();
    const bolt = this.lastStrike();
    const due = Math.min(
      STAGES.length - 1,
      Math.floor(this.progress * STAGES.length),
    );
    const restaged = due !== this.stage && settled;
    if (restaged) this.enter(due);
    const next = STAGES[this.stage]?.[this.live.length];
    if (next && this.stageMs >= this.live.length * STAGGER_MS) {
      this.start(ctx, next);
    }

    let killed = false;
    if (this.has("storm")) killed = this.storm(ctx, ms);
    if (this.has("clash")) this.brawl(ctx.board, ms);
    if (this.has("zombies")) this.shamble(ctx.board, ms);
    if (this.has("fifa")) {
      this.untilBall -= ms;
      if (this.untilBall <= 0) {
        this.untilBall = BALL_MS;
        const pitch = squaresIn(this.zones.fifa!);
        this.ball = pitch[Math.floor(Math.random() * pitch.length)];
      }
    }
    if (this.has("gravity")) {
      this.untilTilt -= ms;
      if (this.untilTilt <= 0) {
        this.untilTilt = TILT_MS;
        this.tilts++;
      }
    }
    if (this.has("tug")) {
      this.untilHeave -= ms;
      if (this.untilHeave <= 0) {
        this.untilHeave = HEAVE_MS;
        this.heaves++;
      }
    }
    return {
      killed,
      struck: this.lastStrike() !== bolt,
      changed: this.look() !== before,
      restaged,
    };
  }

  lastStrike(): Strike | null {
    return this.strikes[this.strikes.length - 1] ?? null;
  }

  /** Everything about the battle that shows, to tell when the board needs drawing again */
  private look(): string {
    return JSON.stringify([
      this.wave,
      this.strikes.map((s) => s.id),
      this.brawlers.map((b) => [b.sq, b.hp]),
      this.hits.length && this.hits[this.hits.length - 1].id,
      this.collapse?.id,
      this.zombies.map((z) => [z.sq, z.risen]),
      this.ball,
      this.tilts,
      this.heaves,
      [...this.hidden],
    ]);
  }

  get done(): boolean {
    return this.progress >= 1;
  }

  /** Clears away the last stage, whose modes then glitch in one by one */
  private enter(stage: number): void {
    for (const helper of this.helpers) this.manager?.unregister(helper.id);
    this.helpers = [];
    this.stage = stage;
    this.stageMs = 0;
    this.live = [];
    this.zones = {};
    this.brawlers = [];
    this.brawlWonAt = null;
    this.collapse = null;
    this.holes = [];
    this.zombies = [];
    this.hidden.clear();
  }

  private start(ctx: PluginContext, act: FinaleAct): void {
    this.live = [...this.live, act];
    this.wave++;
    const zone = ZONES[act]?.();
    if (zone) this.zones = { ...this.zones, [act]: zone };
    if (act === "portals") this.borrow(ctx, new PortalChessPlugin(1));
    if (act === "mines") {
      this.borrow(ctx, new MinefieldPlugin(3, (sq) => inBox(sq, zone!)));
    }
    if (act === "stratego") this.hideSome(ctx.board);
    if (act === "clash") this.dropBrawlers(ctx.board, zone!);
    if (act === "zombies") this.digGraves(ctx.board);
  }

  /** Runs one of the modes' own plugins, ahead of this one, so this one has the last word on moves */
  private borrow(ctx: PluginContext, helper: ModePlugin): void {
    if (!this.manager) return;
    this.manager.unregister(this.id);
    this.manager.register(helper);
    this.manager.register(this);
    helper.onGameStart?.(ctx);
    helper.onIntroEnd?.(ctx);
    this.helpers.push(helper);
  }

  /** A few of Chessbot's pieces at a time are hidden, face down */
  private hideSome(board: Board): void {
    const his = ALL_SQUARES.filter((sq) => {
      const piece = board.get(sq);
      return (
        piece?.color === Color.Black &&
        piece.type !== PieceType.King &&
        !this.hidden.has(sq)
      );
    });
    while (this.hidden.size < HIDDEN && his.length > 0) {
      this.hidden.add(his.splice(Math.floor(Math.random() * his.length), 1)[0]);
    }
  }

  private storm(ctx: PluginContext, ms: number): boolean {
    this.untilStrike -= ms;
    if (this.untilStrike > 0) return false;
    this.untilStrike = between(STRIKE_GAP_MS);
    const board = ctx.board;
    const zone = this.zones.storm!;
    const victims = squaresIn(zone).filter((sq) => {
      const piece = board.get(sq);
      if (!piece || piece.type === PieceType.King) return false;
      // Nobody's king is left open to capture by a bolt
      const king = board.findKing(opponent(ctx.game.turn));
      if (king === null) return true;
      board.remove(sq);
      const exposed = isSquareAttacked(board, king, ctx.game.turn);
      board.put(sq, piece);
      return !exposed;
    });
    const victim =
      Math.random() < STRIKE_KILL_CHANCE
        ? pickWeighted(victims, (sq) => 1 / fortune(board.get(sq)!.color))
        : undefined;
    const open = squaresIn(zone).filter((sq) => !board.get(sq));
    const sq = victim ?? open[Math.floor(Math.random() * open.length)];
    if (sq === undefined) return false;
    const killed = victim === undefined ? null : board.remove(victim);
    this.strikes = [
      ...this.strikes,
      { id: ++strikesEver, sq, killed, shocked: [] },
    ].slice(-RECENT_STRIKES);
    if (killed) this.hidden.delete(sq);
    return killed !== null;
  }

  private dropBrawlers(board: Board, zone: Box): void {
    const open = squaresIn(zone).filter((sq) => !board.get(sq));
    for (let i = open.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [open[i], open[j]] = [open[j], open[i]];
    }
    // Each side's troops land on its own side of the zone
    const sides = [
      open.filter((sq) => rankOf(sq) === zone.r0).slice(0, 3),
      open.filter((sq) => rankOf(sq) === zone.r1).slice(0, 3),
    ];
    sides.forEach((squares, i) => {
      for (const sq of squares) {
        this.brawlers.push({
          id: this.nextId++,
          sq,
          type: BRAWLER_TYPES[Math.floor(Math.random() * BRAWLER_TYPES.length)],
          color: i === 0 ? Color.White : Color.Black,
          hp: BRAWLER_HP,
        });
      }
    });
  }

  private brawl(board: Board, ms: number): void {
    const won =
      this.brawlWonAt !== null &&
      this.stageMs - this.brawlWonAt >= COLLAPSE_AFTER_WIN_MS;
    if (this.collapse === null && (won || this.stageMs >= COLLAPSE_AFTER_MS)) {
      this.collapseZone(board);
      return;
    }
    if (this.collapse) return;
    this.untilBrawl -= ms;
    if (this.untilBrawl > 0) return;
    this.untilBrawl = BRAWL_TICK_MS;
    const order = [...this.brawlers].sort(() => Math.random() - 0.5);
    for (const brawler of order) {
      if (brawler.hp <= 0) continue;
      const foes = this.brawlers.filter(
        (b) => b.hp > 0 && b.color !== brawler.color,
      );
      if (foes.length === 0) break;
      const target = foes.find((f) => near(f.sq, brawler.sq, 1));
      if (target) {
        target.hp--;
        this.hits.push({
          id: this.nextId++,
          from: brawler.sq,
          to: target.sq,
          fatal: target.hp <= 0,
        });
        continue;
      }
      // Nobody in reach: a step toward the nearest of them
      const goal = foes[0].sq;
      const steps = around(brawler.sq).filter(
        (sq) =>
          inBox(sq, this.zones.clash!) &&
          !board.get(sq) &&
          !this.occupied().has(sq),
      );
      const dist = (sq: SquareIndex) =>
        Math.abs(fileOf(sq) - fileOf(goal)) +
        Math.abs(rankOf(sq) - rankOf(goal));
      const best = steps.sort((a, b) => dist(a) - dist(b))[0];
      if (best !== undefined && dist(best) < dist(brawler.sq)) {
        brawler.sq = best;
      }
    }
    this.brawlers = this.brawlers.filter((b) => b.hp > 0);
    this.hits = this.hits.slice(-12);
    const sides = new Set(this.brawlers.map((b) => b.color));
    if (sides.size < 2 && this.brawlWonAt === null) {
      this.brawlWonAt = this.stageMs;
    }
  }

  /** The ground under the brawl gives way, and whoever is still fighting goes with it */
  private collapseZone(board: Board): void {
    const squares = squaresIn(this.zones.clash!).filter((sq) => !board.get(sq));
    this.collapse = {
      id: this.nextId++,
      squares,
      fallen: this.brawlers.map((b) => ({
        sq: b.sq,
        piece: { type: b.type, color: b.color },
      })),
    };
    this.holes = squares;
    this.brawlers = [];
  }

  private digGraves(board: Board): void {
    this.untilRise = ZOMBIE_RISE_MS;
    const open = ALL_SQUARES.filter(
      (sq) => !board.get(sq) && rankOf(sq) >= 2 && rankOf(sq) <= 5,
    );
    for (let i = 0; i < 3 && open.length > 0; i++) {
      const sq = open.splice(Math.floor(Math.random() * open.length), 1)[0];
      this.zombies.push({ id: this.nextId++, sq, risen: false });
    }
  }

  private shamble(board: Board, ms: number): void {
    this.untilRise -= ms;
    if (this.untilRise <= 0) {
      for (const z of this.zombies) z.risen = true;
    }
    this.untilShamble -= ms;
    if (this.untilShamble > 0) return;
    this.untilShamble = SHAMBLE_MS;
    for (const zombie of this.zombies) {
      if (!zombie.risen) continue;
      const steps = around(zombie.sq).filter(
        (sq) => !board.get(sq) && !this.occupied().has(sq),
      );
      if (steps.length > 0) {
        zombie.sq = steps[Math.floor(Math.random() * steps.length)];
      }
    }
  }

  /** The squares the board's own pieces cannot go to: taken by brawlers or the undead, or fallen away */
  private occupied(): Set<SquareIndex> {
    return new Set([
      ...this.brawlers.map((b) => b.sq),
      ...this.zombies.map((z) => z.sq),
      ...this.holes,
    ]);
  }

  modifyLegalMoves(ctx: PluginContext, moves: Move[], color: Color): Move[] {
    const blocked = this.occupied();
    let result = moves.filter((m) => !blocked.has(m.to));
    const hex = this.zones.hex;
    if (!hex) return result;
    result = result.filter(
      (m) => !inBox(m.from, hex) || m.flags & MoveFlag.ModeMove,
    );
    for (const sq of squaresIn(hex)) {
      const piece = ctx.board.get(sq);
      if (piece?.color !== color) continue;
      result.push(
        ...hexMoves(ctx.board, hex, sq, piece).filter(
          (m) => !blocked.has(m.to),
        ),
      );
    }
    return result;
  }

  getSquareModifiers(_ctx: PluginContext, sq: SquareIndex): SquareModifier[] {
    const mods: SquareModifier[] = [];
    if (this.holes.includes(sq)) mods.push({ className: "dead-square" });
    const { hex, conveyor, gravity } = this.zones;
    if (hex && inBox(sq, hex)) {
      mods.push({
        className: `finale-hex${rankOf(sq) % 2 ? " finale-hex-shift" : ""}`,
      });
    }
    if (conveyor && inBox(sq, conveyor)) {
      mods.push({ className: "finale-belt" });
    }
    if (gravity && inBox(sq, gravity)) {
      mods.push({ className: "finale-gravity" });
    }
    return mods;
  }

  getBoardOverlays(): BoardOverlay[] {
    const view: FinaleView = {
      stage: this.stage,
      wave: this.wave,
      arrived: this.live[this.live.length - 1] ?? null,
      acts: this.acts,
      zones: this.zones,
      progress: this.progress,
      strikes: this.strikes,
      brawlers: this.brawlers,
      hits: this.hits,
      collapse: this.collapse,
      holes: this.holes,
      zombies: this.zombies,
      ball: this.ball,
      tilts: this.tilts,
      heaves: this.heaves,
    };
    const overlays: BoardOverlay[] = [
      { type: "finale", squares: [], data: view },
    ];
    if (this.has("hill")) {
      overlays.push({
        type: "king-of-hill",
        squares: HILL,
        data: { whiteDomination: 0, blackDomination: 0, dominationNeeded: 3 },
      });
    }
    if (this.hidden.size > 0) {
      overlays.push({ type: "stratego-hidden", squares: [...this.hidden] });
    }
    return overlays;
  }
}
