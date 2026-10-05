import { Color, GameStatus, MoveFlag, PieceType } from "../engine/types";
import type { Move, Piece, SquareIndex } from "../engine/types";
import type { Board } from "../engine/board";
import { isSquareAttacked, opponent } from "../engine/moves";
import type { ModePlugin, PluginContext, BoardOverlay } from "./types";
import { ALL_SQUARES, fileOf, rankOf, toIndex } from "../utils/squareUtils";

/** Files c to f: the mouth of each goal */
export const GOAL_FILES = [2, 3, 4, 5];
/** Chance that one enemy next to a pass's path steps in and steals it */
const INTERCEPT_CHANCE = 0.2;
/** Chance that an enemy standing in a shot's path blocks it */
const BLOCK_CHANCE: Record<PieceType, number> = {
  [PieceType.Pawn]: 0.25,
  [PieceType.Knight]: 0.3,
  [PieceType.Bishop]: 0.3,
  [PieceType.Rook]: 0.35,
  [PieceType.Queen]: 0.35,
  [PieceType.King]: 0.6,
};
/** Of the shots that miss, the share that clang off a post and back into play */
const POST_CHANCE = 0.4;
/** Chance a defender next to a shot's path dives into it in time to stop the ball */
const DIVE_CHANCE = 0.3;
/** The keeper on the goal line is better at it */
const KEEPER_DIVE_CHANCE = 0.4;
const DIRECTIONS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** A spot on or off the board in square units, rank 8 and rank -1 being behind the goals */
export interface Spot {
  file: number;
  rank: number;
}

export type KickOutcome =
  "received" | "intercepted" | "saved" | "goal" | "wide" | "post";

export interface Kick {
  id: number;
  color: Color;
  kind: "pass" | "shot";
  outcome: KickOutcome;
  /** The ball's flight, starting at the kicker */
  waypoints: Spot[];
  /** Defenders who threw themselves into a shot's path, and where they landed */
  dives: Dive[];
  /** Defenders already standing in a shot's path, who jump to block it */
  jumps: SquareIndex[];
}

export interface Dive {
  from: SquareIndex;
  to: SquareIndex;
}

export type KickTarget = SquareIndex | "goal";

export interface PassOption {
  to: SquareIndex;
  chance: number;
  /** Enemies next to the path, in the order the ball passes them, with where it passes them */
  threats: { sq: SquareIndex; near: SquareIndex }[];
}

export interface ShotOption {
  chance: number;
  path: SquareIndex[];
  exitFile: number;
  /** Defenders already standing in the way */
  blockers: SquareIndex[];
  /** Defenders next to the path, each with the empty square in it they will dive onto */
  dives: Dive[];
  accuracy: number;
}

export interface FootballView {
  ball: SquareIndex;
  lastKick: Kick | null;
  /** The shirt number worn by the piece on each square */
  shirts: Record<number, number>;
}

/** Shirt numbers handed out by position, the way a team sheet would */
const SQUAD_NUMBERS: Partial<Record<PieceType, number[]>> = {
  [PieceType.Queen]: [10],
  [PieceType.Knight]: [9, 11],
  [PieceType.Bishop]: [7, 8],
  [PieceType.Rook]: [4, 5],
  [PieceType.Pawn]: [2, 3, 6, 12, 13, 14, 15, 16],
};

const spotOf = (sq: SquareIndex): Spot => ({
  file: fileOf(sq),
  rank: rankOf(sq),
});
const onBoard = (file: number, rank: number) =>
  file >= 0 && file < 8 && rank >= 0 && rank < 8;
const reach = (a: SquareIndex, b: SquareIndex) =>
  Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));
/** Which way a color's shots travel up the ranks */
const attackDirection = (color: Color) => (color === Color.White ? 1 : -1);
/** Just over the goal line, where the goal takes over the ball's flight */
const goalRank = (color: Color) => (color === Color.White ? 7.6 : -0.6);

/**
 * The kings sit this mode out, so whoever stands on their side's goal line
 * between the posts keeps goal, the one nearest the middle if there are two
 */
