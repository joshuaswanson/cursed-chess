import { useCallback, useEffect, useRef, useState } from "react";
import { GAME_MODES, useGameStore } from "../../stores/gameStore";
import { THEMES } from "../../theme/themes";
import type { SiteTab } from "../../stores/gameStore";
import { AuthDialog } from "./AuthDialog";
import type { AuthMode } from "./AuthDialog";
import "./BoringSite.css";

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
      <div className="boring-avatar" aria-hidden />
      <span className="boring-player-name">{name}</span>
      <span className="boring-rating">({rating})</span>
    </div>
  );
}

function MoveList() {
  const history = useGameStore((s) => s.moveHistory);
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [history.length]);

  const rows: { white: string; black?: string }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push({ white: history[i].san, black: history[i + 1]?.san });
  }
  return (
    <ol className="boring-moves" ref={listRef}>
      {rows.length === 0 && <li className="boring-empty">White to move</li>}
      {rows.map((row, i) => (
        <li key={i}>
          <span className="boring-move-no">{i + 1}.</span>
          <span>{row.white}</span>
          <span>{row.black ?? ""}</span>
        </li>
      ))}
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
      <PlayerCard name="Computer (Level 1)" rating={800} />
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
    </footer>
  );
}
