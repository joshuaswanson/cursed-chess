import { create } from "zustand";
import {
  Game,
  Color,
  PieceType,
  GameStatus,
  MoveFlag,
  isGameOver,
  opponent,
} from "../engine";
import type { Board, SquareIndex, Move, MoveRecord, Piece } from "../engine";
import { PluginManager } from "../plugins/manager";
import type { ModePlugin } from "../plugins/types";
import { rankOf, ALL_SQUARES } from "../utils/squareUtils";
import { PortalChessPlugin } from "../plugins/portalChess";
import type { PortalMoveInfo } from "../plugins/portalChess";
import { FogOfWarPlugin } from "../plugins/fogOfWar";
import { BattleRoyalePlugin } from "../plugins/battleRoyale";
import { RallyPlugin } from "../plugins/clashRoyale";
import { MinefieldPlugin } from "../plugins/minefield";
import { KingOfTheHillPlugin } from "../plugins/kingOfTheHill";
import { GRAVITY_SHIFT_MS, GravityPlugin } from "../plugins/gravity";
import { StrategoPlugin } from "../plugins/stratego";
import { FootballPlugin } from "../plugins/football";
import { TugOfWarPlugin } from "../plugins/tugOfWar";
import type { KickTarget } from "../plugins/football";
import { benchKings, reinforce, returnKing } from "./reinforcements";
import type {
  ArrivalStyle,
  BenchedKing,
  BenchedPlayer,
  Reinforcement,
} from "./reinforcements";
import { HexGame } from "../engine/hex/game";
import { chooseMove, PIECE_VALUE } from "../ai/chooseMove";
import type { ThemeId } from "../theme/themes";
import type { SquareBonus } from "../ai/chooseMove";
import type { HexCoord, HexMove } from "../engine/hex";

export type { PortalMoveInfo };

export const MODE_SECONDS = 45;
export const AUTONOMOUS_TICK_MS = 100;
const PLAYER_MOVE_SECONDS = 10;
const AI_MOVE_SECONDS = 1;
/** Clock value for the opening normal-chess phase, which has no time limit */
const UNLIMITED_SECONDS = 999;
/** Battle Royale ends this many seconds after the board stops shrinking */
const BATTLE_ROYALE_FINAL_SECONDS = 5;
/** Plies of normal chess before the cursed modes begin (white, black, white) */
const NORMAL_CHESS_PLIES = 3;
/** When the plain site's glitching gives way to the curse */
const CURSE_BOOM_MS = 2600;
/** How long the curse's title card owns the screen */
const CURSE_REVEAL_MS = 3200;

const MODE_ANNOUNCE_MS = 2000;
/** How long the mode's title card owns the screen: the title, then its catchphrase */
const MODE_CARD_MS = 4200;
const INTRO_HOLD_MS = 4700;
/** Lets the final move animate before the result banner covers the board */
const GAME_END_DELAY_MS = 600;
/** A goal gets its celebration before the result banner */
const GOAL_CELEBRATION_MS = 3600;
const RESULT_MS = 2500;
const RESULT_HOLD_MS = 2800;

/** The square board shatters right after the hex title card leaves */
const HEX_MORPH_OUT_MS = 4600;
const HEX_MORPH_IN_MS = 5500;
const HEX_MORPH_DONE_MS = 6900;

/** Modes that hold back their setup until the title card clears start here */
const INTRO_END_MS = MODE_CARD_MS + 100;
/** Reinforcements start arriving as the mode's title card clears */
const REINFORCE_START_MS = 4300;
const REINFORCE_STAGGER_MS = 160;
/** How long one newcomer takes to land */
export const ARRIVAL_MS = 1700;
/** How long a king takes to stroll off the board */
export const KING_DEPART_MS = 1600;

export interface GameMode {
  name: string;
  theme: ThemeId;
  create: () => ModePlugin[];
  durationSeconds?: number;
  /** How long play stays paused after the mode starts */
  introHoldMs?: number;
  isHex?: boolean;
  /** Modes with their own way to add pieces skip the top-up */
  noReinforcements?: boolean;
  /** Modes won some other way than checkmate, so the kings walk off and leave it to the troops */
  kingsSitOut?: boolean;
}