function keeperOf(board: Board, color: Color): SquareIndex | null {
  const rank = color === Color.White ? 0 : 7;
  const keepers = GOAL_FILES.map((file) => toIndex(file, rank)).filter(
    (sq) => board.get(sq)?.color === color,
  );
  keepers.sort((a, b) => Math.abs(fileOf(a) - 3.5) - Math.abs(fileOf(b) - 3.5));
  return keepers[0] ?? null;
}

/**
 * Chance a shot is on target by how many squares out it is taken. From right
 * in front of goal it cannot miss; from your own half it almost never goes in.
 */
const ACCURACY_BY_DISTANCE = [1, 1, 1, 0.88, 0.65, 0.2, 0.08, 0.04, 0.02];

function shotAccuracy(distance: number): number {
  return ACCURACY_BY_DISTANCE[
    Math.min(distance, ACCURACY_BY_DISTANCE.length - 1)
  ];
}

/**
 * Football on a chessboard. One ball: the piece standing on it carries it and
 * dribbles by moving. Instead of moving, the carrier can pass along a clear
 * line to a teammate or shoot through the enemy goal mouth. Taking the
 * carrier, or landing on a loose ball, wins it. A goal wins the game.
 */
export class FootballPlugin implements ModePlugin {
  id = "football";
  name = "FIFA";
  description =
    "Pass in straight lines, shoot through the goal mouth, and score to win.";

  ball: SquareIndex = toIndex(4, 3);
  lastKick: Kick | null = null;
  private scorer: Color | null = null;
  private shirts = new Map<SquareIndex, number>();

  /** The shirt number of whoever stands on a square */
  shirtOn(sq: SquareIndex): number | undefined {
    return this.shirts.get(sq);
  }
  private nextId = 1;

  onGameStart(ctx: PluginContext): void {
    this.scorer = null;
    this.handOutShirts(ctx.board);
    this.lastKick = null;
    this.ball = this.kickoffSpot(ctx.board);
  }

  onAfterMove(_ctx: PluginContext, move: Move): void {
    const mover = move.piece.color;
    this.carryShirt(move.from, move.to);
    if (move.flags & MoveFlag.EnPassant) {
      this.shirts.delete(move.to - 16 * attackDirection(mover));
    }
    if (move.from === this.ball) {
      this.ball = move.to;
      return;
    }
    if (move.flags & MoveFlag.EnPassant) {
      if (move.to - 16 * attackDirection(mover) === this.ball) {
        this.ball = move.to;
      }
      return;
    }
    const castleRank = mover === Color.White ? 0 : 7;
    if (move.flags & MoveFlag.KingsideCastle) {
      if (this.ball === toIndex(7, castleRank)) {
        this.ball = toIndex(5, castleRank);
      }
    } else if (move.flags & MoveFlag.QueensideCastle) {
      if (this.ball === toIndex(0, castleRank)) {
        this.ball = toIndex(3, castleRank);
      }
    }
  }

  modifyGameStatus(_ctx: PluginContext, status: GameStatus): GameStatus {
    return this.scorer !== null ? GameStatus.Checkmate : status;
  }

  getWinner(): Color | null {
    return this.scorer;
  }

  getBoardOverlays(): BoardOverlay[] {
    const view: FootballView = {
      ball: this.ball,
      lastKick: this.lastKick,
      shirts: Object.fromEntries(this.shirts),
    };
    return [{ type: "football", squares: [this.ball], data: view }];
  }

  /** The piece holding the ball, if any */
  carrier(board: Board): Piece | null {
    return board.get(this.ball);
  }

  /** Teammates this square can pass to: the first piece along each clear line */
  passOptions(board: Board, from: SquareIndex): PassOption[] {
    const kicker = board.get(from);
    if (!kicker) return [];
    const options: PassOption[] = [];
    for (const [df, dr] of DIRECTIONS) {
      const path: SquareIndex[] = [];
      let file = fileOf(from) + df;
      let rank = rankOf(from) + dr;
      while (onBoard(file, rank)) {
        const sq = toIndex(file, rank);
        path.push(sq);
        const piece = board.get(sq);
        if (piece) {
          if (piece.color === kicker.color) {
            const threats = this.threatsAlong(board, path, kicker.color);
            options.push({
              to: sq,
              chance: Math.pow(1 - INTERCEPT_CHANCE, threats.length),
              threats,
            });
          }
          break;
        }
        file += df;
        rank += dr;
      }
    }
    return options;
  }

