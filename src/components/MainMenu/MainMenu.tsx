import { GAME_MODES, useGameStore } from "../../stores/gameStore";
import { useEffect, useRef, useState } from "react";
import { THEMES } from "../../theme/themes";
import type { ModeTheme } from "../../theme/themes";
import { ModePreview } from "./ModePreview";
import { Logo } from "../Logo/Logo";
import "./MainMenu.css";

/** One mode on the menu: its scene playing while it is on screen, its name, and what it is */
function ModeCard({ theme, onPlay }: { theme: ModeTheme; onPlay: () => void }) {
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
        {
          "--chip-a": theme.sky[1],
          "--chip-b": theme.accent,
        } as React.CSSProperties
      }
      onClick={onPlay}
    >
      <ModePreview theme={theme.id} />
      <span className="menu-mode-text">
        <span className="menu-mode-title">{theme.title}</span>
        <span className="menu-mode-tagline">{theme.catchphrase}</span>
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
        <Logo />
        <button
          type="button"
          className="menu-adventure"
          onClick={startAdventure}
        >
          <span className="menu-adventure-title">Adventure</span>
          <span className="menu-adventure-sub">
            Every mode, one after another
          </span>
        </button>
        <h2 className="menu-heading">Or play just one</h2>
        <div className="menu-modes">
          {GAME_MODES.map((mode, i) => (
            <ModeCard
              key={mode.theme}
              theme={THEMES[mode.theme]}
              onPlay={() => startSingle(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
