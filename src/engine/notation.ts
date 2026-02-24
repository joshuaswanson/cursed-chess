import { Color, PieceType, MoveFlag } from "./types";
import type { Move } from "./types";
import { indexToAlgebraic, fileOf } from "../utils/squareUtils";
import { isSquareAttacked, opponent } from "./moves";
import type { Board } from "./board";

const PIECE_SYMBOLS: Record<string, string> = {
  [PieceType.King]: "K",
  [PieceType.Queen]: "Q",
  [PieceType.Rook]: "R",
  [PieceType.Bishop]: "B",
  [PieceType.Knight]: "N",
  [PieceType.Pawn]: "",
};

export interface SanContext {
  board: Board;
  turn: Color;
  legalMoves: Move[];
}

/** Convert a move to Standard Algebraic Notation */
export function moveToSan(ctx: SanContext, move: Move): string {
  if (move.flags & MoveFlag.KingsideCastle) return "O-O";
  if (move.flags & MoveFlag.QueensideCastle) return "O-O-O";

  let san = "";
  const piece = move.piece;

  if (piece.type !== PieceType.Pawn) {
    san += PIECE_SYMBOLS[piece.type];

    // Disambiguation
    const ambiguous = ctx.legalMoves.filter(
      (m) =>
        m.piece.type === piece.type && m.to === move.to && m.from !== move.from,
    );

    if (ambiguous.length > 0) {
      const sameFile = ambiguous.some(
        (m) => fileOf(m.from) === fileOf(move.from),
      );
      const sameRank = ambiguous.some((m) => m.from >> 4 === move.from >> 4);

      if (!sameFile) {
        san += indexToAlgebraic(move.from)[0];
      } else if (!sameRank) {
        san += indexToAlgebraic(move.from)[1];
      } else {
        san += indexToAlgebraic(move.from);
      }
    }
  }

  if (move.flags & MoveFlag.Capture) {
    if (piece.type === PieceType.Pawn) {
      san += indexToAlgebraic(move.from)[0];
    }
    san += "x";
  }

  san += indexToAlgebraic(move.to);

  if (move.promotion) {
    san += "=" + PIECE_SYMBOLS[move.promotion];
  }

  // Check / checkmate indicator
  const boardClone = ctx.board.clone();
  boardClone.remove(move.from);
  if (move.flags & MoveFlag.EnPassant) {
    const dir = ctx.turn === Color.White ? -16 : 16;
    boardClone.remove(move.to + dir);
  }
  if (move.flags & MoveFlag.KingsideCastle) {
    const rank = ctx.turn === Color.White ? 0 : 7;
    boardClone.remove(rank * 16 + 7);
    boardClone.put(rank * 16 + 5, { type: PieceType.Rook, color: ctx.turn });
  }
  if (move.flags & MoveFlag.QueensideCastle) {
    const rank = ctx.turn === Color.White ? 0 : 7;
    boardClone.remove(rank * 16);
    boardClone.put(rank * 16 + 3, { type: PieceType.Rook, color: ctx.turn });
  }
  if (move.promotion) {
    boardClone.put(move.to, { type: move.promotion, color: piece.color });
  } else {
    boardClone.put(move.to, piece);
  }

  const oppColor = opponent(ctx.turn);
  const oppKingSq = boardClone.findKing(oppColor);
  if (oppKingSq !== null && isSquareAttacked(boardClone, oppKingSq, ctx.turn)) {
    san += "+";
  }

  return san;
}
