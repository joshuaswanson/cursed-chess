import { hexKey, parseHexKey } from "./types";
import { Color, PieceType } from "./types";
import type { HexCoord, Piece } from "./types";

export class HexBoard {
  private cells = new Map<string, Piece>();

  get(q: number, r: number): Piece | null {
    return this.cells.get(hexKey(q, r)) ?? null;
  }

  getCoord(c: HexCoord): Piece | null {
    return this.cells.get(hexKey(c.q, c.r)) ?? null;
  }

  set(q: number, r: number, piece: Piece): void {
    this.cells.set(hexKey(q, r), piece);
  }

  remove(q: number, r: number): void {
    this.cells.delete(hexKey(q, r));
  }

  has(q: number, r: number): boolean {
    return this.cells.has(hexKey(q, r));
  }

  entries(): [HexCoord, Piece][] {
    const result: [HexCoord, Piece][] = [];
    for (const [key, piece] of this.cells) {
      result.push([parseHexKey(key), piece]);
    }
    return result;
  }

  findKing(color: Color): HexCoord | null {
    for (const [key, piece] of this.cells) {
      if (piece.type === PieceType.King && piece.color === color) {
        return parseHexKey(key);
      }
    }
    return null;
  }

  clone(): HexBoard {
    const b = new HexBoard();
    for (const [key, piece] of this.cells) {
      b.cells.set(key, { ...piece });
    }
    return b;
  }

  /** Set up Glinski's hexagonal chess starting position */
  setupInitial(): void {
    this.cells.clear();

    // White pieces
    this.set(0, 5, { type: PieceType.Bishop, color: Color.White });
    this.set(0, 3, { type: PieceType.Bishop, color: Color.White });
    this.set(0, 1, { type: PieceType.Bishop, color: Color.White });
    this.set(-1, 5, { type: PieceType.Queen, color: Color.White });
    this.set(1, 4, { type: PieceType.King, color: Color.White });
    this.set(-2, 5, { type: PieceType.Knight, color: Color.White });
    this.set(2, 3, { type: PieceType.Knight, color: Color.White });
    this.set(-3, 5, { type: PieceType.Rook, color: Color.White });
    this.set(3, 2, { type: PieceType.Rook, color: Color.White });

    // White pawns
    this.set(-4, 5, { type: PieceType.Pawn, color: Color.White });
    this.set(-3, 4, { type: PieceType.Pawn, color: Color.White });
    this.set(-2, 4, { type: PieceType.Pawn, color: Color.White });
    this.set(-1, 4, { type: PieceType.Pawn, color: Color.White });
    this.set(0, 4, { type: PieceType.Pawn, color: Color.White });
    this.set(1, 3, { type: PieceType.Pawn, color: Color.White });
    this.set(2, 2, { type: PieceType.Pawn, color: Color.White });
    this.set(3, 1, { type: PieceType.Pawn, color: Color.White });
    this.set(4, 1, { type: PieceType.Pawn, color: Color.White });

    // Black pieces (180-degree rotation: negate q and r)
    this.set(0, -5, { type: PieceType.Bishop, color: Color.Black });
    this.set(0, -3, { type: PieceType.Bishop, color: Color.Black });
    this.set(0, -1, { type: PieceType.Bishop, color: Color.Black });
    this.set(1, -5, { type: PieceType.Queen, color: Color.Black });
    this.set(-1, -4, { type: PieceType.King, color: Color.Black });
    this.set(2, -5, { type: PieceType.Knight, color: Color.Black });
    this.set(-2, -3, { type: PieceType.Knight, color: Color.Black });
    this.set(3, -5, { type: PieceType.Rook, color: Color.Black });
    this.set(-3, -2, { type: PieceType.Rook, color: Color.Black });

    // Black pawns
    this.set(4, -5, { type: PieceType.Pawn, color: Color.Black });
    this.set(3, -4, { type: PieceType.Pawn, color: Color.Black });
    this.set(2, -4, { type: PieceType.Pawn, color: Color.Black });
    this.set(1, -4, { type: PieceType.Pawn, color: Color.Black });
    this.set(0, -4, { type: PieceType.Pawn, color: Color.Black });
    this.set(-1, -3, { type: PieceType.Pawn, color: Color.Black });
    this.set(-2, -2, { type: PieceType.Pawn, color: Color.Black });
    this.set(-3, -1, { type: PieceType.Pawn, color: Color.Black });
    this.set(-4, -1, { type: PieceType.Pawn, color: Color.Black });
  }
}
