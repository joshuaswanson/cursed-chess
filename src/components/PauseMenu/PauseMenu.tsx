import { useSyncExternalStore } from "react";
import { useGameStore } from "../../stores/gameStore";
import { useTheme } from "../../theme/useTheme";
import { sfx } from "../../audio/sfx";
import { leaveGame } from "../../net/multiplayer";
import {
  MenuIcon,
  MuteIcon,
  PlayIcon,
  RestartIcon,
  SoundIcon,
} from "../Hud/icons";
import "./PauseMenu.css";

/**
 * The game held where it is under a dimmed screen, with the mode's rules to
 * read again and the ways on from here. A guest has the same screen, but
 * their friend's game plays on under it.
 */
export function PauseMenu() {
  const theme = useTheme();
  const soundOn = useSyncExternalStore(sfx.subscribe, sfx.isEnabled);
  const single = useGameStore((s) => s.playMode === "single");
  const guest = useGameStore((s) => s.net?.role === "guest");
  const { togglePause, openMenu } = useGameStore.getState();

  const restart = () => {
    const { currentModeIndex, startSingle } = useGameStore.getState();
    useGameStore.setState({ userPaused: false });
    startSingle(currentModeIndex);
  };

  return (
    <div className="pause-overlay" role="dialog" aria-modal aria-label="Paused">
      <div className="pause-card">
        <h2 className="pause-title">{guest ? "Menu" : "Paused"}</h2>
        <p className="pause-mode">{theme.title}</p>
        <p className="pause-rules">{theme.tagline}</p>
        <div className="pause-actions">
          <button
            type="button"
            className="pause-btn pause-resume"
            onClick={togglePause}
            autoFocus
          >
            <PlayIcon />
            {guest ? "Back to game" : "Resume"}
          </button>
          <button
            type="button"
            className="pause-btn"
            onClick={() => sfx.setEnabled(!soundOn)}
          >
            {soundOn ? <SoundIcon /> : <MuteIcon />}
            {soundOn ? "Sound on" : "Sound off"}
          </button>
          {single && !guest && (
            <button type="button" className="pause-btn" onClick={restart}>
              <RestartIcon />
              Restart
            </button>
          )}
          <button
            type="button"
            className="pause-btn"
            onClick={guest ? leaveGame : openMenu}
          >
            <MenuIcon />
            {guest ? "Leave game" : "Main menu"}
          </button>
        </div>
        <p className="pause-hint">Space or Esc to go back</p>
      </div>
    </div>
  );
}
