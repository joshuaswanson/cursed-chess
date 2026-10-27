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
/** The ghosts' pen, the four middle squares. No piece goes in. */
export const PEN = [toIndex(3, 3), toIndex(4, 3), toIndex(3, 4), toIndex(4, 4)];
/** Where the power pellets go: either side of the pen, on the two files that cross the middle */
const POWER_SPOTS = [
  toIndex(2, 3),
  toIndex(5, 3),
  toIndex(2, 4),
  toIndex(5, 4),
];

/** The two squares a wall runs between, the same whichever is named first */
const wallKey = (a: SquareIndex, b: SquareIndex) =>
  a < b ? `${a}-${b}` : `${b}-${a}`;
/** A wall between a square and the one on the next file, or the next rank */
const beside = (file: number, rank: number): [SquareIndex, SquareIndex] => [
  toIndex(file, rank),
  toIndex(file + 1, rank),
];
const above = (file: number, rank: number): [SquareIndex, SquareIndex] => [
  toIndex(file, rank),
  toIndex(file, rank + 1),
];

/**
 * The maze's walls, each running between two squares, laid out the same
 * from either side of the board. Only the c and f files cross the middle
 * line, past the power pellets; the pen closes off d and e. No wall comes
 * near either side's first two ranks, so every piece can always get out.
 */
export const MAZE_WALLS: [SquareIndex, SquareIndex][] = [
  beside(1, 2),
  beside(5, 2),
  beside(1, 5),
  beside(5, 5),
  above(0, 3),
  above(1, 3),
  above(6, 3),
  above(7, 3),
  // The pen's sides; the ghosts come and go by its top and bottom
  beside(2, 3),
  beside(2, 4),
  beside(4, 3),
  beside(4, 4),
];
const WALLS = new Set(MAZE_WALLS.map(([a, b]) => wallKey(a, b)));
/** How many of its own moves a side can take pieces for after eating a power pellet */
export const POWER_MOVES = 3;
export const PELLET_POINTS = 10;
export const POWER_POINTS = 50;
export const GHOST_POINTS = 200;
/** Moves in a row without a pellet eaten, after which the game is called on points */
const STALL_PLIES = 30;
/** How many moves an eaten ghost spends back in the pen before it comes out again */
const GHOST_REST = 4;
/** How near a piece has to be for Inky to go for the best of them, in steps */
const INKY_REACH = 5;
/** How near Clyde lets a piece come before he loses his nerve and backs off */
const CLYDE_NERVE = 3;

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
  ghosts: Ghost[];
  /** The pieces the ghosts caught after the last move */
  bites: GhostBite[];
}

const other = (color: Color) =>
  color === Color.White ? Color.Black : Color.White;

/** One step from a square, through the tunnel when it leads off a side on a tunnel rank */
function reach(sq: SquareIndex, df: number, dr: number): SquareIndex | null {
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
 * One step from a square, unless a wall is in the way. A diagonal step gets
 * round a wall's end, so it is only stopped where walls close off both
 * ways round the corner.
 */
function step(sq: SquareIndex, df: number, dr: number): SquareIndex | null {
  const to = reach(sq, df, dr);
  if (to === null) return null;
  if (df === 0 || dr === 0) return WALLS.has(wallKey(sq, to)) ? null : to;
  const clear = (via: SquareIndex | null) =>
    via !== null &&
    !WALLS.has(wallKey(sq, via)) &&
    !WALLS.has(wallKey(via, to));
  return clear(reach(sq, df, 0)) || clear(reach(sq, 0, dr)) ? to : null;
}

/** What stands in the pieces' way besides each other */
export interface Maze {
  /** Squares no piece lands on or passes over: the pen, and the ghosts it may not eat */
  shut: Set<SquareIndex>;
  /** Blue ghosts the side to move may eat by landing on them */
  prey: Set<SquareIndex>;
}

const OPEN_MAZE: Maze = { shut: new Set(), prey: new Set() };

export type GhostName = "blinky" | "pinky" | "inky" | "clyde";

export interface Ghost {
  name: GhostName;
  sq: SquareIndex;
  /** The square it last stepped from, which it does not turn straight back to */
  from: SquareIndex;
  /** Where it means to step next, as things stand */
  next: SquareIndex | null;
  /** Waiting in the pen, out in the maze, or eaten and back in the pen to rest */
  state: "pen" | "out" | "eaten";
  /** Moves until it comes out of the pen */
  wait: number;
  /** Counts its jumps, through a tunnel or home to the pen, which are drawn without a glide */
  jumps: number;
}

/** A piece a ghost caught */
export interface GhostBite {
  id: number;
  sq: SquareIndex;
  piece: Piece;
  ghost: GhostName;
}

/** Each ghost's corner of the pen, and how many moves it waits before coming out */
const GHOST_HOMES: [GhostName, SquareIndex, number][] = [
  ["blinky", toIndex(3, 4), 2],
  ["pinky", toIndex(4, 3), 2],
  ["inky", toIndex(3, 3), 8],
  ["clyde", toIndex(4, 4), 8],
];

const ORTHOGONAL: [number, number][] = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];

