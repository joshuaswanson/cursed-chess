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
  /** Every square a sweeping light is on. Whatever stands on one can be seen, and cannot move. */
  lit: SquareIndex[];
  /** Where the light that follows the jewel is: on whoever carries it, once somebody does */
  spot: SquareIndex | null;
  /** Every square that can be seen into: those the sweeping lights are on, and those round the thief */
  shown: SquareIndex[];
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
/** How many squares of wall stand either side of each door */
const WALL_ARM = 3;
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
 * very middle, in a vault walled off from each army by a wall with one
 * door in it, and open at its two ends.
 * Nobody can see the other side's pieces, except where a searchlight
 * falls. The lights cross the hall a square at a time. A piece a light
 * comes onto jumps out of its way if there is anywhere to jump to, and is
 * caught and cannot move if there is not. Whoever carries the jewel has
 * been caught already in a sense: one of the lights stays on them wherever
 * they go, and no light stops them moving. Whoever lands on the jewel lifts
 * it, and from then on can only creep a square at a time. Take the piece
 * carrying it and the jewel is yours. Get it back to your own first two
 * rows to win. There are no kings.
 */
export class HeistPlugin implements ModePlugin {
  id = "heist";
  name = "Heist";
  description =
    "It is dark, and you cannot see their pieces. Get the jewel out of the vault and home to your first two rows. Whoever carries it creeps one square at a time. Pieces jump clear of the searchlights and cannot step into one. Whoever has the jewel is lit up wherever they go, and can always move.";

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
   * Two walls across the hall, one on each army's side of the vault's
   * floor: each three squares long either side of a door in its middle.
   * The vault stands open to the left and right.
   */
  private buildWalls(): Set<SquareIndex> {
    const { file, rank, size } = this.vault;
    const walls = new Set<SquareIndex>();
    const door = file + (size - 1) / 2;
    for (const wallRank of [rank - 1, rank + size]) {
      for (let f = door - WALL_ARM; f <= door + WALL_ARM; f++) {
        if (f !== door) walls.add(toIndex(f, wallRank));
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

  /**
   * The lights sweeping the hall. With the jewel out of the vault one of
   * the three leaves its beat and stays on whoever carries it. That one
   * only shows the thief up: it does not pin anyone, and can be walked into.
   */
  private get patrol(): Light[] {
    return this.carrier === null ? this.lights : this.lights.slice(1);
  }

  private isLit(sq: SquareIndex): boolean {
    const file = fileOf(sq);
    const rank = rankOf(sq);
    return this.patrol.some(
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
   * Nothing standing in a searchlight moves, nothing steps into one, and
   * nothing goes through a wall. Whoever carries the jewel gives up their
   * own way of moving for a creep: one square in any direction, taking
   * whatever stands there. The lights do not stop a creep.
   */
  modifyLegalMoves(ctx: PluginContext, moves: Move[], color: Color): Move[] {
    const free = moves.filter(
      (move) =>
        !this.isLit(move.from) &&
        // A sweeping light is no hiding place for the thief: they can be taken in one
        (!this.isLit(move.to) ||
          (this.carrier !== null && move.to === this.sq)) &&
        !this.hitsWall(move),
    );
    if (this.carrier !== color) return free;
    const piece = ctx.board.get(this.sq);
    if (!piece) return free;
    const others = free.filter((move) => move.from !== this.sq);
    // The thief has been seen already, and the lights mean nothing to them:
    // they creep on whether they stand in one or step into one
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
   * lights, if there is one free. A piece with nowhere to go, and whoever
   * is carrying the jewel, stays where it is, lit up and stuck.
   */
  onTurnEnd(ctx: PluginContext): void {
    const lit = (sq: SquareIndex) => this.isLit(sq);
    const wasLit = new Set(ALL_SQUARES.filter(lit));
    const sweeping = new Set(this.patrol);
    this.lights = this.lights.map((light) =>
      sweeping.has(light) ? this.stepped(light) : light,
    );
    this.dodged = [];
    for (const from of ALL_SQUARES.filter(lit)) {
      // One already caught stays caught until the light moves off it
      if (wasLit.has(from)) continue;
      const piece = ctx.board.get(from);
      if (!piece) continue;
      // Whoever has the jewel has been seen already, and just carries on
      if (this.carrier !== null && this.sq === from) continue;
      const to = this.wayOut(ctx.board, from);
      if (to === undefined) continue;
      ctx.board.remove(from);
      ctx.board.put(to, piece);
      this.dodged.push(to);
    }
  }

  /** The dark, empty square beside this one that is furthest from the lights */
  private wayOut(board: Board, from: SquareIndex): SquareIndex | undefined {
    const fromLights = (sq: SquareIndex) =>
      Math.min(
        ...this.patrol.map((light) =>
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
      const thief = this.carrier !== null && square === this.sq;
      mods.push({
        className:
          ctx.board.get(square) && !thief
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
      lights: this.patrol.map(({ id, file, rank }) => ({ id, file, rank })),
      lit: ALL_SQUARES.filter((sq) => this.isLit(sq)),
      spot: this.carrier === null ? null : this.sq,
      shown: ALL_SQUARES.filter(
        (sq) =>
          this.isLit(sq) || (this.carrier !== null && steps(sq, this.sq) <= 1),
      ),
      vault: this.vault,
      walls: [...this.walls],
      dodged: [...this.dodged],
    };
    return [{ type: "heist", squares: [this.sq], data: view }];
  }

  /** How much the computer likes a move for the sake of the jewel, and for keeping out of the lights */
  squareBonus(to: SquareIndex, piece: Piece, from: SquareIndex): number {
    // Where the lights will be when this move has been made
    const next = this.patrol.map((light) => this.stepped(light));
    const caught = next.some(
      (light) =>
        fileOf(to) >= light.file &&
        fileOf(to) < light.file + LIGHT_SIZE &&
        rankOf(to) >= light.rank &&
        rankOf(to) < light.rank + LIGHT_SIZE,
    );
    const carrying = this.carrier === piece.color && from === this.sq;
    // The lights are nothing to whoever has the jewel
    let bonus = caught && !carrying ? -0.8 : 0;
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
