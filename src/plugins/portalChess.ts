import { Color, PieceType, MoveFlag } from "../engine/types";
import type { Move, SquareIndex } from "../engine/types";
import type {
  ModePlugin,
  PluginContext,
  BoardOverlay,
  SquareModifier,
} from "./types";
import { fileOf, rankOf, isValidSquare } from "../utils/squareUtils";

// Direction offsets in 0x88
const NORTH = 16;
const SOUTH = -16;
const EAST = 1;
const WEST = -1;
const NE = 17;
const NW = 15;
const SE = -15;
const SW = -17;

const SLIDING_DIRECTIONS: Record<string, number[]> = {
  [PieceType.Bishop]: [NE, NW, SE, SW],
  [PieceType.Rook]: [NORTH, SOUTH, EAST, WEST],
  [PieceType.Queen]: [NE, NW, SE, SW, NORTH, SOUTH, EAST, WEST],
};

export interface PortalPair {
  a: SquareIndex;
  b: SquareIndex;
  color: "blue" | "orange";
}

export class PortalChessPlugin implements ModePlugin {
  id = "portal-chess";
  name = "Portal Chess";
  description =
    "Portals spawn on the board. Pieces that enter one exit the other.";

  private portals: PortalPair[] = [];
  private portalRedirects = new Map<string, Move>();

  onGameStart(ctx: PluginContext): void {
    this.portals = [];
    this.spawnPortals(ctx);
  }

  onBeforeMove(_ctx: PluginContext, move: Move): Move | null {
    if (this.portals.length === 0) return move;
    const entrance = this.getPortalEntrance(move.to);
    if (entrance === null) return move;
    const redirected = this.portalRedirects.get(`${move.from}-${move.to}`);
    if (redirected) return redirected;
    // No redirect found — block the move to prevent landing on a portal
    return null;
  }

  modifyLegalMoves(ctx: PluginContext, moves: Move[], color: Color): Move[] {
    if (this.portals.length === 0) return moves;

    const result: Move[] = [];
    this.portalRedirects.clear();

    for (const move of moves) {
      const portalSq = this.getPortalEntrance(move.to);
      if (portalSq === null) {
        // Block moves that pass through a portal (except knights)
        if (this.isPathBlockedByPortal(move)) continue;
        result.push(move);
        continue;
      }

      const exitSq = this.getPortalExit(move.to);
      if (exitSq === null) {
        result.push(move);
        continue;
      }

      const exitPiece = ctx.board.get(exitSq);

      // For sliding pieces, the portal is transparent — continue sliding
      // from the exit without stopping on it
      const directions = SLIDING_DIRECTIONS[move.piece.type];
      if (directions) {
        const dir = this.getMoveDirection(move.from, move.to);
        if (dir !== null && directions.includes(dir)) {
          // Exit portal is blocked by any piece — can't pass through
          if (exitPiece) continue;
          // Empty exit — add continuation moves only (don't stop at exit)
          const beforeLen = result.length;
          this.addContinuationMoves(ctx, result, move, exitSq, dir, color);
          if (result.length > beforeLen) {
            this.addEntranceMove(result, move, result[beforeLen]);
          }
        }
        continue;
      }

      // Non-sliding pieces through portals
      if (exitPiece) continue; // exit blocked

      if (move.piece.type === PieceType.King) {
        // King exits one step in direction of movement
        const df = Math.sign(fileOf(move.to) - fileOf(move.from));
        const dr = Math.sign(rankOf(move.to) - rankOf(move.from));
        const stepDir = dr * 16 + df;
        const landSq = exitSq + stepDir;
        if (!isValidSquare(landSq)) continue;
        const landPiece = ctx.board.get(landSq);
        if (landPiece && landPiece.color === color) continue;
        const portalMove: Move = {
          from: move.from,
          to: landSq,
          piece: move.piece,
          captured: landPiece || undefined,
          flags: MoveFlag.Portal | (landPiece ? MoveFlag.Capture : 0),
        };
        result.push(portalMove);
        this.addEntranceMove(result, move, portalMove);
        continue;
      }

      // Knights and pawns: bounce to a random unoccupied square
      // adjacent to the exit portal (no capture through portals)
      const adjacent = this.getUnoccupiedAdjacent(ctx, exitSq);
      if (adjacent.length === 0) continue;
      const landSq = adjacent[Math.floor(Math.random() * adjacent.length)];
      const portalMove: Move = {
        from: move.from,
        to: landSq,
        piece: move.piece,
        flags: MoveFlag.Portal,
      };
      // Auto-promote pawn to queen if landing on last rank
      if (
        move.piece.type === PieceType.Pawn &&
        ((color === Color.White && rankOf(landSq) === 7) ||
          (color === Color.Black && rankOf(landSq) === 0))
      ) {
        portalMove.promotion = PieceType.Queen;
        portalMove.flags = portalMove.flags | MoveFlag.Promotion;
      }
      this.addEntranceMove(result, move, portalMove);
    }

    return result;
  }

  getBoardOverlays(_ctx: PluginContext): BoardOverlay[] {
    return this.portals.map((p) => ({
      type: "portal",
      squares: [p.a, p.b],
      data: { color: p.color },
    }));
  }

  getSquareModifiers(
    _ctx: PluginContext,
    square: SquareIndex,
  ): SquareModifier[] {
    for (const p of this.portals) {
      if (square === p.a || square === p.b) {
        return [{ className: `portal portal-${p.color}` }];
      }
    }
    return [];
  }