/** How many steps each square is from the nearest of `from`, the way a ghost walks */
function ghostDistances(from: SquareIndex[]): Map<SquareIndex, number> {
  const dist = new Map(from.map((sq) => [sq, 0]));
  const queue = [...from];
  for (let i = 0; i < queue.length; i++) {
    const at = queue[i];
    for (const [df, dr] of ORTHOGONAL) {
      const to = step(at, df, dr);
      if (to === null || dist.has(to)) continue;
      dist.set(to, dist.get(at)! + 1);
      queue.push(to);
    }
  }
  return dist;
}
/**
 * Every move a side has, through the tunnels too and round the maze's walls,
 * which knights jump. Pieces only take each other when `canTake`, and there
 * are no kings to keep out of check.
 */
export function pacSteps(
  board: Board,
  color: Color,
  canTake: boolean,
  maze: Maze = OPEN_MAZE,
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
    if (maze.shut.has(sq)) return false;
    const there = board.get(sq);
    return !there || (canTake && there.color !== color);
  };
  /** Whether a piece stops on a square: another piece, or a ghost it eats */
  const stops = (sq: SquareIndex) => !!board.get(sq) || maze.prey.has(sq);

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
          if (stops(next)) break;
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
          const to = reach(from, df, dr);
          if (to !== null && open(to)) add(from, piece, [to]);
        }
        break;
      case PieceType.Pawn: {
        const ahead = color === Color.White ? 1 : -1;
        const lastRank = color === Color.White ? 7 : 0;
        const startRank = color === Color.White ? 1 : 6;
        const one = step(from, 0, ahead);
        if (one !== null && !board.get(one) && open(one)) {
          add(from, piece, [one], rankOf(one) === lastRank);
          const two = step(one, 0, ahead);
          if (
            rankOf(from) === startRank &&
            !stops(one) &&
            two !== null &&
            !board.get(two) &&
            open(two)
          ) {
            add(from, piece, [one, two]);
          }
        }
        // A pawn the maze stops dead, against a wall or the pen, can step aside round it
        const straight = reach(from, 0, ahead);
        const walledIn =
          straight !== null &&
          (WALLS.has(wallKey(from, straight)) || PEN.includes(straight));
        for (const df of walledIn ? [-1, 1] : []) {
          const to = step(from, df, 0);
          if (to !== null && !board.get(to) && open(to)) add(from, piece, [to]);
        }
        for (const df of [-1, 1]) {
          const to = step(from, df, ahead);
          if (to === null || maze.shut.has(to)) continue;
          const there = board.get(to);
          const takes = canTake && !!there && there.color !== color;
          if (takes || (!there && maze.prey.has(to))) {
            add(from, piece, [to], rankOf(to) === lastRank);
          }
        }
        break;
      }
    }
  }
  return steps;
}

/**
 * Pac-Man. The board is the maze, walled in places, with a pellet on every
 * empty square and a power pellet either side of the ghosts' pen in the
 * middle. A piece eats every pellet it passes over. Nobody can take a piece,
 * until a side eats a power pellet: for its next three moves it can take
 * theirs, which turn blue and run, and eat the ghosts, which turn blue too.
 * The rest of the time the four ghosts hunt, a step after every move, and
 * eat any piece they catch, whichever side it is on. The middle two ranks
 * lead into a tunnel at each side, out one end and in at the other.
 * Once the last pellet is eaten, the most points wins.
 */
export class PacManPlugin implements ModePlugin {
  id = "pacman";
  name = "Pac-Man";
  description =
    "Eat the pellets and keep clear of the ghosts. A power pellet lets you eat them, and their pieces, for three moves.";

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
  private ghosts: Ghost[] = [];
  /** The pieces the ghosts caught after the last move */
  private bites: GhostBite[] = [];
  private bitesEver = 0;
  /** Where the last move landed, for Pinky to go after */
  private lastLanding: SquareIndex | null = null;