export const GAME_MODES: GameMode[] = [
  {
    name: "PORTALS",
    theme: "portals",
    create: () => [new PortalChessPlugin()],
  },
  {
    name: "FOG OF WAR",
    theme: "fog",
    create: () => [new FogOfWarPlugin()],
    // The fog drifts in for 5s once the title cards clear
    introHoldMs: MODE_CARD_MS + 5200,
  },
  {
    name: "TUG OF WAR",
    theme: "tug",
    create: () => [new TugOfWarPlugin()],
    durationSeconds: 75,
    kingsSitOut: true,
  },
  {
    name: "FIFA",
    theme: "fifa",
    create: () => [new FootballPlugin()],
    durationSeconds: 60,
    kingsSitOut: true,
  },
  {
    name: "BATTLE ROYALE",
    theme: "royale",
    create: () => [new BattleRoyalePlugin()],
  },
  {
    name: "CLASH ROYALE",
    theme: "clash",
    create: () => [new RallyPlugin()],
    noReinforcements: true,
    durationSeconds: 75,
  },
  {
    name: "MINEFIELD",
    theme: "mines",
    create: () => [new MinefieldPlugin()],
  },
  {
    name: "KING OF THE HILL",
    theme: "hill",
    create: () => [new KingOfTheHillPlugin()],
    kingsSitOut: true,
  },
  {
    name: "GRAVITY",
    theme: "gravity",
    create: () => [new GravityPlugin()],
  },
  {
    name: "HEX CHESS",
    theme: "hex",
    create: () => [],
    durationSeconds: 60,
    introHoldMs: HEX_MORPH_DONE_MS,
    isHex: true,
  },
  {
    name: "STRATEGO",
    theme: "stratego",
    create: () => [new StrategoPlugin()],
  },
];

export type AnnouncementType = "mode" | "win" | "lose" | "draw";

/** Pages of the plain chess site that shows before the curse */
export type SiteTab =
  | "Play"
  | "Puzzles"
  | "Learn"
  | "Watch"
  | "Community"
  | "Terms"
  | "Privacy"
  | "Help";

export interface GameStore {
  game: Game;
  pluginManager: PluginManager;
  status: GameStatus;
  turn: Color;
  moveHistory: MoveRecord[];

  selectedSquare: SquareIndex | null;
  legalMoveSquares: SquareIndex[];
  hasPortalMoves: boolean;
  portalEntrance: SquareIndex | null;
  /** Teammates the selected ball carrier can pass to, with the chance each pass arrives */
  kickOptions: { to: SquareIndex; chance: number }[];
  lastMove: { from: SquareIndex; to: SquareIndex } | null;
  lastPortalMove: PortalMoveInfo | null;
  promotionPending: { from: SquareIndex; to: SquareIndex } | null;
  flipped: boolean;

  scoreWhite: number;
  scoreBlack: number;

  announcement: string | null;
  announcementType: AnnouncementType;
  /** True while play is frozen, by the user or by an announcement */
  paused: boolean;
  userPaused: boolean;

  timeWhite: number;
  timeBlack: number;
  moveTimerActive: boolean;

  /** -1 is the opening normal-chess phase, otherwise an index into GAME_MODES */
  currentModeIndex: number;
  modeTimeRemaining: number;

  devMode: boolean;
  /** False while the game still poses as a plain chess website */
  cursed: boolean;
  curseStage: "glitch" | "boom" | null;

  deployPieceType: PieceType | null;
  /** Bumped every autonomous tick, since plugins change resources and the board in place */
  autonomousTick: number;
  /** The current mode's title cards have cleared */
  introDone: boolean;
  /** Pieces are falling after gravity shifted, so nobody may move */
  gravityFalling: boolean;
  /** The last side to miss a turn, because none of its pieces could move or its time ran out */
  skippedTurn: { id: number; color: Color; reason: "stuck" | "time" } | null;
  /** A piece is on its way through a portal, so the clock waits for it to arrive */
  portalTravelling: boolean;
  siteTab: SiteTab;
  setSiteTab: (tab: SiteTab) => void;

  hexGame: HexGame | null;
  isHexMode: boolean;
  selectedHex: HexCoord | null;
  legalHexMoves: HexMove[];
  lastHexMove: {
    from: HexCoord;
    to: HexCoord;
    captured: boolean;
    /** Counts up with every hex move, so each one is distinct */
    id: number;
  } | null;
  hexPromotionPending: { from: HexCoord; to: HexCoord } | null;
  hexTransition: "morph-out" | "morph-in" | null;
  /** Pieces flying from their old square to their new hex cell as the hex board forms */
  hexArrivals: { from: SquareIndex; to: HexCoord; piece: Piece }[];
  /** Pieces dropping in to top up a side that ran short */
  reinforcements: Reinforcement[];
  /** Kings coaching from the touchline for a mode they sit out */
  sidelineKings: BenchedKing[];
  /** Pieces captured in FIFA, standing beside their coach */
  sidelineBench: BenchedPlayer[];
  arrivalStyle: ArrivalStyle;

  selectHex: (coord: HexCoord) => void;
  makeHexMove: (from: HexCoord, to: HexCoord, promotion?: PieceType) => void;

