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
import {
  ALL_SQUARES,
  boardFiles,
  boardRanks,
  rankOf,
  setBoardSize,
} from "../utils/squareUtils";
import { PortalChessPlugin } from "../plugins/portalChess";
import type { PortalMoveInfo } from "../plugins/portalChess";
import { FogOfWarPlugin } from "../plugins/fogOfWar";
import { BattleRoyalePlugin } from "../plugins/battleRoyale";
import { RallyPlugin } from "../plugins/clashRoyale";
import { MinefieldPlugin } from "../plugins/minefield";
import { KingOfTheHillPlugin } from "../plugins/kingOfTheHill";
import { GRAVITY_SHIFT_MS, GravityPlugin } from "../plugins/gravity";
import { LanternsPlugin } from "../plugins/lanterns";
import { HEIST_FILES, HEIST_RANKS, HeistPlugin } from "../plugins/heist";
import { StrategoPlugin } from "../plugins/stratego";
import { FootballPlugin } from "../plugins/football";
import { TugOfWarPlugin } from "../plugins/tugOfWar";
import { ZOMBIE_FINISH_MS, ZombiesPlugin } from "../plugins/zombies";
import { TrenchesPlugin } from "../plugins/trenches";
import type { SquadId } from "../plugins/trenches";
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
import {
  ASIDE_LEAD_MS,
  SPEECH_LEAD_MS,
  introDuration,
  introScript,
} from "../components/Chessbot/intro";
import type { ChessbotMood } from "../components/Chessbot/Chessbot";

export type { PortalMoveInfo };

export const MODE_SECONDS = 45;
export const AUTONOMOUS_TICK_MS = 100;
const PLAYER_MOVE_SECONDS = 10;
const AI_MOVE_SECONDS = 1;
/** Clock value for the opening normal-chess phase, which has no time limit */
const UNLIMITED_SECONDS = 999;
/** Battle Royale ends this many seconds after the board stops shrinking */
const BATTLE_ROYALE_FINAL_SECONDS = 5;
/** Plies of normal chess before Chessbot steps in (white, black, white) */
const NORMAL_CHESS_PLIES = 3;
/** How long the plain site glitches before the curse bursts through */
const CURSE_GLITCH_MS = 2200;
/** How long he peeks over the bottom of the screen before anything breaks */
export const CURSE_PEEK_MS = 1500;
/** How long he has to gloat about it before the curse bursts through */
const CURSE_OOPS_MS = 2800;
/** How long the curse's title card owns the screen */
const CURSE_REVEAL_MS = 3200;

const MODE_ANNOUNCE_MS = 2000;
/** How long the mode's title card owns the screen: the title, then its catchphrase */
const MODE_CARD_MS = 4200;
const INTRO_HOLD_MS = 4700;
/** Lets the final move animate before the result banner covers the board */
const GAME_END_DELAY_MS = 600;
/** Long enough for a piece to go through a portal and land before the result shows */
const PORTAL_END_DELAY_MS = 2400;
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
  /**
   * Modes won some other way than checkmate, so the kings walk off and leave
   * it to the troops. These have no clock: they run until one side wins.
   */
  kingsSitOut?: boolean;
  /** Modes with no clock that run until one side wins, kings and all */
  untilWon?: boolean;
  /** How many ranks deep its board is, where that is not the usual eight */
  ranks?: number;
  /** How many files wide its board is, where that is not the usual eight */
  files?: number;
  /** Left out of the adventure: played only when picked from the main menu */
  singleOnly?: boolean;
  /** Still being tried out: listed apart from the finished modes on the main menu */
  beta?: boolean;
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
    name: "FIFA",
    theme: "fifa",
    create: () => [new FootballPlugin()],
    kingsSitOut: true,
  },
  {
    name: "TUG OF WAR",
    theme: "tug",
    create: () => [new TugOfWarPlugin()],
    kingsSitOut: true,
  },
  {
    name: "MINEFIELD",
    theme: "mines",
    create: () => [new MinefieldPlugin()],
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
    name: "LANTERNS",
    theme: "lanterns",
    create: () => [new LanternsPlugin()],
  },
  {
    name: "HEIST",
    theme: "heist",
    create: () => [new HeistPlugin()],
    ranks: HEIST_RANKS,
    files: HEIST_FILES,
    kingsSitOut: true,
    noReinforcements: true,
    singleOnly: true,
    beta: true,
  },
  {
    name: "ZOMBIES",
    theme: "zombies",
    create: () => [new ZombiesPlugin()],
  },
  {
    name: "STRATEGO",
    theme: "stratego",
    create: () => [new StrategoPlugin()],
  },
  {
    name: "TRENCHES",
    theme: "trenches",
    create: () => [new TrenchesPlugin()],
    noReinforcements: true,
    untilWon: true,
    singleOnly: true,
    beta: true,
  },
];