  onGameStart(ctx: PluginContext): void {
    this.clearPen(ctx.board);
    this.ghosts = GHOST_HOMES.map(([name, sq, wait]) => ({
      name,
      sq,
      from: sq,
      next: null,
      state: "pen",
      wait,
      jumps: 0,
    }));
    this.bites = [];
    this.lastLanding = null;
    const empty = ALL_SQUARES.filter(
      (sq) => !ctx.board.get(sq) && !PEN.includes(sq),
    );
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

  /** Any piece set down in the pen moves out to the nearest free square */
  private clearPen(board: Board): void {
    for (const sq of PEN) {
      const piece = board.get(sq);
      if (!piece) continue;
      const free = ALL_SQUARES.filter(
        (to) => !board.get(to) && !PEN.includes(to),
      ).sort(
        (a, b) =>
          Math.abs(fileOf(a) - fileOf(sq)) +
          Math.abs(rankOf(a) - rankOf(sq)) -
          Math.abs(fileOf(b) - fileOf(sq)) -
          Math.abs(rankOf(b) - rankOf(sq)),
      )[0];
      board.remove(sq);
      if (free !== undefined) board.put(free, piece);
    }
  }

  /** Whether the ghosts are blue: while either side is powered up */
  private get scared(): boolean {
    return this.powerLeft.w > 0 || this.powerLeft.b > 0;
  }

  private ghostAt(sq: SquareIndex): Ghost | undefined {
    return this.ghosts.find((g) => g.state !== "eaten" && g.sq === sq);
  }

  /** What stands in the way of `color`'s pieces: the pen, and the ghosts, unless they are blue and its pieces are powered */
  private maze(color: Color): Maze {
    const hunting = this.powerLeft[color] > 0;
    const shut = new Set(PEN);
    const prey = new Set<SquareIndex>();
    for (const ghost of this.ghosts) {
      if (ghost.state !== "out" || PEN.includes(ghost.sq)) continue;
      (hunting ? prey : shut).add(ghost.sq);
    }
    return { shut, prey };
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
    const fen = `${game.toFen()} ${this.powerLeft.w} ${this.powerLeft.b} ${this.ghosts.map((g) => `${g.state}${g.sq}`).join(",")}`;
    if (this.found?.fen === fen) return this.found.steps;
    const steps = new Map<string, PacStep>();
    for (const found of pacSteps(
      game.board,
      game.turn,
      this.powerLeft[game.turn] > 0,
      this.maze(game.turn),
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
    const prey = move.captured ? undefined : this.ghostAt(move.to);
    if (prey) this.sendHome(prey);
    const ghost = !!move.captured || !!prey;
    if (ghost) this.score[color] += GHOST_POINTS;
    this.lastLanding = move.to;
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

  /** An eaten ghost goes back to its corner of the pen to rest */
  private sendHome(ghost: Ghost): void {
    const home = GHOST_HOMES.find(([name]) => name === ghost.name)![1];
    const free = [home, ...PEN].find((sq) => !this.ghostAt(sq)) ?? home;
    ghost.state = "eaten";
    ghost.sq = free;
    ghost.from = free;
    ghost.next = null;
    ghost.wait = GHOST_REST;
    ghost.jumps++;
  }

  /** After every move, and every turn passed, each ghost out in the maze takes a step */
  onTurnEnd(ctx: PluginContext): void {
    this.bites = [];
    if (this.result !== null) return;
    for (const ghost of this.ghosts) {
      if (ghost.state === "out") continue;
      // Nobody comes out of the pen while the ghosts outside are blue
      if (ghost.state === "pen" && ghost.wait <= 1 && this.scared) continue;
      ghost.wait--;
      if (ghost.wait > 0) continue;
      if (ghost.state === "eaten") {
        ghost.state = "pen";
        ghost.wait = 1;
      } else ghost.state = "out";
    }
    for (const ghost of this.ghosts) {
      if (ghost.state !== "out") continue;
      const to = this.ghostStep(ctx.board, ghost);
      if (to === null) continue;
      if (Math.abs(fileOf(to) - fileOf(ghost.sq)) > 1) ghost.jumps++;
      ghost.from = ghost.sq;
      ghost.sq = to;
      const caught = this.scared ? null : ctx.board.get(to);
      if (caught) {
        ctx.board.remove(to);
        this.bites.push({
          id: ++this.bitesEver,
          sq: to,
          piece: caught,
          ghost: ghost.name,
        });
      }
    }
    for (const ghost of this.ghosts) {
      ghost.next =
        ghost.state === "out" ? this.ghostStep(ctx.board, ghost) : null;
    }
    this.found = null;
    this.decide(ctx.board);
  }

  /**
   * Where a ghost steps next. Out hunting, each goes its own way: Blinky
   * after the nearest piece, Pinky after the piece that moved last, Inky
   * after the best piece near him, Clyde after the nearest until it is close,
   * when he backs off to a corner. Blue, they run from the pieces that can
   * eat them, and keep off every piece. None turns straight back unless it
   * has to, and once out of the pen none goes back in.
   */
  private ghostStep(board: Board, ghost: Ghost): SquareIndex | null {
    const inPen = PEN.includes(ghost.sq);
    const options = ORTHOGONAL.map(([df, dr]) => step(ghost.sq, df, dr)).filter(
      (to): to is SquareIndex =>
        to !== null &&
        !this.ghostAt(to) &&
        (inPen || !PEN.includes(to)) &&
        (!this.scared || !board.get(to)),
    );
    const onward = options.filter((to) => to !== ghost.from);
    const choices = onward.length > 0 ? onward : options;
    if (choices.length === 0) return null;

    const pieces = ALL_SQUARES.filter((sq) => board.get(sq));
    if (this.scared) {
      const hunters = pieces.filter(
        (sq) => this.powerLeft[board.get(sq)!.color] > 0,
      );
      const away = ghostDistances(hunters);
      return this.best(choices, ghost, (to) => away.get(to) ?? 99);
    }
    const target = this.ghostTarget(board, ghost, pieces);
    const toward = ghostDistances(target);
    return this.best(choices, ghost, (to) => -(toward.get(to) ?? 99));
  }

  /** The highest scoring of `choices`, keeping straight on where it is level */
  private best(
    choices: SquareIndex[],
    ghost: Ghost,
    score: (sq: SquareIndex) => number,
  ): SquareIndex {
    const ahead = ghost.sq + (ghost.sq - ghost.from);
    return choices.reduce((a, b) => {
      const diff = score(b) - score(a);
      if (diff !== 0) return diff > 0 ? b : a;
      return b === ahead ? b : a;
    });
  }

  /** The squares a hunting ghost heads for */
  private ghostTarget(
    board: Board,
    ghost: Ghost,
    pieces: SquareIndex[],
  ): SquareIndex[] {
    if (pieces.length === 0) return [ghost.sq];
    const near = ghostDistances([ghost.sq]);
    const steps = (sq: SquareIndex) => near.get(sq) ?? 99;
    switch (ghost.name) {
      case "pinky":
        return this.lastLanding !== null && board.get(this.lastLanding)
          ? [this.lastLanding]
          : pieces;
      case "inky": {
        const within = pieces.filter((sq) => steps(sq) <= INKY_REACH);
        if (within.length === 0) return pieces;
        const worth = (sq: SquareIndex) => PIECE_VALUE[board.get(sq)!.type];
        return [within.reduce((a, b) => (worth(b) > worth(a) ? b : a))];
      }
      case "clyde": {
        const closest = Math.min(...pieces.map(steps));
        if (closest > CLYDE_NERVE) return pieces;
        const corners = [
          toIndex(0, 2),
          toIndex(7, 2),
          toIndex(0, 5),
          toIndex(7, 5),
        ];
        const from = ghostDistances(pieces);
        return [
          corners.reduce((a, b) =>
            (from.get(b) ?? 0) > (from.get(a) ?? 0) ? b : a,
          ),
        ];
      }
      default:
        return pieces;
    }
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
    if (PEN.includes(sq)) return [{ className: "pac-pen" }];
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
      ghosts: this.ghosts.map((g) => ({ ...g })),
      bites: this.bites,
    };
    return [{ type: "pacman", squares: view.pellets, data: view }];
  }

  /**
   * Chessbot's move: the most pellets he can eat, a power pellet above all,
   * any of yours or any blue ghost he can take while he is powered up,
   * keeping clear of yours while you are and of the ghosts while they hunt,
   * and otherwise heading for the nearest pellets
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
    // The squares the hunting ghosts can reach with their next step
    const haunted = new Set<SquareIndex>();
    if (!this.scared) {
      for (const ghost of this.ghosts) {
        if (ghost.state !== "out") continue;
        for (const [df, dr] of ORTHOGONAL) {
          const to = step(ghost.sq, df, dr);
          if (to !== null) haunted.add(to);
        }
      }
    }
    const prey = this.maze(me).prey;
    let best = moves[0];
    let bestScore = -Infinity;
    for (const move of moves) {
      const way = steps.get(`${move.from}-${move.to}-${move.promotion ?? ""}`)
        ?.path ?? [move.to];
      let score = this.feast(way) / PELLET_POINTS;
      // A power pellet is worth most with ghosts out to eat, and is saved while there are none
      if (way.some((sq) => this.power.has(sq)) && this.powerLeft[me] === 0) {
        score += this.ghosts.some((g) => g.state === "out") ? 4 : -6;
      }
      if (move.captured) {
        score += GHOST_POINTS / PELLET_POINTS + PIECE_VALUE[move.captured.type];
      }
      score += (nearest(move.from) - nearest(move.to)) * 0.4;
      if (prey.has(move.to)) score += GHOST_POINTS / PELLET_POINTS;
      const worth = PIECE_VALUE[move.piece.type] + 3;
      if (haunted.has(move.to)) score -= worth;
      if (haunted.has(move.from)) score += worth;
      // While you are powered up, he keeps whatever you could take next out of reach
      if (this.powerLeft[foe] > 0) {
        const after = game.board.clone();
        after.remove(move.from);
        after.put(move.to, move.piece);
        const threat = pacSteps(after, foe, true, this.maze(foe)).reduce(
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
