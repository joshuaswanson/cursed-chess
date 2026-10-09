import { useEffect, useSyncExternalStore } from "react";
import { useGameStore, GAME_MODES, MODE_SECONDS } from "../../stores/gameStore";
import { Color, PieceType } from "../../engine";
import { useTheme } from "../../theme/useTheme";
import { pieceImage } from "../../utils/pieceImages";
import { sfx } from "../../audio/sfx";
import {
  MenuIcon,
  MuteIcon,
  PauseIcon,
  PlayIcon,
  RestartIcon,
  SoundIcon,
} from "./icons";
import "./Hud.css";

const MOVE_SECONDS = 10;
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
        <span className="score-name">Chessbot</span>
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
  const duration =
    modeIndex < 0
      ? MODE_SECONDS
      : (GAME_MODES[modeIndex].durationSeconds ?? MODE_SECONDS);
  // Modes the kings sit out, and some others, have no clock; they run until someone wins
  const untimed =
    modeIndex >= 0 &&
    (GAME_MODES[modeIndex].kingsSitOut || GAME_MODES[modeIndex].untilWon);
  const fraction = untimed ? 1 : Math.max(0, Math.min(1, remaining / duration));
  const tagline = theme.tagline;
  const urgent = !untimed && remaining <= 5;

  return (
    <section className="hud-card now-playing" aria-label="Now playing">
      <div className="now-text">
        <span className="now-kicker">Now playing</span>
        <h2 className="now-title" key={theme.id}>
          {theme.title}
        </h2>
        <p className="now-tagline">{tagline}</p>
      </div>
      <div
        className={`mode-ring${urgent ? " urgent" : ""}`}
        role="timer"
        aria-label={
          untimed
            ? "No time limit: play until someone wins"
            : `${remaining} seconds left in this mode`
        }
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
        <span className="mode-ring-value">{untimed ? "∞" : remaining}</span>
      </div>
    </section>
  );
}

function MoveClock() {
  const turn = useGameStore((s) => s.turn);
  const timeWhite = useGameStore((s) => s.timeWhite);
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
          Chessbot is thinking
          <span className="thinking-dots" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </span>
      </section>
    );
  }

  const fraction = Math.max(0, timeWhite / MOVE_SECONDS);
  const urgent = timeWhite <= 3;
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
      <span className="clock-value">{Math.ceil(timeWhite)}</span>
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
  const { togglePause } = useGameStore.getState();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest("button")) {
        if (e.key === " ") return;
      }
      switch (e.key.toLowerCase()) {
        case " ":
          e.preventDefault();
          togglePause();
          break;
        case "m":
          sfx.setEnabled(!sfx.isEnabled());
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePause]);
}

function Toolbar() {
  const userPaused = useGameStore((s) => s.userPaused);
  const soundOn = useSyncExternalStore(sfx.subscribe, sfx.isEnabled);
  const { newGame, togglePause, openMenu } = useGameStore.getState();
  useShortcuts();

  return (
    <nav className="toolbar" aria-label="Game controls">
      <ToolButton label="Main menu" onClick={openMenu}>
        <MenuIcon />
      </ToolButton>
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
        label={soundOn ? "Mute sound" : "Turn sound on"}
        shortcut="M"
        onClick={() => sfx.setEnabled(!soundOn)}
      >
        {soundOn ? <SoundIcon /> : <MuteIcon />}
      </ToolButton>
    </nav>
  );
}

/** The broadcast panel beside the board */
export function Hud() {
  return (
    <aside className="hud">
      <Scoreboard />
      <NowPlaying />
      <MoveClock />
      <Toolbar />
    </aside>
  );
}
