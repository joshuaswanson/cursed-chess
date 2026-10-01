import { Color, PieceType, MoveFlag } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type {
  ModePlugin,
  PluginContext,
  BoardOverlay,
  SquareModifier,
} from "./types";
import {
  fileOf,
  rankOf,
  isValidSquare,
  promotionRank,
  ALL_SQUARES,
} from "../utils/squareUtils";
import {
  isSquareAttacked,
  opponent,
  BISHOP_DIRECTIONS,
  ROOK_DIRECTIONS,
  QUEEN_DIRECTIONS,
} from "../engine/moves";

const SLIDING_DIRECTIONS: Partial<Record<PieceType, number[]>> = {
  [PieceType.Bishop]: BISHOP_DIRECTIONS,
  [PieceType.Rook]: ROOK_DIRECTIONS,
  [PieceType.Queen]: QUEEN_DIRECTIONS,
};

/** Unit 0x88 step from one square toward another, or null if they are not on a line */
function slidingDirection(
  from: SquareIndex,
  to: SquareIndex,
): number | null {
  const df = fileOf(to) - fileOf(from);
  const dr = rankOf(to) - rankOf(from);
  if (df === 0 && dr === 0) return null;
  if (df !== 0 && dr !== 0 && Math.abs(df) !== Math.abs(dr)) return null;
  return Math.sign(dr) * 16 + Math.sign(df);
}

export type PortalColor = "blue" | "orange";

export interface PortalTransit {
  entrance: SquareIndex;
  exit: SquareIndex;
  color: PortalColor;
}

export interface PortalMoveInfo {
  piece: Piece;
  from: SquareIndex;
  transits: PortalTransit[];
  landing: SquareIndex;
}

export interface PortalPair {
  a: SquareIndex;
  b: SquareIndex;
  color: PortalColor;
}

export class PortalChessPlugin implements ModePlugin {
  id = "portal-chess";
  name = "Portal Chess";
  description =
    "Portals spawn on the board. Pieces that enter one exit the other.";

  private portals: PortalPair[] = [];
  private portalRedirects = new Map<string, Move>();
  private moveCount = 0;
  private repositionInterval = 4;

  onGameStart(ctx: PluginContext): void {
    this.portals = [];
    this.moveCount = 0;
    this.spawnPortals(ctx);
  }

