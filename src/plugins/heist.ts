import { Color, GameStatus, MoveFlag, PieceType } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import { isSquareAttacked, opponent } from "../engine/moves";
import type {
  BoardOverlay,
  ModePlugin,
  PluginContext,
  SquareModifier,
} from "./types";
import { fileOf, isValidSquare, rankOf, toIndex } from "../utils/squareUtils";

/** One side's jewel: in its vault, or in the hands of a thief from the other side */
export interface HeistJewel {
  owner: Color;
  /** The square of its vault, in front of its owner's pawns */
  vault: SquareIndex;
  sq: SquareIndex;
  /** Lifted, and on its way out with one of the other side's pieces */
  carried: boolean;
}

export interface HeistView {
  jewels: HeistJewel[];
}

const STEPS = [-17, -16, -15, -1, 1, 15, 16, 17];
/** The row each side's vault is on: the third from its own end, just ahead of its pawns */
const VAULT_ROW = 2;
/** How many rows at a side's own end a thief has to get the jewel back to */
const HOME_ROWS = 2;
/** How many rows a rank is from a side's own end of the board */
const fromOwnEnd = (color: Color, rank: number) =>
  color === Color.White ? rank : 7 - rank;
const isHome = (color: Color, rank: number) =>
  fromOwnEnd(color, rank) < HOME_ROWS;
/** How far apart two squares are, counted in king's steps */
const steps = (a: SquareIndex, b: SquareIndex) =>
  Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));

/**
 * A museum at night, with a jewel in each side's vault, just ahead of its
 * pawns. Land a piece on the other side's vault to lift their jewel. From
 * then on that piece can only creep a square at a time, in any direction.
 * Get it back to your own first two rows to win. Take a thief and the
 * jewel goes straight back to its vault.
 */
export class HeistPlugin implements ModePlugin {
  id = "heist";
  name = "Heist";
  description =
    "Break into their vault, lift their jewel, and carry it home to your first two rows. A thief can only creep one square at a time. Take a thief to send your jewel back.";

  private jewels: HeistJewel[] = [];
  private winner: Color | null = null;

  onGameStart(): void {
    this.winner = null;
    this.jewels = [Color.White, Color.Black].map((owner) => {
      const rank = owner === Color.White ? VAULT_ROW : 7 - VAULT_ROW;
      const vault = toIndex(Math.random() < 0.5 ? 3 : 4, rank);
      return { owner, vault, sq: vault, carried: false };
    });
  }

  /** The alarm has gone off: somebody has a jewel out of its vault */
  get alarm(): boolean {
    return this.jewels.some((jewel) => jewel.carried);
  }

  /** The jewel a side is trying to steal */
  private loot(thief: Color): HeistJewel | undefined {
    return this.jewels.find((jewel) => jewel.owner !== thief);
  }

  /**
   * A thief gives up its own way of moving for a creep: one square in any
   * direction, taking whatever stands there
   */
  modifyLegalMoves(ctx: PluginContext, moves: Move[], color: Color): Move[] {
    const loot = this.loot(color);
    if (!loot?.carried) return moves;
    const piece = ctx.board.get(loot.sq);
    // A king creeps as it is
    if (!piece || piece.type === PieceType.King) return moves;
    const others = moves.filter((move) => move.from !== loot.sq);
    const creeps = STEPS.map((step) => loot.sq + step)
      .filter((to) => isValidSquare(to))
      .flatMap((to): Move[] => {
        const there = ctx.board.get(to);
        if (there?.color === color) return [];
        return [
          {
            from: loot.sq,
            to,
            piece,
            captured: there ?? undefined,
            flags: MoveFlag.ModeMove | (there ? MoveFlag.Capture : 0),
          },
        ];
      })
      .filter((move) => this.leavesKingSafe(ctx.board, move, color));
    return [...others, ...creeps];
  }

  private leavesKingSafe(board: Board, move: Move, color: Color): boolean {
    const after = board.clone();
    after.remove(move.from);
    after.put(move.to, move.piece);
    const king = after.findKing(color);
    return king === null || !isSquareAttacked(after, king, opponent(color));
  }

  onAfterMove(ctx: PluginContext, move: Move): void {
    const mover = move.piece.color;
    // A pawn taken in passing stood beside the square the taker lands on
    const taken =
      move.flags & MoveFlag.EnPassant
        ? toIndex(fileOf(move.to), rankOf(move.from))
        : move.to;
    for (const jewel of this.jewels) {
      const thief = opponent(jewel.owner);
      if (jewel.carried && mover === thief && jewel.sq === move.from) {
        jewel.sq = move.to;
      } else if (jewel.carried && move.captured && jewel.sq === taken) {
        // The thief is caught, and the jewel is back where it belongs
        jewel.carried = false;
        jewel.sq = jewel.vault;
      }
      // Anyone from the other side standing on the vault has the jewel
      if (!jewel.carried && ctx.board.get(jewel.vault)?.color === thief) {
        jewel.carried = true;
        jewel.sq = jewel.vault;
      }
      if (jewel.carried && isHome(thief, rankOf(jewel.sq))) {
        this.winner = thief;
      }
    }
  }

  modifyGameStatus(_ctx: PluginContext, status: GameStatus): GameStatus {
    return this.winner !== null ? GameStatus.Checkmate : status;
  }

  getWinner(): Color | null {
    return this.winner;
  }

  /** A thief's home rows are lit up as the way out */
  getSquareModifiers(
    _ctx: PluginContext,
    square: SquareIndex,
  ): SquareModifier[] {
    return this.jewels.flatMap((jewel) => {
      const thief = opponent(jewel.owner);
      return jewel.carried && isHome(thief, rankOf(square))
        ? [{ className: `heist-exit heist-exit-${thief}` }]
        : [];
    });
  }

  getBoardOverlays(): BoardOverlay[] {
    const view: HeistView = {
      jewels: this.jewels.map((jewel) => ({ ...jewel })),
    };
    return [
      {
        type: "heist",
        squares: this.jewels.map((jewel) => jewel.sq),
        data: view,
      },
    ];
  }

  /** How much the computer likes a move for the sake of the jewels */
  squareBonus(to: SquareIndex, piece: Piece, from: SquareIndex): number {
    const loot = this.loot(piece.color);
    const mine = this.jewels.find((jewel) => jewel.owner === piece.color);
    let bonus = 0;
    if (loot?.carried) {
      // Carrying theirs: head for home
      if (from === loot.sq) {
        const nearer =
          fromOwnEnd(piece.color, rankOf(from)) -
          fromOwnEnd(piece.color, rankOf(to));
        bonus += isHome(piece.color, rankOf(to)) ? 500 : nearer * 3;
      }
    } else if (loot) {
      // Theirs is still in its vault: work toward it, and lift it when it is safe to
      bonus +=
        to === loot.vault
          ? 2.5
          : (steps(from, loot.vault) - steps(to, loot.vault)) * 0.4;
    }
    if (mine?.carried) {
      // Mine is on its way out: catch the thief
      bonus +=
        to === mine.sq ? 15 : (steps(from, mine.sq) - steps(to, mine.sq)) * 0.8;
    }
    return bonus;
  }
}
