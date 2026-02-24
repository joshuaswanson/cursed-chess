import { create } from "zustand";
import { Game, Color, PieceType, GameStatus, MoveFlag } from "../engine";
import type { SquareIndex, Piece, MoveRecord, Move } from "../engine";
import { PluginManager } from "../plugins/manager";
import type { ModePlugin } from "../plugins/types";
import { fileOf, rankOf } from "../utils/squareUtils";

export interface PortalMoveInfo {
  piece: Piece;
  entrance: SquareIndex;
  exit: SquareIndex;
  landing: SquareIndex;
}

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
  hasPortalMoves: boolean;
  portalEntrance: SquareIndex | null;
  lastMove: { from: SquareIndex; to: SquareIndex } | null;
  lastPortalMove: PortalMoveInfo | null;
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
  hasPortalMoves: false,
  portalEntrance: null,
  lastMove: null,
  lastPortalMove: null,
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
      const rawMoves = game.getLegalMoves(square);
      const moves = state.pluginManager.invokeModifyLegalMoves(
        rawMoves,
        game.turn,
      );
      const hasPortal = moves.some((m) => m.flags & MoveFlag.Portal);
      // Find which portal is the entrance by checking portal moves' to squares
      let portalEntrance: SquareIndex | null = null;
      if (hasPortal) {
        const overlays = state.pluginManager.getAllOverlays();
        let bestDist = Infinity;
        for (const po of overlays) {
          if (po.type !== "portal" || po.squares.length !== 2) continue;
          const [a, b] = po.squares;
          const targetsA = moves.some(
            (m) => m.to === a && m.flags & MoveFlag.Portal,
          );
          const targetsB = moves.some(
            (m) => m.to === b && m.flags & MoveFlag.Portal,
          );
          let candidate: SquareIndex | null = null;
          if (targetsA && !targetsB) candidate = a;
          else if (targetsB && !targetsA) candidate = b;
          else if (targetsA && targetsB) {
            const dA =
              Math.abs(fileOf(square) - fileOf(a)) +
              Math.abs(rankOf(square) - rankOf(a));
            const dB =
              Math.abs(fileOf(square) - fileOf(b)) +
              Math.abs(rankOf(square) - rankOf(b));
            candidate = dA <= dB ? a : b;
          }
          if (candidate !== null) {
            const dist =
              Math.abs(fileOf(square) - fileOf(candidate)) +
              Math.abs(rankOf(square) - rankOf(candidate));
            if (dist < bestDist) {
              bestDist = dist;
              portalEntrance = candidate;
            }
          }
        }
      }
      set({
        selectedSquare: square,
        legalMoveSquares: moves.map((m) => m.to),
        hasPortalMoves: hasPortal,
        portalEntrance,
      });
      return;
    }

    // Clicking empty square or opponent piece without selection - clear
    set({
      selectedSquare: null,
      legalMoveSquares: [],
      hasPortalMoves: false,
      portalEntrance: null,
    });
  },

  makeMove: (from: SquareIndex, to: SquareIndex, promotion?: PieceType) => {
    const { game, pluginManager } = get();
    const piece = game.board.get(from);
    if (!piece) return;

    // Find the matching legal move (with plugin modifications)
    const rawMoves = game.getLegalMoves(from);
    const legalMoves = pluginManager.invokeModifyLegalMoves(
      rawMoves,
      game.turn,
    );
    const move = legalMoves.find((m) => {
      if (m.to !== to) return false;
      if (promotion && m.promotion !== promotion) return false;
      if (!promotion && m.promotion) return false;
      return true;
    });

    if (!move) return;

    const processedMove = pluginManager.invokeOnBeforeMove(move);
    if (!processedMove) return;

    const previousTurn = game.turn;

    // Portal or plugin-modified moves bypass engine validation
    let success: boolean;
    if (processedMove.flags & MoveFlag.Portal) {
      success = game.executeTrustedMove(processedMove);
    } else {
      success = game.makeMove(processedMove);
    }
    if (!success) return;

    pluginManager.invokeOnAfterMove(processedMove);
    pluginManager.invokeOnTurnEnd(previousTurn);

    const status = game.getStatus();

    // Compute portal animation info if this was a portal move
    let lastPortalMove: PortalMoveInfo | null = null;
    if (processedMove.flags & MoveFlag.Portal) {
      const overlays = pluginManager.getAllOverlays();
      for (const portalOverlay of overlays) {
        if (
          portalOverlay.type !== "portal" ||
          portalOverlay.squares.length !== 2
        )
          continue;
        const [a, b] = portalOverlay.squares;
        let entrance: SquareIndex | null = null;
        let exit: SquareIndex | null = null;
        if (to === a) {
          entrance = a;
          exit = b;
        } else if (to === b) {
          entrance = b;
          exit = a;
        } else {
          // Check if this pair is the one the piece went through (closer to from)
          const distA =
            Math.abs(fileOf(from) - fileOf(a)) +
            Math.abs(rankOf(from) - rankOf(a));
          const distB =
            Math.abs(fileOf(from) - fileOf(b)) +
            Math.abs(rankOf(from) - rankOf(b));
          const candidate = distA <= distB ? a : b;
          const other = candidate === a ? b : a;
          // Only use this pair if the candidate is reasonably close
          if (!lastPortalMove || distA < 4 || distB < 4) {
            entrance = candidate;
            exit = other;
          }
        }
        if (entrance !== null && exit !== null) {
          lastPortalMove = {
            piece,
            entrance,
            exit,
            landing: processedMove.to,
          };
          break;
        }
      }
    }

    set({
      selectedSquare: null,
      legalMoveSquares: [],
      hasPortalMoves: false,
      portalEntrance: null,
      lastMove: { from, to: processedMove.to },
      lastPortalMove,
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
      hasPortalMoves: false,
      portalEntrance: null,
      lastMove: { from: record.move.to, to: record.move.from },
      lastPortalMove: null,
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
      hasPortalMoves: false,
      portalEntrance: null,
      lastMove: null,
      lastPortalMove: null,
      promotionPending: null,
    });
  },

  flipBoard: () => set((state) => ({ flipped: !state.flipped })),

  clearSelection: () =>
    set({
      selectedSquare: null,
      legalMoveSquares: [],
      hasPortalMoves: false,
      portalEntrance: null,
      promotionPending: null,
    }),

  getPiece: (square: SquareIndex) => get().game.board.get(square),

  isLegalMoveTarget: (square: SquareIndex) =>
    get().legalMoveSquares.includes(square),
}));
