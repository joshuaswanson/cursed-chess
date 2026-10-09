import { GAME_MODES, useGameStore } from "../../stores/gameStore";
import { THEMES } from "../../theme/themes";
import { Logo } from "../Logo/Logo";
import "./MainMenu.css";

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
          {GAME_MODES.map((mode, i) => {
            const theme = THEMES[mode.theme];
            return (
              <button
                key={mode.theme}
                type="button"
                className="menu-mode"
                style={
                  {
                    "--chip-a": theme.sky[1],
                    "--chip-b": theme.accent,
                    "--tilt": `${((i * 7) % 5) - 2}deg`,
                  } as React.CSSProperties
                }
                onClick={() => startSingle(i)}
              >
                {theme.title}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
