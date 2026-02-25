import { create } from "zustand";
import { Game, Color, PieceType, GameStatus, MoveFlag } from "../engine";
import type { SquareIndex, Piece, MoveRecord } from "../engine";
import { PluginManager } from "../plugins/manager";
import type { ModePlugin } from "../plugins/types";
import { fileOf, rankOf, isValidSquare } from "../utils/squareUtils";
import { PortalChessPlugin } from "../plugins/portalChess";
import { FogOfWarPlugin } from "../plugins/fogOfWar";
import { BattleRoyalePlugin } from "../plugins/battleRoyale";
import { RallyPlugin, PIECE_COST } from "../plugins/rallyTheTroops";

export interface GameMode {
  name: string;
  create: () => ModePlugin[];
}

export const GAME_MODES: GameMode[] = [
  { name: "PORTAL CHESS", create: () => [new PortalChessPlugin()] },
  { name: "FOG OF WAR", create: () => [new FogOfWarPlugin()] },
  { name: "BATTLE ROYALE", create: () => [new BattleRoyalePlugin()] },
  { name: "RALLY THE TROOPS", create: () => [new RallyPlugin()] },
];

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
  transits: { entrance: SquareIndex; exit: SquareIndex }[];
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
  announcementType: "mode" | "intro";
  paused: boolean;

  // Timer
  timeWhite: number;
  timeBlack: number;
  moveTimerActive: boolean;

  // Mode cycling
  currentModeIndex: number;
  modeTimeRemaining: number;

  // Rally deployment
  deployPieceType: PieceType | null;

  // Actions
  selectSquare: (square: SquareIndex) => void;
  makeMove: (from: SquareIndex, to: SquareIndex, promotion?: PieceType) => void;
  undoMove: () => void;
  newGame: (fen?: string, plugins?: ModePlugin[]) => void;
  flipBoard: () => void;
  clearSelection: () => void;
  togglePause: () => void;
  setDeployPieceType: (type: PieceType | null) => void;
  deployPiece: (square: SquareIndex) => boolean;
  showAnnouncement: (
    text: string,
    durationMs?: number,
    type?: "mode" | "intro",
  ) => void;
  tickTimer: () => void;
  expireTimer: () => void;
  tickModeTimer: () => void;
  tickAutonomous: () => void;
  switchMode: () => void;

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
  announcementType: "mode" as const,
  paused: false,

  timeWhite: 15,
  timeBlack: 1,
  moveTimerActive: false,

  currentModeIndex: -1,
  modeTimeRemaining: 60,

  deployPieceType: null,

  selectSquare: (square: SquareIndex) => {
    const state = get();
    if (state.paused) return;
    // During autonomous mode, only allow deployment clicks
    if (state.pluginManager.isAutonomous()) {
      if (state.deployPieceType) {
        state.deployPiece(square);
      }
      return;
    }
    // Human plays White only — block interaction during Black's turn
    if (state.game.turn === Color.Black) return;
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
      const landing = processedMove.to;

      // Build a lookup for portal squares
      const portalExitMap = new Map<number, SquareIndex>();
      for (const po of overlays) {
        if (po.type !== "portal" || po.squares.length !== 2) continue;
        const [a, b] = po.squares;
        portalExitMap.set(a, b);
        portalExitMap.set(b, a);
      }

      // Try to find the path by walking from `from` in a sliding direction
      // through portals until we reach `landing`.
      // For non-chained moves, the direction from→entrance is enough.
      // For chained moves, try all 8 directions.
      const ALL_DIRS = [16, -16, 1, -1, 17, 15, -15, -17];

      // Helper: walk from `from` in direction `dir`, recording portal transits
      const tryWalk = (
        dir: number,
      ): { entrance: SquareIndex; exit: SquareIndex }[] | null => {
        const transits: { entrance: SquareIndex; exit: SquareIndex }[] = [];
        const visitedExits = new Set<number>();
        let sq = (from + dir) as SquareIndex;

        // Walk to first portal entrance or to landing
        while (isValidSquare(sq)) {
          if (sq === landing && transits.length > 0) return transits;
          const exitSq = portalExitMap.get(sq);
          if (exitSq !== undefined) {
            transits.push({ entrance: sq, exit: exitSq });
            if (visitedExits.has(exitSq)) return null; // infinite loop
            visitedExits.add(exitSq);
            // Continue walking from exit in same direction
            sq = (exitSq + dir) as SquareIndex;
            continue;
          }
          // Not a portal; if we've passed through at least one portal and
          // haven't reached landing, keep walking
          if (transits.length === 0) {
            // Haven't hit any portal yet, keep going
            sq = (sq + dir) as SquareIndex;
            continue;
          }
          if (sq === landing) return transits;
          sq = (sq + dir) as SquareIndex;
        }
        return null;
      };

      // First, try the natural direction from→to (the user-clicked target)
      const naturalDir = slidingDirection(from, to);
      if (naturalDir !== null) {
        const result = tryWalk(naturalDir);
        if (result && result.length > 0) {
          lastPortalMove = { piece, from, transits: result, landing };
        }
      }

      // If natural direction didn't work, try all 8 directions
      if (!lastPortalMove) {
        for (const dir of ALL_DIRS) {
          const result = tryWalk(dir);
          if (result && result.length > 0) {
            lastPortalMove = { piece, from, transits: result, landing };
            break;
          }
        }
      }

      // Fallback for non-sliding portal moves (knight/king/pawn):
      // single transit, entrance = to (clicked portal), exit from map
      if (!lastPortalMove && portalExitMap.has(to)) {
        lastPortalMove = {
          piece,
          from,
          transits: [{ entrance: to, exit: portalExitMap.get(to)! }],
          landing,
        };
      }
    }

    const isNormalChess = get().currentModeIndex < 0;

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
      timeWhite: isNormalChess
        ? 999
        : game.turn === Color.White
          ? 15
          : get().timeWhite,
      timeBlack: 1,
      moveTimerActive: true,
    });

    // Normal chess: switch to chaos after 3 moves (white, black, white)
    if (isNormalChess && game.history.length >= 3) {
      // Wait for the piece movement animation to finish before announcing
      setTimeout(() => {
        get().showAnnouncement("GET READY!", 1500, "intro");
        setTimeout(() => {
          get().showAnnouncement("CHAOS CHESS", 2000, "intro");
          setTimeout(() => {
            get().switchMode();
          }, 2000);
        }, 1800);
      }, 600);
    }
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
      timeWhite: 999,
      timeBlack: 1,
      moveTimerActive: true,
      modeTimeRemaining: 999,
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

  togglePause: () => set((state) => ({ paused: !state.paused })),

  setDeployPieceType: (type: PieceType | null) => {
    set({ deployPieceType: type });
  },

  deployPiece: (square: SquareIndex) => {
    const { game, pluginManager, deployPieceType } = get();
    if (!deployPieceType) return false;

    // Find the rally plugin
    const rallyPlugin = pluginManager
      .getPlugins()
      .find((p) => p.id === "rally") as RallyPlugin | undefined;
    if (!rallyPlugin) return false;

    // Check cost
    const cost = PIECE_COST[deployPieceType];
    if (cost === undefined || rallyPlugin.resourceWhite < cost) return false;

    // Only deploy on White's half (ranks 0-3), must be empty
    const rank = rankOf(square);
    if (rank > 3) return false;
    if (game.board.get(square)) return false;

    // Deploy the piece
    game.board.put(square, { type: deployPieceType, color: Color.White });
    rallyPlugin.resourceWhite -= cost;

    set({ deployPieceType: null });
    return true;
  },

  showAnnouncement: (
    text: string,
    durationMs = 2000,
    type: "mode" | "intro" = "mode",
  ) => {
    set({ announcement: text, announcementType: type, paused: true });
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

  tickAutonomous: () => {
    const { pluginManager, paused, game } = get();
    if (paused) return;
    if (!pluginManager.isAutonomous()) return;

    const move = pluginManager.invokeTickAutonomous(200);
    if (!move) return;

    // Auto-promote pawns to queen
    const piece = game.board.get(move.from);
    let promotion: PieceType | undefined;
    if (piece && piece.type === PieceType.Pawn) {
      if (
        (piece.color === Color.White && rankOf(move.to) === 7) ||
        (piece.color === Color.Black && rankOf(move.to) === 0)
      ) {
        promotion = PieceType.Queen;
      }
    }

    get().makeMove(move.from, move.to, promotion);
  },

  tickModeTimer: () => {
    const { paused, modeTimeRemaining } = get();
    if (paused) return;
    const next = Math.max(0, modeTimeRemaining - 1);
    set({ modeTimeRemaining: next });
    if (next <= 0) {
      get().switchMode();
    }
  },

  switchMode: () => {
    const { currentModeIndex, game } = get();
    // -1 = Normal Chess (initial only), transition to first chaos mode
    const nextIndex =
      currentModeIndex < 0 ? 0 : (currentModeIndex + 1) % GAME_MODES.length;
    const mode = GAME_MODES[nextIndex];

    // Swap plugins on the current game (preserve board state)
    const pluginManager = new PluginManager();
    pluginManager.setContext(game);
    for (const plugin of mode.create()) {
      pluginManager.register(plugin);
    }
    pluginManager.invokeOnGameStart();

    // Fog of war: show announcement briefly, then pause while fog rolls in
    const isFog = pluginManager.getPlugins().some((p) => p.id === "fog-of-war");

    set({
      currentModeIndex: nextIndex,
      modeTimeRemaining: 60,
      pluginManager,
      selectedSquare: null,
      legalMoveSquares: [],
      hasPortalMoves: false,
      portalEntrance: null,
      moveTimerActive: true,
      timeWhite: 15,
      timeBlack: 1,
    });

    get().showAnnouncement(mode.name);

    if (isFog) {
      // Keep the game paused after the announcement ends while fog rolls in
      setTimeout(() => {
        set({ paused: true });
        setTimeout(() => {
          set({ paused: false });
        }, 6000);
      }, 2000);
    }
  },

  getPiece: (square: SquareIndex) => get().game.board.get(square),

  isLegalMoveTarget: (square: SquareIndex) =>
    get().legalMoveSquares.includes(square),
}));
