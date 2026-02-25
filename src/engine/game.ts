import { Color, PieceType, MoveFlag, GameStatus } from "./types";
import type {
  SquareIndex,
  Move,
  CastlingRights,
  GameState,
  MoveRecord,
} from "./types";
import { Board, STARTING_FEN } from "./board";
import { generatePseudoLegalMoves, isSquareAttacked, opponent } from "./moves";
import { toIndex, fileOf, rankOf } from "../utils/squareUtils";
import { moveToSan } from "./notation";

function cloneCastling(c: CastlingRights): CastlingRights {
  return {
    [Color.White]: { ...c[Color.White] },
    [Color.Black]: { ...c[Color.Black] },
  };
}

export class Game {
  board: Board;
  turn: Color;
  castling: CastlingRights;
  enPassant: SquareIndex | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  history: MoveRecord[];

  constructor(fen?: string) {
    this.board = new Board();
    const state = this.board.loadFen(fen || STARTING_FEN);
    this.turn = state.turn;
    this.castling = state.castling;
    this.enPassant = state.enPassant;
    this.halfMoveClock = state.halfMoveClock;
    this.fullMoveNumber = state.fullMoveNumber;
    this.history = [];
  }

  /** Get all legal moves, optionally filtered to a specific square */
  getLegalMoves(square?: SquareIndex): Move[] {
    const pseudoLegal = generatePseudoLegalMoves(
      this.board,
      this.turn,
      this.enPassant,
    );
    const legal: Move[] = [];

    for (const move of pseudoLegal) {
      if (square !== undefined && move.from !== square) continue;
      if (this.isMoveLegal(move)) {
        legal.push(move);
      }
    }

    // Add castling moves
    const castlingMoves = this.generateCastlingMoves();
    if (square !== undefined) {
      legal.push(...castlingMoves.filter((m) => m.from === square));
    } else {
      legal.push(...castlingMoves);
    }

    return legal;
  }

  /** Check if a pseudo-legal move is legal (doesn't leave king in check) */
  private isMoveLegal(move: Move): boolean {
    const boardClone = this.board.clone();

    // Execute the move on the clone
    boardClone.remove(move.from);

    if (move.flags & MoveFlag.EnPassant) {
      // Remove the captured pawn
      const capturedSq = move.to + (this.turn === Color.White ? -16 : 16);
      boardClone.remove(capturedSq);
    }

    if (move.promotion) {
      boardClone.put(move.to, { type: move.promotion, color: this.turn });
    } else {
      boardClone.put(move.to, move.piece);
    }

    // Check if our king is in check after the move
    const kingSq =
      move.piece.type === PieceType.King
        ? move.to
        : boardClone.findKing(this.turn)!;

    return !isSquareAttacked(boardClone, kingSq, opponent(this.turn));
  }

  /** Generate castling moves if legal */
  private generateCastlingMoves(): Move[] {
    const moves: Move[] = [];
    const color = this.turn;
    const rank = color === Color.White ? 0 : 7;
    const kingSq = toIndex(4, rank);
    const king = this.board.get(kingSq);

    if (!king || king.type !== PieceType.King || king.color !== color)
      return moves;

    // Can't castle while in check
    if (isSquareAttacked(this.board, kingSq, opponent(color))) return moves;

    // Kingside
    if (this.castling[color].kingSide) {
      const f1 = toIndex(5, rank);
      const g1 = toIndex(6, rank);
      const rookSq = toIndex(7, rank);
      const rook = this.board.get(rookSq);

      if (
        rook &&
        rook.type === PieceType.Rook &&
        rook.color === color &&
        !this.board.get(f1) &&
        !this.board.get(g1) &&
        !isSquareAttacked(this.board, f1, opponent(color)) &&
        !isSquareAttacked(this.board, g1, opponent(color))
      ) {
        moves.push({
          from: kingSq,
          to: g1,
          piece: king,
          flags: MoveFlag.KingsideCastle,
        });
      }
    }

    // Queenside
    if (this.castling[color].queenSide) {
      const d1 = toIndex(3, rank);
      const c1 = toIndex(2, rank);
      const b1 = toIndex(1, rank);
      const rookSq = toIndex(0, rank);
      const rook = this.board.get(rookSq);

      if (
        rook &&
        rook.type === PieceType.Rook &&
        rook.color === color &&
        !this.board.get(d1) &&
        !this.board.get(c1) &&
        !this.board.get(b1) &&
        !isSquareAttacked(this.board, d1, opponent(color)) &&
        !isSquareAttacked(this.board, c1, opponent(color))
      ) {
        moves.push({
          from: kingSq,
          to: c1,
          piece: king,
          flags: MoveFlag.QueensideCastle,
        });
      }
    }

    return moves;
  }