  /** The best open line from this square through the enemy goal mouth */
  shotOption(board: Board, from: SquareIndex): ShotOption | null {
    const kicker = board.get(from);
    if (!kicker) return null;
    const dr = attackDirection(kicker.color);
    const enemy = opponent(kicker.color);
    const keeperSq = keeperOf(board, enemy);
    let best: ShotOption | null = null;

    for (const df of [-1, 0, 1]) {
      const path: SquareIndex[] = [];
      let file = fileOf(from) + df;
      let rank = rankOf(from) + dr;
      let blocked = false;
      while (onBoard(file, rank)) {
        const sq = toIndex(file, rank);
        if (board.get(sq)?.color === kicker.color) {
          blocked = true;
          break;
        }
        path.push(sq);
        file += df;
        rank += dr;
      }
      // The line has to leave over the goal line, between the posts
      if (blocked || (rank >= 0 && rank < 8) || !GOAL_FILES.includes(file)) {
        continue;
      }

      const blockers = path.filter((sq) => board.get(sq)?.color === enemy);
      const dives = this.divesInto(board, path, enemy);
      const accuracy = shotAccuracy(path.length + 1);
      let chance = accuracy;
      for (const sq of blockers)
        chance *= 1 - BLOCK_CHANCE[board.get(sq)!.type];
      for (const dive of dives)
        chance *=
          1 - (dive.from === keeperSq ? KEEPER_DIVE_CHANCE : DIVE_CHANCE);

      if (!best || chance > best.chance) {
        best = { chance, path, exitFile: file, blockers, dives, accuracy };
      }
    }
    return best;
  }

  /**
   * Every defender beside a shot's path throws themselves at it, each onto the
   * first empty square of the path within reach, nearest the kicker first
   */
  private divesInto(
    board: Board,
    path: SquareIndex[],
    defender: Color,
  ): Dive[] {
    const claimed = new Set<SquareIndex>();
    const dives: Dive[] = [];
    const divers = ALL_SQUARES.filter(
      (sq) =>
        board.get(sq)?.color === defender &&
        !path.includes(sq) &&
        path.some((p) => reach(p, sq) === 1),
    );
    for (const from of divers) {
      const to = path.find(
        (p) => reach(p, from) === 1 && !board.get(p) && !claimed.has(p),
      );
      if (to === undefined) continue;
      claimed.add(to);
      dives.push({ from, to });
    }
    return dives.sort((a, b) => path.indexOf(a.to) - path.indexOf(b.to));
  }

