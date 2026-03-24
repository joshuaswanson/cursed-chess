import {
  isValidHex,
  hexKey,
  Color,
  PieceType,
  ORTHO,
  DIAG,
  KNIGHT_OFFSETS,
  PAWN_FORWARD,
  PAWN_CAPTURES,
  PAWN_STARTS,
} from "./types";
import type { HexCoord, HexMove, Piece } from "./types";
import type { HexBoard } from "./board";

function opponent(c: Color): Color {
  return c === Color.White ? Color.Black : Color.White;
}

function minR(q: number): number {
  return Math.max(-5, -5 - q);
}

function maxR(q: number): number {
  return Math.min(5, 5 - q);
}

function isPromotionHex(q: number, r: number, color: Color): boolean {
  if (color === Color.White) return r === minR(q);
  return r === maxR(q);
}

function addPawnMoves(
  moves: HexMove[],
  from: HexCoord,
  to: HexCoord,
  piece: Piece,
  captured: Piece | undefined,
  color: Color,
): void {
  if (isPromotionHex(to.q, to.r, color)) {
    for (const promo of [
      PieceType.Queen,
      PieceType.Rook,
      PieceType.Bishop,
      PieceType.Knight,
    ]) {
      moves.push({ from, to, piece, captured, promotion: promo });
    }
  } else {
    moves.push({ from, to, piece, captured });
  }
}

function addSlidingMoves(
  moves: HexMove[],
  board: HexBoard,
  from: HexCoord,
  piece: Piece,
  directions: readonly HexCoord[],
): void {
  for (const dir of directions) {
    let sq = from.q + dir.q;
    let sr = from.r + dir.r;
    while (isValidHex(sq, sr)) {
      const target = board.get(sq, sr);
      if (target) {
        if (target.color !== piece.color) {
          moves.push({
            from,
            to: { q: sq, r: sr },
            piece,
            captured: target,
          });
        }
        break;
      }
      moves.push({ from, to: { q: sq, r: sr }, piece });
      sq += dir.q;
      sr += dir.r;
    }
  }
}

export function generatePseudoLegalMoves(
  board: HexBoard,
  color: Color,
  enPassant: HexCoord | null,
): HexMove[] {
  const moves: HexMove[] = [];
  const opp = opponent(color);

  for (const [coord, piece] of board.entries()) {
    if (piece.color !== color) continue;
    const { q, r } = coord;

    switch (piece.type) {
      case PieceType.Pawn: {
        const fwd = PAWN_FORWARD[color];
        const fq = q + fwd.q;
        const fr = r + fwd.r;

        // Forward 1
        if (isValidHex(fq, fr) && !board.has(fq, fr)) {
          addPawnMoves(moves, coord, { q: fq, r: fr }, piece, undefined, color);

          // Forward 2 (double push from starting position)
          const f2q = fq + fwd.q;
          const f2r = fr + fwd.r;
          if (
            PAWN_STARTS[color].has(hexKey(q, r)) &&
            isValidHex(f2q, f2r) &&
            !board.has(f2q, f2r)
          ) {
            moves.push({
              from: coord,
              to: { q: f2q, r: f2r },
              piece,
              isDoublePush: true,
            });
          }
        }

        // Captures
        for (const cap of PAWN_CAPTURES[color]) {
          const cq = q + cap.q;
          const cr = r + cap.r;
          if (!isValidHex(cq, cr)) continue;

          const target = board.get(cq, cr);
          if (target && target.color === opp) {
            addPawnMoves(moves, coord, { q: cq, r: cr }, piece, target, color);
          }

          // En passant
          if (enPassant && cq === enPassant.q && cr === enPassant.r) {
            const epFwd = PAWN_FORWARD[opp];
            const capturedPawn = board.get(
              enPassant.q + epFwd.q,
              enPassant.r + epFwd.r,
            );
            if (
              capturedPawn &&
              capturedPawn.type === PieceType.Pawn &&
              capturedPawn.color === opp
            ) {
              moves.push({
                from: coord,
                to: { q: cq, r: cr },
                piece,
                captured: capturedPawn,
                isEnPassant: true,
              });
            }
          }
        }
        break;
      }

      case PieceType.Knight: {
        for (const off of KNIGHT_OFFSETS) {
          const nq = q + off.q;
          const nr = r + off.r;
          if (!isValidHex(nq, nr)) continue;
          const target = board.get(nq, nr);
          if (target && target.color === color) continue;
          moves.push({
            from: coord,
            to: { q: nq, r: nr },
            piece,
            captured: target ?? undefined,
          });
        }
        break;
      }

      case PieceType.Bishop:
        addSlidingMoves(moves, board, coord, piece, DIAG);
        break;

      case PieceType.Rook:
        addSlidingMoves(moves, board, coord, piece, ORTHO);
        break;

      case PieceType.Queen:
        addSlidingMoves(moves, board, coord, piece, ORTHO);
        addSlidingMoves(moves, board, coord, piece, DIAG);
        break;

      case PieceType.King: {
        const allDirs = [...ORTHO, ...DIAG];
        for (const dir of allDirs) {
          const kq = q + dir.q;
          const kr = r + dir.r;
          if (!isValidHex(kq, kr)) continue;
          const target = board.get(kq, kr);
          if (target && target.color === color) continue;
          moves.push({
            from: coord,
            to: { q: kq, r: kr },
            piece,
            captured: target ?? undefined,
          });
        }
        break;
      }
    }
  }

  return moves;
}

export function isHexAttacked(
  board: HexBoard,
  target: HexCoord,
  byColor: Color,
): boolean {
  const { q: tq, r: tr } = target;

  // Knight attacks
  for (const off of KNIGHT_OFFSETS) {
    const nq = tq + off.q;
    const nr = tr + off.r;
    if (!isValidHex(nq, nr)) continue;
    const p = board.get(nq, nr);
    if (p && p.color === byColor && p.type === PieceType.Knight) return true;
  }

  // Orthogonal sliding attacks (rook, queen)
  for (const dir of ORTHO) {
    let sq = tq + dir.q;
    let sr = tr + dir.r;
    while (isValidHex(sq, sr)) {
      const p = board.get(sq, sr);
      if (p) {
        if (
          p.color === byColor &&
          (p.type === PieceType.Rook || p.type === PieceType.Queen)
        )
          return true;
        break;
      }
      sq += dir.q;
      sr += dir.r;
    }
  }

  // Diagonal sliding attacks (bishop, queen)
  for (const dir of DIAG) {
    let sq = tq + dir.q;
    let sr = tr + dir.r;
    while (isValidHex(sq, sr)) {
      const p = board.get(sq, sr);
      if (p) {
        if (
          p.color === byColor &&
          (p.type === PieceType.Bishop || p.type === PieceType.Queen)
        )
          return true;
        break;
      }
      sq += dir.q;
      sr += dir.r;
    }
  }

  // King attacks (1 step in any of 12 directions)
  for (const dir of [...ORTHO, ...DIAG]) {
    const kq = tq + dir.q;
    const kr = tr + dir.r;
    if (!isValidHex(kq, kr)) continue;
    const p = board.get(kq, kr);
    if (p && p.color === byColor && p.type === PieceType.King) return true;
  }

  // Pawn attacks (check if an enemy pawn could capture TO this square)
  for (const cap of PAWN_CAPTURES[byColor]) {
    const pq = tq - cap.q;
    const pr = tr - cap.r;
    if (!isValidHex(pq, pr)) continue;
    const p = board.get(pq, pr);
    if (p && p.color === byColor && p.type === PieceType.Pawn) return true;
  }

  return false;
}
