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

  /** Where each carried-over piece was placed, keyed by the piece passed in */
  placements = new Map<Piece, HexCoord>();

  constructor(whitePieces?: Piece[], blackPieces?: Piece[]) {
    this.board = new HexBoard();
    if (whitePieces && blackPieces) {
      this.placements = this.board.setupFromPieces(whitePieces, blackPieces);
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

  /**
   * Greedy AI move: material won, minus the moved piece's value if it lands
   * on an attacked square (less a recapture if it is defended)
   */
  getBestMove(pieceValue: Record<PieceType, number>): HexMove | null {
    const moves = this.getLegalMoves();
    let best: HexMove | null = null;
    let bestScore = -Infinity;
    for (const move of moves) {
      const score = this.scoreMove(move, pieceValue) + Math.random() * 0.35;
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    return best;
  }

  private scoreMove(
    move: HexMove,
    pieceValue: Record<PieceType, number>,
  ): number {
    const me = this.turn;
    const landed = move.promotion ?? move.piece.type;
    let score = move.captured ? pieceValue[move.captured.type] : 0;
    if (move.promotion) score += pieceValue[move.promotion] - 1;

    const saved = this.board;
    this.board = saved.clone();
    this.board.remove(move.from.q, move.from.r);
    this.board.set(move.to.q, move.to.r, { type: landed, color: me });
    if (move.isEnPassant) {
      const fwd = PAWN_FORWARD[opponent(me)];
      this.board.remove(move.to.q + fwd.q, move.to.r + fwd.r);
    }
    if (isHexAttacked(this.board, move.to, opponent(me))) {
      const defended = isHexAttacked(this.board, move.to, me);
      score -= defended ? pieceValue[landed] * 0.4 : pieceValue[landed];
    }
    const theirKing = this.board.findKing(opponent(me));
    if (theirKing && isHexAttacked(this.board, theirKing, me)) score += 0.4;
    this.board = saved;
    return score;
  }
}
