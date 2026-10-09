import { Color, GameStatus, MoveFlag } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type {
  BoardOverlay,
  ModePlugin,
  PluginContext,
  SquareModifier,
} from "./types";
import {
  ALL_SQUARES,
  fileOf,
  isValidSquare,
  lastRank,
  rankOf,
  toIndex,
} from "../utils/squareUtils";

/** How many ranks deep Heist's board is: a long hall with the vault in the middle of it */
export const HEIST_RANKS = 12;

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
  /** The vault: the four by four squares in the middle of the hall, by the corner nearest a1 */
  vault: { file: number; rank: number; size: number };
}

interface Light {
  id: number;
  file: number;
  rank: number;
  df: number;
  dr: number;
}

const STEPS = [-17, -16, -15, -1, 1, 15, 16, 17];
const VAULT_SIZE = 4;
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
 * A museum at night: a long dark hall with one jewel in the vault at its
 * middle. Nobody can see the other side's pieces, except where a
 * searchlight falls. The lights cross the hall a square at a time, and
 * anything standing in one cannot move. Whoever lands on the jewel lifts
 * it, and from then on can only creep a square at a time. Take the piece
 * carrying it and the jewel is yours. Get it back to your own first two
 * rows to win. There are no kings.
 */
export class HeistPlugin implements ModePlugin {
  id = "heist";
  name = "Heist";
  description =
    "It is dark, and you cannot see their pieces. Get the jewel out of the vault and home to your first two rows. Whoever carries it creeps one square at a time, and anything caught in a searchlight cannot move.";

  private sq: SquareIndex = 0;
  private carrier: Color | null = null;
  private lights: Light[] = [];
  private winner: Color | null = null;

  private get vault() {
    return {
      file: (8 - VAULT_SIZE) / 2,
      rank: (lastRank() + 1 - VAULT_SIZE) / 2,
      size: VAULT_SIZE,
    };
  }

  /** The ranks a light's near corner can be on: everything between the two sides' home rows */
  private get lightRanks(): [number, number] {
    return [HOME_ROWS, lastRank() - HOME_ROWS - LIGHT_SIZE + 1];
  }

  onGameStart(): void {
    const { file, rank } = this.vault;
    // The jewel sits on one of the four squares at the very middle
    const pick = () => 1 + Math.floor(Math.random() * 2);
    this.sq = toIndex(file + pick(), rank + pick());
    this.carrier = null;
    this.winner = null;
    const [low, high] = this.lightRanks;
    const span = high - low;
    // One light starts toward each end and one in the middle, all on the move
    this.lights = Array.from({ length: LIGHTS }, (_, id) => ({
      id,
      file: Math.floor(Math.random() * (8 - LIGHT_SIZE + 1)),
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
    const maxFile = 8 - LIGHT_SIZE;
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

  /**
   * Nothing standing in a searchlight moves. Whoever carries the jewel
   * gives up their own way of moving for a creep: one square in any
   * direction, taking whatever stands there.
   */
  modifyLegalMoves(ctx: PluginContext, moves: Move[], color: Color): Move[] {
    const free = moves.filter((move) => !this.isLit(move.from));
    if (this.carrier !== color) return free;
    const piece = ctx.board.get(this.sq);
    if (!piece) return free;
    const others = free.filter((move) => move.from !== this.sq);
    if (this.isLit(this.sq)) return others;
    const creeps = STEPS.map((step) => this.sq + step)
      .filter((to) => isValidSquare(to))
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

  /** The lights move on a square after every turn */
  onTurnEnd(): void {
    this.lights = this.lights.map((light) => this.stepped(light));
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
