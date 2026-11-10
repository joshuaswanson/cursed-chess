import { Color, GameStatus, MoveFlag, PieceType } from "../engine/types";
import type { Move, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import type { Game } from "../engine/game";
import type { ModePlugin, PluginContext } from "./types";
import { PIECE_VALUE } from "../ai/chooseMove";
import { ALL_SQUARES, toIndex } from "../utils/squareUtils";

/**
 * The Singularity Chess board, as H. G. Muller lays it out: a sheet of
 * twelve columns by six rows with two of its corners, two by two, cut away,
 * and the left half of its top edge folded over onto the right half. The
 * fold makes a cone, its tip the singularity in the middle of the top edge.
 * Row 0 runs along the fold, and the far side of the fold from a square in
 * row 0 is the square the same distance from the singularity on the other
 * half.
 */
export interface Cell {
  c: number;
  r: number;
}

const COLUMNS = 12;
const ROWS = 6;
/** The column whose left edge the singularity sits on top of */
const MIDDLE = 6;

const onSheet = (c: number, r: number) =>
  c >= 0 &&
  c < COLUMNS &&
  r >= 0 &&
  r < ROWS &&
  !((c < 2 || c >= COLUMNS - 2) && r >= ROWS - 2);

/** Every square of the board */
export const CELLS: Cell[] = Array.from({ length: COLUMNS * ROWS }, (_, i) => ({
  c: i % COLUMNS,
  r: Math.floor(i / COLUMNS),
})).filter(({ c, r }) => onSheet(c, r));

const cellKey = (c: number, r: number) => r * COLUMNS + c;
/** Each square of the board kept on a square of the engine's ordinary board */
const SQUARE_OF = new Map(
  CELLS.map(({ c, r }, i) => [cellKey(c, r), toIndex(i % 8, i >> 3)]),
);
const CELL_OF = new Map(
  CELLS.map(({ c, r }) => [SQUARE_OF.get(cellKey(c, r))!, { c, r }]),
);

export const squareOf = (c: number, r: number): SquareIndex =>
  SQUARE_OF.get(cellKey(c, r))!;
export const cellOf = (sq: SquareIndex): Cell | undefined => CELL_OF.get(sq);

/**
 * Where a square shows on the round board: its file, a to h, its ring out
 * from the singularity, 1 to 6, and its half, White's or Black's, or both
 * for the square of each file that lies across the middle
 */
export interface Place {
  file: number;
  ring: number;
  half: Color | null;
}

export function placeOf({ c, r }: Cell): Place {
  const right = c >= MIDDLE;
  const edge = right ? COLUMNS - 1 - c : c;
  const ring = Math.max(r, MIDDLE - 1 - edge) + 1;
  // Up the column from White's end, the file turns at the diagonal off the singularity
  const climbing = edge + r >= MIDDLE - 1;
  const file = climbing ? edge - 2 : MIDDLE - 3 - r;
  return {
    file: right ? 7 - file : file,
    ring,
    half:
      edge + r > MIDDLE - 1
        ? Color.White
        : edge + r < MIDDLE - 1
          ? Color.Black
          : null,
  };
}

/** A way to move one square: across a column, and along it, toward the fold when negative */
type Dir = [dc: number, dr: number];

interface Step {
  c: number;
  r: number;
  /** The way the move is heading once it is there, which the fold turns round */
  dir: Dir;
}

const STRAIGHT: Dir[] = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];
const DIAGONAL: Dir[] = [
  [1, -1],
  [-1, -1],
  [1, 1],
  [-1, 1],
];

/**
 * One square on: out through the side, or the corner, the move is heading
 * for, and in at the other side of it. Over the fold the move comes back
 * down the other half, turned round. A diagonal that runs into the
 * singularity itself turns a right angle there, onto the square on its other
 * side, and so onto squares of the other colour.
 */
function step(c: number, r: number, [dc, dr]: Dir): Step | null {
  const nc = c + dc;
  const nr = r + dr;
  if (nr >= 0) return onSheet(nc, nr) ? { c: nc, r: nr, dir: [dc, dr] } : null;
  if (dc !== 0 && c + (dc > 0 ? 1 : 0) === MIDDLE) {
    return { c: nc, r: 0, dir: [dc, 1] };
  }
  const over = COLUMNS - 1 - nc;
  return onSheet(over, 0) ? { c: over, r: 0, dir: [-dc, 1] } : null;
}

