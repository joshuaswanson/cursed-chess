import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { sfx } from "../../audio/sfx";
import { Confetti } from "./Confetti";
import "./Show.css";

/** What his installer reports as it finishes, a line at a time */
const INSTALL_LOG = [
  "totally_normal_chess ..... deleted",
  "rules .................... replaced",
  "fairness ................. not found",
  "administrator ............ chessbot",
];
const LOG_LINE_MS = 260;
const BAR_CELLS = 28;

/**
 * The plain site is gone. In its place, filling the screen, his installer
 * reports that it has finished: whatever he was loading is on the machine
 * now, and about to start.
 */
function CurseInstalled({ launching }: { launching: boolean }) {
  const [logged, setLogged] = useState(0);
  useEffect(() => {
    sfx.glitch();
    const timers = [500, 1100, 1500, 1800, 2500, 3100, 3800, 4400].map((ms) =>
      setTimeout(() => sfx.glitch(), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    if (logged >= INSTALL_LOG.length) return;
    const timer = setTimeout(() => setLogged((n) => n + 1), LOG_LINE_MS);
    return () => clearTimeout(timer);
  }, [logged]);
  return (
    <div className="curse-glitch-layer curse-install" role="status">
      <div className="install-panel">
        <p className="install-name">cursed_chess.exe</p>
        <p className="install-bar" aria-hidden>
          [{"#".repeat(BAR_CELLS)}] 100%
        </p>
        <h1 className="install-done" data-text="INSTALLATION COMPLETE">
          INSTALLATION COMPLETE
        </h1>
        <pre className="install-log">
          {INSTALL_LOG.slice(0, logged).join("\n")}
        </pre>
        {launching && (
          <p className="install-launch">
            {"> starting cursed chess"}
            <span className="install-caret" aria-hidden />
          </p>
        )}
      </div>
      <div className="glitch-scanlines" aria-hidden />
      <div className="glitch-static" aria-hidden />
      {[18, 41, 63, 77].map((top, i) => (
        <span
          key={i}
          className="glitch-tear"
          aria-hidden
          style={
            {
              top: `${top}%`,
              animationDelay: `${i * -0.37}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** BOOM: the curse bursts through and the party begins */
function CurseBoom() {
  useEffect(() => {
    sfx.boom();
  }, []);
  return (
    <div className="curse-boom" role="status" aria-label="Cursed Chess">
      <div className="boom-rays" />
      <div className="boom-flash" />
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="boom-ring"
          style={{ animationDelay: `${i * 140}ms` }}
        />
      ))}
      <div className="boom-logo">
        <div className="boom-cursed" data-text="CURSED">
          {"CURSED".split("").map((ch, i) => (
            <span
              key={i}
              className="boom-letter"
              style={{ "--i": i } as React.CSSProperties}
            >
              {ch}
            </span>
          ))}
        </div>
        <div className="boom-chess">CHESS</div>
      </div>
      <Confetti count={140} seed={3} delayMs={850} />
    </div>
  );
}

export function CurseIntro() {
  const stage = useGameStore((s) => s.curseStage);
  // His installer holds the screen while he gloats, right up to the title
  if (stage === "glitch" || stage === "oops") {
    return <CurseInstalled launching={stage === "oops"} />;
  }
  if (stage === "boom") return <CurseBoom />;
  return null;
}