  legalMovesFrom: (square: SquareIndex) => Move[];
  selectSquare: (square: SquareIndex) => void;
  /** Make the move, or open the promotion picker. Returns null if the target is illegal. */
  requestMove: (
    from: SquareIndex,
    to: SquareIndex,
  ) => "moved" | "promotion" | "kicked" | null;
  /** The ball carrier passes or shoots instead of moving */
  kick: (target: KickTarget) => boolean;
  makeMove: (from: SquareIndex, to: SquareIndex, promotion?: PieceType) => void;
  newGame: () => void;
  flipBoard: () => void;
  clearSelection: () => void;
  togglePause: () => void;
  toggleDevMode: () => void;
  handleGameEnd: (winner: Color | null) => void;
  setDeployPieceType: (type: PieceType | null) => void;
  deployPiece: (square: SquareIndex) => boolean;
  showAnnouncement: (
    text: string,
    durationMs?: number,
    type?: AnnouncementType,
  ) => void;
  tickTimer: () => void;
  expireTimer: () => void;
  tickModeTimer: () => void;
  tickAutonomous: () => void;
  /** Turns the gravity board and lets everything fall when it passes the next step */
  tickGravity: () => void;
  resolveExplosion: (square: SquareIndex) => void;
  /** Moves the portals if a reshuffle is due, once the board has finished animating */
  settlePortals: () => void;
  switchMode: (index?: number) => void;
}

const CLEARED_SELECTION = {
  selectedSquare: null,
  legalMoveSquares: [],
  hasPortalMoves: false,
  portalEntrance: null,
  kickOptions: [],
} satisfies Partial<GameStore>;

const CLEARED_HEX = {
  hexGame: null,
  isHexMode: false,
  selectedHex: null,
  legalHexMoves: [],
  lastHexMove: null,
  hexPromotionPending: null,
  hexTransition: null,
  hexArrivals: [],
  reinforcements: [],
  sidelineKings: [],
  sidelineBench: [],
  arrivalStyle: "parachute",
} satisfies Partial<GameStore>;

const FRESH_BOARD = {
  ...CLEARED_SELECTION,
  ...CLEARED_HEX,
  status: GameStatus.Active,
  turn: Color.White,
  moveHistory: [],
  lastMove: null,
  lastPortalMove: null,
  promotionPending: null,
  deployPieceType: null,
} satisfies Partial<GameStore>;

const FRESH_CLOCKS = {
  moveTimerActive: true,
  timeWhite: PLAYER_MOVE_SECONDS,
  timeBlack: AI_MOVE_SECONDS,
} satisfies Partial<GameStore>;

// Every delayed action goes through schedule() so that quitting or switching
// modes can cancel all of them at once.
const pendingTimers = new Set<ReturnType<typeof setTimeout>>();
let pauseHolds = 0;
let announcementSeq = 0;

function schedule(fn: () => void, ms: number): void {
  const id = setTimeout(() => {
    pendingTimers.delete(id);
    fn();
  }, ms);
  pendingTimers.add(id);
}

function syncPaused(): void {
  useGameStore.setState((s) => ({ paused: s.userPaused || pauseHolds > 0 }));
}

function cancelScheduled(): void {
  for (const id of pendingTimers) clearTimeout(id);
  pendingTimers.clear();
  pauseHolds = 0;
  syncPaused();
}

/** Freeze play for `ms`. Overlapping holds stack, so the longest one wins. */
function holdPause(ms: number): void {
  pauseHolds++;
  syncPaused();
  schedule(() => {
    pauseHolds--;
    syncPaused();
  }, ms);
}

function endGameSoon(
  winner: Color | null,
  delayMs: number = GAME_END_DELAY_MS,
): void {
  schedule(() => useGameStore.getState().handleGameEnd(winner), delayMs);
}

/** The plain chess site starts glitching, then the curse bursts through */
function startCursedIntro(): void {
  holdPause(CURSE_BOOM_MS + CURSE_REVEAL_MS);
  schedule(
    () => useGameStore.setState({ curseStage: "glitch" }),
    GAME_END_DELAY_MS,
  );
  schedule(
    () => useGameStore.setState({ curseStage: "boom", cursed: true }),
    CURSE_BOOM_MS,
  );
  schedule(() => {
    useGameStore.setState({ curseStage: null });
    useGameStore.getState().switchMode();
  }, CURSE_BOOM_MS + CURSE_REVEAL_MS);
}

/** Ends the turn for an action that does not move a piece, like a kick or a battering */
function passTurnWithoutMoving(endDelayMs: number): void {
  const state = useGameStore.getState();
  const { game, pluginManager } = state;
  const mover = game.turn;
  game.turn = opponent(mover);
  game.enPassant = null;
  pluginManager.invokeOnTurnEnd(mover);
  const status = pluginManager.invokeModifyGameStatus(game.getStatus());
  useGameStore.setState({
    ...CLEARED_SELECTION,
    promotionPending: null,
    turn: game.turn,
    status,
    timeWhite:
      game.turn === Color.White ? PLAYER_MOVE_SECONDS : state.timeWhite,
    timeBlack: AI_MOVE_SECONDS,
    moveTimerActive: true,
  });
  if (isGameOver(status)) {
    const winner =
      pluginManager.getWinner() ??
      (status === GameStatus.Checkmate ? mover : null);
    endGameSoon(winner, endDelayMs);
    return;
  }
  skipStuckTurn();
}

/** A beat before a side with nothing to move is passed over, so the last move lands first */
const SKIP_DELAY_MS = 700;

/** Whether the side to move has any move at all, by the mode's rules */
function canMove(state: GameStore): boolean {
  const { game } = state;
  return ALL_SQUARES.some(
    (sq) =>
      game.board.get(sq)?.color === game.turn &&
      state.legalMovesFrom(sq).length > 0,
  );
}

