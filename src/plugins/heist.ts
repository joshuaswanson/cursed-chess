import { Color, GameStatus, MoveFlag, PieceType } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type {
  BoardOverlay,
  ModePlugin,
  PluginContext,
  SquareModifier,
} from "./types";
import type { Board } from "../engine/board";
import {
  ALL_SQUARES,
  boardFiles,
  fileOf,
  lastFile,
  isValidSquare,
  lastRank,
  rankOf,
  toIndex,
} from "../utils/squareUtils";

/**
 * Heist's board: a long hall, an odd number of squares each way so that
 * the jewel can sit on the one square at its very middle
 */
export const HEIST_RANKS = 13;
export const HEIST_FILES = 9;

/** A searchlight: the two by two squares it lights, by the corner nearest a1 */
export interface HeistLight {
  id: number;
  file: number;
  rank: number;
}

export interface HeistView {
  /** Where the jewel is: in the vault, or with whoever carries it */
  sq: SquareIndex;
  /** Whose piece carries it, or nobody while it still sits in the vault */
  carrier: Color | null;
  lights: HeistLight[];
  /** Every square a light is on. Whatever stands on one can be seen, and cannot move. */
  lit: SquareIndex[];
  /** The vault's floor: the squares inside its walls, by the corner nearest a1 */
  vault: { file: number; rank: number; size: number };
  /** The vault's walls. Nothing stands on one or slides through one, though a knight jumps them. */
  walls: SquareIndex[];
  /** Where pieces jumped to, getting out of the way of a light, when the lights last moved */
  dodged: SquareIndex[];
}

interface Light {
  id: number;
  file: number;
  rank: number;
  df: number;
  dr: number;
}

const STEPS = [-17, -16, -15, -1, 1, 15, 16, 17];
/** How many squares across the vault is inside its walls */
const VAULT_SIZE = 3;
const LIGHT_SIZE = 2;
const LIGHTS = 3;
/** How many rows at each end the lights never reach, and a thief has to get the jewel back to */
const HOME_ROWS = 2;
/** How many rows a rank is from a side's own end of the board */
const fromOwnEnd = (color: Color, rank: number) =>
  color === Color.White ? rank : lastRank() - rank;
const isHome = (color: Color, rank: number) =>
  fromOwnEnd(color, rank) < HOME_ROWS;
/** How far apart two squares are, counted in king's steps */
const steps = (a: SquareIndex, b: SquareIndex) =>
  Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));

/**
 * A museum at night: a long dark hall with one jewel on the square at its
 * very middle, inside a vault whose walls leave one door in each side.
 * Nobody can see the other side's pieces, except where a searchlight
 * falls. The lights cross the hall a square at a time. A piece a light
 * comes onto jumps out of its way if there is anywhere to jump to, and is
 * caught and cannot move if there is not. Whoever lands on the jewel lifts
 * it, and from then on can only creep a square at a time. Take the piece
 * carrying it and the jewel is yours. Get it back to your own first two
 * rows to win. There are no kings.
 */
export class HeistPlugin implements ModePlugin {
  id = "heist";
  name = "Heist";
  description =
    "It is dark, and you cannot see their pieces. Get the jewel out of the vault and home to your first two rows. Whoever carries it creeps one square at a time. Pieces jump clear of the searchlights, and any that cannot are stuck.";

  private sq: SquareIndex = 0;
  private carrier: Color | null = null;
  private lights: Light[] = [];
  private winner: Color | null = null;

  private walls = new Set<SquareIndex>();
  private dodged: SquareIndex[] = [];

  /** The square at the very middle of the hall */
  private get middle(): SquareIndex {
    return toIndex(lastFile() / 2, lastRank() / 2);
  }

  private get vault() {
    return {
      file: (boardFiles() - VAULT_SIZE) / 2,
      rank: (lastRank() + 1 - VAULT_SIZE) / 2,
      size: VAULT_SIZE,
    };
  }

  /** The ranks a light's near corner can be on: everything between the two sides' home rows */
  private get lightRanks(): [number, number] {
    return [HOME_ROWS, lastRank() - HOME_ROWS - LIGHT_SIZE + 1];
  }

  /**
   * The ring of squares round the vault's floor, walled at each corner and
   * for a square either side of it, which leaves a single door in the
   * middle of each of its four sides
   */
  private buildWalls(): Set<SquareIndex> {
    const { file, rank, size } = this.vault;
    const walls = new Set<SquareIndex>();
    const near = -1;
    const far = size;
    const door = (size - 1) / 2;
    for (let f = near; f <= far; f++) {
      for (let r = near; r <= far; r++) {
        const onRing = f === near || f === far || r === near || r === far;
        if (onRing && f !== door && r !== door) {
          walls.add(toIndex(file + f, rank + r));
        }
      }
    }
    return walls;
  }

