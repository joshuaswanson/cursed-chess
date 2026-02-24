import { create } from "zustand";
import { Game, Color, PieceType, GameStatus } from "../engine";
import type { SquareIndex, Piece, MoveRecord } from "../engine";
import { PluginManager } from "../plugins/manager";
import type { ModePlugin } from "../plugins/types";

export interface GameStore {
  // Game state
  game: Game;
  pluginManager: PluginManager;
  status: GameStatus;
  turn: Color;
  moveHistory: MoveRecord[];

  // UI state
  selectedSquare: SquareIndex | null;
  legalMoveSquares: SquareIndex[];
  lastMove: { from: SquareIndex; to: SquareIndex } | null;
  promotionPending: { from: SquareIndex; to: SquareIndex } | null;
  flipped: boolean;

  // Actions
  selectSquare: (square: SquareIndex) => void;
  makeMove: (from: SquareIndex, to: SquareIndex, promotion?: PieceType) => void;
  undoMove: () => void;
  newGame: (fen?: string, plugins?: ModePlugin[]) => void;
  flipBoard: () => void;
  clearSelection: () => void;

  // Helpers
  getPiece: (square: SquareIndex) => Piece | null;
  isLegalMoveTarget: (square: SquareIndex) => boolean;
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: new Game(),
  pluginManager: new PluginManager(),
  status: GameStatus.Active,
  turn: Color.White,
  moveHistory: [],

  selectedSquare: null,
  legalMoveSquares: [],
  lastMove: null,
  promotionPending: null,
  flipped: false,

  selectSquare: (square: SquareIndex) => {
    const state = get();
    const { game, selectedSquare, legalMoveSquares } = state;

    // If clicking a legal move target, make the move
    if (selectedSquare !== null && legalMoveSquares.includes(square)) {
      const piece = game.board.get(selectedSquare);
      // Check if this is a pawn promotion
      if (
        piece &&
        piece.type === PieceType.Pawn &&
        ((piece.color === Color.White && square >> 4 === 7) ||
          (piece.color === Color.Black && square >> 4 === 0))
      ) {
        set({ promotionPending: { from: selectedSquare, to: square } });
        return;
      }
      state.makeMove(selectedSquare, square);
      return;
    }

    // If clicking own piece, select it
    const piece = game.board.get(square);
    if (piece && piece.color === game.turn) {
      const moves = game.getLegalMoves(square);
      set({
        selectedSquare: square,
        legalMoveSquares: moves.map((m) => m.to),
      });
      return;
    }

    // Clicking empty square or opponent piece without selection - clear
    set({ selectedSquare: null, legalMoveSquares: [] });
  },

  makeMove: (from: SquareIndex, to: SquareIndex, promotion?: PieceType) => {
    const { game, pluginManager } = get();
    const piece = game.board.get(from);
    if (!piece) return;

    // Find the matching legal move
    const legalMoves = game.getLegalMoves(from);
    const move = legalMoves.find((m) => {
      if (m.to !== to) return false;
      if (promotion && m.promotion !== promotion) return false;
      if (!promotion && m.promotion) return false;
      return true;
    });

    if (!move) return;

    const success = game.makeMove(move);
    if (!success) return;

    const status = game.getStatus();

    set({
      selectedSquare: null,
      legalMoveSquares: [],
      lastMove: { from, to },
      promotionPending: null,
      turn: game.turn,
      status,
      moveHistory: [...game.history],
    });
  },

  undoMove: () => {
    const { game } = get();
    const record = game.undoMove();
    if (!record) return;

    set({
      selectedSquare: null,
      legalMoveSquares: [],
      lastMove: { from: record.move.to, to: record.move.from },
      promotionPending: null,
      turn: game.turn,
      status: game.getStatus(),
      moveHistory: [...game.history],
    });
  },

  newGame: (fen?: string, plugins?: ModePlugin[]) => {
    const game = new Game(fen);
    const pluginManager = new PluginManager();
    pluginManager.setContext(game);

    if (plugins) {
      for (const plugin of plugins) {
        pluginManager.register(plugin);
      }
    }

    pluginManager.invokeOnGameStart();

    set({
      game,
      pluginManager,
      status: GameStatus.Active,
      turn: Color.White,
      moveHistory: [],
      selectedSquare: null,
      legalMoveSquares: [],
      lastMove: null,
      promotionPending: null,
    });
  },

  flipBoard: () => set((state) => ({ flipped: !state.flipped })),

  clearSelection: () =>
    set({ selectedSquare: null, legalMoveSquares: [], promotionPending: null }),

  getPiece: (square: SquareIndex) => get().game.board.get(square),

  isLegalMoveTarget: (square: SquareIndex) =>
    get().legalMoveSquares.includes(square),
}));
