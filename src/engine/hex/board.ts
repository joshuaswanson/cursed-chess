import { hexKey, isValidHex, parseHexKey } from "./types";
import { Color, PieceType } from "./types";
import type { HexCoord, Piece } from "./types";

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/** Place pieces: pawns in front cells, king + others in back cells */
/** Places the pieces and returns where each one landed */
function placeGroup(
  board: HexBoard,
  pieces: Piece[],
  front: HexCoord[],
  back: HexCoord[],
): Map<Piece, HexCoord> {
  const placed = new Map<Piece, HexCoord>();
  const kings: Piece[] = [];
  const pawns: Piece[] = [];
  const others: Piece[] = [];
  for (const p of pieces) {
    if (p.type === PieceType.King) kings.push(p);
    else if (p.type === PieceType.Pawn) pawns.push(p);
    else others.push(p);
  }

  const frontFirst = [...front, ...back];
  const backFirst = [...back, ...front];
  const used = new Set<HexCoord>();
  const place = (p: Piece, order: HexCoord[]) => {
    const cell = order.find((c) => !used.has(c));
    if (!cell) return;
    used.add(cell);
    board.set(cell.q, cell.r, p);
    placed.set(p, cell);
  };
  const placeBack = (p: Piece) => place(p, backFirst);
  const placeFront = (p: Piece) => place(p, frontFirst);

  for (const p of kings) placeBack(p);
  for (const p of others) placeBack(p);
  for (const p of pawns) placeFront(p);
  return placed;
}

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

  /**
   * Place surviving pieces from a standard game onto the hex board.
   * Uses visual y-position (q + 2r) to determine top/bottom halves,
   * since the axial r-axis runs diagonally, not vertically.
   */
  setupFromPieces(
    whitePieces: Piece[],
    blackPieces: Piece[],
  ): Map<Piece, HexCoord> {
    this.cells.clear();

    const whiteBack: HexCoord[] = [];
    const whiteFront: HexCoord[] = [];
    const blackBack: HexCoord[] = [];
    const blackFront: HexCoord[] = [];

    for (let q = -5; q <= 5; q++) {
      for (let r = -5; r <= 5; r++) {
        if (!isValidHex(q, r)) continue;
        // q + 2r is proportional to visual y (positive = bottom/White)
        const yMetric = q + 2 * r;
        if (yMetric >= 5) whiteBack.push({ q, r });
        else if (yMetric >= 1) whiteFront.push({ q, r });
        else if (yMetric <= -5) blackBack.push({ q, r });
        else if (yMetric <= -1) blackFront.push({ q, r });
      }
    }

    shuffle(whiteBack);
    shuffle(whiteFront);
    shuffle(blackBack);
    shuffle(blackFront);

    return new Map([
      ...placeGroup(this, whitePieces, whiteFront, whiteBack),
      ...placeGroup(this, blackPieces, blackFront, blackBack),
    ]);
  }
}
