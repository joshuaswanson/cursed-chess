import { Game, GameStatus, MoveFlag, isGameOver } from "../engine";
import type { Color, Move, SquareIndex } from "../engine";
import { PluginManager } from "../plugins/manager";
import type { ModePlugin } from "../plugins/types";
import { ALL_SQUARES, toIndex } from "../utils/squareUtils";

/** A square by its name, as in "e4" */
export const sq = (name: string): SquareIndex =>
  toIndex(name.charCodeAt(0) - 97, Number(name[1]) - 1);

export const nameOf = (square: SquareIndex): string =>
  "abcdefgh"[square & 7] + ((square >> 4) + 1);

/** A game with a mode's plugins running on it, played the way the store plays it */
export class Table {
  game: Game;
  manager = new PluginManager();

  constructor(plugins: ModePlugin[], fen?: string) {
    this.game = new Game(fen);
    this.manager.setContext(this.game);
    for (const plugin of plugins) this.manager.register(plugin);
    this.manager.invokeOnGameStart();
    this.manager.invokeOnIntroEnd();
  }

  get status(): GameStatus {
    return this.manager.invokeModifyGameStatus(this.game.getStatus());
  }

  get over(): boolean {
    return isGameOver(this.status);
  }

  /** Every move the side to move has, by the mode's rules */
  moves(): Move[] {
    return this.manager.invokeModifyLegalMoves(
      this.game.getLegalMoves(),
      this.game.turn,
    );
  }

  movesFrom(from: string): string[] {
    return this.moves()
      .filter((move) => move.from === sq(from))
      .map((move) => nameOf(move.to))
      .sort();
  }

  /** Plays a move, and whatever the mode does at the end of the turn. False if the mode refuses it. */
  play(move: Move): boolean {
    const processed = this.manager.invokeOnBeforeMove(move);
    if (!processed) return false;
    const mover: Color = this.game.turn;
    const trusted = processed.flags & (MoveFlag.Portal | MoveFlag.ModeMove);
    const played = trusted
      ? this.game.executeTrustedMove(processed)
      : this.game.makeMove(processed);
    if (!played) return false;
    this.manager.invokeOnAfterMove(processed);
    this.manager.invokeOnTurnEnd(mover);
    if (this.manager.getPlugins().some((plugin) => plugin.solo)) {
      this.game.turn = mover;
    }
    return true;
  }

  /** Plays the move between two named squares, which must be one the mode allows */
  move(from: string, to: string): void {
    const move = this.moves().find(
      (m) => m.from === sq(from) && m.to === sq(to),
    );
    if (!move) throw new Error(`${from}-${to} is not a move here`);
    if (!this.play(move)) throw new Error(`${from}-${to} was refused`);
  }

  /** Plays random moves until the game ends or `plies` have been played, and returns how many were */
  playRandomly(plies: number, random: () => number): number {
    for (let ply = 0; ply < plies; ply++) {
      if (this.over) return ply;
      const moves = this.moves();
      if (moves.length === 0) return ply;
      this.play(moves[Math.floor(random() * moves.length)]);
    }
    return plies;
  }

  pieces(): number {
    return ALL_SQUARES.filter((square) => this.game.board.get(square)).length;
  }
}

/** Random numbers that come out the same every run, so a failing game can be played again */
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