  private spawnPortals(ctx: PluginContext): void {
    const emptySquares: SquareIndex[] = [];
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const sq = (rank << 4) | file;
        if (!ctx.board.get(sq)) {
          emptySquares.push(sq);
        }
      }
    }

    if (emptySquares.length < 4) return;

    // Pick 4 random empty squares for 2 portal pairs
    const picked: number[] = [];
    while (picked.length < 4) {
      const idx = Math.floor(Math.random() * emptySquares.length);
      if (!picked.includes(idx)) {
        picked.push(idx);
      }
    }

    this.portals = [
      {
        a: emptySquares[picked[0]],
        b: emptySquares[picked[1]],
        color: "blue",
      },
      {
        a: emptySquares[picked[2]],
        b: emptySquares[picked[3]],
        color: "orange",
      },
    ];
  }

  /** Find all unoccupied, non-portal adjacent squares around a square */
  private getUnoccupiedAdjacent(
    ctx: PluginContext,
    sq: SquareIndex,
  ): SquareIndex[] {
    const dirs = [NORTH, SOUTH, EAST, WEST, NE, NW, SE, SW];
    const result: SquareIndex[] = [];
    for (const dir of dirs) {
      const target = (sq + dir) as SquareIndex;
      if (!isValidSquare(target)) continue;
      if (ctx.board.get(target)) continue;
      if (this.getPortalEntrance(target) !== null) continue;
      result.push(target);
    }
    return result;
  }

  private getPortalEntrance(sq: SquareIndex): SquareIndex | null {
    for (const p of this.portals) {
      if (sq === p.a || sq === p.b) return sq;
    }
    return null;
  }

  private getPortalExit(sq: SquareIndex): SquareIndex | null {
    for (const p of this.portals) {
      if (sq === p.a) return p.b;
      if (sq === p.b) return p.a;
    }
    return null;
  }

  /** Check if a move's path passes through any portal square */
  private isPathBlockedByPortal(move: Move): boolean {
    // Knights jump over everything
    if (move.piece.type === PieceType.Knight) return false;

    // Sliding pieces: check each intermediate square along the path
    const directions = SLIDING_DIRECTIONS[move.piece.type];
    if (directions) {
      const dir = this.getMoveDirection(move.from, move.to);
      if (dir === null || !directions.includes(dir)) return false;
      let sq = (move.from + dir) as SquareIndex;
      while (sq !== move.to) {
        if (this.getPortalEntrance(sq) !== null) return true;
        sq = (sq + dir) as SquareIndex;
      }
      return false;
    }

    // Pawns: double push — check intermediate square
    if (move.piece.type === PieceType.Pawn) {
      const dRank = rankOf(move.to) - rankOf(move.from);
      if (Math.abs(dRank) === 2) {
        const midSq = (move.from + (dRank > 0 ? NORTH : SOUTH)) as SquareIndex;
        if (this.getPortalEntrance(midSq) !== null) return true;
      }
    }

    return false;
  }

  private getMoveDirection(from: SquareIndex, to: SquareIndex): number | null {
    const df = fileOf(to) - fileOf(from);
    const dr = rankOf(to) - rankOf(from);
    const steps = Math.max(Math.abs(df), Math.abs(dr));
    if (steps === 0) return null;
    const dirFile = df / steps;
    const dirRank = dr / steps;
    return dirRank * 16 + dirFile;
  }

  private addContinuationMoves(
    ctx: PluginContext,
    result: Move[],
    originalMove: Move,
    exitSq: SquareIndex,
    direction: number,
    color: Color,
    visited?: Set<number>,
  ): void {
    // Track visited portal exits to prevent infinite loops
    if (!visited) {
      visited = new Set<number>();
    }
    visited.add(exitSq);

    let sq = (exitSq + direction) as SquareIndex;
    while (isValidSquare(sq)) {
      // Check if this square is a portal entrance
      const portalEntrance = this.getPortalEntrance(sq);
      if (portalEntrance !== null) {
        const portalExit = this.getPortalExit(sq);
        if (portalExit === null) break;
        // If exit is blocked by any piece, can't chain through
        const exitPiece = ctx.board.get(portalExit);
        if (exitPiece) break;
        // Prevent infinite loops — don't re-enter a portal we've already exited
        if (visited.has(portalExit)) break;
        // Recursively add continuation moves from the chained portal's exit
        this.addContinuationMoves(
          ctx,
          result,
          originalMove,
          portalExit as SquareIndex,
          direction,
          color,
          visited,
        );
        // Don't add a move landing on the portal square itself
        break;
      }

      const piece = ctx.board.get(sq);
      if (piece) {
        if (piece.color !== color) {
          result.push({
            from: originalMove.from,
            to: sq,
            piece: originalMove.piece,
            captured: piece,
            flags: MoveFlag.Portal | MoveFlag.Capture,
          });
        }
        break;
      }
      result.push({
        from: originalMove.from,
        to: sq,
        piece: originalMove.piece,
        flags: MoveFlag.Portal,
      });
      sq = (sq + direction) as SquareIndex;
    }
  }

  /** Add an entrance-portal move that redirects to the real landing move */
  private addEntranceMove(
    result: Move[],
    originalMove: Move,
    realMove: Move,
  ): void {
    const entranceMove: Move = {
      from: originalMove.from,
      to: originalMove.to,
      piece: originalMove.piece,
      flags: MoveFlag.Portal,
    };
    result.push(entranceMove);
    this.portalRedirects.set(
      `${originalMove.from}-${originalMove.to}`,
      realMove,
    );
  }
}