/** The next mode of the adventure after this one, or -1 once the last has been played */
function nextAdventureMode(after: number): number {
  return GAME_MODES.findIndex((mode, i) => i > after && !mode.singleOnly);
}

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
  /** In Trenches, the man of yours picked out to be sent forward on his own */
  trenchPicked: SquareIndex | null;
  legalMoveSquares: SquareIndex[];
  hasPortalMoves: boolean;
  portalEntrance: SquareIndex | null;
  /** Teammates the selected ball carrier can pass to, with the chance each pass arrives */
  kickOptions: { to: SquareIndex; chance: number }[];
  lastMove: { from: SquareIndex; to: SquareIndex } | null;
  lastPortalMove: PortalMoveInfo | null;
  promotionPending: { from: SquareIndex; to: SquareIndex } | null;
  flipped: boolean;
  /** The colour this browser plays: White, except for the guest of an online game */
  seat: Color;
  /** An online game with a friend, if one is on: which end of it this browser is, and how the link stands */
  net: NetLink | null;
  /** The guest's copy of the moves open to them, sent over by the host with each position */
  netLegal: Move[];
  /** The main menu is showing the online lobby */
  lobbyOpen: boolean;

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

  /** False while the game still poses as a plain chess website */
  cursed: boolean;
  /** The plain site's end: Chessbot shows himself, the site glitches, the curse bursts through */
  curseStage: "hello" | "peek" | "glitch" | "oops" | "boom" | null;
  /** The main menu is up, between games */
  menuOpen: boolean;
  /** Adventure runs every mode once in order; a single mode is played alone. Either ends at the main menu. */
  playMode: "adventure" | "single";
  /**
   * His remark on your opening move: the plain site glitches, a terminal
   * opens in the move list and he types into it, then it glitches shut and
   * is gone, as if he had broken through for a moment and been shut out
   */
  aside: "glitch" | "typing" | "leaving" | "said" | null;
  /** How Chessbot looks at this point in his opening speech */
  introMood: ChessbotMood;
  /** How far his speech has corrupted the plain site: one step for each line he has begun */
  corruption: number;

  deployPieceType: PieceType | null;
  /** Your cards in Clash Royale */
  clashHand: ClashHand;
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
  /** The undead are rising, shambling, or biting, so the clocks wait for them to finish */
  zombiesActing: boolean;
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
  handleGameEnd: (winner: Color | null) => void;
  setDeployPieceType: (type: PieceType | null) => void;
  deployPiece: (square: SquareIndex) => boolean;
  /** Blows the whistle in Trenches, sending your front line over the top */
  trenchAttack: () => boolean;
  /** Sends everyone holding one of your trench lines forward to the next */
  trenchAdvance: (rank: number) => boolean;
  /** Send one of your men in Trenches out of his trench for the next one ahead */
  trenchAdvanceMan: (square: SquareIndex) => boolean;
  /** Sends one of your squads up to your back trench in Trenches */
  trenchSend: (card: SquadId) => boolean;
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
  /** Leave whatever is being played for the main menu */
  openMenu: () => void;
  /** From the main menu: the whole adventure again, from the plain chess site on */
  startAdventure: () => void;
  /** From the main menu: one mode, played by itself */
  startSingle: (index: number) => void;
}

