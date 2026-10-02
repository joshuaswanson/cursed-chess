import { Color, PieceType, opponent } from "../engine";
import type { Board, Piece, SquareIndex } from "../engine";
import type { ModePlugin, PluginContext, BoardOverlay } from "./types";
import { ALL_SQUARES, fileOf, rankOf, toIndex } from "../utils/squareUtils";

/** Hits a wall square takes: the first cracks it, the second brings it down */
const WALL_HP = 2;
/** The attackers' catapults fire on their own every this many rounds */
const VOLLEY_EVERY_ROUNDS = 2;
const PIECE_VALUE: Record<PieceType, number> = {
  [PieceType.Pawn]: 1,
  [PieceType.Knight]: 3,
  [PieceType.Bishop]: 3,
  [PieceType.Rook]: 5,
  [PieceType.Queen]: 9,
  [PieceType.King]: 0,
};
/** Which pieces sit closest to the king inside the castle */
const KEEP_ORDER: PieceType[] = [
  PieceType.Queen,
  PieceType.Rook,
  PieceType.Bishop,
  PieceType.Knight,
  PieceType.Pawn,
];
const KNIGHT_STEPS = [-33, -31, -18, -14, 14, 18, 31, 33];
const KING_STEPS = [-17, -16, -15, -1, 1, 15, 16, 17];
const ROOK_DIRS = [-16, -1, 1, 16];
const BISHOP_DIRS = [-17, -15, 15, 17];

/** 0 for the four center squares, 1 for the courtyard ring, 2 for the walls, 3 for the open field */
function ringOf(sq: SquareIndex): number {
  return Math.round(
    Math.max(Math.abs(fileOf(sq) - 3.5), Math.abs(rankOf(sq) - 3.5)) - 0.5,
  );
}

export const GATES: SquareIndex[] = [toIndex(3, 1), toIndex(4, 6)];
export const TOWERS: SquareIndex[] = [
  toIndex(1, 1),
  toIndex(6, 1),
  toIndex(1, 6),
  toIndex(6, 6),
];
const WALL_SQUARES = ALL_SQUARES.filter(
  (sq) => ringOf(sq) === 2 && !GATES.includes(sq),
);
export const COURTYARD = ALL_SQUARES.filter((sq) => ringOf(sq) <= 1);
/** The open field around the castle, in order around the board */
const FIELD = (() => {
  const ring: SquareIndex[] = [];
  for (let f = 0; f < 8; f++) ring.push(toIndex(f, 0));
  for (let r = 1; r < 8; r++) ring.push(toIndex(7, r));
  for (let f = 6; f >= 0; f--) ring.push(toIndex(f, 7));
  for (let r = 6; r >= 1; r--) ring.push(toIndex(0, r));
  return ring;
})();

export interface Strike {
  id: number;
  target: SquareIndex;
  /** Hit points left on the wall after the strike, 0 when it falls */
  hpAfter: number;
}

export interface Ram extends Strike {
  from: SquareIndex;
}

export interface SiegeView {
  defender: Color;
  /** Hit points of every wall square that has not fallen */
  walls: Record<number, number>;
  /** Wall squares that have been knocked down */
  rubble: SquareIndex[];
  throne: SquareIndex;
  lastBoulder: Strike | null;
  lastRam: Ram | null;
}

function material(board: Board, color: Color): number {
  return ALL_SQUARES.reduce((sum, sq) => {
    const piece = board.get(sq);
    return piece?.color === color ? sum + PIECE_VALUE[piece.type] : sum;
  }, 0);
}

const distance = (a: SquareIndex, b: SquareIndex) =>
  Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));

/**
 * One side holds a walled castle in the middle of the board, the other
 * surrounds it. Attackers batter the walls and catapults pound them every
 * few rounds. The attackers win by taking the king; the defenders win if
 * the king is still standing when time runs out.
 */
export class SiegePlugin implements ModePlugin {
  id = "siege";
  name = "Siege";
  description =
    "One side holds the castle, the other storms it. Hold out until time runs out to win.";

  /** The side behind on material gets the castle */
  defender: Color = Color.Black;
  throne: SquareIndex = toIndex(4, 4);
  lastBoulder: Strike | null = null;
  lastRam: Ram | null = null;
  private hp = new Map<SquareIndex, number>();
  private rubble = new Set<SquareIndex>();
  private rounds = 0;
  private nextId = 1;

