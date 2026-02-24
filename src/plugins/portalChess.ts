import { Color, PieceType, MoveFlag } from "../engine/types";
import type { Move, SquareIndex, Piece } from "../engine/types";
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
  private turnCount = 0;
  private spawnInterval = 5;
  private portalRedirects = new Map<string, Move>();

  onGameStart(ctx: PluginContext): void {
    this.portals = [];
    this.turnCount = 0;
    this.spawnPortals(ctx);
  }

  onTurnEnd(ctx: PluginContext, color: Color): void {
    if (color === Color.Black) {
      this.turnCount++;
      if (this.turnCount % this.spawnInterval === 0) {
        this.spawnPortals(ctx);
      }
    }
  }

  onBeforeMove(ctx: PluginContext, move: Move): Move | null {
    if (this.portals.length === 0) return move;
    const entrance = this.getPortalEntrance(move.to);
    if (entrance === null) return move;
    const redirected = this.portalRedirects.get(`${move.from}-${move.to}`);
    if (redirected) return redirected;
    return move;
  }

  modifyLegalMoves(ctx: PluginContext, moves: Move[], color: Color): Move[] {
    if (this.portals.length === 0) return moves;

    const result: Move[] = [];
    this.portalRedirects.clear();

    for (const move of moves) {
      const portalSq = this.getPortalEntrance(move.to);
      if (portalSq === null) {
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
          // Exit square is blocked by friendly piece — can't pass through
          if (exitPiece && exitPiece.color === color) continue;
          // Exit square has enemy piece — can capture but can't continue
          if (exitPiece && exitPiece.color !== color) {
            const captureMove: Move = {
              from: move.from,
              to: exitSq,
              piece: move.piece,
              captured: exitPiece,
              flags: MoveFlag.Portal | MoveFlag.Capture,
            };
            result.push(captureMove);
            this.addEntranceMove(result, move, captureMove);
            continue;
          }
          // Empty exit — add continuation moves only (don't stop at exit)
          const beforeLen = result.length;
          this.addContinuationMoves(ctx, result, move, exitSq, dir, color);
          if (result.length > beforeLen) {
            this.addEntranceMove(result, move, result[beforeLen]);
          }
        }
        continue;
      }

      // Non-sliding pieces (knight, king, pawn) exit one step beyond
      // the portal in their direction of movement
      if (exitPiece) continue; // exit blocked, can't pass through

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

      // Handle pawn promotion through portal
      if (
        move.piece.type === PieceType.Pawn &&
        ((color === Color.White && rankOf(landSq) === 7) ||
          (color === Color.Black && rankOf(landSq) === 0))
      ) {
        for (const promo of [
          PieceType.Queen,
          PieceType.Rook,
          PieceType.Bishop,
          PieceType.Knight,
        ]) {
          result.push({
            ...portalMove,
            promotion: promo,
            flags: portalMove.flags | MoveFlag.Promotion,
          });
        }
      } else {
        result.push(portalMove);
      }

      this.addEntranceMove(result, move, portalMove);
    }

    return result;
  }

  getBoardOverlays(ctx: PluginContext): BoardOverlay[] {
    return this.portals.map((p) => ({
      type: "portal",
      squares: [p.a, p.b],
      data: { color: p.color },
    }));
  }

  getSquareModifiers(
    ctx: PluginContext,
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
  ): void {
    let sq = exitSq + direction;
    while (isValidSquare(sq)) {
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
      sq += direction;
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