/**
 * Your cards in Clash Royale: the four in your hand, and the one waiting to
 * take the place of whichever you play, which then goes to the back to wait
 * in its turn
 */
export interface ClashHand {
  slots: PieceType[];
  next: PieceType;
  /** How many cards have been dealt into each slot, so a new one can be seen arriving */
  dealt: number[];
}

const CLASH_DECK = [
  PieceType.Pawn,
  PieceType.Knight,
  PieceType.Bishop,
  PieceType.Rook,
  PieceType.Queen,
];
const CLASH_HAND_SIZE = 4;

function dealClashHand(): ClashHand {
  const deck = [...CLASH_DECK];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return {
    slots: deck.slice(0, CLASH_HAND_SIZE),
    next: deck[CLASH_HAND_SIZE],
    dealt: Array(CLASH_HAND_SIZE).fill(0),
  };
}

/** One end of an online game: the host's browser runs it, and the guest's shows what it is sent */
export interface NetLink {
  role: "host" | "guest";
  /** The code the two found each other by */
  code: string;
  status: "waiting" | "connecting" | "connected" | "lost";
}

/** What the guest sends the host: for now, only the moves it wants played */
export type GuestMessage = {
  t: "move";
  from: SquareIndex;
  to: SquareIndex;
  promotion?: PieceType;
};

let sendToHost: ((message: GuestMessage) => void) | null = null;
/** Gives the store its line to the host, or takes it away */
export function connectGuestLine(
  send: ((message: GuestMessage) => void) | null,
): void {
  sendToHost = send;
}

const isGuest = () => useGameStore.getState().net?.role === "guest";
/** How long Black has for a move: a moment for the computer, a full turn for a friend */
const foeSeconds = () =>
  useGameStore.getState().net ? PLAYER_MOVE_SECONDS : AI_MOVE_SECONDS;

/** How many moves had been played when the current mode began */
let modeStartPly = 0;

