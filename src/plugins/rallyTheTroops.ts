import { Color, PieceType } from "../engine/types";
import type { Move, SquareIndex } from "../engine/types";
import type {
  ModePlugin,
  PluginContext,
  BoardOverlay,
  SquareModifier,
} from "./types";
import { rankOf } from "../utils/squareUtils";

const PIECE_SPEED: Record<string, number> = {
  [PieceType.Pawn]: 2000,
  [PieceType.Knight]: 1500,
  [PieceType.Bishop]: 1500,
  [PieceType.Rook]: 1800,
  [PieceType.Queen]: 2500,
  [PieceType.King]: 3000,
};

export const PIECE_COST: Record<string, number> = {
  [PieceType.Pawn]: 1,
  [PieceType.Knight]: 3,
  [PieceType.Bishop]: 3,
  [PieceType.Rook]: 5,
  [PieceType.Queen]: 9,
};

export class RallyPlugin implements ModePlugin {
  id = "rally";
  name = "Rally the Troops";
  description =
    "Pieces move on their own. Spend resources to deploy reinforcements.";
  isAutonomous = true;

  private cooldowns = new Map<number, number>();
  resourceWhite = 0;
  resourceBlack = 0;
  private resourceAccumulator = 0;

  onGameStart(ctx: PluginContext): void {
    this.cooldowns.clear();
    this.resourceWhite = 5;
    this.resourceBlack = 5;
    this.resourceAccumulator = 0;

    // Set initial cooldowns with jitter so pieces stagger
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const sq = ((rank << 4) | file) as SquareIndex;
        const piece = ctx.board.get(sq);
        if (piece) {
          const baseSpeed = PIECE_SPEED[piece.type] ?? 2000;
          this.cooldowns.set(sq, Math.random() * baseSpeed);
        }
      }
    }
  }

  tickAutonomous(
    ctx: PluginContext,
    tickMs: number,
  ): { from: SquareIndex; to: SquareIndex } | null {
    // Accumulate resources (+1 per second)
    this.resourceAccumulator += tickMs;
    while (this.resourceAccumulator >= 1000) {
      this.resourceAccumulator -= 1000;
      this.resourceWhite = Math.min(10, this.resourceWhite + 1);
      this.resourceBlack = Math.min(10, this.resourceBlack + 1);
    }

    // Decrement all cooldowns
    for (const [sq, cd] of this.cooldowns) {
      this.cooldowns.set(sq, cd - tickMs);
    }

    // Find pieces of the current turn that are off cooldown
    const currentColor = ctx.game.turn;
    const ready: { sq: SquareIndex; moves: Move[] }[] = [];

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const sq = ((rank << 4) | file) as SquareIndex;
        const piece = ctx.board.get(sq);
        if (!piece || piece.color !== currentColor) continue;

        const cd = this.cooldowns.get(sq) ?? 0;
        if (cd > 0) continue;

        const moves = ctx.game.getLegalMoves(sq);
        if (moves.length > 0) {
          ready.push({ sq, moves });
        }
      }
    }

    if (ready.length === 0) return null;

    // Pick a random ready piece
    const pick = ready[Math.floor(Math.random() * ready.length)];

    // AI: prefer captures (highest value first), then forward moves
    const bestMove = this.pickBestMove(pick.moves, currentColor);

    // Set cooldown for the destination
    const piece = ctx.board.get(pick.sq);
    const speed = piece ? (PIECE_SPEED[piece.type] ?? 2000) : 2000;
    const jitter = (Math.random() - 0.5) * speed * 0.3;
    this.cooldowns.delete(pick.sq);
    this.cooldowns.set(bestMove.to, speed + jitter);

    return { from: pick.sq, to: bestMove.to };
  }

  getBoardOverlays(_ctx: PluginContext): BoardOverlay[] {
    return [
      {
        type: "rally-resources",
        squares: [],
        data: {
          white: this.resourceWhite,
          black: this.resourceBlack,
        },
      },
    ];
  }

  getSquareModifiers(
    _ctx: PluginContext,
    _square: SquareIndex,
  ): SquareModifier[] {
    return [];
  }

  private pickBestMove(moves: Move[], color: Color): Move {
    const pieceValue: Record<string, number> = {
      [PieceType.Pawn]: 1,
      [PieceType.Knight]: 3,
      [PieceType.Bishop]: 3,
      [PieceType.Rook]: 5,
      [PieceType.Queen]: 9,
      [PieceType.King]: 100,
    };

    // King self-preservation: never move the king forward, prefer retreating
    if (moves[0]?.piece.type === PieceType.King) {
      const backward = color === Color.White ? -1 : 1;
      const safeMoves = moves.filter((m) => !m.captured);
      const retreats = safeMoves.filter((m) => {
        const dRank = rankOf(m.to) - rankOf(m.from);
        return dRank * backward > 0;
      });
      if (retreats.length > 0) {
        return retreats[Math.floor(Math.random() * retreats.length)];
      }
      if (safeMoves.length > 0) {
        return safeMoves[Math.floor(Math.random() * safeMoves.length)];
      }
      return moves[Math.floor(Math.random() * moves.length)];
    }

    // Prefer highest-value captures
    const captures = moves
      .filter((m) => m.captured)
      .sort(
        (a, b) =>
          (pieceValue[b.captured!.type] ?? 0) -
          (pieceValue[a.captured!.type] ?? 0),
      );
    if (captures.length > 0) {
      return captures[0];
    }

    // No captures: prefer forward movement
    const forward = color === Color.White ? 1 : -1;
    const forwardMoves = moves.filter((m) => {
      const dRank = rankOf(m.to) - rankOf(m.from);
      return dRank * forward > 0;
    });

    if (forwardMoves.length > 0) {
      return forwardMoves[Math.floor(Math.random() * forwardMoves.length)];
    }

    return moves[Math.floor(Math.random() * moves.length)];
  }
}