const other = (color: Color) =>
  color === Color.White ? Color.Black : Color.White;

/**
 * Which way is forward for a pawn on a square: along its file toward the
 * other end. Up White's half that is toward the fold, until the file turns
 * at the middle and runs sideways out to the edge where Black starts.
 */
function forward({ c, r }: Cell, color: Color): Dir {
  const right = c >= MIDDLE;
  const edge = right ? COLUMNS - 1 - c : c;
  const outward = right ? 1 : -1;
  if (color === Color.White)
    return edge + r > MIDDLE - 1 ? [0, -1] : [outward, 0];
  return edge + r < MIDDLE - 1 ? [-outward, 0] : [0, 1];
}

/** The two ways a pawn takes: through the corners either side of its step forward */
const captureDirs = ([dc, dr]: Dir): Dir[] =>
  dc === 0
    ? [
        [-1, dr],
        [1, dr],
      ]
    : [
        [dc, -1],
        [dc, 1],
      ];

const isWhiteHome = ({ r }: Cell) => r === ROWS - 1;
const isBlackHome = ({ c }: Cell) => c === 0 || c === COLUMNS - 1;

/** The back rank each side starts on, a file to h file */
const HOME: Record<Color, Cell[]> = {
  [Color.White]: [2, 3, 4, 5, 6, 7, 8, 9].map((c) => ({ c, r: ROWS - 1 })),
  [Color.Black]: [
    { c: 0, r: 3 },
    { c: 0, r: 2 },
    { c: 0, r: 1 },
    { c: 0, r: 0 },
    { c: 11, r: 0 },
    { c: 11, r: 1 },
    { c: 11, r: 2 },
    { c: 11, r: 3 },
  ],
};
const PAWNS: Record<Color, Cell[]> = {
  [Color.White]: [2, 3, 4, 5, 6, 7, 8, 9].map((c) => ({ c, r: ROWS - 2 })),
  [Color.Black]: HOME[Color.Black].map(({ c, r }) => ({
    c: c === 0 ? 1 : 10,
    r,
  })),
};
const BACK_RANK = [
  PieceType.Rook,
  PieceType.Knight,
  PieceType.Bishop,
  PieceType.Queen,
  PieceType.King,
  PieceType.Bishop,
  PieceType.Knight,
  PieceType.Rook,
];
const PROMOTIONS = [
  PieceType.Queen,
  PieceType.Rook,
  PieceType.Bishop,
  PieceType.Knight,
];

/** The squares each move passes over on its way, its landing square last */
const ROUTE = new WeakMap<Move, SquareIndex[]>();

