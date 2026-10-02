export const Color = {
  White: "w",
  Black: "b",
} as const;
export type Color = (typeof Color)[keyof typeof Color];

export const PieceType = {
  Pawn: "p",
  Knight: "n",
  Bishop: "b",
  Rook: "r",
  Queen: "q",
  King: "k",
} as const;
export type PieceType = (typeof PieceType)[keyof typeof PieceType];

export interface Piece {
  type: PieceType;
  color: Color;
}

/** 0x88 square index (0-127, valid when (index & 0x88) === 0) */
export type SquareIndex = number;

export const MoveFlag = {
  Normal: 0,
  Capture: 1,
  EnPassant: 2,
  Promotion: 4,
  KingsideCastle: 8,
  QueensideCastle: 16,
  DoublePawnPush: 32,
  Portal: 64,
} as const;
export type MoveFlag = (typeof MoveFlag)[keyof typeof MoveFlag];

export interface Move {
  from: SquareIndex;
  to: SquareIndex;
  piece: Piece;
  captured?: Piece;
  promotion?: PieceType;
  flags: number;
}

/** How pawns of one color move when a mode turns the board: 0x88 offsets */
export interface PawnRule {
  forward: number;
  captures: [number, number];
}

/** Overrides for pawn movement; null means standard chess pawns */
export type PawnRules = Record<Color, PawnRule> | null;

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

export const GameStatus = {
  Active: "active",
  Check: "check",
  Checkmate: "checkmate",
  Stalemate: "stalemate",
  DrawFiftyMove: "draw_fifty_move",
  DrawInsufficientMaterial: "draw_insufficient_material",
} as const;
export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

export function isGameOver(status: GameStatus): boolean {
  return (
    status === GameStatus.Checkmate ||
    status === GameStatus.Stalemate ||
    status === GameStatus.DrawFiftyMove ||
    status === GameStatus.DrawInsufficientMaterial
  );
}

export interface MoveRecord {
  move: Move;
  san: string;
  fen: string;
  previousCastling: CastlingRights;
  previousEnPassant: SquareIndex | null;
  previousHalfMoveClock: number;
}
