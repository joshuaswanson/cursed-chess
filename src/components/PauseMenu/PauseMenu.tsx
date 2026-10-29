import { useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { useTheme } from "../../theme/useTheme";
import { leaveGame } from "../../net/multiplayer";
import { t } from "../../i18n";
import { GearIcon, MenuIcon, PlayIcon, RestartIcon } from "../Hud/icons";
import { Settings } from "../Settings/Settings";
import "./PauseMenu.css";

/**
 * The game held where it is under a dimmed screen, with the mode's rules to
 * read again and the ways on from here. A guest has the same screen, but
 * their friend's game plays on under it.
 */
export function PauseMenu() {
  const theme = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const single = useGameStore((s) => s.playMode === "single");
  const guest = useGameStore((s) => s.net?.role === "guest");
  const { togglePause, openMenu } = useGameStore.getState();

  const restart = () => {
    const { currentModeIndex, startSingle } = useGameStore.getState();
    useGameStore.setState({ userPaused: false });
    startSingle(currentModeIndex);
  };

  const options = (
    <>
      <h2 className="pause-title">{guest ? t("Menu") : t("Paused")}</h2>
      <p className="pause-mode">{t(theme.title)}</p>
      <p className="pause-rules">{t(theme.catchphrase)}</p>
      <div className="pause-actions">
        <button
          type="button"
          className="pause-btn pause-resume"
          onClick={togglePause}
          autoFocus
        >
          <PlayIcon />
          {guest ? t("Back to game") : t("Resume")}
        </button>
        <button
          type="button"
          className="pause-btn"
          onClick={() => setSettingsOpen(true)}
        >
          <GearIcon />
          {t("Settings")}
        </button>
        {single && !guest && (
          <button type="button" className="pause-btn" onClick={restart}>
            <RestartIcon />
            {t("Restart")}
          </button>
        )}
        <button
          type="button"
          className="pause-btn"
          onClick={guest ? leaveGame : openMenu}
        >
          <MenuIcon />
          {guest ? t("Leave game") : t("Main menu")}
        </button>
      </div>
      <p className="pause-hint">{t("Space or Esc to go back")}</p>
    </>
  );

  return (
    <div
      className="pause-overlay"
      role="dialog"
      aria-modal
      aria-label={t("Paused")}
    >
      <div className="pause-card">
        {settingsOpen ? (
          <Settings onClose={() => setSettingsOpen(false)} />
        ) : (
          options
        )}
      </div>
    </div>
  );
}
