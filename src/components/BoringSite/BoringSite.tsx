import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { GAME_MODES, useGameStore } from "../../stores/gameStore";
import { THEMES } from "../../theme/themes";
import type { SiteTab } from "../../stores/gameStore";
import { AuthDialog } from "./AuthDialog";
import type { AuthMode } from "./AuthDialog";
import "./BoringSite.css";
import { Chessbot } from "../Chessbot/Chessbot";
import type { ChessbotMood } from "../Chessbot/Chessbot";
import {
  ASIDE_LEAD_MS,
  SPEECH_LEAD_MS,
  introDelays,
  introMood,
  introScript,
} from "../Chessbot/intro";
import type { IntroLine } from "../Chessbot/intro";

const NAV_LINKS: SiteTab[] = ["Play", "Puzzles", "Learn", "Watch", "Community"];

function PawnMark() {
  return (
    <svg viewBox="0 0 24 24" className="boring-mark" aria-hidden>
      <circle cx="12" cy="6" r="3.2" />
      <path d="M8.5 11h7l-1.2 6h-4.6zM6 19.5h12v2.5H6z" />
    </svg>
  );
}

/** The forgettable header of a forgettable chess site */
export function BoringHeader() {
  const tab = useGameStore((s) => s.siteTab);
  const setTab = useGameStore((s) => s.setSiteTab);
  const [auth, setAuth] = useState<AuthMode | null>(null);
  const closeAuth = useCallback(() => setAuth(null), []);
  return (
    <header className="boring-header">
      <div className="boring-brand">
        <PawnMark />
        <span>Totally Normal Chess</span>
      </div>
      <nav className="boring-nav" aria-label="Site">
        {NAV_LINKS.map((link) => (
          <button
            type="button"
            key={link}
            className={link === tab ? "current" : ""}
            aria-current={link === tab ? "page" : undefined}
            onClick={() => setTab(link)}
          >
            {link}
          </button>
        ))}
      </nav>
      <div className="boring-account">
        <button
          type="button"
          className="boring-btn boring-btn-plain"
          onClick={() => setAuth("login")}
        >
          Log in
        </button>
        <button
          type="button"
          className="boring-btn"
          onClick={() => setAuth("signup")}
        >
          Sign up
        </button>
      </div>
      {auth && <AuthDialog key={auth} mode={auth} onClose={closeAuth} />}
    </header>
  );
}

function PlayerCard({ name, rating }: { name: string; rating: number }) {
  return (
    <div className="boring-player">
      <div className="boring-avatar" aria-hidden>
        {/* The plain head and shoulders of someone who has not signed in */}
        <svg viewBox="0 0 32 32">
          <circle cx="16" cy="12.5" r="5.5" fill="#6f6f6f" />
          <path d="M5.5 29 a10.5 9.5 0 0 1 21 0 z" fill="#6f6f6f" />
        </svg>
      </div>
      <span className="boring-player-name">{name}</span>
      <span className="boring-rating">({rating})</span>
    </div>
  );
}

/** How he looks in his first moments out, before he starts typing: pleased to be here, then a look each way */
const FIRST_LOOKS: [ChessbotMood, number][] = [
  ["happy", 550],
  ["lookleft", 600],
  ["lookright", 600],
];

/** His face in the icon spot through his speech: a look around first, then whatever each line calls for */
function useSpeechMood(speaking: boolean): ChessbotMood {
  const spoken = useGameStore((s) => s.introMood);
  const [look, setLook] = useState(0);
  useEffect(() => {
    if (!speaking || look >= FIRST_LOOKS.length) return;
    const timer = window.setTimeout(
      () => setLook((n) => n + 1),
      FIRST_LOOKS[look][1],
    );
    return () => window.clearTimeout(timer);
  }, [speaking, look]);
  if (look < FIRST_LOOKS.length) return FIRST_LOOKS[look][0];
  return spoken;
}

