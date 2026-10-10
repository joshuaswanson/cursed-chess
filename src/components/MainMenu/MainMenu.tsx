import { GAME_MODES, useGameStore } from "../../stores/gameStore";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { THEMES } from "../../theme/themes";
import {
  AdventurePreview,
  ModePreview,
  MultiplayerPreview,
} from "./ModePreview";
import { Logo } from "../Logo/Logo";
import { Lobby } from "./Lobby";
import { onlineModeIndexes } from "../../net/onlineModes";
import "./MainMenu.css";

/** One thing to play on the menu: its scene playing while it is on screen, its name, and its tagline */
function ModeCard({
  title,
  tagline,
  colors,
  onPlay,
  children,
}: {
  title: string;
  tagline: string;
  /** The two colours its card and scene are washed in */
  colors: [string, string];
  onPlay: () => void;
  /** Its little scene */
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const watcher = new IntersectionObserver(([entry]) =>
      setInView(entry.isIntersecting),
    );
    watcher.observe(ref.current);
    return () => watcher.disconnect();
  }, []);
  return (
    <button
      ref={ref}
      type="button"
      className={`menu-mode${inView ? " in-view" : ""}`}
      style={
        { "--chip-a": colors[0], "--chip-b": colors[1] } as React.CSSProperties
      }
      onClick={onPlay}
    >
      {children}
      <span className="menu-mode-text">
        <span className="menu-mode-title">{title}</span>
        <span className="menu-mode-tagline">{tagline}</span>
      </span>
    </button>
  );
}

const SITE_URL = "https://joshuaswanson.github.io";
const BUGS_URL = "https://github.com/joshuaswanson/cursed-chess/issues";
const COFFEE_URL = "https://buymeacoffee.com/swanson";

/**
 * The main menu, where every game ends up: play the adventure through
 * again, or pick one mode and play just that
 */
export function MainMenu() {
  const open = useGameStore((s) => s.menuOpen);
  const link = useGameStore((s) => s.net);
  const lobbyOpen = useGameStore((s) => s.lobbyOpen);
  const { startAdventure, startSingle } = useGameStore.getState();
  if (!open) return null;
  /** A card for every mode that is, or is not, still in beta */
  const modeCards = (beta: boolean) =>
    GAME_MODES.flatMap((mode, i) => {
      if (!!mode.beta !== beta) return [];
      const theme = THEMES[mode.theme];
      return [
        <ModeCard
          key={mode.theme}
          title={theme.title}
          tagline={theme.catchphrase}
          colors={[theme.sky[1], theme.accent]}
          onPlay={() => startSingle(i)}
        >
          <ModePreview theme={theme.id} />
        </ModeCard>,
      ];
    });
  return (
    <div className="main-menu" role="dialog" aria-label="Main menu">
      <div className="menu-sheet">
        <header className="menu-head">
          <Logo />
          <a
            className="menu-credit"
            href={SITE_URL}
            target="_blank"
            rel="noreferrer"
          >
            Made by <b>Joshua Swanson</b>
          </a>
        </header>
        {link || lobbyOpen ? (
          <div className="menu-list">
            <Lobby />
            {link?.role === "host" && link.status === "connected" && (
              <div className="menu-modes">
                {onlineModeIndexes().map((i) => {
                  const theme = THEMES[GAME_MODES[i].theme];
                  return (
                    <ModeCard
                      key={theme.id}
                      title={theme.title}
                      tagline={theme.catchphrase}
                      colors={[theme.sky[1], theme.accent]}
                      onPlay={() => startSingle(i)}
                    >
                      <ModePreview theme={theme.id} />
                    </ModeCard>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="menu-list">
            {/* The two ways to play everything, on a row of their own */}
            <div className="menu-featured">
              <ModeCard
                title="Story Mode"
                tagline="One mode after another!"
                colors={["#6a1fd6", "#ff2e88"]}
                onPlay={startAdventure}
              >
                <AdventurePreview />
              </ModeCard>
              <ModeCard
                title="Multiplayer"
                tagline="Curse your friends!"
                colors={["#6b2fd6", "#3ee6b0"]}
                onPlay={() => useGameStore.setState({ lobbyOpen: true })}
              >
                <MultiplayerPreview />
              </ModeCard>
            </div>
            <h2 className="menu-divider">
              <span>Single modes</span>
            </h2>
            <div className="menu-modes">{modeCards(false)}</div>
            <h2 className="menu-divider">
              <span>Beta modes</span>
            </h2>
            <p className="menu-note">
              Still being worked on. Expect rough edges.
            </p>
            <div className="menu-modes">{modeCards(true)}</div>
            <footer className="menu-foot">
              <a href={SITE_URL} target="_blank" rel="noreferrer">
                Made by Joshua Swanson
              </a>
              <a href={BUGS_URL} target="_blank" rel="noreferrer">
                Report a bug
              </a>
              <a
                className="menu-foot-coffee"
                href={COFFEE_URL}
                target="_blank"
                rel="noreferrer"
              >
                Enjoyed playing? Buy me a coffee
              </a>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