  /** Make a move. Returns false if the move is illegal. */
  makeMove(move: Move): boolean {
    // Verify the move is in the legal move list
    const legalMoves = this.getLegalMoves(move.from);
    const legalMove = legalMoves.find(
      (m) =>
        m.from === move.from &&
        m.to === move.to &&
        m.promotion === move.promotion,
    );

    if (!legalMove) return false;

    // Save state for undo
    const allLegal = this.getLegalMoves();
    const san = moveToSan(
      { board: this.board, turn: this.turn, legalMoves: allLegal },
      legalMove,
    );
    const record: MoveRecord = {
      move: legalMove,
      san,
      fen: this.toFen(),
      previousCastling: cloneCastling(this.castling),
      previousEnPassant: this.enPassant,
      previousHalfMoveClock: this.halfMoveClock,
    };

    // Execute the move
    this.executeMove(legalMove);
    this.history.push(record);

    return true;
  }

  /** Execute a pre-validated move (skips legal move check). Used by plugins. */
  executeTrustedMove(move: Move): boolean {
    const allLegal = this.getLegalMoves();
    const san = moveToSan(
      { board: this.board, turn: this.turn, legalMoves: allLegal },
      move,
    );
    const record: MoveRecord = {
      move,
      san,
      fen: this.toFen(),
      previousCastling: cloneCastling(this.castling),
      previousEnPassant: this.enPassant,
      previousHalfMoveClock: this.halfMoveClock,
    };
    this.executeMove(move);
    this.history.push(record);
    return true;
  }

  /** Execute a move on the board (assumes move is legal) */
  private executeMove(move: Move): void {
    const piece = move.piece;

    // Update half-move clock
    if (piece.type === PieceType.Pawn || move.flags & MoveFlag.Capture) {
      this.halfMoveClock = 0;
    } else {
      this.halfMoveClock++;
    }

    // Handle en passant capture
    if (move.flags & MoveFlag.EnPassant) {
      const capturedSq = move.to + (this.turn === Color.White ? -16 : 16);
      this.board.remove(capturedSq);
    }

    // Handle castling
    if (move.flags & MoveFlag.KingsideCastle) {
      const rank = this.turn === Color.White ? 0 : 7;
      const rookFrom = toIndex(7, rank);
      const rookTo = toIndex(5, rank);
      const rook = this.board.remove(rookFrom)!;
      this.board.put(rookTo, rook);
    } else if (move.flags & MoveFlag.QueensideCastle) {
      const rank = this.turn === Color.White ? 0 : 7;
      const rookFrom = toIndex(0, rank);
      const rookTo = toIndex(3, rank);
      const rook = this.board.remove(rookFrom)!;
      this.board.put(rookTo, rook);
    }

    // Move the piece
    this.board.remove(move.from);
    if (move.promotion) {
      this.board.put(move.to, { type: move.promotion, color: this.turn });
    } else {
      this.board.put(move.to, piece);
    }

    // Update en passant square
    if (move.flags & MoveFlag.DoublePawnPush) {
      this.enPassant = move.from + (this.turn === Color.White ? 16 : -16);
    } else {
      this.enPassant = null;
    }

    // Update castling rights
    this.updateCastlingRights(move);

    // Switch turns
    if (this.turn === Color.Black) {
      this.fullMoveNumber++;
    }
    this.turn = opponent(this.turn);
  }

  private updateCastlingRights(move: Move): void {
    const piece = move.piece;

    // King moved
    if (piece.type === PieceType.King) {
      this.castling[piece.color].kingSide = false;
      this.castling[piece.color].queenSide = false;
    }

    // Rook moved or captured
    if (piece.type === PieceType.Rook) {
      if (move.from === toIndex(0, 0))
        this.castling[Color.White].queenSide = false;
      if (move.from === toIndex(7, 0))
        this.castling[Color.White].kingSide = false;
      if (move.from === toIndex(0, 7))
        this.castling[Color.Black].queenSide = false;
      if (move.from === toIndex(7, 7))
        this.castling[Color.Black].kingSide = false;
    }

    // Rook captured
    if (move.flags & MoveFlag.Capture) {
      if (move.to === toIndex(0, 0))
        this.castling[Color.White].queenSide = false;
      if (move.to === toIndex(7, 0))
        this.castling[Color.White].kingSide = false;
      if (move.to === toIndex(0, 7))
        this.castling[Color.Black].queenSide = false;
      if (move.to === toIndex(7, 7))
        this.castling[Color.Black].kingSide = false;
    }
  }

