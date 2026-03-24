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
  [PieceType.Pawn]: 10000,
  [PieceType.Knight]: 8000,
  [PieceType.Bishop]: 8000,
  [PieceType.Rook]: 12000,
  [PieceType.Queen]: 10000,
  [PieceType.King]: 4000,
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
  name = "Clash Royale";
  description =
    "Pieces move on their own. Spend resources to deploy reinforcements.";
  isAutonomous = true;

  private cooldowns = new Map<number, number>();
  private cooldownTotal = new Map<number, number>();
  private cooldownGen = new Map<number, number>();
  resourceWhite = 0;
  resourceBlack = 0;
  private resourceAccumulator = 0;

  onGameStart(ctx: PluginContext): void {
    this.cooldowns.clear();
    this.cooldownTotal.clear();
    this.cooldownGen.clear();
    this.resourceWhite = 5;
    this.resourceBlack = 5;
    this.resourceAccumulator = 0;

    // Wait for announcements (~5s) + each piece's own speed as initial cooldown
    const announceDelay = 5000;
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const sq = ((rank << 4) | file) as SquareIndex;
        const piece = ctx.board.get(sq);
        if (piece) {
          const speed = PIECE_SPEED[piece.type] ?? 2000;
          const total = announceDelay + speed;
          this.cooldowns.set(sq, total);
          this.cooldownTotal.set(sq, total);
          this.cooldownGen.set(sq, 0);
        }
      }
    }
  }

  tickAutonomous(
    ctx: PluginContext,
    tickMs: number,
  ): { from: SquareIndex; to: SquareIndex }[] {
    // Accumulate resources (+1 per 1.5 seconds)
    this.resourceAccumulator += tickMs;
    while (this.resourceAccumulator >= 1500) {
      this.resourceAccumulator -= 1500;
      this.resourceWhite = Math.min(10, this.resourceWhite + 1);
      this.resourceBlack = Math.min(10, this.resourceBlack + 1);
    }

    // Decrement all cooldowns
    for (const [sq, cd] of this.cooldowns) {
      this.cooldowns.set(sq, cd - tickMs);
    }

    // AI deployment: Black spends resources to deploy pieces
    if (this.resourceBlack >= 3 && Math.random() < 0.15) {
      this.aiDeploy(ctx);
    }

    // Find ALL pieces (both colors) that are off cooldown and move them
    const results: { from: SquareIndex; to: SquareIndex }[] = [];
    const savedTurn = ctx.game.turn;

    // Defer cooldown updates to avoid blocking pieces at destination squares
    const cooldownDeletes: number[] = [];
    const cooldownSets: [number, number][] = [];

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const sq = ((rank << 4) | file) as SquareIndex;
        const piece = ctx.board.get(sq);
        if (!piece) continue;

        const cd = this.cooldowns.get(sq) ?? 0;
        if (cd > 0) continue;

        // Temporarily set turn so getLegalMoves works for this color
        ctx.game.turn = piece.color;
        const moves = ctx.game.getLegalMoves(sq);
        if (moves.length === 0) {
          // No legal moves — full cooldown restart
          const speed = PIECE_SPEED[piece.type] ?? 2000;
          cooldownSets.push([sq, speed]);
          continue;
        }

        const bestMove = this.pickBestMove(moves, piece.color);

        // Defer cooldown update for the destination
        const speed = PIECE_SPEED[piece.type] ?? 2000;
        const jitter = (Math.random() - 0.5) * speed * 0.3;
        cooldownDeletes.push(sq);
        cooldownSets.push([bestMove.to, speed + jitter]);

        results.push({ from: sq, to: bestMove.to });
      }
    }

    // Apply all cooldown changes after iteration
    for (const sq of cooldownDeletes) {
      this.cooldowns.delete(sq);
      this.cooldownTotal.delete(sq);
      this.cooldownGen.delete(sq);
    }
    for (const [sq, cd] of cooldownSets) {
      this.cooldowns.set(sq, cd);
      this.cooldownTotal.set(sq, cd);
      this.cooldownGen.set(sq, (this.cooldownGen.get(sq) ?? 0) + 1);
    }

    ctx.game.turn = savedTurn;
    return results;
  }

  getBoardOverlays(ctx: PluginContext): BoardOverlay[] {
    // Build cooldown map: square -> { ms, gen }
    const cooldownData: Record<number, { total: number; gen: number }> = {};
    for (const [sq, cd] of this.cooldowns) {
      if (cd > 0) {
        cooldownData[sq] = {
          total: this.cooldownTotal.get(sq) ?? cd,
          gen: this.cooldownGen.get(sq) ?? 0,
        };
      }
    }

    return [
      {
        type: "rally-resources",
        squares: [],
        data: {
          white: this.resourceWhite,
          black: this.resourceBlack,
        },
      },
      {
        type: "rally-cooldowns",
        squares: [],
        data: cooldownData,
      },
    ];
  }

  getSquareModifiers(
    _ctx: PluginContext,
    _square: SquareIndex,
  ): SquareModifier[] {
    return [];
  }

  setCooldown(square: SquareIndex, pieceType: PieceType): void {
    const speed = PIECE_SPEED[pieceType] ?? 2000;
    this.cooldowns.set(square, speed);
    this.cooldownTotal.set(square, speed);
    this.cooldownGen.set(square, (this.cooldownGen.get(square) ?? 0) + 1);
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

  private aiDeploy(ctx: PluginContext): boolean {
    // Pick a piece type the AI can afford, weighted toward cheaper pieces
    const options = [
      PieceType.Pawn,
      PieceType.Pawn,
      PieceType.Pawn,
      PieceType.Knight,
      PieceType.Bishop,
      PieceType.Rook,
      PieceType.Queen,
    ].filter((t) => PIECE_COST[t] <= this.resourceBlack);

    if (options.length === 0) return false;

    const pieceType = options[Math.floor(Math.random() * options.length)];

    // Find empty squares on Black's half (ranks 4-7)
    const candidates: SquareIndex[] = [];
    for (let rank = 4; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const sq = ((rank << 4) | file) as SquareIndex;
        if (!ctx.board.get(sq)) {
          candidates.push(sq);
        }
      }
    }

    if (candidates.length === 0) return false;

    const target = candidates[Math.floor(Math.random() * candidates.length)];
    ctx.board.put(target, { type: pieceType, color: Color.Black });
    this.resourceBlack -= PIECE_COST[pieceType];

    // Set cooldown for newly deployed piece
    const speed = PIECE_SPEED[pieceType] ?? 2000;
    this.cooldowns.set(target, speed);
    this.cooldownTotal.set(target, speed);
    this.cooldownGen.set(target, 0);

    return true;
  }
}
