import { create } from "zustand";
import { Game, Color, PieceType, GameStatus, MoveFlag } from "../engine";
import type { SquareIndex, Piece, MoveRecord, Move } from "../engine";
import { PluginManager } from "../plugins/manager";
import type { ModePlugin } from "../plugins/types";
import { fileOf, rankOf } from "../utils/squareUtils";

/** Get normalized sliding direction from origin to target, or null if not a straight line */
function slidingDirection(
  origin: SquareIndex,
  target: SquareIndex,
): number | null {
  const df = fileOf(target) - fileOf(origin);
  const dr = rankOf(target) - rankOf(origin);
  if (df === 0 && dr === 0) return null;
  if (df !== 0 && dr !== 0 && Math.abs(df) !== Math.abs(dr)) return null;
  return Math.sign(dr) * 16 + Math.sign(df);
}

export interface PortalMoveInfo {
  piece: Piece;
  from: SquareIndex;
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

  // Announcement
  announcement: string | null;
  paused: boolean;

  // Timer
  timeWhite: number;
  timeBlack: number;
  moveTimerActive: boolean;

  // Actions
  selectSquare: (square: SquareIndex) => void;
  makeMove: (from: SquareIndex, to: SquareIndex, promotion?: PieceType) => void;
  undoMove: () => void;
  newGame: (fen?: string, plugins?: ModePlugin[]) => void;
  flipBoard: () => void;
  clearSelection: () => void;
  showAnnouncement: (text: string, durationMs?: number) => void;
  tickTimer: () => void;
  expireTimer: () => void;

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

  announcement: null,
  paused: false,

  timeWhite: 15,
  timeBlack: 15,
  moveTimerActive: false,

  selectSquare: (square: SquareIndex) => {
    const state = get();
    if (state.paused) return;
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
    if (get().paused) return;
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

        const landing = processedMove.to;

        // 1. User clicked a portal square directly
        if (to === a) {
          entrance = a;
          exit = b;
        } else if (to === b) {
          entrance = b;
          exit = a;
          // 2. Piece landed on a portal square (capture at exit)
        } else if (landing === a) {
          entrance = b;
          exit = a;
        } else if (landing === b) {
          entrance = a;
          exit = b;
        } else {
          // 3. Continuation move — verify direction is consistent:
          //    from→entrance and exit→landing must be the same direction
          const dirFromA = slidingDirection(from, a);
          const dirBToLand = slidingDirection(b, landing);
          if (dirFromA !== null && dirFromA === dirBToLand) {
            entrance = a;
            exit = b;
          } else {
            const dirFromB = slidingDirection(from, b);
            const dirAToLand = slidingDirection(a, landing);
            if (dirFromB !== null && dirFromB === dirAToLand) {
              entrance = b;
              exit = a;
            }
          }
        }
        if (entrance !== null && exit !== null) {
          lastPortalMove = {
            piece,
            from,
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
      timeWhite: game.turn === Color.White ? 15 : get().timeWhite,
      timeBlack: game.turn === Color.Black ? 15 : get().timeBlack,
      moveTimerActive: true,
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
      timeWhite: 15,
      timeBlack: 15,
      moveTimerActive: true,
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

  showAnnouncement: (text: string, durationMs = 2000) => {
    set({ announcement: text, paused: true });
    setTimeout(() => {
      set({ announcement: null, paused: false });
    }, durationMs);
  },

  tickTimer: () => {
    const { turn, moveTimerActive, paused } = get();
    if (!moveTimerActive || paused) return;
    const key = turn === Color.White ? "timeWhite" : "timeBlack";
    const current = get()[key];
    const next = Math.max(0, current - 0.1);
    set({ [key]: next });
    if (next <= 0) {
      get().expireTimer();
    }
  },

  expireTimer: () => {
    const { game } = get();
    // Random move when time expires
    const allMoves: { from: SquareIndex; to: SquareIndex }[] = [];
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const sq = ((rank << 4) | file) as SquareIndex;
        const piece = game.board.get(sq);
        if (piece && piece.color === game.turn) {
          const moves = game.getLegalMoves(sq);
          const modified = get().pluginManager.invokeModifyLegalMoves(
            moves,
            game.turn,
          );
          for (const m of modified) {
            allMoves.push({ from: sq, to: m.to });
          }
        }
      }
    }
    if (allMoves.length > 0) {
      const pick = allMoves[Math.floor(Math.random() * allMoves.length)];
      get().makeMove(pick.from, pick.to);
    }
  },

  getPiece: (square: SquareIndex) => get().game.board.get(square),

  isLegalMoveTarget: (square: SquareIndex) =>
    get().legalMoveSquares.includes(square),
}));
