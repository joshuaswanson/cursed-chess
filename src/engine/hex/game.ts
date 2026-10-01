import { HexBoard } from "./board";
import { generatePseudoLegalMoves, isHexAttacked } from "./moves";
import { opponent, Color, PieceType, GameStatus, PAWN_FORWARD } from "./types";
import type { HexCoord, HexMove, Piece } from "./types";

export class HexGame {
  board: HexBoard;
  turn: Color = Color.White;
  enPassant: HexCoord | null = null;
  halfMoveClock = 0;
  fullMoveNumber = 1;

  constructor(whitePieces?: Piece[], blackPieces?: Piece[]) {
    this.board = new HexBoard();
    if (whitePieces && blackPieces) {
      this.board.setupFromPieces(whitePieces, blackPieces);
    } else {
      this.board.setupInitial();
    }
  }

  isInCheck(color?: Color): boolean {
    const c = color ?? this.turn;
    const king = this.board.findKing(c);
    if (!king) return false;
    return isHexAttacked(this.board, king, opponent(c));
  }

  getLegalMoves(coord?: HexCoord): HexMove[] {
    const pseudo = generatePseudoLegalMoves(
      this.board,
      this.turn,
      this.enPassant,
    );
    const filtered = coord
      ? pseudo.filter((m) => m.from.q === coord.q && m.from.r === coord.r)
      : pseudo;

    return filtered.filter((move) => {
      // Simulate and check if our king remains safe
      const saved = this.board.clone();

      this.board.remove(move.from.q, move.from.r);
      const placed: Piece = move.promotion
        ? { type: move.promotion, color: move.piece.color }
        : move.piece;
      this.board.set(move.to.q, move.to.r, placed);

      // En passant: remove the captured pawn
      if (move.isEnPassant) {
        const fwd = PAWN_FORWARD[opponent(this.turn)];
        this.board.remove(move.to.q + fwd.q, move.to.r + fwd.r);
      }

      const king = this.board.findKing(this.turn);
      const inCheck = king
        ? isHexAttacked(this.board, king, opponent(this.turn))
        : true;

      this.board = saved;
      return !inCheck;
    });
  }

  /** Execute a move. Caller is responsible for legality validation. */
  makeMove(move: HexMove): boolean {
    this.board.remove(move.from.q, move.from.r);
    const placed: Piece = move.promotion
      ? { type: move.promotion, color: move.piece.color }
      : move.piece;
    this.board.set(move.to.q, move.to.r, placed);

    if (move.isEnPassant) {
      const fwd = PAWN_FORWARD[opponent(this.turn)];
      this.board.remove(move.to.q + fwd.q, move.to.r + fwd.r);
    }

    // En passant target
    if (move.isDoublePush) {
      const fwd = PAWN_FORWARD[this.turn];
      this.enPassant = {
        q: move.from.q + fwd.q,
        r: move.from.r + fwd.r,
      };
    } else {
      this.enPassant = null;
    }

    // Clocks
    if (move.piece.type === PieceType.Pawn || move.captured) {
      this.halfMoveClock = 0;
    } else {
      this.halfMoveClock++;
    }
    if (this.turn === Color.Black) {
      this.fullMoveNumber++;
    }

    this.turn = opponent(this.turn);
    return true;
  }

  getStatus(): GameStatus {
    const legalMoves = this.getLegalMoves();

    if (legalMoves.length === 0) {
      return this.isInCheck() ? GameStatus.Checkmate : GameStatus.Stalemate;
    }

    if (this.isInCheck()) return GameStatus.Check;
    if (this.halfMoveClock >= 100) return GameStatus.DrawFiftyMove;
    return GameStatus.Active;
  }

  /** Every piece on the board, split by color. */
  armies(): Record<Color, Piece[]> {
    const result: Record<Color, Piece[]> = {
      [Color.White]: [],
      [Color.Black]: [],
    };
    for (const [, piece] of this.board.entries()) {
      result[piece.color].push({ ...piece });
    }
    return result;
  }

  /** Pick a random legal move (for AI) */
  getRandomMove(): HexMove | null {
    const moves = this.getLegalMoves();
    if (moves.length === 0) return null;

    // Simple heuristic: prefer captures, then forward moves
    const captures = moves.filter((m) => m.captured);
    if (captures.length > 0 && Math.random() < 0.6) {
      return captures[Math.floor(Math.random() * captures.length)];
    }
    return moves[Math.floor(Math.random() * moves.length)];
  }
}
