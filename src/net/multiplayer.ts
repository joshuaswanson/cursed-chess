import Peer from "peerjs";
import type { DataConnection } from "peerjs";
import { Color, Game } from "../engine";
import type { Move, Piece, SquareIndex } from "../engine";
import { HexGame } from "../engine/hex";
import type { HexCoord } from "../engine/hex";
import type {
  FootballPlugin,
  Kick,
  PassOption,
  ShotOption,
} from "../plugins/football";
import type { GravityPlugin } from "../plugins/gravity";
import { PluginManager } from "../plugins/manager";
import type {
  BoardOverlay,
  ModePlugin,
  SquareModifier,
} from "../plugins/types";
import type { PortalChessPlugin } from "../plugins/portalChess";
import type { StrategoPlugin } from "../plugins/stratego";
import { connectGuestLine, useGameStore } from "../stores/gameStore";
import type { GameStore, GuestMessage } from "../stores/gameStore";
import {
  ALL_SQUARES,
  boardFiles,
  boardRanks,
  setBoardSize,
} from "../utils/squareUtils";

/** Every game's address on the meeting server starts with this, so codes do not clash with other sites' */
const ADDRESS = "cursed-chess-game-";
/** Letters that cannot be mistaken for one another when read aloud or typed */
const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 5;
/** How often, at most, the host sends the guest the state of play */
const SEND_EVERY_MS = 60;

/** The parts of the game the guest is shown exactly as the host has them */
const SHARED = [
  "turn",
  "status",
  "timeWhite",
  "timeBlack",
  "moveTimerActive",
  "paused",
  "scoreWhite",
  "scoreBlack",
  "currentModeIndex",
  "modeTimeRemaining",
  "cursed",
  "menuOpen",
  "playMode",
  "announcement",
  "announcementType",
  "introDone",
  "lastMove",
  "lastPortalMove",
  "gravityFalling",
  "portalTravelling",
  "zombiesActing",
  "skippedTurn",
  "reinforcements",
  "sidelineKings",
  "sidelineBench",
  "arrivalStyle",
  "autonomousTick",
  "isHexMode",
  "lastHexMove",
  "hexTransition",
  "hexArrivals",
] as const satisfies readonly (keyof GameStore)[];

/** The state of play as the host sends it */
interface Snapshot {
  shared: Pick<GameStore, (typeof SHARED)[number]>;
  fen: string;
  ranks: number;
  files: number;
  overlays: BoardOverlay[];
  /** What each mode has to say about each square, for the squares it says anything about */
  modifiers: Record<number, SquareModifier[]>;
  /** The moves open to the guest, when it is their turn */
  legal: Move[];
  lastRecord: GameStore["moveHistory"];
  /** Whether Portals is about to move its portals */
  portalsDue: boolean | null;
  pawnRules: Game["pawnRules"];
  /** How far Gravity's board has turned, in degrees, and how fast it is turning, in degrees a millisecond */
  spin: { angle: number; perMs: number } | null;
  /** FIFA: where the ball is, the last kick, and what the guest could do with the ball */
  football: {
    ball: SquareIndex;
    lastKick: Kick | null;
    passes: PassOption[];
    shot: ShotOption | null;
  } | null;
  /** Hex chess: every piece on the hex board and whose turn it is */
  hex: { cells: [HexCoord, Piece][]; turn: Color } | null;
}

let peer: Peer | null = null;
let line: DataConnection | null = null;
let stopSending: (() => void) | null = null;

const store = () => useGameStore.getState();
const setLink = (link: GameStore["net"]) =>
  useGameStore.setState({ net: link });

function newCode(): string {
  return Array.from(
    { length: CODE_LENGTH },
    () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)],
  ).join("");
}

