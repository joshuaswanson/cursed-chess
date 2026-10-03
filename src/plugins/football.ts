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
/** Chance the enemy keeper dives across to save a shot that passes next to them */
const KEEPER_DIVE_CHANCE = 0.35;
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
  "received" | "intercepted" | "saved" | "goal" | "wide";

export interface Kick {
  id: number;
  color: Color;
  kind: "pass" | "shot";
  outcome: KickOutcome;
  /** The ball's flight, starting at the kicker */
  waypoints: Spot[];
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
  blockers: SquareIndex[];
  keeper: SquareIndex | null;
  accuracy: number;
}

export interface FootballView {
  ball: SquareIndex;
  lastKick: Kick | null;
}

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

function shotAccuracy(distance: number): number {
  return Math.min(1, Math.max(0.6, 1 - (distance - 3) * 0.06));
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
  private nextId = 1;

  onGameStart(ctx: PluginContext): void {
    this.scorer = null;
    this.lastKick = null;
    this.ball = this.kickoffSpot(ctx.board);
  }

  onAfterMove(_ctx: PluginContext, move: Move): void {
    const mover = move.piece.color;
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
    const view: FootballView = { ball: this.ball, lastKick: this.lastKick };
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
      const lastTwo = path.slice(-2);
      const keeper =
        keeperSq !== null &&
        !blockers.includes(keeperSq) &&
        lastTwo.some((sq) => reach(sq, keeperSq) === 1)
          ? keeperSq
          : null;
      const accuracy = shotAccuracy(path.length + 1);
      let chance = accuracy * (keeper !== null ? 1 - KEEPER_DIVE_CHANCE : 1);
      for (const sq of blockers)
        chance *= 1 - BLOCK_CHANCE[board.get(sq)!.type];

      if (!best || chance > best.chance) {
        best = { chance, path, exitFile: file, blockers, keeper, accuracy };
      }
    }
    return best;
  }

  /** Plays a pass or shot from the carrier, rolling for interceptions and saves */
  kick(board: Board, target: KickTarget): Kick | null {
    const kicker = board.get(this.ball);
    if (!kicker) return null;
    const from = this.ball;
    const start = spotOf(from);
    const finish = (kick: Omit<Kick, "id" | "color">): Kick => {
      this.lastKick = { ...kick, id: this.nextId++, color: kicker.color };
      return this.lastKick;
    };

    if (target === "goal") {
      const shot = this.shotOption(board, from);
      if (!shot) return null;
      for (const sq of shot.blockers) {
        if (Math.random() < BLOCK_CHANCE[board.get(sq)!.type]) {
          this.ball = sq;
          return finish({
            kind: "shot",
            outcome: "saved",
            waypoints: [start, spotOf(sq)],
          });
        }
      }
      if (shot.keeper !== null && Math.random() < KEEPER_DIVE_CHANCE) {
        const passing = shot.path.find((sq) => reach(sq, shot.keeper!) === 1);
        this.ball = shot.keeper;
        return finish({
          kind: "shot",
          outcome: "saved",
          waypoints: [
            start,
            spotOf(passing ?? shot.keeper),
            spotOf(shot.keeper),
          ],
        });
      }
      const exit = { file: shot.exitFile, rank: goalRank(kicker.color) };
      if (Math.random() > shot.accuracy) {
        const side = shot.exitFile < 4 ? -1 : 1;
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