  /** Plays a pass or shot from the carrier, rolling for interceptions and saves */
  kick(board: Board, target: KickTarget): Kick | null {
    const kicker = board.get(this.ball);
    if (!kicker) return null;
    const from = this.ball;
    const start = spotOf(from);
    let dives: Dive[] = [];
    let jumps: SquareIndex[] = [];
    const finish = (
      kick: Omit<Kick, "id" | "color" | "dives" | "jumps">,
    ): Kick => {
      this.lastKick = {
        ...kick,
        dives,
        jumps,
        id: this.nextId++,
        color: kicker.color,
      };
      return this.lastKick;
    };

    if (target === "goal") {
      const shot = this.shotOption(board, from);
      if (!shot) return null;
      const keeperSq = keeperOf(board, opponent(kicker.color));
      // Everyone beside the path dives at once, and stays where they land
      dives = shot.dives;
      jumps = shot.blockers;
      for (const dive of dives) {
        board.put(dive.to, board.get(dive.from)!);
        board.remove(dive.from);
        this.carryShirt(dive.from, dive.to);
      }
      // The ball meets whoever is in its way in the order it reaches them
      const stoppers = [
        ...shot.blockers.map((sq) => ({
          sq,
          chance: BLOCK_CHANCE[board.get(sq)!.type],
        })),
        ...dives.map((dive) => ({
          sq: dive.to,
          chance: dive.from === keeperSq ? KEEPER_DIVE_CHANCE : DIVE_CHANCE,
        })),
      ].sort((a, b) => shot.path.indexOf(a.sq) - shot.path.indexOf(b.sq));
      for (const { sq, chance } of stoppers) {
        if (Math.random() < chance) {
          this.ball = sq;
          return finish({
            kind: "shot",
            outcome: "saved",
            waypoints: [start, spotOf(sq)],
          });
        }
      }
      const exit = { file: shot.exitFile, rank: goalRank(kicker.color) };
      if (Math.random() > shot.accuracy) {
        const side = shot.exitFile < 4 ? -1 : 1;
        const rebound =
          Math.random() < POST_CHANCE
            ? this.reboundSpot(board, kicker.color, side)
            : null;
        if (rebound !== null) {
          this.ball = rebound;
          return finish({
            kind: "shot",
            outcome: "post",
            waypoints: [
              start,
              {
                file: side < 0 ? 1.5 : 5.5,
                rank: exit.rank - Math.sign(exit.rank) * 0.1,
              },
              spotOf(rebound),
            ],
          });
        }
        this.ball = this.goalKickSpot(board, opponent(kicker.color));
        return finish({
          kind: "shot",
          outcome: "wide",
          waypoints: [start, { ...exit, file: exit.file + side * 2.6 }],
        });
      }
      this.scorer = kicker.color;
      return finish({
        kind: "shot",
        outcome: "goal",
        waypoints: [start, exit],
      });
    }

    const pass = this.passOptions(board, from).find((p) => p.to === target);
    if (!pass) return null;
    for (const { sq, near } of pass.threats) {
      if (Math.random() < INTERCEPT_CHANCE) {
        this.ball = sq;
        return finish({
          kind: "pass",
          outcome: "intercepted",
          waypoints: [start, spotOf(near), spotOf(sq)],
        });
      }
    }
    this.ball = pass.to;
    return finish({
      kind: "pass",
      outcome: "received",
      waypoints: [start, spotOf(pass.to)],
    });
  }

  /** What the computer does with the ball instead of moving, if anything */
  chooseKick(board: Board, color: Color): KickTarget | null {
    if (this.carrier(board)?.color !== color) return null;
    const shot = this.shotOption(board, this.ball);
    if (shot && shot.chance >= 0.3) return "goal";

    const underPressure = isSquareAttacked(board, this.ball, opponent(color));
    const dir = attackDirection(color);
    let best: PassOption | null = null;
    let bestScore = 0;
    for (const pass of this.passOptions(board, this.ball)) {
      const progress = (rankOf(pass.to) - rankOf(this.ball)) * dir;
      const shotAfter = this.shotFrom(board, pass.to, color);
      const score =
        pass.chance * (progress + shotAfter * 4 + (underPressure ? 2 : 0));
      if (pass.chance >= 0.6 && score > bestScore) {
        bestScore = score;
        best = pass;
      }
    }
    if (best && (underPressure || bestScore >= 2.5) && Math.random() < 0.75) {
      return best.to;
    }
    return null;
  }

  /** How much the computer likes a move for footballing reasons */
  squareBonus(
    board: Board,
    to: SquareIndex,
    piece: Piece,
    from: SquareIndex,
  ): number {
    const holder = board.get(this.ball);
    if (from === this.ball) {
      const progress =
        (rankOf(to) - rankOf(from)) * attackDirection(piece.color);
      return progress * 0.5 + this.shotFrom(board, to, piece.color, from) * 4;
    }
    if (to === this.ball && holder?.color !== piece.color) return 3.5;
    if (piece.type === PieceType.King) return 0;
    return 0.12 * (7 - reach(to, this.ball));
  }

  /** Shot chance a piece of this color would have from a square */
  private shotFrom(
    board: Board,
    sq: SquareIndex,
    color: Color,
    vacated?: SquareIndex,
  ): number {
    const trial = board.clone();
    if (vacated !== undefined) trial.remove(vacated);
    trial.put(sq, { type: PieceType.Pawn, color });
    return this.shotOption(trial, sq)?.chance ?? 0;
  }

