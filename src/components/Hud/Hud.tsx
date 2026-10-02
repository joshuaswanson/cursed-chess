import { useEffect, useSyncExternalStore } from "react";
import { useGameStore, GAME_MODES, MODE_SECONDS } from "../../stores/gameStore";
import { Color, PieceType } from "../../engine";
import { THEMES } from "../../theme/themes";
import { useTheme } from "../../theme/useTheme";
import { pieceImage } from "../../utils/pieceImages";
import { sfx } from "../../audio/sfx";
import {
  MuteIcon,
  PauseIcon,
  PlayIcon,
  RestartIcon,
  SkipIcon,
  SoundIcon,
  WrenchIcon,
} from "./icons";
import "./Hud.css";

const MOVE_SECONDS = 10;
const LINEUP_LENGTH = 3;
const RING_RADIUS = 26;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function Scoreboard() {
  const scoreWhite = useGameStore((s) => s.scoreWhite);
  const scoreBlack = useGameStore((s) => s.scoreBlack);
  return (
    <section className="hud-card scoreboard" aria-label="Score">
      <div className="score-side">
        <img
          className="score-avatar"
          src={pieceImage({ type: PieceType.King, color: Color.White })}
          alt=""
        />
        <span className="score-name">You</span>
        <span className="score-value" key={scoreWhite}>
          {scoreWhite}
        </span>
      </div>
      <span className="score-vs" aria-hidden>
        VS
      </span>
      <div className="score-side score-side-foe">
        <span className="score-value" key={scoreBlack}>
          {scoreBlack}
        </span>
        <span className="score-name">Foe</span>
        <img
          className="score-avatar"
          src={pieceImage({ type: PieceType.King, color: Color.Black })}
          alt=""
        />
      </div>
    </section>
  );
}

function NowPlaying() {
  const theme = useTheme();
  const modeIndex = useGameStore((s) => s.currentModeIndex);
  const remaining = useGameStore((s) => s.modeTimeRemaining);
  const devMode = useGameStore((s) => s.devMode);
  const duration =
    modeIndex < 0
      ? MODE_SECONDS
      : (GAME_MODES[modeIndex].durationSeconds ?? MODE_SECONDS);
  const fraction = Math.max(0, Math.min(1, remaining / duration));
  const urgent = !devMode && remaining <= 5;

  return (
    <section className="hud-card now-playing" aria-label="Now playing">
      <div className="now-text">
        <span className="now-kicker">Now playing</span>
        <h2 className="now-title" key={theme.id}>
          {theme.title}
        </h2>
        <p className="now-tagline">{theme.tagline}</p>
      </div>
      <div
        className={`mode-ring${urgent ? " urgent" : ""}`}
        role="timer"
        aria-label={`${remaining} seconds left in this mode`}
      >
        <svg viewBox="0 0 64 64">
          <circle className="mode-ring-track" cx="32" cy="32" r={RING_RADIUS} />
          <circle
            className="mode-ring-fill"
            cx="32"
            cy="32"
            r={RING_RADIUS}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - fraction)}
          />
        </svg>
        <span className="mode-ring-value">{devMode ? "∞" : remaining}</span>
      </div>
    </section>
  );
}

function MoveClock() {
  const turn = useGameStore((s) => s.turn);
  const timeWhite = useGameStore((s) => s.timeWhite);
  const devMode = useGameStore((s) => s.devMode);
  const autonomous = useGameStore((s) => s.pluginManager.isAutonomous());

  if (autonomous) {
    return (
      <section className="hud-card move-clock">
        <span className="clock-label">Pieces are moving on their own</span>
      </section>
    );
  }
  if (turn !== Color.White) {
    return (
      <section className="hud-card move-clock foe-turn">
        <span className="clock-label">
          Foe is thinking
          <span className="thinking-dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </span>
      </section>
    );
  }

  const fraction = devMode ? 1 : Math.max(0, timeWhite / MOVE_SECONDS);
  const urgent = !devMode && timeWhite <= 3;
  return (
    <section
      className={`hud-card move-clock${urgent ? " urgent" : ""}`}
      role="timer"
      aria-label="Your move clock"
    >
      <span className="clock-label">Your move</span>
      <div className="clock-bar">
        <div className="clock-fill" style={{ scale: `${fraction} 1` }} />
      </div>
      <span className="clock-value">
        {devMode ? "∞" : Math.ceil(timeWhite)}
      </span>
    </section>
  );
}