/**
 * With the kings off the board there is no stalemate: a side that cannot move
 * misses its turn, and the players are told. Only if neither side can move is
 * the game a draw.
 */
function skipStuckTurn(): void {
  const state = useGameStore.getState();
  const { game, status, pluginManager } = state;
  if (isGameOver(status) || pluginManager.isAutonomous()) return;
  if (game.board.findKing(game.turn) !== null || canMove(state)) return;
  const stuck = game.turn;
  schedule(() => {
    const now = useGameStore.getState();
    if (now.game.turn !== stuck || isGameOver(now.status) || canMove(now)) {
      return;
    }
    now.game.turn = opponent(stuck);
    const otherCanMove = canMove(useGameStore.getState());
    now.game.turn = stuck;
    if (!otherCanMove) {
      useGameStore.setState({ status: GameStatus.Stalemate });
      endGameSoon(null);
      return;
    }
    useGameStore.setState((s) => ({
      skippedTurn: {
        id: (s.skippedTurn?.id ?? 0) + 1,
        color: stuck,
        reason: "stuck",
      },
    }));
    passTurnWithoutMoving(GAME_END_DELAY_MS);
  }, SKIP_DELAY_MS);
}

/** Alternates two lists, so both sides' reinforcements arrive together */
function interleave<T>(a: T[], b: T[]): T[] {
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) =>
    [a[i], b[i]].filter((x): x is T => x !== undefined),
  ).flat();
}

/** How the current mode's square markings make a square better or worse to stand on */
function modeSquareBonus(
  pluginManager: PluginManager,
  board: Board,
): SquareBonus {
  const football = pluginManager.find<FootballPlugin>("football");
  const tug = pluginManager.find<TugOfWarPlugin>("tug-of-war");
  return (square, piece, from) => {
    const classes = pluginManager
      .getSquareModifiers(square)
      .map((m) => m.className ?? "")
      .join(" ");
    const value = PIECE_VALUE[piece.type];
    let bonus = 0;
    if (classes.includes("danger-square")) bonus -= Math.min(value, 9) * 0.8;
    if (classes.includes("mine-warning") && piece.type !== PieceType.King) {
      bonus -= value;
    }
    if (classes.includes("hill-square")) bonus += 0.5;
    if (football) bonus += football.squareBonus(board, square, piece, from);
    if (tug) bonus += tug.squareBonus(square, piece);
    return bonus;
  };
}

function freshPluginManager(game: Game, plugins: ModePlugin[] = []) {
  const pluginManager = new PluginManager();
  pluginManager.setContext(game);
  for (const plugin of plugins) pluginManager.register(plugin);
  pluginManager.invokeOnGameStart();
  return pluginManager;
}

const initialGame = new Game();

