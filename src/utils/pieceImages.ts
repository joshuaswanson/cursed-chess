import type { Piece } from "../engine";
import { useGameStore } from "../stores/gameStore";

/** Classic pieces while the game poses as a plain chess site, party pieces once cursed */
export function pieceImage(piece: Piece): string {
  const set = useGameStore.getState().cursed ? "party/" : "";
  return `/pieces/${set}${piece.color}${piece.type.toUpperCase()}.svg`;
}
