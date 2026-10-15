import { Color, GameStatus, MoveFlag, PieceType } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import type { Game } from "../engine/game";
import type {
  BoardOverlay,
  ModePlugin,
  PluginContext,
  SquareModifier,
} from "./types";
import { PIECE_VALUE } from "../ai/chooseMove";
import { ALL_SQUARES, fileOf, rankOf, toIndex } from "../utils/squareUtils";

/** The ranks with a tunnel at each end: a piece can leave by one side and come in at the other */
export const TUNNEL_RANKS = [3, 4];
/** Where the power pellets go: the four middle squares, which neither side can reach without the other close by */
const POWER_SPOTS = [
  toIndex(3, 3),
  toIndex(4, 3),
  toIndex(3, 4),
  toIndex(4, 4),
];
/** How many of its own moves a side can take pieces for after eating a power pellet */
export const POWER_MOVES = 3;
export const PELLET_POINTS = 10;
export const POWER_POINTS = 50;
export const GHOST_POINTS = 200;
/** Moves in a row without a pellet eaten, after which the game is called on points */
const STALL_PLIES = 30;

const KNIGHT: [number, number][] = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];
const DIAGONALS: [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const STRAIGHTS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** A move and every square it passes over on the way, its landing square last */
export interface PacStep {
  move: Move;
  path: SquareIndex[];
}

/** The last move played: the way it went, and what it ate */
export interface PacRun {
  id: number;
  from: SquareIndex;
  to: SquareIndex;
  path: SquareIndex[];
  eaten: SquareIndex[];
  /** The power pellets among them */
  powerEaten: SquareIndex[];
  power: boolean;
  ghost: boolean;
  /** Which side ate */
  color: Color;
}

export interface PacView {
  pellets: SquareIndex[];
  power: SquareIndex[];
  /** How many pellets of either kind there were at the start */
  total: number;
  score: Record<Color, number>;
  /** How many more of its own moves each side can take pieces for */
  powerLeft: Record<Color, number>;
  run: PacRun | null;
}

const other = (color: Color) =>
  color === Color.White ? Color.Black : Color.White;

/** One step from a square, through the tunnel when it leads off a side on a tunnel rank */
function step(sq: SquareIndex, df: number, dr: number): SquareIndex | null {
  const fromRank = rankOf(sq);
  const rank = fromRank + dr;
  if (rank < 0 || rank > 7) return null;
  let file = fileOf(sq) + df;
  if (file < 0 || file > 7) {
    if (!TUNNEL_RANKS.includes(fromRank) || !TUNNEL_RANKS.includes(rank)) {
      return null;
    }
    file = (file + 8) % 8;
  }
  return toIndex(file, rank);
}

/**
 * Every move a side has, through the tunnels too. Pieces only take each
 * other when `canTake`, and there are no kings to keep out of check.
 */
export function pacSteps(
  board: Board,
  color: Color,
  canTake: boolean,
): PacStep[] {
  const steps: PacStep[] = [];
  const add = (
    from: SquareIndex,
    piece: Piece,
    path: SquareIndex[],
    promote = false,
  ) => {
    const to = path[path.length - 1];
    const captured = board.get(to) ?? undefined;
    const flags =
      MoveFlag.ModeMove |
      (captured ? MoveFlag.Capture : 0) |
      (promote ? MoveFlag.Promotion : 0);
    const promotions = promote
      ? [PieceType.Queen, PieceType.Rook, PieceType.Bishop, PieceType.Knight]
      : [undefined];
    for (const promotion of promotions) {
      steps.push({
        move: { from, to, piece, captured, promotion, flags },
        path,
      });
    }
  };
  /** Whether a piece can land on a square: an empty one, or one of theirs while it may take */
  const open = (sq: SquareIndex) => {
    const there = board.get(sq);
    return !there || (canTake && there.color !== color);
  };

  for (const from of ALL_SQUARES) {
    const piece = board.get(from);
    if (piece?.color !== color) continue;
    const slide = (dirs: [number, number][], reach: number) => {
      for (const [df, dr] of dirs) {
        const path: SquareIndex[] = [];
        let at = from;
        for (let i = 0; i < reach; i++) {
          const next = step(at, df, dr);
          if (next === null || next === from || !open(next)) break;
          path.push(next);
          add(from, piece, [...path]);
          if (board.get(next)) break;
          at = next;
        }
      }
    };
    switch (piece.type) {
      case PieceType.Rook:
        slide(STRAIGHTS, 7);
        break;
      case PieceType.Bishop:
        slide(DIAGONALS, 7);
        break;
      case PieceType.Queen:
        slide([...STRAIGHTS, ...DIAGONALS], 7);
        break;
      case PieceType.King:
        slide([...STRAIGHTS, ...DIAGONALS], 1);
        break;
      case PieceType.Knight:
        for (const [df, dr] of KNIGHT) {
          const to = step(from, df, dr);
          if (to !== null && open(to)) add(from, piece, [to]);
        }
        break;
      case PieceType.Pawn: {
        const ahead = color === Color.White ? 1 : -1;
        const lastRank = color === Color.White ? 7 : 0;
        const startRank = color === Color.White ? 1 : 6;
        const one = step(from, 0, ahead);
        if (one !== null && !board.get(one)) {
          add(from, piece, [one], rankOf(one) === lastRank);
          const two = step(one, 0, ahead);
          if (rankOf(from) === startRank && two !== null && !board.get(two)) {
            add(from, piece, [one, two]);
          }
        }
        if (canTake) {
          for (const df of [-1, 1]) {
            const to = step(from, df, ahead);
            const there = to === null ? null : board.get(to);
            if (to !== null && there && there.color !== color) {
              add(from, piece, [to], rankOf(to) === lastRank);
            }
          }
        }
        break;
      }
    }
  }
  return steps;
}

/**
 * Pac-Man. The board is the maze, with a pellet on every empty square and a
 * power pellet on each of the four middle squares. A piece eats every
 * pellet it passes over. Nobody can take a piece, until a side eats a power
 * pellet: for its next three moves it can take theirs, which turn blue and
 * run. The middle two ranks lead into a tunnel at each side, out one end
 * and in at the other.
 * Once the last pellet is eaten, the most points wins.
 */
export class PacManPlugin implements ModePlugin {
  id = "pacman";
  name = "Pac-Man";
  description =
    "Eat the pellets. Eat a power pellet to take their pieces for three moves.";

  private pellets = new Set<SquareIndex>();
  private power = new Set<SquareIndex>();
  private total = 0;
  private score: Record<Color, number> = { w: 0, b: 0 };
  private powerLeft: Record<Color, number> = { w: 0, b: 0 };
  private run: PacRun | null = null;
  private quietPlies = 0;
  private result: Color | "draw" | null = null;
  /** The way each move found for the last position goes, by its squares */
  private found: { fen: string; steps: Map<string, PacStep> } | null = null;
  private playing: PacStep | null = null;

  onGameStart(ctx: PluginContext): void {
    const empty = ALL_SQUARES.filter((sq) => !ctx.board.get(sq));
    this.power = new Set(
      POWER_SPOTS.map(
        (spot) =>
          [...empty].sort(
            (a, b) =>
              Math.abs(fileOf(a) - fileOf(spot)) +
              Math.abs(rankOf(a) - rankOf(spot)) -
              (Math.abs(fileOf(b) - fileOf(spot)) +
                Math.abs(rankOf(b) - rankOf(spot))),
          )[0],
      ),
    );
    this.pellets = new Set(empty.filter((sq) => !this.power.has(sq)));
    this.total = this.pellets.size + this.power.size;
    this.score = { w: 0, b: 0 };
    this.powerLeft = { w: 0, b: 0 };
    this.run = null;
    this.quietPlies = 0;
    this.result = null;
    this.found = null;
    // Nobody castles through a maze, or takes in passing
    ctx.game.castling = {
      w: { kingSide: false, queenSide: false },
      b: { kingSide: false, queenSide: false },
    };
    ctx.game.enPassant = null;
  }

  /** How many pellets a way eats, counting a power pellet as its points' worth of them */
  private feast(path: SquareIndex[]): number {
    return path.reduce(
      (sum, sq) =>
        sum +
        (this.pellets.has(sq) ? PELLET_POINTS : 0) +
        (this.power.has(sq) ? POWER_POINTS : 0),
      0,
    );
  }

  /** Every move the side to move has, each by the way that eats the most where two ways land on the same square */
  private steps(game: Game): Map<string, PacStep> {
    const fen = `${game.toFen()} ${this.powerLeft.w} ${this.powerLeft.b}`;
    if (this.found?.fen === fen) return this.found.steps;
    const steps = new Map<string, PacStep>();
    for (const found of pacSteps(
      game.board,
      game.turn,
      this.powerLeft[game.turn] > 0,
    )) {
      const key = `${found.move.from}-${found.move.to}-${found.move.promotion ?? ""}`;
      const kept = steps.get(key);
      if (!kept || this.feast(found.path) > this.feast(kept.path)) {
        steps.set(key, found);
      }
    }
    this.found = { fen, steps };
    return steps;
  }

  modifyLegalMoves(ctx: PluginContext): Move[] {
    return [...this.steps(ctx.game).values()].map((s) => s.move);
  }

  onBeforeMove(ctx: PluginContext, move: Move): Move {
    const key = `${move.from}-${move.to}-${move.promotion ?? ""}`;
    this.playing = this.steps(ctx.game).get(key) ?? {
      move,
      path: [move.to],
    };
    return move;
  }

  onAfterMove(ctx: PluginContext, move: Move): void {
    const color = move.piece.color;
    const path = this.playing?.path ?? [move.to];
    this.playing = null;
    const eaten = path.filter(
      (sq) => this.pellets.has(sq) || this.power.has(sq),
    );
    const powerEaten = eaten.filter((sq) => this.power.has(sq));
    const power = powerEaten.length > 0;
    for (const sq of eaten) {
      this.score[color] += this.power.has(sq) ? POWER_POINTS : PELLET_POINTS;
      this.pellets.delete(sq);
      this.power.delete(sq);
    }
    const ghost = !!move.captured;
    if (ghost) this.score[color] += GHOST_POINTS;
    if (this.powerLeft[color] > 0) this.powerLeft[color]--;
    if (power) this.powerLeft[color] = POWER_MOVES;
    this.quietPlies = eaten.length > 0 ? 0 : this.quietPlies + 1;
    this.run = {
      id: (this.run?.id ?? 0) + 1,
      from: move.from,
      to: move.to,
      path: [move.from, ...path],
      eaten,
      powerEaten,
      power,
      ghost,
      color,
    };
    this.decide(ctx.board);
  }

  private decide(board: Board): void {
    const left = (color: Color) =>
      ALL_SQUARES.some((sq) => board.get(sq)?.color === color);
    if (!left(Color.White)) this.result = Color.Black;
    else if (!left(Color.Black)) this.result = Color.White;
    else if (
      this.pellets.size + this.power.size === 0 ||
      this.quietPlies >= STALL_PLIES
    ) {
      const { w, b } = this.score;
      this.result = w > b ? Color.White : b > w ? Color.Black : "draw";
    }
  }

  modifyGameStatus(): GameStatus {
    if (this.result === null) return GameStatus.Active;
    return this.result === "draw" ? GameStatus.Stalemate : GameStatus.Checkmate;
  }

  getWinner(): Color | null {
    return this.result === "draw" ? null : this.result;
  }

  getSquareModifiers(ctx: PluginContext, sq: SquareIndex): SquareModifier[] {
    const piece = ctx.board.get(sq);
    if (!piece) return [];
    const hunter = this.powerLeft[other(piece.color)];
    if (hunter === 0) return [];
    return [
      { className: hunter === 1 ? "pac-scared pac-ending" : "pac-scared" },
    ];
  }

  getBoardOverlays(): BoardOverlay[] {
    const view: PacView = {
      pellets: [...this.pellets],
      power: [...this.power],
      total: this.total,
      score: { ...this.score },
      powerLeft: { ...this.powerLeft },
      run: this.run,
    };
    return [{ type: "pacman", squares: view.pellets, data: view }];
  }

  /**
   * Chessbot's move: the most pellets he can eat, a power pellet above all,
   * any of yours he can take while he is powered up, keeping clear of yours
   * while you are, and otherwise heading for the nearest pellets
   */
  choose(game: Game, moves: Move[]): Move {
    const steps = this.steps(game);
    const me = game.turn;
    const foe = other(me);
    const food = [...this.pellets, ...this.power];
    const nearest = (sq: SquareIndex) =>
      food.reduce(
        (best, p) =>
          Math.min(
            best,
            Math.max(
              Math.abs(fileOf(p) - fileOf(sq)),
              Math.abs(rankOf(p) - rankOf(sq)),
            ),
          ),
        8,
      );
    let best = moves[0];
    let bestScore = -Infinity;
    for (const move of moves) {
      const way = steps.get(`${move.from}-${move.to}-${move.promotion ?? ""}`)
        ?.path ?? [move.to];
      let score = this.feast(way) / PELLET_POINTS;
      if (way.some((sq) => this.power.has(sq)) && this.powerLeft[me] === 0) {
        score += 4;
      }
      if (move.captured) {
        score += GHOST_POINTS / PELLET_POINTS + PIECE_VALUE[move.captured.type];
      }
      score += (nearest(move.from) - nearest(move.to)) * 0.4;
      // While you are powered up, he keeps whatever you could take next out of reach
      if (this.powerLeft[foe] > 0) {
        const after = game.board.clone();
        after.remove(move.from);
        after.put(move.to, move.piece);
        const threat = pacSteps(after, foe, true).reduce(
          (worst, s) =>
            s.move.captured
              ? Math.max(worst, PIECE_VALUE[s.move.captured.type])
              : worst,
          -1,
        );
        if (threat >= 0) score -= GHOST_POINTS / PELLET_POINTS + threat;
      }
      score += Math.random() * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    return best;
  }
}