function snapshot(): Snapshot {
  const state = store();
  const { game, pluginManager } = state;
  const modifiers: Snapshot["modifiers"] = {};
  for (const sq of ALL_SQUARES) {
    const mods = pluginManager.getSquareModifiers(sq);
    if (mods.length > 0) modifiers[sq] = mods;
  }
  const guestToMove = game.turn === Color.Black && !state.menuOpen;
  const stratego = pluginManager.find<StrategoPlugin>("stratego");
  const context = { game, board: game.board };
  const football = pluginManager.find<FootballPlugin>("football");
  const gravity = pluginManager.find<GravityPlugin>("gravity");
  const now = performance.now();
  const guestHasBall =
    football !== undefined &&
    game.board.get(football.ball)?.color === Color.Black;
  return {
    shared: Object.fromEntries(
      SHARED.map((key) => [key, state[key]]),
    ) as Snapshot["shared"],
    fen: game.toFen(),
    ranks: boardRanks(),
    files: boardFiles(),
    overlays: pluginManager.getAllOverlays().map((overlay) =>
      // In Stratego the guest is kept in the dark about the host's pieces, and shown their own
      overlay.type === "stratego-hidden" && stratego
        ? { ...overlay, squares: stratego.hiddenFrom(context, Color.Black) }
        : overlay,
    ),
    modifiers,
    legal: guestToMove
      ? ALL_SQUARES.filter(
          (sq) => game.board.get(sq)?.color === Color.Black,
        ).flatMap((sq) => state.legalMovesFrom(sq))
      : [],
    lastRecord: state.moveHistory.slice(-1),
    portalsDue:
      pluginManager.find<PortalChessPlugin>("portal-chess")?.respawnDue ?? null,
    pawnRules: game.pawnRules,
    spin: gravity
      ? {
          angle: gravity.spinAt(now),
          perMs: (gravity.spinAt(now + 1000) - gravity.spinAt(now)) / 1000,
        }
      : null,
    football: football
      ? {
          ball: football.ball,
          lastKick: football.lastKick,
          passes: guestHasBall
            ? football.passOptions(game.board, football.ball)
            : [],
          shot: guestHasBall
            ? football.shotOption(game.board, football.ball)
            : null,
        }
      : null,
    hex:
      state.isHexMode && state.hexGame
        ? { cells: state.hexGame.board.entries(), turn: state.hexGame.turn }
        : null,
  };
}

/** Stands in for the host's modes on the guest's side: it knows only what the host last said */
function mirror(game: Game, snap: Snapshot): PluginManager {
  const manager = new PluginManager();
  manager.setContext(game);
  const told: ModePlugin = {
    id: "mirror",
    name: "",
    description: "",
    getBoardOverlays: () => snap.overlays,
    getSquareModifiers: (_ctx, square: SquareIndex) =>
      snap.modifiers[square] ?? [],
  };
  manager.register(told);
  if (snap.portalsDue !== null) {
    manager.register({
      id: "portal-chess",
      name: "",
      description: "",
      respawnDue: snap.portalsDue,
    } as ModePlugin);
  }
  if (snap.football) {
    const { ball, lastKick, passes, shot } = snap.football;
    manager.register({
      id: "football",
      name: "",
      description: "",
      ball,
      lastKick,
      passOptions: () => passes,
      shotOption: () => shot,
      carrier: (board: Game["board"]) => board.get(ball),
    } as unknown as ModePlugin);
  }
  if (snap.spin !== null) {
    manager.register({
      id: "gravity",
      name: "",
      description: "",
      spinAt: turningAt,
    } as unknown as ModePlugin);
  }
  return manager;
}

/**
 * Gravity's board turns all the time, and word of it comes only now and
 * then: between times the guest carries the turn on at the rate the host
 * says it is going
 */
let spin = { angle: 0, at: 0, perMs: 0 };
/** How long the guest goes on turning the board with no word from the host */
const SPIN_COAST_MS = 2000;
function turningAt(now: number): number {
  return spin.angle + spin.perMs * Math.min(SPIN_COAST_MS, now - spin.at);
}

/** The host's hex board, set up again on the guest's side */
function hexBoard(hex: NonNullable<Snapshot["hex"]>): HexGame {
  const game = new HexGame([], []);
  for (const [coord, piece] of hex.cells) {
    game.board.set(coord.q, coord.r, piece);
  }
  game.turn = hex.turn;
  return game;
}