/**
 * The computer opponent's card. Its plain grey icon is Chessbot keeping up
 * appearances, and with each move of the opening game he slips more:
 * tearing sideways and showing his real face for an instant. After the
 * third he pops out as himself right there in the icon's place, looks
 * about, and has his say in the move list. Then he glitches out of the
 * card altogether, and the name on it gives way to his own.
 */
function ComputerCard() {
  const plies = useGameStore((s) => s.moveHistory.length);
  const stage = useGameStore((s) => s.curseStage);
  const revealed = stage === "hello";
  const gone = stage !== null && stage !== "hello";
  const aside = useGameStore((s) => s.aside);
  // He flickers through hardest while he is typing his remark
  const slipping =
    stage !== null ? 0 : aside === "typing" ? 2 : Math.min(2, plies);
  const mood = useSpeechMood(revealed);
  return (
    <div
      className={`boring-player boring-bot slipping-${slipping}${revealed ? " revealed" : ""}${gone ? " vacated renamed" : ""}`}
    >
      <div className="boring-avatar boring-bot-avatar" aria-hidden>
        <svg className="boring-bot-icon" viewBox="0 0 32 32">
          <path d="M16 9.5 V5.5" stroke="#6f6f6f" strokeWidth="1.6" />
          <circle cx="16" cy="4.8" r="1.7" fill="#6f6f6f" />
          <rect x="4.5" y="14" width="3" height="7" rx="1.2" fill="#8a8a8a" />
          <rect x="24.5" y="14" width="3" height="7" rx="1.2" fill="#8a8a8a" />
          <rect
            x="6.5"
            y="9.5"
            width="19"
            height="16"
            rx="4.5"
            fill="#6f6f6f"
          />
          <rect
            x="9.5"
            y="14"
            width="13"
            height="7.5"
            rx="2.6"
            fill="#e4e4e4"
          />
          <path
            d="M12 17.8 h2.6 M17.4 17.8 h2.6"
            stroke="#6f6f6f"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <Chessbot
          className="boring-bot-true"
          mood={stage === null ? "smug" : mood}
          grounded={false}
        />
      </div>
      <span className="boring-player-name boring-bot-name">
        <span>Computer (Level 1)</span>
        <span aria-hidden>Ch3ssb0t (L3vel ?)</span>
      </span>
      <span className="boring-rating">(800)</span>
    </div>
  );
}

/**
 * Something Chessbot types into the move list, the way someone types it: a
 * letter at a time, with a caret blinking where the next one will land. It
 * sits in a block of its own, a terminal he has forced open among the moves.
 */
function BotTyping({
  lines,
  lead,
  acted = false,
}: {
  lines: IntroLine[];
  /** How long before the first letter */
  lead: number;
  /** Whether his face follows the words, for when he is out where it can be seen */
  acted?: boolean;
}) {
  const delays = useMemo(() => introDelays(lines, lead), [lines, lead]);
  const [typed, setTyped] = useState(0);
  const caret = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    caret.current?.scrollIntoView({ block: "nearest" });
    if (typed >= delays.length) return;
    const timer = window.setTimeout(
      () => setTyped((n) => n + 1),
      delays[typed],
    );
    return () => window.clearTimeout(timer);
  }, [typed, delays]);

  const starts = lines.map((_, i) =>
    lines.slice(0, i).reduce((n, line) => n + line.text.length, 0),
  );
  // The last line he has begun
  const current = Math.max(
    0,
    starts.filter((start) => typed > start).length - 1,
  );
  const mood = introMood(lines[current], typed - starts[current]);
  useEffect(() => {
    if (acted) useGameStore.setState({ introMood: mood });
  }, [acted, mood]);

  return (
    <li className="boring-bot-block">
      {/* The process that has no business running in a move list */}
      <span className="boring-bot-tag" aria-hidden>
        chessbot.exe
      </span>
      {lines.map(({ text }, i) => {
        if (i > current) return null;
        return (
          <p key={i} className="boring-bot-says">
            <span className="boring-prompt" aria-hidden>
              {">"}
            </span>
            {text.slice(0, typed - starts[i])}
            {/* The caret goes once a passing remark is finished; through his speech it stays */}
            {i === current && (acted || typed < delays.length) && (
              <span ref={caret} className="boring-caret" aria-hidden />
            )}
          </p>
        );
      })}
    </li>
  );
}