export const useGameStore = create<GameStore>((set, get) => ({
  game: initialGame,
  pluginManager: freshPluginManager(initialGame),
  ...FRESH_BOARD,
  flipped: false,

  scoreWhite: 0,
  scoreBlack: 0,

  announcement: null,
  announcementType: "mode",
  paused: false,
  userPaused: false,

  ...FRESH_CLOCKS,
  timeWhite: UNLIMITED_SECONDS,

  currentModeIndex: -1,
  modeTimeRemaining: UNLIMITED_SECONDS,

  devMode: false,
  cursed: false,
  curseStage: null,
  autonomousTick: 0,
  introDone: true,
  gravityFalling: false,
  skippedTurn: null,
  portalTravelling: false,
  siteTab: "Play",
  setSiteTab: (tab) => set({ siteTab: tab }),

  selectHex: (coord) => {
    const { paused, hexGame, selectedHex, legalHexMoves, makeHexMove } = get();
    if (paused || !hexGame || hexGame.turn !== Color.White) return;

    if (selectedHex) {
      const move = legalHexMoves.find(
        (m) => m.to.q === coord.q && m.to.r === coord.r && !m.promotion,
      );
      if (move) {
        makeHexMove(selectedHex, coord);
        return;
      }
    }

    const piece = hexGame.board.getCoord(coord);
    if (piece && piece.color === hexGame.turn) {
      set({ selectedHex: coord, legalHexMoves: hexGame.getLegalMoves(coord) });
      return;
    }

    set({ selectedHex: null, legalHexMoves: [] });
  },

  makeHexMove: (from, to, promotion) => {
    const { paused, hexGame } = get();
    if (paused || !hexGame) return;

    const move = hexGame
      .getLegalMoves(from)
      .find(
        (m) => m.to.q === to.q && m.to.r === to.r && m.promotion === promotion,
      );
    if (!move) return;

    const mover = hexGame.turn;
    hexGame.makeMove(move);
    const kingCaptured = move.captured?.type === PieceType.King;
    const status = kingCaptured ? GameStatus.Checkmate : hexGame.getStatus();

    set({
      selectedHex: null,
      legalHexMoves: [],
      lastHexMove: {
        from,
        to,
        captured: !!move.captured,
        id: (get().lastHexMove?.id ?? 0) + 1,
      },
      hexPromotionPending: null,
      turn: hexGame.turn,
      status,
      timeWhite:
        hexGame.turn === Color.White ? PLAYER_MOVE_SECONDS : get().timeWhite,
      timeBlack: AI_MOVE_SECONDS,
      moveTimerActive: true,
    });

    if (isGameOver(status)) {
      endGameSoon(status === GameStatus.Checkmate ? mover : null);
    }
  },

  legalMovesFrom: (square) => {
    const { game, pluginManager } = get();
    return pluginManager.invokeModifyLegalMoves(
      game.getLegalMoves(square),
      game.turn,
    );
  },

  selectSquare: (square) => {
    const state = get();
    if (state.paused || state.gravityFalling) return;
    if (state.pluginManager.isAutonomous()) {
      if (state.deployPieceType) state.deployPiece(square);
      return;
    }
    // The human always plays White
    if (state.game.turn !== Color.White) return;

    const { game, selectedSquare, legalMoveSquares, kickOptions } = state;
    if (selectedSquare !== null && legalMoveSquares.includes(square)) {
      state.requestMove(selectedSquare, square);
      return;
    }
    if (selectedSquare !== null && kickOptions.some((k) => k.to === square)) {
      state.kick(square);
      return;
    }

    const piece = game.board.get(square);
    if (piece && piece.color === game.turn) {
      const moves = state.legalMovesFrom(square);
      const hasPortalMoves = moves.some((m) => m.flags & MoveFlag.Portal);
      const portal =
        state.pluginManager.find<PortalChessPlugin>("portal-chess");
      const football = state.pluginManager.find<FootballPlugin>("football");
      const canKick =
        football !== undefined && square === football.ball && !game.isInCheck();
      set({
        selectedSquare: square,
        legalMoveSquares: moves.map((m) => m.to),
        hasPortalMoves,
        portalEntrance:
          hasPortalMoves && portal ? portal.findEntrance(square, moves) : null,
        kickOptions: canKick
          ? football
              .passOptions(game.board, square)
              .map(({ to, chance }) => ({ to, chance }))
          : [],
      });
      return;
    }

    set(CLEARED_SELECTION);
  },

  requestMove: (from, to) => {
    const moves = get()
      .legalMovesFrom(from)
      .filter((m) => m.to === to);
    if (moves.length === 0) {
      const { selectedSquare, kickOptions } = get();
      const canPass =
        selectedSquare === from && kickOptions.some((k) => k.to === to);
      return canPass && get().kick(to) ? "kicked" : null;
    }
    if (moves.some((m) => m.promotion)) {
      set({ promotionPending: { from, to } });
      return "promotion";
    }
    get().makeMove(from, to);
    return "moved";
  },

  makeMove: (from, to, promotion) => {
    const state = get();
    if (state.paused || state.gravityFalling) return;
    const { game, pluginManager } = state;
    const piece = game.board.get(from);
    if (!piece) return;

    const move = state
      .legalMovesFrom(from)
      .find((m) => m.to === to && m.promotion === promotion);
    if (!move) return;

    const processedMove = pluginManager.invokeOnBeforeMove(move);
    if (!processedMove) return;

    const mover = game.turn;
    // A captured FIFA player keeps the number they wore onto the touchline
    const takenShirt = pluginManager
      .find<FootballPlugin>("football")
      ?.shirtOn(processedMove.to);
    const isPortalMove = !!(processedMove.flags & MoveFlag.Portal);
    const success = isPortalMove
      ? game.executeTrustedMove(processedMove)
      : game.makeMove(processedMove);
    if (!success) return;

    const moveState = {
      ...CLEARED_SELECTION,
      lastMove: { from, to: processedMove.to },
      promotionPending: null,
      turn: game.turn,
      moveHistory: [...game.history],
    };

    // In FIFA the taken piece joins its coach on the touchline
    if (processedMove.captured && pluginManager.find("football")) {
      set((s) => ({
        sidelineBench: [
          ...s.sidelineBench,
          {
            piece: { ...processedMove.captured! },
            takenOn: processedMove.to,
            number: takenShirt,
          },
        ],
      }));
    }

    if (processedMove.captured?.type === PieceType.King) {
      set({ ...moveState, lastPortalMove: null, status: GameStatus.Checkmate });
      endGameSoon(mover);
      return;
    }

    // Trace before turn end, which may move the portals
    const lastPortalMove = isPortalMove
      ? (pluginManager
          .find<PortalChessPlugin>("portal-chess")
          ?.traceMove(
            piece,
            from,
            to,
            processedMove.to,
            !!processedMove.captured,
          ) ?? null)
      : null;

    pluginManager.invokeOnAfterMove(processedMove);
    pluginManager.invokeOnTurnEnd(mover);

    const status = pluginManager.invokeModifyGameStatus(game.getStatus());
    const isNormalChess = state.currentModeIndex < 0;

    set({
      ...moveState,
      lastPortalMove,
      status,
      timeWhite: isNormalChess
        ? UNLIMITED_SECONDS
        : game.turn === Color.White
          ? PLAYER_MOVE_SECONDS
          : state.timeWhite,
      timeBlack: AI_MOVE_SECONDS,
      moveTimerActive: true,
    });

    const battleRoyale =
      pluginManager.find<BattleRoyalePlugin>("battle-royale");
    if (
      battleRoyale?.fullyShrunk &&
      get().modeTimeRemaining > BATTLE_ROYALE_FINAL_SECONDS
    ) {
      set({ modeTimeRemaining: BATTLE_ROYALE_FINAL_SECONDS });
    }

    if (isGameOver(status)) {
      const winner =
        pluginManager.getWinner() ??
        (status === GameStatus.Checkmate ? opponent(game.turn) : null);
      endGameSoon(winner);
      return;
    }

    if (isNormalChess && game.history.length === NORMAL_CHESS_PLIES) {
      startCursedIntro();
    }
    skipStuckTurn();
  },

  kick: (target) => {
    const state = get();
    const { game, pluginManager } = state;
    if (state.paused || isGameOver(state.status)) return false;
    const football = pluginManager.find<FootballPlugin>("football");
    if (football?.carrier(game.board)?.color !== game.turn) return false;
    if (game.isInCheck()) return false;
    const kick = football.kick(game.board, target);
    if (!kick) return false;

    passTurnWithoutMoving(
      kick.outcome === "goal" ? GOAL_CELEBRATION_MS : GAME_END_DELAY_MS,
    );
    return true;
  },

  newGame: () => {
    cancelScheduled();
    const game = new Game();
    set({
      game,
      pluginManager: freshPluginManager(game),
      ...FRESH_BOARD,
      ...FRESH_CLOCKS,
      timeWhite: UNLIMITED_SECONDS,
      currentModeIndex: -1,
      modeTimeRemaining: UNLIMITED_SECONDS,
      scoreWhite: 0,
      scoreBlack: 0,
      announcement: null,
      userPaused: false,
      paused: false,
      cursed: false,
      curseStage: null,
    });
  },

  flipBoard: () => set((state) => ({ flipped: !state.flipped })),

  clearSelection: () => set({ ...CLEARED_SELECTION, promotionPending: null }),

  togglePause: () => {
    set((s) => ({ userPaused: !s.userPaused }));
    syncPaused();
  },

  toggleDevMode: () => set((s) => ({ devMode: !s.devMode })),

  handleGameEnd: (winner) => {
    const { scoreWhite, scoreBlack } = get();
    set({
      scoreWhite: scoreWhite + (winner === Color.White ? 1 : 0),
      scoreBlack: scoreBlack + (winner === Color.Black ? 1 : 0),
    });

    const label =
      winner === Color.White
        ? "YOU WIN!"
        : winner === Color.Black
          ? "YOU LOSE!"
          : "DRAW!";
    holdPause(RESULT_HOLD_MS);
    get().showAnnouncement(
      label,
      RESULT_MS,
      winner === Color.White ? "win" : winner === Color.Black ? "lose" : "draw",
    );

    schedule(() => {
      const { devMode, pluginManager, isHexMode, currentModeIndex } = get();
      const game = new Game();
      set({ game, ...FRESH_BOARD });
      // Replaying a mode the kings sit out sends them back to the touchline
      if (devMode && GAME_MODES[currentModeIndex]?.kingsSitOut) {
        set({ sidelineKings: benchKings(game.board, 0) });
      }

      if (!devMode) {
        get().switchMode();
      } else if (isHexMode) {
        set({ hexGame: new HexGame(), isHexMode: true, ...FRESH_CLOCKS });
      } else {
        pluginManager.setContext(game);
        pluginManager.invokeOnGameStart();
        pluginManager.invokeOnIntroEnd();
        set(FRESH_CLOCKS);
      }
    }, RESULT_HOLD_MS);
  },

  setDeployPieceType: (type) => set({ deployPieceType: type }),

  deployPiece: (square) => {
    const { game, pluginManager, deployPieceType, paused } = get();
    if (!deployPieceType || paused) return false;

    const rally = pluginManager.find<RallyPlugin>("rally");
    if (!rally) return false;

    // White deploys on its own half only
    if (rankOf(square) > 3) return false;
    if (!rally.deploy(game.board, square, deployPieceType, Color.White)) {
      return false;
    }
    set({ deployPieceType: null });
    return true;
  },

  showAnnouncement: (text, durationMs = MODE_ANNOUNCE_MS, type = "mode") => {
    const seq = ++announcementSeq;
    set({ announcement: text, announcementType: type });
    holdPause(durationMs);
    schedule(() => {
      if (seq === announcementSeq) set({ announcement: null });
    }, durationMs);
  },

  tickTimer: () => {
    const { turn, moveTimerActive, paused, devMode, pluginManager } = get();
    if (
      !moveTimerActive ||
      paused ||
      get().gravityFalling ||
      get().portalTravelling
    ) {
      return;
    }
    // A mine going off holds the clock, so nobody moves until the blast has played out
    const minefield = pluginManager.find<MinefieldPlugin>("minefield");
    if (minefield && minefield.pendingExplosions.size > 0) return;
    // Dev mode gives the human unlimited time
    if (devMode && turn === Color.White) return;
    const key = turn === Color.White ? "timeWhite" : "timeBlack";
    const next = Math.max(0, get()[key] - 0.1);
    set({ [key]: next });
    if (next <= 0) get().expireTimer();
  },

  // Black's move comes from the AI. A human who runs out of time gets a random move.
  expireTimer: () => {
    const { isHexMode, hexGame, game } = get();
    // A player who runs out of time just misses their move
    const playersTurn = (isHexMode ? hexGame?.turn : game.turn) === Color.White;
    if (playersTurn) {
      set((s) => ({
        skippedTurn: {
          id: (s.skippedTurn?.id ?? 0) + 1,
          color: Color.White,
          reason: "time",
        },
      }));
      if (isHexMode && hexGame) {
        hexGame.turn = Color.Black;
        set({
          turn: Color.Black,
          selectedHex: null,
          legalHexMoves: [],
          timeBlack: AI_MOVE_SECONDS,
          moveTimerActive: true,
        });
      } else {
        passTurnWithoutMoving(GAME_END_DELAY_MS);
      }
      return;
    }
    if (isHexMode) {
      const move = hexGame?.getBestMove(PIECE_VALUE);
      if (move) get().makeHexMove(move.from, move.to, move.promotion);
      return;
    }

    const moves = ALL_SQUARES.filter(
      (sq) => game.board.get(sq)?.color === game.turn,
    )
      .flatMap((sq) => get().legalMovesFrom(sq))
      .filter((m) => !m.promotion || m.promotion === PieceType.Queen);

    // Mode rules can remove every move the engine allows
    if (moves.length === 0 && game.board.findKing(game.turn) === null) {
      skipStuckTurn();
      return;
    }
    if (moves.length === 0) {
      const status = game.isInCheck()
        ? GameStatus.Checkmate
        : GameStatus.Stalemate;
      set({ status });
      endGameSoon(status === GameStatus.Checkmate ? opponent(game.turn) : null);
      return;
    }

    const football = get().pluginManager.find<FootballPlugin>("football");
    const kick =
      game.turn === Color.Black && !game.isInCheck()
        ? football?.chooseKick(game.board, Color.Black)
        : null;
    if (kick != null && get().kick(kick)) return;

    const pick =
      game.turn === Color.Black
        ? chooseMove(
            game,
            moves,
            modeSquareBonus(get().pluginManager, game.board),
          )
        : moves[Math.floor(Math.random() * moves.length)];
    get().makeMove(pick.from, pick.to, pick.promotion);
  },

  tickAutonomous: () => {
    const { pluginManager, paused, status } = get();
    if (paused || isGameOver(status) || !pluginManager.isAutonomous()) return;

    const winner = pluginManager.invokeTickAutonomous(AUTONOMOUS_TICK_MS);
    set((s) => ({ autonomousTick: s.autonomousTick + 1 }));
    if (winner === null) return;
    set({ status: GameStatus.Checkmate });
    endGameSoon(winner);
  },

  tickGravity: () => {
    const { pluginManager, game, paused, status, introDone, gravityFalling } =
      get();
    const gravity = pluginManager.find<GravityPlugin>("gravity");
    if (!gravity) return;
    const now = performance.now();
    if (paused || !introDone || gravityFalling || isGameOver(status)) {
      gravity.holdSpin(now);
      return;
    }
    gravity.resumeSpin(now);
    if (!gravity.shiftIfDue({ game, board: game.board }, now)) return;

    const next = pluginManager.invokeModifyGameStatus(game.getStatus());
    set({
      ...CLEARED_SELECTION,
      promotionPending: null,
      gravityFalling: true,
      status: next,
      turn: game.turn,
    });
    schedule(() => set({ gravityFalling: false }), GRAVITY_SHIFT_MS);
    if (isGameOver(next)) {
      endGameSoon(
        next === GameStatus.Checkmate ? opponent(game.turn) : null,
        GRAVITY_SHIFT_MS,
      );
    }
  },

  tickModeTimer: () => {
    const { paused, modeTimeRemaining, devMode } = get();
    if (paused || devMode) return;
    const next = Math.max(0, modeTimeRemaining - 1);
    set({ modeTimeRemaining: next });
    if (next > 0) return;
    get().switchMode();
  },

  settlePortals: () => {
    const { pluginManager, game } = get();
    const portals = pluginManager.find<PortalChessPlugin>("portal-chess");
    if (!portals?.settle({ game, board: game.board })) return;
    // Hints worked out against the old portals no longer apply
    set({ ...CLEARED_SELECTION });
  },

  resolveExplosion: (square) => {
    const { pluginManager, game } = get();
    const minefield = pluginManager.find<MinefieldPlugin>("minefield");
    if (!minefield) return;
    minefield.resolveExplosion({ game, board: game.board }, square);
    set({ turn: game.turn });
  },

  switchMode: (index) => {
    const { currentModeIndex, game, isHexMode, hexGame } = get();
    const nextIndex =
      index ??
      (currentModeIndex < 0 ? 0 : (currentModeIndex + 1) % GAME_MODES.length);
    const mode = GAME_MODES[nextIndex];

    cancelScheduled();

    // Surviving pieces carry over between the square and hex boards
    const armies = isHexMode && hexGame ? hexGame.armies() : game.armies();

    set({
      currentModeIndex: nextIndex,
      cursed: true,
      curseStage: null,
      modeTimeRemaining: mode.durationSeconds ?? MODE_SECONDS,
      status: GameStatus.Active,
      ...CLEARED_SELECTION,
      lastPortalMove: null,
      promotionPending: null,
      deployPieceType: null,
      reinforcements: [],
      ...FRESH_CLOCKS,
    });

    holdPause(mode.introHoldMs ?? INTRO_HOLD_MS);
    get().showAnnouncement(mode.name, MODE_CARD_MS, "mode");

    if (mode.isHex) {
      // Remember each piece's square so it can fly to its new hex cell
      const sources = isHexMode
        ? []
        : ALL_SQUARES.flatMap((sq) => {
            const piece = game.board.get(sq);
            return piece ? [{ sq, piece: { ...piece } }] : [];
          });
      const army = (color: Color) => {
        const pieces =
          sources.length > 0
            ? sources.filter((s) => s.piece.color === color).map((s) => s.piece)
            : armies[color];
        // A king who sat out the last mode rejoins his side
        return pieces.some((p) => p.type === PieceType.King)
          ? pieces
          : [...pieces, { type: PieceType.King, color }];
      };

      schedule(() => set({ hexTransition: "morph-out" }), HEX_MORPH_OUT_MS);
      schedule(() => {
        const hexGame = new HexGame(army(Color.White), army(Color.Black));
        const hexArrivals = sources.flatMap(({ sq, piece }) => {
          const to = hexGame.placements.get(piece);
          return to ? [{ from: sq, to, piece }] : [];
        });
        set({
          ...CLEARED_HEX,
          pluginManager: freshPluginManager(game),
          hexGame,
          hexArrivals,
          isHexMode: true,
          hexTransition: "morph-in",
          turn: Color.White,
        });
      }, HEX_MORPH_IN_MS);
      schedule(
        () => set({ hexTransition: null, hexArrivals: [] }),
        HEX_MORPH_DONE_MS,
      );
      return;
    }

    const nextGame = isHexMode
      ? Game.fromArmies(armies[Color.White], armies[Color.Black])
      : game;
    // A turned board's pawn rules end with its mode
    nextGame.pawnRules = null;

    // Kings leave for modes they sit out, and come back for the next one that needs them
    const sidelineKings = mode.kingsSitOut
      ? benchKings(nextGame.board, REINFORCE_START_MS)
      : [];
    const returningKings = mode.kingsSitOut
      ? []
      : [Color.White, Color.Black].flatMap((color) => {
          const sq = returnKing(nextGame.board, color);
          return sq === null
            ? []
            : [{ sq, piece: { type: PieceType.King, color } }];
        });

    // Newcomers land before the mode's rules are set up, so they count for them
    const kingsWalkOff = sidelineKings.some((king) => king.sq !== null);
    // Any newcomers wait for the kings to clear the pitch
    const arrivalsStart =
      REINFORCE_START_MS + (kingsWalkOff ? KING_DEPART_MS : 0);
    const reinforcements = mode.noReinforcements
      ? []
      : [
          ...returningKings,
          ...interleave(
            reinforce(nextGame.board, Color.White),
            reinforce(nextGame.board, Color.Black),
          ),
        ].map((r, i) => ({
          ...r,
          delayMs: arrivalsStart + i * REINFORCE_STAGGER_MS,
        }));
    const settledMs = Math.max(
      reinforcements.length > 0
        ? reinforcements[reinforcements.length - 1].delayMs + ARRIVAL_MS
        : 0,
      kingsWalkOff ? REINFORCE_START_MS + KING_DEPART_MS : 0,
    );
    if (settledMs > 0) {
      holdPause(settledMs + 250);
      schedule(() => set({ reinforcements: [] }), settledMs + 250);
    }

    set({
      ...CLEARED_HEX,
      game: nextGame,
      reinforcements,
      sidelineKings,
      arrivalStyle: Math.random() < 0.5 ? "parachute" : "sprint",
      introDone: false,
      gravityFalling: false,
      skippedTurn: null,
      portalTravelling: false,
      pluginManager: freshPluginManager(nextGame, mode.create()),
      turn: nextGame.turn,
      moveHistory: [...nextGame.history],
      ...(isHexMode ? { lastMove: null } : {}),
    });
    schedule(() => {
      get().pluginManager.invokeOnIntroEnd();
      set({ introDone: true });
    }, INTRO_END_MS);
  },
}));