  private threatsAlong(
    board: Board,
    path: SquareIndex[],
    color: Color,
  ): { sq: SquareIndex; near: SquareIndex }[] {
    const seen = new Set<SquareIndex>();
    const threats: { sq: SquareIndex; near: SquareIndex }[] = [];
    for (const near of path) {
      for (const [df, dr] of DIRECTIONS) {
        const file = fileOf(near) + df;
        const rank = rankOf(near) + dr;
        if (!onBoard(file, rank)) continue;
        const sq = toIndex(file, rank);
        if (seen.has(sq) || board.get(sq)?.color !== opponent(color)) continue;
        seen.add(sq);
        threats.push({ sq, near });
      }
    }
    return threats;
  }

  /** The ball starts loose on an open center square */
  private kickoffSpot(board: Board): SquareIndex {
    const byCenter = [...ALL_SQUARES].sort(
      (a, b) =>
        Math.hypot(fileOf(a) - 3.5, rankOf(a) - 3.5) -
        Math.hypot(fileOf(b) - 3.5, rankOf(b) - 3.5),
    );
    const center = byCenter.slice(0, 4).filter((sq) => !board.get(sq));
    if (center.length > 0) {
      return center[Math.floor(Math.random() * center.length)];
    }
    return byCenter.find((sq) => !board.get(sq)) ?? byCenter[0];
  }

  /** After a miss, the defending piece nearest its own goal takes the ball */
  /** Gives every piece on the pitch a number, by position and then by file */
  private handOutShirts(board: Board): void {
    this.shirts.clear();
    for (const color of [Color.White, Color.Black]) {
      const squad = ALL_SQUARES.filter(
        (sq) => board.get(sq)?.color === color,
      ).sort((a, b) => fileOf(a) - fileOf(b) || rankOf(a) - rankOf(b));
      const used = new Set<number>();
      const leftover: SquareIndex[] = [];
      for (const sq of squad) {
        const free = (SQUAD_NUMBERS[board.get(sq)!.type] ?? []).find(
          (n) => !used.has(n),
        );
        if (free === undefined) {
          leftover.push(sq);
          continue;
        }
        used.add(free);
        this.shirts.set(sq, free);
      }
      let next = 17;
      for (const sq of leftover) {
        while (used.has(next)) next++;
        used.add(next);
        this.shirts.set(sq, next);
      }
    }
  }

  /** A player keeps their number wherever they go; anyone taken on `to` loses theirs */
  private carryShirt(from: SquareIndex, to: SquareIndex): void {
    const number = this.shirts.get(from);
    this.shirts.delete(from);
    this.shirts.delete(to);
    if (number !== undefined) this.shirts.set(to, number);
  }

  /** A free square in front of the goal for a ball that comes back off a post */
  private reboundSpot(
    board: Board,
    attacker: Color,
    side: number,
  ): SquareIndex | null {
    const goalLine = attacker === Color.White ? 7 : 0;
    const postFile = side < 0 ? 2 : 5;
    const spots = ALL_SQUARES.filter(
      (sq) =>
        !board.get(sq) &&
        Math.abs(rankOf(sq) - goalLine) <= 2 &&
        Math.abs(fileOf(sq) - postFile) <= 2,
    );
    return spots.length > 0
      ? spots[Math.floor(Math.random() * spots.length)]
      : null;
  }

  private goalKickSpot(board: Board, defender: Color): SquareIndex {
    const goalLine = defender === Color.White ? 0 : 7;
    const mouth = toIndex(3, goalLine);
    const pieces = ALL_SQUARES.filter(
      (sq) => board.get(sq)?.color === defender,
    );
    if (pieces.length === 0) return mouth;
    return pieces.reduce((a, b) =>
      Math.hypot(fileOf(a) - 3.5, rankOf(a) - goalLine) <=
      Math.hypot(fileOf(b) - 3.5, rankOf(b) - goalLine)
        ? a
        : b,
    );
  }
}