/** One line of the move list: a move number, White's move, and Black's */
function MoveRow({
  no,
  white,
  black,
}: {
  no: number;
  /** Left out for a row that carries on after something was said in between */
  white?: string;
  black?: string;
}) {
  return (
    <li className="boring-move-row">
      <span className="boring-move-no">{no}.</span>
      <span>{white ?? "\u2026"}</span>
      <span>{black ?? ""}</span>
    </li>
  );
}

function MoveList() {
  const history = useGameStore((s) => s.moveHistory);
  // He remarks on your first move before he answers it
  const aside = useGameStore((s) => s.aside);
  // Once he is out of his icon, he has more to say
  const speaking = useGameStore((s) => s.curseStage !== null);
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [history.length]);

  const opening = history[0]?.san ?? "e4";
  const script = useMemo(() => introScript(opening), [opening]);
  const remark = useMemo(() => script.slice(0, 1), [script]);
  const speech = useMemo(() => script.slice(1), [script]);
  // His remark comes between your first move and his reply, so that row is
  // split in two around it
  const remarked = aside === "typing" || aside === "said";
  const rows: ReactNode[] = [];
  for (let i = 0; i < history.length; i += 2) {
    const no = i / 2 + 1;
    const white = history[i].san;
    const black = history[i + 1]?.san;
    if (i === 0 && remarked) {
      rows.push(<MoveRow key="1w" no={1} white={white} />);
      rows.push(<BotTyping key="remark" lines={remark} lead={ASIDE_LEAD_MS} />);
      if (black) rows.push(<MoveRow key="1b" no={1} black={black} />);
    } else {
      rows.push(<MoveRow key={no} no={no} white={white} black={black} />);
    }
  }
  return (
    <ol className="boring-moves" ref={listRef}>
      {history.length === 0 && <li className="boring-empty">White to move</li>}
      {rows}
      {speaking && (
        <BotTyping key="speech" lines={speech} lead={SPEECH_LEAD_MS} acted />
      )}
    </ol>
  );
}

/** Dev mode's shortcut straight into any cursed mode, dressed as a plain admin panel */
function BoringDevPanel() {
  const { switchMode } = useGameStore.getState();
  return (
    <section className="boring-panel boring-dev">
      <h2>Developer: jump to a mode</h2>
      <div className="boring-dev-grid">
        {GAME_MODES.map((mode, i) => (
          <button
            key={mode.theme}
            type="button"
            className="boring-btn boring-btn-plain"
            onClick={() => switchMode(i)}
          >
            {THEMES[mode.theme].title}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Opponent, move list, and a couple of sensible buttons */
export function BoringSidebar() {
  const devMode = useGameStore((s) => s.devMode);
  const { newGame, flipBoard } = useGameStore.getState();
  return (
    <aside className="boring-sidebar">
      {devMode && <BoringDevPanel />}
      <ComputerCard />
      <section className="boring-panel">
        <h2>Moves</h2>
        <MoveList />
        <div className="boring-actions">
          <button type="button" className="boring-btn" onClick={newGame}>
            New game
          </button>
          <button
            type="button"
            className="boring-btn boring-btn-plain"
            onClick={flipBoard}
          >
            Flip board
          </button>
        </div>
      </section>
      <PlayerCard name="Guest" rating={1200} />
    </aside>
  );
}

const FOOTER_LINKS: SiteTab[] = ["Terms", "Privacy", "Help"];

export function BoringFooter() {
  const setTab = useGameStore((s) => s.setSiteTab);
  return (
    <footer className="boring-footer">
      <span>&copy; 2026 Totally Normal Chess</span>
      {FOOTER_LINKS.map((link) => (
        <button type="button" key={link} onClick={() => setTab(link)}>
          {link}
        </button>
      ))}
      <button type="button" onClick={() => useGameStore.getState().openMenu()}>
        Skip to main menu
      </button>
    </footer>
  );
}