function Lineup() {
  const modeIndex = useGameStore((s) => s.currentModeIndex);
  const upcoming = Array.from(
    { length: LINEUP_LENGTH },
    (_, i) => GAME_MODES[(modeIndex + 1 + i) % GAME_MODES.length],
  );
  return (
    <section className="lineup" aria-label="Up next">
      <span className="lineup-label">Up next</span>
      <ol className="lineup-list">
        {upcoming.map((mode, i) => {
          const theme = THEMES[mode.theme];
          return (
            <li
              key={`${mode.theme}-${i}`}
              className="lineup-chip"
              style={
                {
                  "--chip-a": theme.sky[1],
                  "--chip-b": theme.accent,
                } as React.CSSProperties
              }
            >
              {theme.title}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ToolButton({
  label,
  shortcut,
  onClick,
  active,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`tool-btn${active ? " active" : ""}`}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      data-tip={shortcut ? `${label} (${shortcut})` : label}
    >
      {children}
    </button>
  );
}

function useShortcuts() {
  const { togglePause, switchMode, toggleDevMode } = useGameStore.getState();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        toggleDevMode();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("button")) {
        if (e.key === " ") return;
      }
      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          togglePause();
          break;
        case "n":
          switchMode();
          break;
        case "m":
          sfx.setEnabled(!sfx.isEnabled());
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause, switchMode, toggleDevMode]);
}

function Toolbar() {
  const userPaused = useGameStore((s) => s.userPaused);
  const devMode = useGameStore((s) => s.devMode);
  const soundOn = useSyncExternalStore(sfx.subscribe, sfx.isEnabled);
  const { newGame, togglePause, switchMode, toggleDevMode } =
    useGameStore.getState();
  useShortcuts();

  return (
    <nav className="toolbar" aria-label="Game controls">
      <ToolButton label="Restart from the top" onClick={newGame}>
        <RestartIcon />
      </ToolButton>
      <ToolButton
        label={userPaused ? "Resume" : "Pause"}
        shortcut="Space"
        onClick={togglePause}
        active={userPaused}
      >
        {userPaused ? <PlayIcon /> : <PauseIcon />}
      </ToolButton>
      <ToolButton
        label="Skip to the next mode"
        shortcut="N"
        onClick={() => switchMode()}
      >
        <SkipIcon />
      </ToolButton>
      <ToolButton
        label={soundOn ? "Mute sound" : "Turn sound on"}
        shortcut="M"
        onClick={() => sfx.setEnabled(!soundOn)}
      >
        {soundOn ? <SoundIcon /> : <MuteIcon />}
      </ToolButton>
      <ToolButton
        label="Dev mode"
        shortcut="Ctrl+Shift+D"
        onClick={toggleDevMode}
        active={devMode}
      >
        <WrenchIcon />
      </ToolButton>
    </nav>
  );
}

function DevPanel() {
  const modeIndex = useGameStore((s) => s.currentModeIndex);
  const { switchMode } = useGameStore.getState();
  return (
    <section className="hud-card dev-panel" aria-label="Jump to a mode">
      <span className="dev-title">Jump to a mode</span>
      <div className="dev-grid">
        {GAME_MODES.map((mode, i) => {
          const theme = THEMES[mode.theme];
          return (
            <button
              key={mode.theme}
              type="button"
              className={`dev-chip${i === modeIndex ? " active" : ""}`}
              style={
                {
                  "--chip-a": theme.sky[1],
                  "--chip-b": theme.accent,
                } as React.CSSProperties
              }
              onClick={() => switchMode(i)}
            >
              {theme.title}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** The broadcast panel beside the board */
export function Hud() {
  const devMode = useGameStore((s) => s.devMode);
  return (
    <aside className="hud">
      <Scoreboard />
      <NowPlaying />
      <MoveClock />
      <Lineup />
      <Toolbar />
      {devMode && <DevPanel />}
    </aside>
  );
}