/** Every move `color` has, leaving its king in check or not */
function pseudoMoves(board: Board, color: Color): Move[] {
  const moves: Move[] = [];
  const at = (cell: Cell) => board.get(squareOf(cell.c, cell.r));
  for (const from of CELLS) {
    const piece = at(from);
    if (piece?.color !== color) continue;
    const fromSq = squareOf(from.c, from.r);
    /**
     * A move to `to` by way of `via`, as long as no piece of its own is
     * there and `quiet` or `takes` allows it
     */
    const add = (to: Cell, quiet = true, takes = true, via: Cell[] = []) => {
      if (to.c === from.c && to.r === from.r) return;
      const toSq = squareOf(to.c, to.r);
      const there = board.get(toSq) ?? undefined;
      if (there?.color === color) return;
      if (there ? !takes : !quiet) return;
      if (moves.some((m) => m.from === fromSq && m.to === toSq)) return;
      const promotes =
        piece.type === PieceType.Pawn &&
        (color === Color.White ? isBlackHome(to) : isWhiteHome(to));
      const route = [...via, to].map(({ c, r }) => squareOf(c, r));
      for (const promotion of promotes ? PROMOTIONS : [undefined]) {
        const move: Move = {
          from: fromSq,
          to: toSq,
          piece,
          captured: there,
          promotion,
          flags:
            MoveFlag.ModeMove |
            (there ? MoveFlag.Capture : 0) |
            (promotion ? MoveFlag.Promotion : 0),
        };
        ROUTE.set(move, route);
        moves.push(move);
      }
    };
    const slide = (dirs: Dir[], reach: number) => {
      for (const dir of dirs) {
        let here: Step = { ...from, dir };
        const passed = new Set([cellKey(from.c, from.r)]);
        const way: Cell[] = [];
        for (let i = 0; i < reach; i++) {
          const next = step(here.c, here.r, here.dir);
          if (!next || passed.has(cellKey(next.c, next.r))) break;
          passed.add(cellKey(next.c, next.r));
          add(next, true, true, [...way]);
          way.push(next);
          if (at(next)) break;
          here = next;
        }
      }
    };
    switch (piece.type) {
      case PieceType.Rook:
        slide(STRAIGHT, CELLS.length);
        break;
      case PieceType.Bishop:
        slide(DIAGONAL, CELLS.length);
        break;
      case PieceType.Queen:
        slide([...STRAIGHT, ...DIAGONAL], CELLS.length);
        break;
      case PieceType.King:
        slide([...STRAIGHT, ...DIAGONAL], 1);
        break;
      case PieceType.Knight: {
        // A step straight and one diagonally on outward, or the other way round
        for (const dir of STRAIGHT) {
          const first = step(from.c, from.r, dir);
          if (!first) continue;
          const [dc, dr] = first.dir;
          const sideways: Dir[] =
            dc === 0
              ? [
                  [-1, dr],
                  [1, dr],
                ]
              : [
                  [dc, -1],
                  [dc, 1],
                ];
          for (const turn of sideways) {
            const to = step(first.c, first.r, turn);
            if (to) add(to, true, true, [first]);
          }
        }
        for (const dir of DIAGONAL) {
          const first = step(from.c, from.r, dir);
          if (!first) continue;
          const [dc, dr] = first.dir;
          for (const on of [
            [dc, 0],
            [0, dr],
          ] as Dir[]) {
            const to = step(first.c, first.r, on);
            if (to) add(to, true, true, [first]);
          }
        }
        break;
      }
      case PieceType.Pawn: {
        const ahead = forward(from, color);
        const one = step(from.c, from.r, ahead);
        if (one && !at(one)) {
          add(one, true, false);
          const starting = PAWNS[color].some(
            (p) => p.c === from.c && p.r === from.r,
          );
          // The first step can be two, as long as it stays out of the other side's half
          const two = starting && step(one.c, one.r, forward(one, color));
          if (two && !at(two) && placeOf(two).half !== other(color)) {
            add(two, true, false, [one]);
          }
        }
        for (const dir of captureDirs(ahead)) {
          const to = step(from.c, from.r, dir);
          if (to) add(to, false, true);
        }
        break;
      }
    }
  }
  return moves;
}

function kingOf(board: Board, color: Color): SquareIndex | null {
  for (const { c, r } of CELLS) {
    const piece = board.get(squareOf(c, r));
    if (piece?.type === PieceType.King && piece.color === color) {
      return squareOf(c, r);
    }
  }
  return null;
}

/** Whether `color`'s king could be taken, if it were the other side's move */
function inCheck(board: Board, color: Color): boolean {
  const king = kingOf(board, color);
  return (
    king !== null &&
    pseudoMoves(board, other(color)).some((move) => move.to === king)
  );
}

function played(board: Board, move: Move): Board {
  const after = board.clone();
  after.remove(move.from);
  after.put(
    move.to,
    move.promotion ? { ...move.piece, type: move.promotion } : move.piece,
  );
  return after;
}

/** Every move `color` has that does not leave its own king in check */
function legalMoves(board: Board, color: Color): Move[] {
  return pseudoMoves(board, color).filter(
    (move) => !inCheck(played(board, move), color),
  );
}

const MATE_SCORE = 10_000;
const STALEMATE_COST = 5;
/** How much of what a reply could win Chessbot counts against a move */
const CAUTION = 0.9;
const CHECK_WORTH = 0.3;
/** What each move his pieces would have afterwards is worth to him */
const MOBILITY_WORTH = 0.02;
/** How much chance sways him between moves that are much alike */
const WHIM = 0.3;

/** How long a piece takes to travel a way of so many squares */
export const travelMs = (squares: number) =>
  Math.min(TRAVEL_MAX_MS, Math.max(TRAVEL_MIN_MS, squares * TRAVEL_STEP_MS));
const TRAVEL_STEP_MS = 130;
const TRAVEL_MIN_MS = 220;
const TRAVEL_MAX_MS = 1500;