const CLEARED_SELECTION = {
  selectedSquare: null,
  trenchPicked: null,
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
  clashHand: dealClashHand(),
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
  useGameStore.setState((s) => ({
    paused: s.userPaused || pauseHolds > 0 || s.menuOpen,
  }));
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

/** What the trenches looked like at the last redraw */
let lastTrenchLook: string | undefined;
let lastTrenchDraw = 0;
/** How often, at most, the Trenches board redraws: each redraw of a crowded front costs the page dearly */
const TRENCH_REDRAW_MS = 200;

function endGameSoon(
  winner: Color | null,
  delayMs: number = GAME_END_DELAY_MS,
): void {
  // A king mated by zombies is bitten first, so the player sees how they lost
  const zombies = useGameStore
    .getState()
    .pluginManager.find<ZombiesPlugin>("zombies");
  const wait = zombies?.finishingBite
    ? Math.max(delayMs, ZOMBIE_FINISH_MS)
    : delayMs;
  schedule(() => useGameStore.getState().handleGameEnd(winner), wait);
}

/** How long the plain site glitches after your first move, before he says anything */
const ASIDE_GLITCH_MS = 1300;

/** How long your first move is left to land before anything goes wrong */
const ASIDE_WAIT_MS = 1000;
/** How long his terminal takes to glitch shut once he has had his say */
const ASIDE_LEAVE_MS = 700;

/**
 * Your first move lets him through for a moment: the plain site glitches,
 * he types what he thinks of it into the move list, then the terminal
 * glitches shut, everything settles, and the computer simply replies
 */
function startAside(): void {
  const opening = useGameStore.getState().moveHistory[0]?.san ?? "e4";
  const typing = introDuration(introScript(opening).slice(0, 1), ASIDE_LEAD_MS);
  const typeAt = ASIDE_WAIT_MS + ASIDE_GLITCH_MS;
  const leaveAt = typeAt + typing;
  holdPause(leaveAt + ASIDE_LEAVE_MS);
  schedule(() => useGameStore.setState({ aside: "glitch" }), ASIDE_WAIT_MS);
  schedule(() => useGameStore.setState({ aside: "typing" }), typeAt);
  schedule(() => useGameStore.setState({ aside: "leaving" }), leaveAt);
  schedule(
    () => useGameStore.setState({ aside: "said" }),
    leaveAt + ASIDE_LEAVE_MS,
  );
}

/**
 * Chessbot shows himself in his icon on the plain chess site and types what
 * he thinks of it into the move list. Then he leaves the card and peeks up
 * from the corner of the screen, breaks the site while he cackles, gloats,
 * and the curse bursts through.
 */
function startCursedIntro(): void {
  const opening = useGameStore.getState().moveHistory[0]?.san ?? "e4";
  const helloAt = GAME_END_DELAY_MS;
  const peekAt =
    helloAt + introDuration(introScript(opening).slice(1), SPEECH_LEAD_MS);
  const glitchAt = peekAt + CURSE_PEEK_MS;
  const oopsAt = glitchAt + CURSE_GLITCH_MS;
  const boomAt = oopsAt + CURSE_OOPS_MS;
  holdPause(boomAt + CURSE_REVEAL_MS);
  schedule(
    () =>
      useGameStore.setState({
        curseStage: "hello",
        introMood: "happy",
        corruption: 0,
      }),
    helloAt,
  );
  schedule(() => useGameStore.setState({ curseStage: "peek" }), peekAt);
  schedule(() => useGameStore.setState({ curseStage: "glitch" }), glitchAt);
  schedule(() => useGameStore.setState({ curseStage: "oops" }), oopsAt);
  schedule(
    () => useGameStore.setState({ curseStage: "boom", cursed: true }),
    boomAt,
  );
  schedule(() => {
    useGameStore.setState({ curseStage: null });
    useGameStore.getState().switchMode();
  }, boomAt + CURSE_REVEAL_MS);
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
    timeBlack: foeSeconds(),
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
  const zombies = pluginManager.find<ZombiesPlugin>("zombies");
  const heist = pluginManager.find<HeistPlugin>("heist");
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
    if (zombies) bonus += zombies.squareBonus(square, piece);
    if (heist) bonus += heist.squareBonus(square, piece, from);
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
  seat: Color.White,
  net: null,
  netLegal: [],
  lobbyOpen: false,

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

  cursed: false,
  curseStage: null,
  introMood: "happy",
  corruption: 0,
  aside: null,
  menuOpen: false,
  playMode: "adventure",
  autonomousTick: 0,
  introDone: true,
  gravityFalling: false,
  skippedTurn: null,
  portalTravelling: false,
  zombiesActing: false,
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
      timeBlack: foeSeconds(),
      moveTimerActive: true,
    });

    if (isGameOver(status)) {
      endGameSoon(status === GameStatus.Checkmate ? mover : null);
    }
  },

  legalMovesFrom: (square) => {
    const { game, pluginManager } = get();
    // The guest plays from the moves the host says are open
    if (isGuest()) return get().netLegal.filter((m) => m.from === square);
    return pluginManager
      .invokeModifyLegalMoves(game.getLegalMoves(square), game.turn)
      .filter((move) => move.from === square);
  },

  selectSquare: (square) => {
    const state = get();
    // Nobody moves while pieces fall or the undead are still acting
    if (state.paused || state.gravityFalling || state.zombiesActing) return;
    if (state.pluginManager.isAutonomous()) {
      if (state.deployPieceType) state.deployPiece(square);
      else
        set({
          trenchPicked: state.trenchPicked === square ? null : square,
        });
      return;
    }
    // Each player moves only their own side
    if (state.game.turn !== state.seat) return;

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
    // The guest's moves are played on the host's board, and come back from there
    if (isGuest()) {
      sendToHost?.({ t: "move", from, to, promotion });
      set({ ...CLEARED_SELECTION, promotionPending: null });
      return;
    }
    const state = get();
    // Nobody moves while pieces fall or the undead are still acting
    if (state.paused || state.gravityFalling || state.zombiesActing) return;
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
    const success =
      isPortalMove || processedMove.flags & MoveFlag.ModeMove
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

    // A finishing move through a portal plays out before the result comes up
    const endDelay = isPortalMove ? PORTAL_END_DELAY_MS : GAME_END_DELAY_MS;

    if (processedMove.captured?.type === PieceType.King) {
      set({ ...moveState, lastPortalMove, status: GameStatus.Checkmate });
      endGameSoon(mover, endDelay);
      return;
    }

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
      timeBlack: foeSeconds(),
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
      endGameSoon(winner, endDelay);
      return;
    }

    if (isNormalChess && game.history.length === NORMAL_CHESS_PLIES) {
      startCursedIntro();
    } else if (isNormalChess && game.history.length === 1) {
      startAside();
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
    setBoardSize();
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
      introMood: "happy",
      corruption: 0,
      menuOpen: false,
      playMode: "adventure",
      aside: null,
    });
  },

  flipBoard: () => set((state) => ({ flipped: !state.flipped })),

  clearSelection: () => set({ ...CLEARED_SELECTION, promotionPending: null }),

  togglePause: () => {
    if (isGuest()) return;
    set((s) => ({ userPaused: !s.userPaused }));
    syncPaused();
  },

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
      setBoardSize();
      set({ game: new Game(), ...FRESH_BOARD });
      get().switchMode();
    }, RESULT_HOLD_MS);
  },

  setDeployPieceType: (type) => set({ deployPieceType: type }),

  trenchAttack: () => {
    const { game, pluginManager, paused } = get();
    const trenches = pluginManager.find<TrenchesPlugin>("trenches");
    if (!trenches || paused) return false;
    const ordered = trenches.attack(game.board, Color.White);
    if (ordered) set((s) => ({ autonomousTick: s.autonomousTick + 1 }));
    return ordered;
  },

  trenchSend: (card) => {
    const { game, pluginManager, paused } = get();
    const trenches = pluginManager.find<TrenchesPlugin>("trenches");
    if (!trenches || paused) return false;
    const sent = trenches.sendSquad(game.board, Color.White, card);
    if (sent) set((s) => ({ autonomousTick: s.autonomousTick + 1 }));
    return sent;
  },

  trenchAdvance: (rank) => {
    const { game, pluginManager, paused } = get();
    const trenches = pluginManager.find<TrenchesPlugin>("trenches");
    if (!trenches || paused) return false;
    const ordered = trenches.advanceLine(game.board, Color.White, rank);
    if (ordered) set((s) => ({ autonomousTick: s.autonomousTick + 1 }));
    return ordered;
  },

  trenchAdvanceMan: (square) => {
    const { game, pluginManager, paused } = get();
    const trenches = pluginManager.find<TrenchesPlugin>("trenches");
    if (!trenches || paused) return false;
    const ordered = trenches.advanceMan(game.board, Color.White, square);
    set((s) => ({
      trenchPicked: null,
      autonomousTick: s.autonomousTick + (ordered ? 1 : 0),
    }));
    return ordered;
  },

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
    // The card played goes to the back, and the one waiting takes its place
    const { slots, next, dealt } = get().clashHand;
    const played = slots.indexOf(deployPieceType);
    set({
      deployPieceType: null,
      clashHand:
        played < 0
          ? get().clashHand
          : {
              slots: slots.map((card, i) => (i === played ? next : card)),
              next: deployPieceType,
              dealt: dealt.map((n, i) => (i === played ? n + 1 : n)),
            },
    });
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
    if (isGuest()) return;
    const { turn, moveTimerActive, paused, pluginManager } = get();
    if (
      !moveTimerActive ||
      paused ||
      get().gravityFalling ||
      get().portalTravelling ||
      get().zombiesActing
    ) {
      return;
    }
    // A mine going off holds the clock, so nobody moves until the blast has played out
    const minefield = pluginManager.find<MinefieldPlugin>("minefield");
    if (minefield && minefield.pendingExplosions.size > 0) return;
    const key = turn === Color.White ? "timeWhite" : "timeBlack";
    const next = Math.max(0, get()[key] - 0.1);
    set({ [key]: next });
    if (next <= 0) get().expireTimer();
  },

  // Black's move comes from the AI. A human who runs out of time gets a random move.
  expireTimer: () => {
    if (isGuest()) return;
    const { isHexMode, hexGame, game } = get();
    // A player who runs out of time just misses their move
    const toMove = (isHexMode ? hexGame?.turn : game.turn) ?? Color.White;
    // Against a friend, Black is a player too
    const playersTurn = toMove === Color.White || get().net !== null;
    if (playersTurn) {
      set((s) => ({
        skippedTurn: {
          id: (s.skippedTurn?.id ?? 0) + 1,
          color: toMove,
          reason: "time",
        },
      }));
      if (isHexMode && hexGame) {
        hexGame.turn = Color.Black;
        set({
          turn: Color.Black,
          selectedHex: null,
          legalHexMoves: [],
          timeBlack: foeSeconds(),
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

    const portals = get().pluginManager.find<PortalChessPlugin>("portal-chess");
    /** The moves that would take a king, which in Portals can happen outright */
    const regicides = new Set<Move>();
    const moves = ALL_SQUARES.filter(
      (sq) => game.board.get(sq)?.color === game.turn,
    )
      .flatMap((sq) => {
        const from = get().legalMovesFrom(sq);
        for (const move of from) {
          const taken = portals ? portals.capturedBy(move) : move.captured;
          if (taken?.type === PieceType.King) regicides.add(move);
        }
        return from;
      })
      .filter((m) => !m.promotion || m.promotion === PieceType.Queen);

    // Mode rules can remove every move the engine allows
    if (moves.length === 0 && game.board.findKing(game.turn) === null) {
      skipStuckTurn();
      return;
    }
    if (moves.length === 0) {
      const status =
        game.isInCheck() || get().status === GameStatus.Check
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

    // He does not take your king with his first move of Portals, before
    // you have had a chance to see how the portals work
    const firstInPortals =
      portals !== undefined &&
      !get()
        .moveHistory.slice(modeStartPly)
        .some((m) => m.move.piece.color === Color.Black);
    const sparing = moves.filter((m) => !regicides.has(m));
    const allowed = firstInPortals && sparing.length > 0 ? sparing : moves;

    const pick =
      game.turn === Color.Black
        ? chooseMove(
            game,
            allowed,
            modeSquareBonus(get().pluginManager, game.board),
          )
        : moves[Math.floor(Math.random() * moves.length)];
    get().makeMove(pick.from, pick.to, pick.promotion);
  },

  tickAutonomous: () => {
    if (isGuest()) return;
    const { pluginManager, paused, status } = get();
    if (paused || isGameOver(status) || !pluginManager.isAutonomous()) return;

    const winner = pluginManager.invokeTickAutonomous(AUTONOMOUS_TICK_MS);
    // Trenches says when anything on screen has changed; the board redraws only then
    const trenches = pluginManager.find<TrenchesPlugin>("trenches");
    const look = trenches?.signature();
    const now = performance.now();
    const due = !trenches || now - lastTrenchDraw >= TRENCH_REDRAW_MS;
    if ((look === undefined || look !== lastTrenchLook) && due) {
      lastTrenchLook = look;
      lastTrenchDraw = now;
      set((s) => ({ autonomousTick: s.autonomousTick + 1 }));
    }
    if (winner === null) return;
    set({ status: GameStatus.Checkmate });
    endGameSoon(winner);
  },

  tickGravity: () => {
    if (isGuest()) return;
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
    if (isGuest()) return;
    const { paused, modeTimeRemaining } = get();
    if (paused) return;
    // Modes the kings sit out run until one side wins them, with no clock
    const mode = GAME_MODES[get().currentModeIndex];
    if (mode?.kingsSitOut || mode?.untilWon) return;
    const next = Math.max(0, modeTimeRemaining - 1);
    set({ modeTimeRemaining: next });
    if (next > 0) return;
    get().switchMode();
  },

  settlePortals: () => {
    if (isGuest()) return;
    const { pluginManager, game } = get();
    const portals = pluginManager.find<PortalChessPlugin>("portal-chess");
    if (!portals?.settle({ game, board: game.board })) return;
    // Hints worked out against the old portals no longer apply
    set({ ...CLEARED_SELECTION });
  },

  resolveExplosion: (square) => {
    if (isGuest()) return;
    const { pluginManager, game } = get();
    const minefield = pluginManager.find<MinefieldPlugin>("minefield");
    if (!minefield) return;
    minefield.resolveExplosion({ game, board: game.board }, square);
    set({ turn: game.turn });
  },

  openMenu: () => {
    cancelScheduled();
    setBoardSize();
    const game = new Game();
    set((s) => ({
      game,
      pluginManager: freshPluginManager(game),
      ...FRESH_BOARD,
      ...FRESH_CLOCKS,
      ...CLEARED_HEX,
      status: GameStatus.Active,
      announcement: null,
      userPaused: false,
      cursed: true,
      curseStage: null,
      menuOpen: true,
      // The menu wears the first mode's colours if no mode has been played yet
      currentModeIndex: Math.max(0, s.currentModeIndex),
    }));
    syncPaused();
  },

  // The adventure begins where it always does: on a plain chess site
  startAdventure: () => get().newGame(),

  startSingle: (index) => {
    set({ menuOpen: false, playMode: "single", scoreWhite: 0, scoreBlack: 0 });
    get().switchMode(index);
  },

  switchMode: (index) => {
    const { currentModeIndex, game, isHexMode, hexGame } = get();
    // Moving on by itself, a single mode is over once it has been played,
    // and the adventure once its last mode has
    if (index === undefined && currentModeIndex >= 0) {
      const over =
        get().playMode === "single" || nextAdventureMode(currentModeIndex) < 0;
      if (over) {
        get().openMenu();
        return;
      }
    }
    const nextIndex = index ?? Math.max(0, nextAdventureMode(currentModeIndex));
    const mode = GAME_MODES[nextIndex];

    cancelScheduled();
    modeStartPly = get().moveHistory.length;

    // Surviving pieces carry over between the square and hex boards
    const armies = isHexMode && hexGame ? hexGame.armies() : game.armies();

    set({
      currentModeIndex: nextIndex,
      cursed: true,
      curseStage: null,
      introMood: "happy",
      corruption: 0,
      modeTimeRemaining: mode.durationSeconds ?? MODE_SECONDS,
      status: GameStatus.Active,
      ...CLEARED_SELECTION,
      lastPortalMove: null,
      promotionPending: null,
      deployPieceType: null,
      clashHand: dealClashHand(),
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

    // A board of a different depth is laid out afresh, each side at its own end
    const depth = mode.ranks ?? 8;
    const width = mode.files ?? 8;
    const resized = depth !== boardRanks() || width !== boardFiles();
    setBoardSize(depth, width);
    const nextGame =
      isHexMode || resized
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
      zombiesActing: false,
      pluginManager: freshPluginManager(nextGame, mode.create()),
      turn: nextGame.turn,
      moveHistory: [...nextGame.history],
      ...(isHexMode || resized ? { lastMove: null } : {}),
    });
    schedule(() => {
      get().pluginManager.invokeOnIntroEnd();
      set({ introDone: true });
    }, INTRO_END_MS);
  },
}));