  onGameStart(): void {
    this.sq = this.middle;
    this.carrier = null;
    this.winner = null;
    this.walls = this.buildWalls();
    this.dodged = [];
    const [low, high] = this.lightRanks;
    const span = high - low;
    // One light starts toward each end and one in the middle, all on the move
    this.lights = Array.from({ length: LIGHTS }, (_, id) => ({
      id,
      file: Math.floor(Math.random() * (boardFiles() - LIGHT_SIZE + 1)),
      rank: low + Math.round((span * id) / (LIGHTS - 1)),
      df: Math.random() < 0.5 ? -1 : 1,
      dr: id === 0 ? 1 : id === LIGHTS - 1 ? -1 : Math.random() < 0.5 ? -1 : 1,
    }));
  }

  /** The alarm has gone off: somebody has the jewel out of the vault */
  get alarm(): boolean {
    return this.carrier !== null;
  }

  /** Where a light goes with its next step, turning back from the walls and the home rows */
  private stepped(light: Light): Light {
    const [low, high] = this.lightRanks;
    const maxFile = boardFiles() - LIGHT_SIZE;
    const df =
      light.file + light.df < 0 || light.file + light.df > maxFile
        ? -light.df
        : light.df;
    const dr =
      light.rank + light.dr < low || light.rank + light.dr > high
        ? -light.dr
        : light.dr;
    return { ...light, df, dr, file: light.file + df, rank: light.rank + dr };
  }

  private isLit(sq: SquareIndex): boolean {
    const file = fileOf(sq);
    const rank = rankOf(sq);
    return this.lights.some(
      (light) =>
        file >= light.file &&
        file < light.file + LIGHT_SIZE &&
        rank >= light.rank &&
        rank < light.rank + LIGHT_SIZE,
    );
  }

  /** Whether a move lands on a wall, or slides through one. A knight's jump clears them. */
  private hitsWall(move: Move): boolean {
    if (this.walls.has(move.to)) return true;
    if (move.piece.type === PieceType.Knight) return false;
    const df = Math.sign(fileOf(move.to) - fileOf(move.from));
    const dr = Math.sign(rankOf(move.to) - rankOf(move.from));
    const step = dr * 16 + df;
    for (let sq = move.from + step; sq !== move.to; sq += step) {
      if (!isValidSquare(sq)) return false;
      if (this.walls.has(sq)) return true;
    }
    return false;
  }

  /**
   * Nothing standing in a searchlight moves, and nothing goes through a
   * wall. Whoever carries the jewel gives up their own way of moving for a
   * creep: one square in any direction, taking whatever stands there.
   */
  modifyLegalMoves(ctx: PluginContext, moves: Move[], color: Color): Move[] {
    const free = moves.filter(
      (move) => !this.isLit(move.from) && !this.hitsWall(move),
    );
    if (this.carrier !== color) return free;
    const piece = ctx.board.get(this.sq);
    if (!piece) return free;
    const others = free.filter((move) => move.from !== this.sq);
    if (this.isLit(this.sq)) return others;
    const creeps = STEPS.map((step) => this.sq + step)
      .filter((to) => isValidSquare(to) && !this.walls.has(to))
      .flatMap((to): Move[] => {
        const there = ctx.board.get(to);
        if (there?.color === color) return [];
        return [
          {
            from: this.sq,
            to,
            piece,
            captured: there ?? undefined,
            flags: MoveFlag.ModeMove | (there ? MoveFlag.Capture : 0),
          },
        ];
      });
    return [...others, ...creeps];
  }

  onAfterMove(_ctx: PluginContext, move: Move): void {
    // A pawn taken in passing stood beside the square the taker lands on
    const taken =
      move.flags & MoveFlag.EnPassant
        ? toIndex(fileOf(move.to), rankOf(move.from))
        : move.to;
    const mover = move.piece.color;
    if (this.sq === move.from && this.carrier === mover) {
      this.sq = move.to;
    } else if (
      (move.captured && this.sq === taken) ||
      (this.carrier === null && this.sq === move.to)
    ) {
      // Lifted from the vault, or taken along with whoever had it
      this.sq = move.to;
      this.carrier = mover;
    }
    if (this.carrier === mover && isHome(mover, rankOf(this.sq))) {
      this.winner = mover;
    }
  }

