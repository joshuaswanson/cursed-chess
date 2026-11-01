import { Color, MoveFlag, PieceType } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import type { BoardOverlay, ModePlugin, PluginContext } from "./types";
import { ALL_SQUARES, fileOf, rankOf, toIndex } from "../utils/squareUtils";
import { DarkMemory } from "./darkMemory";

/** One of the lanterns on the board, and the square of whoever carries it, or where it lies */
export interface Lantern {
  id: number;
  sq: SquareIndex;
}

/** A lantern knocked flying by the last move, on its way to where it comes down */
export interface LanternFlight {
  id: number;
  lantern: number;
  from: SquareIndex;
  to: SquareIndex;
}

export interface LanternView {
  lanterns: Lantern[];
  flights: LanternFlight[];
}

/** How long a lantern spends in the air */
export const LANTERN_FLIGHT_MS = 1100;
/** How long the capture that knocks a lantern flying, and its flight, take to play out */
export const LANTERN_HOLD_MS = 2000;

/** How many lanterns each side starts with */
const LANTERNS_EACH = 2;
/** The files their first carriers are picked from, in order of preference: b and g first */
const CARRIER_FILES = [1, 6, 2, 5, 0, 7, 3, 4];

/**
 * The board is dark. Two pawns on each side carry a lantern, and only the
 * three by three squares round a lantern can be seen. Whoever takes a piece
 * carrying one carries it from then on, so there are always four alight. No
 * piece carries two: a lantern with nobody free to take it on goes flying to
 * a square nearby, and lies there, alight, until a piece picks it up.
 */
export class LanternsPlugin implements ModePlugin {
  id = "lanterns";
  name = "Lanterns";
  description =
    "The board is dark. Each lantern lights the squares round its carrier. Take a piece carrying one to carry it yourself.";

  private lanterns: Lantern[] = [];
  private flights: LanternFlight[] = [];
  private flightsEver = 0;
  private seen = new DarkMemory();

  onGameStart(ctx: PluginContext): void {
    this.lanterns = [Color.White, Color.Black]
      .flatMap((color) => this.firstCarriers(ctx.board, color))
      .map((sq, id) => ({ id, sq }));
    this.flights = [];
    this.seen.reset(ctx.board);
  }

  /** Whether the last move knocked a lantern flying */
  get flying(): boolean {
    return this.flights.length > 0;
  }

  /** Your pieces as Chessbot remembers them */
  memory(): ReadonlyMap<SquareIndex, Piece> {
    return this.seen.pieces();
  }

  /** Brings what he remembers up to date with whatever the lanterns light now */
  look(board: Board): void {
    this.seen.look(board, this.litSquares());
  }

  /** The pieces that start with a lantern: pawns where there are any, anyone but the king where there are not */
  private firstCarriers(board: Board, color: Color): SquareIndex[] {
    const byFile = (a: SquareIndex, b: SquareIndex) =>
      CARRIER_FILES.indexOf(fileOf(a)) - CARRIER_FILES.indexOf(fileOf(b));
    const mine = ALL_SQUARES.filter((sq) => board.get(sq)?.color === color);
    const pawns = mine
      .filter((sq) => board.get(sq)?.type === PieceType.Pawn)
      .sort(byFile);
    const others = mine
      .filter((sq) => {
        const type = board.get(sq)?.type;
        return type !== PieceType.Pawn && type !== PieceType.King;
      })
      .sort(byFile);
    return [...pawns, ...others].slice(0, LANTERNS_EACH);
  }

  onAfterMove(ctx: PluginContext, move: Move): void {
    // A pawn taken in passing stood beside the square the taker lands on
    const taken =
      move.flags & MoveFlag.EnPassant
        ? toIndex(fileOf(move.to), rankOf(move.from))
        : move.to;
    const rank = rankOf(move.from);
    // A rook that castles carries its lantern over the king with it
    const rookHop =
      move.flags & MoveFlag.KingsideCastle
        ? { from: toIndex(7, rank), to: toIndex(5, rank) }
        : move.flags & MoveFlag.QueensideCastle
          ? { from: toIndex(0, rank), to: toIndex(3, rank) }
          : null;
    const carried = this.lanterns.find((l) => l.sq === move.from);
    const hopping = this.lanterns.find((l) => l.sq === rookHop?.from);
    const seized = this.lanterns.find(
      (l) => move.captured && l.sq === taken && l !== carried,
    );
    if (carried) carried.sq = move.to;
    if (hopping && rookHop) hopping.sq = rookHop.to;
    if (seized && !carried) seized.sq = move.to;

    const held = [carried, hopping].filter((l) => l !== undefined);
    const knocked = this.lanterns.filter(
      (l) =>
        !held.includes(l) &&
        (l === seized ? !!carried : held.some((h) => h.sq === l.sq)),
    );
    const foe = move.piece.color === Color.White ? Color.Black : Color.White;
    this.flights = knocked.map((lantern) => {
      const from = lantern.sq;
      lantern.sq = this.landing(ctx.board, from, foe);
      return {
        id: ++this.flightsEver,
        lantern: lantern.id,
        from,
        to: lantern.sq,
      };
    });
    this.seen.notice(ctx.board, move, this.litSquares());
  }

  /**
   * Where a lantern knocked off `from` comes down: on a random empty square
   * beside it, or failing that a piece of `side` with no lantern, or failing
   * that any piece with no lantern. With four lanterns on the board, even a
   * corner always has a square free of them.
   */
  private landing(board: Board, from: SquareIndex, side: Color): SquareIndex {
    const lit = new Set(this.lanterns.map((lantern) => lantern.sq));
    const beside = ALL_SQUARES.filter(
      (sq) =>
        !lit.has(sq) &&
        Math.abs(fileOf(sq) - fileOf(from)) <= 1 &&
        Math.abs(rankOf(sq) - rankOf(from)) <= 1,
    );
    const empty = beside.filter((sq) => !board.get(sq));
    const friends = beside.filter((sq) => board.get(sq)?.color === side);
    const choices = [empty, friends, beside].find((sqs) => sqs.length > 0);
    return choices![Math.floor(Math.random() * choices!.length)];
  }

  /** The squares the lanterns light: each carrier's and the eight round it */
  litSquares(): Set<SquareIndex> {
    const lit = new Set<SquareIndex>();
    for (const { sq } of this.lanterns) {
      for (let df = -1; df <= 1; df++) {
        for (let dr = -1; dr <= 1; dr++) {
          const file = fileOf(sq) + df;
          const rank = rankOf(sq) + dr;
          if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
            lit.add(toIndex(file, rank));
          }
        }
      }
    }
    return lit;
  }

  getBoardOverlays(): BoardOverlay[] {
    const view: LanternView = {
      lanterns: this.lanterns.map((lantern) => ({ ...lantern })),
      flights: this.flights,
    };
    return [
      {
        type: "lanterns",
        squares: this.lanterns.map((lantern) => lantern.sq),
        data: view,
      },
    ];
  }
}