  get attacker(): Color {
    return opponent(this.defender);
  }

  onGameStart(ctx: PluginContext): void {
    const { board, game } = ctx;
    this.rounds = 0;
    this.lastBoulder = null;
    this.lastRam = null;
    this.rubble.clear();
    this.defender =
      material(board, Color.White) < material(board, Color.Black)
        ? Color.White
        : Color.Black;
    this.throne = this.defender === Color.White ? toIndex(3, 3) : toIndex(4, 4);
    this.deploy(board);

    this.hp = new Map(WALL_SQUARES.map((sq) => [sq, WALL_HP]));
    board.walls = new Set(WALL_SQUARES);
    // Pieces were moved by hand, so castling and en passant no longer apply
    for (const color of [Color.White, Color.Black]) {
      game.castling[color] = { kingSide: false, queenSide: false };
    }
    game.enPassant = null;
  }

  onTurnEnd(ctx: PluginContext, color: Color): void {
    if (color !== Color.Black) return;
    this.rounds++;
    if (this.rounds % VOLLEY_EVERY_ROUNDS === 0) this.volley(ctx.board);
  }

  /** The defenders win the siege if their king lasts until the timer runs out */
  onTimeUp(ctx: PluginContext): Color | null {
    return ctx.board.findKing(this.defender) !== null ? this.defender : null;
  }

  getBoardOverlays(): BoardOverlay[] {
    const view: SiegeView = {
      defender: this.defender,
      walls: Object.fromEntries(this.hp),
      rubble: [...this.rubble],
      throne: this.throne,
      lastBoulder: this.lastBoulder,
      lastRam: this.lastRam,
    };
    return [{ type: "siege", squares: [...this.hp.keys()], data: view }];
  }

  /** Standing wall squares an attacking piece could strike from where it is */
  ramTargets(board: Board, from: SquareIndex): SquareIndex[] {
    const piece = board.get(from);
    if (!piece || piece.color !== this.attacker) return [];
    const standing = (sq: SquareIndex) => this.hp.has(sq);
    const targets = new Set<SquareIndex>();
    const ray = (dirs: number[]) => {
      for (const dir of dirs) {
        let sq = from + dir;
        while (board.passable(sq) && !board.get(sq)) sq += dir;
        if (standing(sq)) targets.add(sq);
      }
    };
    switch (piece.type) {
      case PieceType.Knight:
        for (const step of KNIGHT_STEPS) {
          if (standing(from + step)) targets.add(from + step);
        }
        break;
      case PieceType.King:
        for (const step of KING_STEPS) {
          if (standing(from + step)) targets.add(from + step);
        }
        break;
      case PieceType.Pawn: {
        const ahead = piece.color === Color.White ? 16 : -16;
        for (const step of [ahead - 1, ahead, ahead + 1]) {
          if (standing(from + step)) targets.add(from + step);
        }
        break;
      }
      case PieceType.Rook:
        ray(ROOK_DIRS);
        break;
      case PieceType.Bishop:
        ray(BISHOP_DIRS);
        break;
      case PieceType.Queen:
        ray([...ROOK_DIRS, ...BISHOP_DIRS]);
        break;
    }
    return [...targets];
  }

  /** An attacker strikes a wall in place of moving. Returns false if it cannot. */
  ram(board: Board, from: SquareIndex, target: SquareIndex): boolean {
    if (!this.ramTargets(board, from).includes(target)) return false;
    const hpAfter = this.strike(board, target);
    this.lastRam = { id: this.nextId++, from, target, hpAfter };
    return true;
  }

  /** What the computer batters, if it would rather hit a wall than move */
  chooseRam(
    board: Board,
    color: Color,
  ): { from: SquareIndex; target: SquareIndex } | null {
    if (color !== this.attacker) return null;
    const king = board.findKing(this.defender);
    let best: { from: SquareIndex; target: SquareIndex } | null = null;
    let bestScore = -Infinity;
    for (const from of ALL_SQUARES) {
      if (board.get(from)?.color !== color) continue;
      for (const target of this.ramTargets(board, from)) {
        const finishing = this.hp.get(target) === 1 ? 4 : 0;
        const nearKing = king === null ? 0 : 6 - distance(target, king);
        const score = finishing + nearKing + Math.random();
        if (score > bestScore) {
          bestScore = score;
          best = { from, target };
        }
      }
    }
    return best;
  }