  onTurnEnd(ctx: PluginContext, color: Color): void {
    if (color === Color.Black) {
      this.moveCount++;
      if (this.moveCount % this.repositionInterval === 0) {
        this.spawnPortals(ctx);
      }
    }
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
        const dir = slidingDirection(move.from, move.to);
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
        rankOf(landSq) === promotionRank(color)
      ) {
        portalMove.promotion = PieceType.Queen;
        portalMove.flags = portalMove.flags | MoveFlag.Promotion;
      }
      this.addEntranceMove(result, move, portalMove);
    }

    // Entrance moves are judged by where the piece actually lands
    return result.filter((m) => {
      if (!(m.flags & MoveFlag.Portal)) return true;
      const landing =
        this.getPortalEntrance(m.to) !== null
          ? this.portalRedirects.get(`${m.from}-${m.to}`)
          : m;
      return landing !== undefined && this.keepsKingSafe(ctx, landing, color);
    });
  }

  private keepsKingSafe(ctx: PluginContext, move: Move, color: Color): boolean {
    const clone = ctx.board.clone();
    clone.remove(move.from);
    clone.put(move.to, move.piece);
    const kingSq = clone.findKing(color);
    if (kingSq === null) return true;
    return !isSquareAttacked(clone, kingSq, opponent(color));
  }

  /** Portal the selected piece would enter, for drawing the entrance-to-exit arrow */
  findEntrance(from: SquareIndex, moves: Move[]): SquareIndex | null {
    const distance = (sq: SquareIndex) =>
      Math.abs(fileOf(from) - fileOf(sq)) + Math.abs(rankOf(from) - rankOf(sq));
    const targeted = (sq: SquareIndex) =>
      moves.some((m) => m.to === sq && m.flags & MoveFlag.Portal);

    let best: SquareIndex | null = null;
    for (const { a, b } of this.portals) {
      const usesA = targeted(a);
      const usesB = targeted(b);
      if (!usesA && !usesB) continue;
      const candidate =
        usesA && usesB ? (distance(a) <= distance(b) ? a : b) : usesA ? a : b;
      if (best === null || distance(candidate) < distance(best)) {
        best = candidate;
      }
    }
    return best;
  }

  /** Reconstruct which portals a completed move passed through, for animation */
  traceMove(
    piece: Piece,
    from: SquareIndex,
    clickedTo: SquareIndex,
    landing: SquareIndex,
  ): PortalMoveInfo | null {
    const natural = slidingDirection(from, clickedTo);
    const directions = [
      ...(natural !== null ? [natural] : []),
      ...QUEEN_DIRECTIONS,
    ];
    for (const dir of directions) {
      const transits = this.walk(from, dir, landing);
      if (transits) return { piece, from, transits, landing };
    }

    // Knights, kings and pawns hop through the clicked portal directly
    const exit = this.getPortalExit(clickedTo);
    if (exit === null) return null;
    const transit = {
      entrance: clickedTo,
      exit,
      color: this.getPortalColor(clickedTo),
    };
    return { piece, from, transits: [transit], landing };
  }

  private walk(
    from: SquareIndex,
    dir: number,
    landing: SquareIndex,
  ): PortalTransit[] | null {
    const transits: PortalTransit[] = [];
    const visitedExits = new Set<SquareIndex>();
    let sq = from + dir;
    while (isValidSquare(sq)) {
      if (sq === landing && transits.length > 0) return transits;
      const exit = this.getPortalExit(sq);
      if (exit !== null) {
        if (visitedExits.has(exit)) return null;
        visitedExits.add(exit);
        transits.push({ entrance: sq, exit, color: this.getPortalColor(sq) });
        sq = exit + dir;
      } else {
        sq += dir;
      }
    }
    return null;
  }

  getBoardOverlays(): BoardOverlay[] {
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
    const empty = ALL_SQUARES.filter((sq) => !ctx.board.get(sq));
    if (empty.length < 4) return;

    for (let i = empty.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [empty[i], empty[j]] = [empty[j], empty[i]];
    }
    this.portals = [
      { a: empty[0], b: empty[1], color: "blue" },
      { a: empty[2], b: empty[3], color: "orange" },
    ];
  }

  /** Find all unoccupied, non-portal adjacent squares around a square */
  private getUnoccupiedAdjacent(
    ctx: PluginContext,
    sq: SquareIndex,
  ): SquareIndex[] {
    const result: SquareIndex[] = [];
    for (const dir of QUEEN_DIRECTIONS) {
      const target = sq + dir;
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

  private getPortalColor(sq: SquareIndex): PortalColor {
    return this.portals.find((p) => p.a === sq || p.b === sq)?.color ?? "blue";
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
      const dir = slidingDirection(move.from, move.to);
      if (dir === null || !directions.includes(dir)) return false;
      let sq = move.from + dir;
      while (sq !== move.to) {
        if (this.getPortalEntrance(sq) !== null) return true;
        sq = sq + dir;
      }
      return false;
    }

    // Pawns: double push — check intermediate square
    if (move.piece.type === PieceType.Pawn) {
      const dRank = rankOf(move.to) - rankOf(move.from);
      if (Math.abs(dRank) === 2) {
        const midSq = move.from + (dRank > 0 ? 16 : -16);
        if (this.getPortalEntrance(midSq) !== null) return true;
      }
    }

    return false;
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

    let sq = exitSq + direction;
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
          portalExit,
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
      sq = sq + direction;
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
