export enum Color {
  White = "w",
  Black = "b",
}

export enum PieceType {
  Pawn = "p",
  Knight = "n",
  Bishop = "b",
  Rook = "r",
  Queen = "q",
  King = "k",
}

export interface Piece {
  type: PieceType;
  color: Color;
}

/** 0x88 square index (0-127, valid when (index & 0x88) === 0) */
export type SquareIndex = number;

export enum MoveFlag {
  Normal = 0,
  Capture = 1 << 0,
  EnPassant = 1 << 1,
  Promotion = 1 << 2,
  KingsideCastle = 1 << 3,
  QueensideCastle = 1 << 4,
  DoublePawnPush = 1 << 5,
  Portal = 1 << 6,
}

export interface Move {
  from: SquareIndex;
  to: SquareIndex;
  piece: Piece;
  captured?: Piece;
  promotion?: PieceType;
  flags: number;
}

export interface CastlingRights {
  [Color.White]: { kingSide: boolean; queenSide: boolean };
  [Color.Black]: { kingSide: boolean; queenSide: boolean };
}

export interface GameState {
  board: (Piece | null)[];
  turn: Color;
  castling: CastlingRights;
  enPassant: SquareIndex | null;
  halfMoveClock: number;
  fullMoveNumber: number;
}

export enum GameStatus {
  Active = "active",
  Check = "check",
  Checkmate = "checkmate",
  Stalemate = "stalemate",
  DrawFiftyMove = "draw_fifty_move",
  DrawInsufficientMaterial = "draw_insufficient_material",
}

export interface MoveRecord {
  move: Move;
  san: string;
  fen: string;
  previousCastling: CastlingRights;
  previousEnPassant: SquareIndex | null;
  previousHalfMoveClock: number;
}