/** Shows the guest the game as the host has it, turned round to their own side of the board */
function show(snap: Snapshot): void {
  if (snap.ranks !== boardRanks() || snap.files !== boardFiles()) {
    setBoardSize(snap.ranks, snap.files);
  }
  const game = new Game(snap.fen);
  game.pawnRules = snap.pawnRules;
  if (snap.spin) spin = { ...snap.spin, at: performance.now() };
  const { announcementType } = snap.shared;
  useGameStore.setState({
    ...snap.shared,
    // The host's win is the guest's loss
    announcementType:
      announcementType === "win"
        ? "lose"
        : announcementType === "lose"
          ? "win"
          : announcementType,
    game,
    pluginManager: mirror(game, snap),
    hexGame: snap.hex ? hexBoard(snap.hex) : null,
    moveHistory: snap.lastRecord,
    netLegal: snap.legal,
    seat: Color.Black,
    flipped: true,
    lobbyOpen: snap.shared.menuOpen,
  });
}

/** Sends the guest the state of play whenever it changes, but no faster than they can use it */
function keepSending(): () => void {
  let due: number | undefined;
  let lastSent = 0;
  const send = () => {
    due = undefined;
    lastSent = performance.now();
    if (line?.open) line.send(JSON.stringify(snapshot()));
  };
  const stop = useGameStore.subscribe(() => {
    if (due !== undefined) return;
    const wait = Math.max(0, SEND_EVERY_MS - (performance.now() - lastSent));
    due = window.setTimeout(send, wait);
  });
  send();
  return () => {
    stop();
    window.clearTimeout(due);
  };
}

/** The guest wants a move played: the host plays it, if it is theirs to make */
function hear(message: GuestMessage): void {
  const state = store();
  if (state.turn !== Color.Black) return;
  if (message.t === "move") {
    state.makeMove(message.from, message.to, message.promotion);
  } else if (message.t === "kick") {
    state.kick(message.target);
  } else {
    state.makeHexMove(message.from, message.to, message.promotion);
  }
}

function lost(): void {
  const link = store().net;
  if (link) setLink({ ...link, status: "lost" });
}

/** Opens a game for a friend to join, and gives back the code to pass on */
export function hostGame(): string {
  leaveGame();
  const code = newCode();
  setLink({ role: "host", code, status: "waiting" });
  useGameStore.setState({ lobbyOpen: true });
  peer = new Peer(ADDRESS + code);
  peer.on("connection", (connection) => {
    // One friend at a time
    if (line) {
      connection.close();
      return;
    }
    line = connection;
    connection.on("open", () => {
      setLink({ role: "host", code, status: "connected" });
      stopSending = keepSending();
    });
    connection.on("data", (data) => hear(JSON.parse(data as string)));
    connection.on("close", lost);
    connection.on("error", lost);
  });
  peer.on("error", lost);
  return code;
}

/** Joins the game a friend has opened under this code */
export function joinGame(code: string): void {
  leaveGame();
  const tidy = code.trim().toUpperCase();
  setLink({ role: "guest", code: tidy, status: "connecting" });
  useGameStore.setState({ lobbyOpen: true });
  peer = new Peer();
  peer.on("open", () => {
    const connection = peer!.connect(ADDRESS + tidy, { reliable: true });
    line = connection;
    connection.on("open", () => {
      setLink({ role: "guest", code: tidy, status: "connected" });
      connectGuestLine((message) => connection.send(JSON.stringify(message)));
    });
    connection.on("data", (data) => show(JSON.parse(data as string)));
    connection.on("close", lost);
    connection.on("error", lost);
  });
  peer.on("error", lost);
}

/** Ends the online game and puts this browser back to playing by itself */
export function leaveGame(): void {
  stopSending?.();
  stopSending = null;
  connectGuestLine(null);
  line?.close();
  line = null;
  peer?.destroy();
  peer = null;
  const wasGuest = store().net?.role === "guest";
  useGameStore.setState({
    net: null,
    netLegal: [],
    seat: Color.White,
    flipped: false,
  });
  // A guest was only ever shown the host's game, and has none of their own to go back to
  if (wasGuest) {
    setBoardSize();
    store().openMenu();
  }
}
