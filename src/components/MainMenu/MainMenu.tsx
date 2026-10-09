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

/**
 * The main menu, where every game ends up: play the adventure through
 * again, or pick one mode and play just that
 */
export function MainMenu() {
  const open = useGameStore((s) => s.menuOpen);
  const { startAdventure, startSingle } = useGameStore.getState();
  if (!open) return null;
  return (
    <div className="main-menu" role="dialog" aria-label="Main menu">
      <div className="menu-sheet">
        <header className="menu-head">
          <Logo />
          <a
            className="menu-credit"
            href="https://joshuaswanson.github.io"
            target="_blank"
            rel="noreferrer"
          >
            Made by <b>Joshua Swanson</b>
          </a>
        </header>
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
            {/* Not a button: there is nothing to play yet */}
            <div
              className="menu-mode is-soon"
              style={
                {
                  "--chip-a": "#6b2fd6",
                  "--chip-b": "#3ee6b0",
                } as React.CSSProperties
              }
            >
              <MultiplayerPreview />
              <span className="menu-mode-text">
                <span className="menu-mode-title">Multiplayer</span>
                <span className="menu-mode-tagline">Curse your friends!</span>
              </span>
              <span className="menu-soon">Coming soon</span>
            </div>
          </div>
          <h2 className="menu-divider">
            <span>Single modes</span>
          </h2>
          <div className="menu-modes">
            {GAME_MODES.map((mode, i) => {
              const theme = THEMES[mode.theme];
              return (
                <ModeCard
                  key={mode.theme}
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
        </div>
      </div>
    </div>
  );
}
