import { Color, PieceType } from "./types";
import type { Piece, SquareIndex, CastlingRights, GameState } from "./types";
import { toIndex, isValidSquare, indexToAlgebraic } from "../utils/squareUtils";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const PIECE_CHARS: Record<string, { type: PieceType; color: Color }> = {
  P: { type: PieceType.Pawn, color: Color.White },
  N: { type: PieceType.Knight, color: Color.White },
  B: { type: PieceType.Bishop, color: Color.White },
  R: { type: PieceType.Rook, color: Color.White },
  Q: { type: PieceType.Queen, color: Color.White },
  K: { type: PieceType.King, color: Color.White },
  p: { type: PieceType.Pawn, color: Color.Black },
  n: { type: PieceType.Knight, color: Color.Black },
  b: { type: PieceType.Bishop, color: Color.Black },
  r: { type: PieceType.Rook, color: Color.Black },
  q: { type: PieceType.Queen, color: Color.Black },
  k: { type: PieceType.King, color: Color.Black },
};

function pieceToChar(piece: Piece): string {
  const c = piece.type as string;
  return piece.color === Color.White ? c.toUpperCase() : c;
}

export class Board {
  squares: (Piece | null)[];

  constructor() {
    this.squares = new Array(128).fill(null);
  }

  get(sq: SquareIndex): Piece | null {
    if (!isValidSquare(sq)) return null;
    return this.squares[sq];
  }

  put(sq: SquareIndex, piece: Piece): void {
    if (!isValidSquare(sq)) return;
    this.squares[sq] = piece;
  }

  remove(sq: SquareIndex): Piece | null {
    if (!isValidSquare(sq)) return null;
    const piece = this.squares[sq];
    this.squares[sq] = null;
    return piece;
  }

  findKing(color: Color): SquareIndex | null {
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const sq = toIndex(file, rank);
        const piece = this.squares[sq];
        if (piece && piece.type === PieceType.King && piece.color === color) {
          return sq;
        }
      }
    }
    return null;
  }

  findPieces(
    color: Color,
    type?: PieceType,
  ): { sq: SquareIndex; piece: Piece }[] {
    const result: { sq: SquareIndex; piece: Piece }[] = [];
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const sq = toIndex(file, rank);
        const piece = this.squares[sq];
        if (piece && piece.color === color && (!type || piece.type === type)) {
          result.push({ sq, piece });
        }
      }
    }
    return result;
  }

  clone(): Board {
    const copy = new Board();
    for (let i = 0; i < 128; i++) {
      copy.squares[i] = this.squares[i] ? { ...this.squares[i]! } : null;
    }
    return copy;
  }

  clear(): void {
    this.squares.fill(null);
  }

  loadFen(fen: string): GameState {
    const parts = fen.split(" ");
    const piecePlacement = parts[0];
    const activeColor = parts[1] || "w";
    const castling = parts[2] || "KQkq";
    const enPassant = parts[3] || "-";
    const halfMove = parseInt(parts[4] || "0");
    const fullMove = parseInt(parts[5] || "1");

    this.clear();

    // Parse piece placement
    let rank = 7;
    let file = 0;
    for (const ch of piecePlacement) {
      if (ch === "/") {
        rank--;
        file = 0;
      } else if (ch >= "1" && ch <= "8") {
        file += parseInt(ch);
      } else {
        const pieceInfo = PIECE_CHARS[ch];
        if (pieceInfo) {
          this.put(toIndex(file, rank), {
            type: pieceInfo.type,
            color: pieceInfo.color,
          });
          file++;
        }
      }
    }

    // Parse castling rights
    const castlingRights: CastlingRights = {
      [Color.White]: { kingSide: false, queenSide: false },
      [Color.Black]: { kingSide: false, queenSide: false },
    };
    if (castling !== "-") {
      if (castling.includes("K")) castlingRights[Color.White].kingSide = true;
      if (castling.includes("Q")) castlingRights[Color.White].queenSide = true;
      if (castling.includes("k")) castlingRights[Color.Black].kingSide = true;
      if (castling.includes("q")) castlingRights[Color.Black].queenSide = true;
    }

    // Parse en passant
    let enPassantSq: SquareIndex | null = null;
    if (enPassant !== "-") {
      const epFile = enPassant.charCodeAt(0) - 97;
      const epRank = parseInt(enPassant[1]) - 1;
      enPassantSq = toIndex(epFile, epRank);
    }

    return {
      board: this.squares,
      turn: activeColor === "w" ? Color.White : Color.Black,
      castling: castlingRights,
      enPassant: enPassantSq,
      halfMoveClock: halfMove,
      fullMoveNumber: fullMove,
    };
  }

  toFen(state: Omit<GameState, "board">): string {
    let fen = "";

    // Piece placement
    for (let rank = 7; rank >= 0; rank--) {
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const piece = this.squares[toIndex(file, rank)];
        if (piece) {
          if (empty > 0) {
            fen += empty;
            empty = 0;
          }
          fen += pieceToChar(piece);
        } else {
          empty++;
        }
      }
      if (empty > 0) fen += empty;
      if (rank > 0) fen += "/";
    }

    // Active color
    fen += " " + state.turn;

    // Castling
    let castlingStr = "";
    if (state.castling[Color.White].kingSide) castlingStr += "K";
    if (state.castling[Color.White].queenSide) castlingStr += "Q";
    if (state.castling[Color.Black].kingSide) castlingStr += "k";
    if (state.castling[Color.Black].queenSide) castlingStr += "q";
    fen += " " + (castlingStr || "-");

    // En passant
    fen +=
      " " +
      (state.enPassant !== null ? indexToAlgebraic(state.enPassant) : "-");

    // Half-move clock and full-move number
    fen += " " + state.halfMoveClock;
    fen += " " + state.fullMoveNumber;

    return fen;
  }

  static startingPosition(): { board: Board; state: GameState } {
    const board = new Board();
    const state = board.loadFen(STARTING_FEN);
    return { board, state };
  }

  /** Fill each side's half from its home rank outward: king and pieces first, then pawns. */
  placeArmy(color: Color, pieces: Piece[]): void {
    const homeRanks = color === Color.White ? [0, 1, 2, 3] : [7, 6, 5, 4];
    const cells = homeRanks.flatMap((rank) =>
      CENTER_OUT_FILES.map((file) => toIndex(file, rank)),
    );
    const pawnStart = CENTER_OUT_FILES.length;
    const placed = new Set<SquareIndex>();
    const take = (preferred: number) => {
      const sq =
        cells.slice(preferred).find((c) => !placed.has(c)) ??
        cells.find((c) => !placed.has(c));
      if (sq !== undefined) placed.add(sq);
      return sq;
    };

    const ordered = [...pieces].sort(
      (a, b) => PLACEMENT_ORDER[a.type] - PLACEMENT_ORDER[b.type],
    );
    for (const piece of ordered) {
      const sq = take(piece.type === PieceType.Pawn ? pawnStart : 0);
      if (sq === undefined) return;
      this.put(sq, { ...piece });
    }
  }
}

const CENTER_OUT_FILES = [4, 3, 5, 2, 6, 1, 7, 0];

const PLACEMENT_ORDER: Record<PieceType, number> = {
  [PieceType.King]: 0,
  [PieceType.Queen]: 1,
  [PieceType.Rook]: 2,
  [PieceType.Bishop]: 3,
  [PieceType.Knight]: 4,
  [PieceType.Pawn]: 5,
};

export { STARTING_FEN };