  /** How much the computer likes a move for siege reasons */
  squareBonus(board: Board, to: SquareIndex, piece: Piece): number {
    if (piece.color === this.attacker) {
      const king = board.findKing(this.defender);
      return king === null ? 0 : 0.15 * (7 - distance(to, king));
    }
    if (piece.type === PieceType.King) {
      return -0.4 * distance(to, this.throne);
    }
    return COURTYARD.includes(to) ? 0.3 : -0.3;
  }

  private strike(board: Board, target: SquareIndex): number {
    const hpAfter = (this.hp.get(target) ?? 1) - 1;
    if (hpAfter > 0) {
      this.hp.set(target, hpAfter);
    } else {
      this.hp.delete(target);
      this.rubble.add(target);
      board.walls.delete(target);
    }
    return hpAfter;
  }

  /** A catapult stone lands on a standing wall, favoring the stretch nearest the king */
  private volley(board: Board): void {
    const standing = [...this.hp.keys()];
    if (standing.length === 0) return;
    const king = board.findKing(this.defender);
    const weight = (sq: SquareIndex) =>
      (king === null ? 1 : 8 - distance(sq, king)) +
      (this.hp.get(sq) === 1 ? 3 : 0);
    const total = standing.reduce((sum, sq) => sum + weight(sq), 0);
    let roll = Math.random() * total;
    const target =
      standing.find((sq) => (roll -= weight(sq)) <= 0) ??
      standing[standing.length - 1];
    const hpAfter = this.strike(board, target);
    this.lastBoulder = { id: this.nextId++, target, hpAfter };
  }

  /** Moves every piece into position: defenders in the courtyard, attackers around the field */
  private deploy(board: Board): void {
    const armies = new Map<Color, Piece[]>([
      [Color.White, []],
      [Color.Black, []],
    ]);
    for (const sq of ALL_SQUARES) {
      const piece = board.remove(sq);
      if (piece) armies.get(piece.color)!.push(piece);
    }
    const byRank = (pieces: Piece[]) =>
      [...pieces].sort(
        (a, b) => KEEP_ORDER.indexOf(a.type) - KEEP_ORDER.indexOf(b.type),
      );

    // Defenders: king on the throne, the strongest pieces closest to him, pawns along the walls
    const keep = COURTYARD.filter((sq) => sq !== this.throne).sort(
      (a, b) => distance(a, this.throne) - distance(b, this.throne),
    );
    const defenders = armies.get(this.defender)!;
    const defKing = defenders.find((p) => p.type === PieceType.King);
    if (defKing) board.put(this.throne, defKing);
    byRank(defenders.filter((p) => p !== defKing)).forEach((piece, i) => {
      if (keep[i] !== undefined) board.put(keep[i], piece);
    });

    // Attackers: king in a corner on their own side, everyone else spread around the castle
    const attackers = armies.get(this.attacker)!;
    const camp = this.attacker === Color.White ? toIndex(0, 0) : toIndex(7, 7);
    const atkKing = attackers.find((p) => p.type === PieceType.King);
    if (atkKing) board.put(camp, atkKing);
    const open = FIELD.filter((sq) => sq !== camp);
    const pawns = attackers.filter((p) => p.type === PieceType.Pawn);
    const others = attackers.filter(
      (p) => p.type !== PieceType.Pawn && p !== atkKing,
    );
    // Pawns stand on the side files, at least two steps from promoting
    const promotesAt = this.attacker === Color.White ? 7 : 0;
    const flanks = open.filter(
      (sq) =>
        rankOf(sq) > 0 &&
        rankOf(sq) < 7 &&
        Math.abs(rankOf(sq) - promotesAt) > 1,
    );
    const spread = (pieces: Piece[], squares: SquareIndex[]) => {
      const free = squares.filter((sq) => !board.get(sq));
      pieces.forEach((piece, i) => {
        const sq = free[Math.floor((i * free.length) / pieces.length)];
        if (sq !== undefined) board.put(sq, piece);
      });
    };
    spread(pawns, flanks);
    spread(others, open);
  }
}