  /**
   * The lights move on a square after every turn. Every piece one comes
   * onto jumps to a dark square beside it, the one furthest from the
   * lights, if there is one free. A piece with nowhere to go stays where
   * it is, lit up and stuck.
   */
  onTurnEnd(ctx: PluginContext): void {
    const lit = (sq: SquareIndex) => this.isLit(sq);
    const wasLit = new Set(ALL_SQUARES.filter(lit));
    this.lights = this.lights.map((light) => this.stepped(light));
    this.dodged = [];
    for (const from of ALL_SQUARES.filter(lit)) {
      // One already caught stays caught until the light moves off it
      if (wasLit.has(from)) continue;
      const piece = ctx.board.get(from);
      if (!piece) continue;
      const to = this.wayOut(ctx.board, from);
      if (to === undefined) continue;
      ctx.board.remove(from);
      ctx.board.put(to, piece);
      this.dodged.push(to);
      if (this.sq === from && this.carrier !== null) {
        this.sq = to;
        if (isHome(this.carrier, rankOf(to))) this.winner = this.carrier;
      }
    }
  }

  /** The dark, empty square beside this one that is furthest from the lights */
  private wayOut(board: Board, from: SquareIndex): SquareIndex | undefined {
    const fromLights = (sq: SquareIndex) =>
      Math.min(
        ...this.lights.map((light) =>
          Math.hypot(
            fileOf(sq) - (light.file + (LIGHT_SIZE - 1) / 2),
            rankOf(sq) - (light.rank + (LIGHT_SIZE - 1) / 2),
          ),
        ),
      );
    return STEPS.map((step) => from + step)
      .filter(
        (to) =>
          isValidSquare(to) &&
          !board.get(to) &&
          !this.isLit(to) &&
          !this.walls.has(to) &&
          // Nobody lifts the jewel by accident
          (this.carrier !== null || to !== this.sq),
      )
      .sort((a, b) => fromLights(b) - fromLights(a))[0];
  }

  modifyGameStatus(_ctx: PluginContext, status: GameStatus): GameStatus {
    return this.winner !== null ? GameStatus.Checkmate : status;
  }

  getWinner(): Color | null {
    return this.winner;
  }

  getSquareModifiers(
    ctx: PluginContext,
    square: SquareIndex,
  ): SquareModifier[] {
    const mods: SquareModifier[] = [];
    const { file, rank, size } = this.vault;
    const f = fileOf(square);
    const r = rankOf(square);
    if (f >= file && f < file + size && r >= rank && r < rank + size) {
      mods.push({ className: "heist-vault" });
    }
    if (this.walls.has(square)) mods.push({ className: "heist-wall" });
    if (this.isLit(square)) {
      mods.push({
        className: ctx.board.get(square)
          ? "heist-lit heist-frozen"
          : "heist-lit",
      });
    }
    if (this.carrier !== null && isHome(this.carrier, r)) {
      mods.push({ className: `heist-exit heist-exit-${this.carrier}` });
    }
    return mods;
  }

  getBoardOverlays(): BoardOverlay[] {
    const view: HeistView = {
      sq: this.sq,
      carrier: this.carrier,
      lights: this.lights.map(({ id, file, rank }) => ({ id, file, rank })),
      lit: ALL_SQUARES.filter((sq) => this.isLit(sq)),
      vault: this.vault,
      walls: [...this.walls],
      dodged: [...this.dodged],
    };
    return [{ type: "heist", squares: [this.sq], data: view }];
  }

  /** How much the computer likes a move for the sake of the jewel, and for keeping out of the lights */
  squareBonus(to: SquareIndex, piece: Piece, from: SquareIndex): number {
    // Where the lights will be when this move has been made
    const next = this.lights.map((light) => this.stepped(light));
    const caught = next.some(
      (light) =>
        fileOf(to) >= light.file &&
        fileOf(to) < light.file + LIGHT_SIZE &&
        rankOf(to) >= light.rank &&
        rankOf(to) < light.rank + LIGHT_SIZE,
    );
    const carrying = this.carrier === piece.color && from === this.sq;
    let bonus = caught ? (carrying ? -4 : -0.8) : 0;
    const closer = steps(from, this.sq) - steps(to, this.sq);
    if (this.carrier === null) {
      // Nobody has it: get there first
      bonus += to === this.sq ? 6 : closer * 0.7;
    } else if (this.carrier === piece.color) {
      if (carrying) {
        const nearer =
          fromOwnEnd(piece.color, rankOf(from)) -
          fromOwnEnd(piece.color, rankOf(to));
        bonus += isHome(piece.color, rankOf(to)) ? 500 : nearer * 3;
      } else {
        // Stay close to whoever has it
        bonus += closer * 0.2;
      }
    } else {
      // The other side has it: close in, and take it if it can be taken
      bonus += to === this.sq ? 14 : closer * 0.9;
    }
    return bonus;
  }
}