/**
 * Singularity Chess. The board is curved round a singularity in the middle,
 * so a straight move goes in at one side of a square and out at the side
 * opposite, and a diagonal one in at a corner and out at the corner
 * opposite, wherever that leads. Rooks can loop round the middle and come
 * back to their own side, a bishop can attack the same square two ways, and
 * a bishop that crosses the singularity comes out on the other colour. Pawns
 * follow their file, round the bend at the middle, to the far end, and the
 * two squares of a first move cannot reach into the other side's half.
 * There is no castling and no taking in passing.
 */
export class SingularityPlugin implements ModePlugin {
  id = "singularity";
  name = "Singularity";
  description =
    "The board curves round a singularity in the middle. Moves follow the curve.";

  /** The moves for the last position asked about */
  private found: { fen: string; moves: Move[] } | null = null;
  /** The way the last move went, square by square, its landing square last */
  route: SquareIndex[] = [];

  onGameStart(ctx: PluginContext): void {
    const { board } = ctx;
    for (const sq of ALL_SQUARES) board.remove(sq);
    for (const color of [Color.White, Color.Black]) {
      HOME[color].forEach(({ c, r }, file) =>
        board.put(squareOf(c, r), { type: BACK_RANK[file], color }),
      );
      for (const { c, r } of PAWNS[color]) {
        board.put(squareOf(c, r), { type: PieceType.Pawn, color });
      }
    }
    ctx.game.castling = {
      w: { kingSide: false, queenSide: false },
      b: { kingSide: false, queenSide: false },
    };
    ctx.game.enPassant = null;
    this.found = null;
  }

  private moves(game: Game): Move[] {
    const fen = game.toFen();
    if (this.found?.fen !== fen) {
      this.found = { fen, moves: legalMoves(game.board, game.turn) };
    }
    return this.found.moves;
  }

  modifyLegalMoves(ctx: PluginContext): Move[] {
    return this.moves(ctx.game);
  }

  onBeforeMove(_ctx: PluginContext, move: Move): Move {
    this.route = ROUTE.get(move) ?? [move.to];
    return move;
  }

  onAfterMove(ctx: PluginContext): void {
    ctx.game.enPassant = null;
  }

  holdAfterMoveMs(): number {
    return travelMs(this.route.length);
  }

  modifyGameStatus(ctx: PluginContext): GameStatus {
    const { game } = ctx;
    const checked = inCheck(game.board, game.turn);
    if (this.moves(game).length > 0) {
      return checked ? GameStatus.Check : GameStatus.Active;
    }
    return checked ? GameStatus.Checkmate : GameStatus.Stalemate;
  }

  /** The square of the king of the side to move, when it is in check */
  checkedKing(board: Board, turn: Color): SquareIndex | null {
    return inCheck(board, turn) ? kingOf(board, turn) : null;
  }

  /**
   * Chessbot's move: mate if he has one, then whatever leaves him best off
   * once your best reply has been made and he has taken back what he can,
   * with a little weight on keeping his pieces free to move
   */
  choose(game: Game, moves: Move[]): Move {
    const me = game.turn;
    const foe = other(me);
    const gain = (move: Move) =>
      (move.captured ? PIECE_VALUE[move.captured.type] : 0) +
      (move.promotion
        ? PIECE_VALUE[move.promotion] - PIECE_VALUE[PieceType.Pawn]
        : 0);
    let best = moves[0];
    let bestScore = -Infinity;
    for (const move of moves) {
      const after = played(game.board, move);
      const replies = legalMoves(after, foe);
      let score = gain(move);
      if (replies.length === 0) {
        score += inCheck(after, foe) ? MATE_SCORE : -STALEMATE_COST;
      } else {
        const worstReply = Math.max(
          0,
          ...replies
            .filter((reply) => gain(reply) > 0)
            .map((reply) => {
              const takenBack = pseudoMoves(played(after, reply), me).some(
                (back) => back.to === reply.to,
              );
              const lost = PIECE_VALUE[reply.promotion ?? reply.piece.type];
              return (
                gain(reply) - (takenBack ? Math.min(lost, gain(reply)) : 0)
              );
            }),
        );
        score -= worstReply * CAUTION;
        if (inCheck(after, foe)) score += CHECK_WORTH;
        score += pseudoMoves(after, me).length * MOBILITY_WORTH;
      }
      score += Math.random() * WHIM;
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    return best;
  }
}