  /** Undo the last move */
  undoMove(): MoveRecord | null {
    const record = this.history.pop();
    if (!record) return null;

    const move = record.move;
    const color = opponent(this.turn); // the color that made the move

    // Restore piece to original square
    this.board.remove(move.to);
    this.board.put(move.from, move.piece);

    // Restore captured piece
    if (move.flags & MoveFlag.EnPassant) {
      const capturedSq = move.to + (color === Color.White ? -16 : 16);
      this.board.put(capturedSq, move.captured!);
    } else if (move.flags & MoveFlag.Capture) {
      this.board.put(move.to, move.captured!);
    }

    // Undo castling rook move
    if (move.flags & MoveFlag.KingsideCastle) {
      const rank = color === Color.White ? 0 : 7;
      const rook = this.board.remove(toIndex(5, rank))!;
      this.board.put(toIndex(7, rank), rook);
    } else if (move.flags & MoveFlag.QueensideCastle) {
      const rank = color === Color.White ? 0 : 7;
      const rook = this.board.remove(toIndex(3, rank))!;
      this.board.put(toIndex(0, rank), rook);
    }

    // Restore state
    this.castling = record.previousCastling;
    this.enPassant = record.previousEnPassant;
    this.halfMoveClock = record.previousHalfMoveClock;
    this.turn = color;
    if (color === Color.Black) {
      this.fullMoveNumber--;
    }

    return record;
  }

  /** Get the current game status */
  getStatus(): GameStatus {
    const legalMoves = this.getLegalMoves();
    const inCheck = this.isInCheck();

    if (legalMoves.length === 0) {
      return inCheck ? GameStatus.Checkmate : GameStatus.Stalemate;
    }

    if (inCheck) return GameStatus.Check;

    if (this.halfMoveClock >= 100) return GameStatus.DrawFiftyMove;

    if (this.isInsufficientMaterial())
      return GameStatus.DrawInsufficientMaterial;

    return GameStatus.Active;
  }

  /** Check if the current side's king is in check */
  isInCheck(): boolean {
    const kingSq = this.board.findKing(this.turn);
    if (!kingSq) return false;
    return isSquareAttacked(this.board, kingSq, opponent(this.turn));
  }

  /** Check for insufficient material */
  private isInsufficientMaterial(): boolean {
    const whitePieces = this.board.findPieces(Color.White);
    const blackPieces = this.board.findPieces(Color.Black);

    const whiteNonKing = whitePieces.filter(
      (p) => p.piece.type !== PieceType.King,
    );
    const blackNonKing = blackPieces.filter(
      (p) => p.piece.type !== PieceType.King,
    );

    // K vs K
    if (whiteNonKing.length === 0 && blackNonKing.length === 0) return true;

    // K+B vs K or K+N vs K
    if (whiteNonKing.length === 0 && blackNonKing.length === 1) {
      const t = blackNonKing[0].piece.type;
      if (t === PieceType.Bishop || t === PieceType.Knight) return true;
    }
    if (blackNonKing.length === 0 && whiteNonKing.length === 1) {
      const t = whiteNonKing[0].piece.type;
      if (t === PieceType.Bishop || t === PieceType.Knight) return true;
    }

    // K+B vs K+B with same-colored bishops
    if (
      whiteNonKing.length === 1 &&
      blackNonKing.length === 1 &&
      whiteNonKing[0].piece.type === PieceType.Bishop &&
      blackNonKing[0].piece.type === PieceType.Bishop
    ) {
      const wSq = whiteNonKing[0].sq;
      const bSq = blackNonKing[0].sq;
      const wSquareColor = (fileOf(wSq) + rankOf(wSq)) % 2;
      const bSquareColor = (fileOf(bSq) + rankOf(bSq)) % 2;
      if (wSquareColor === bSquareColor) return true;
    }

    return false;
  }

  /** Get FEN string for current position */
  toFen(): string {
    return this.board.toFen({
      turn: this.turn,
      castling: this.castling,
      enPassant: this.enPassant,
      halfMoveClock: this.halfMoveClock,
      fullMoveNumber: this.fullMoveNumber,
    });
  }

  /** Get a readonly snapshot of current state */
  getState(): GameState {
    return {
      board: this.board.squares,
      turn: this.turn,
      castling: cloneCastling(this.castling),
      enPassant: this.enPassant,
      halfMoveClock: this.halfMoveClock,
      fullMoveNumber: this.fullMoveNumber,
    };
  }
}
