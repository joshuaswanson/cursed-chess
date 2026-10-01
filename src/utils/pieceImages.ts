import type { Piece } from "../engine";

export function pieceImage(piece: Piece): string {
  return `/pieces/${piece.color}${piece.type.toUpperCase()}.svg`;
}
