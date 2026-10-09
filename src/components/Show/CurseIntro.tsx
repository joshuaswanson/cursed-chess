import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { sfx } from "../../audio/sfx";
import { Confetti } from "./Confetti";
import "./Show.css";

const NOTICE = "Connection unstable. Reconnecting...";
const CORRUPTED = "R̷E̶C̵O̸N̷N̵E̶C̷T̸I̵N̶G̷ TO SOMETHING ELSE";
const GLYPHS = "#$%&@!?*<>/\\|=+~^";

/** Text that decays from `from` into `to`, one scrambled character at a time */
function useCorruptingText(from: string, to: string, ms: number) {
  const [text, setText] = useState(from);
  useEffect(() => {
    const start = performance.now();
    const interval = setInterval(() => {
      const progress = Math.min(1, (performance.now() - start) / ms);
      const target = progress < 0.55 ? from : to;
      const noise = Math.sin(progress * Math.PI);
      setText(
        target
          .split("")
          .map((ch) =>
            ch !== " " && Math.random() < noise * 0.45
              ? GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
              : ch,
          )
          .join(""),
      );
      if (progress === 1) clearInterval(interval);
    }, 70);
    return () => clearInterval(interval);
  }, [from, to, ms]);
  return text;
}

/** The plain chess site starts to break apart */
function CurseGlitch() {
  const notice = useCorruptingText(NOTICE, CORRUPTED, 1900);
  useEffect(() => {
    sfx.glitch();
    const timers = [500, 1100, 1500, 1800].map((ms) =>
      setTimeout(() => sfx.glitch(), ms),
    );
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <div className="curse-glitch-layer" aria-hidden>
      <div className="glitch-scanlines" />
      <div className="glitch-static" />
      {[18, 41, 63, 77].map((top, i) => (
        <span
          key={i}
          className="glitch-tear"
          style={
            {
              top: `${top}%`,
              animationDelay: `${i * -0.37}s`,
            } as React.CSSProperties
          }
        />
      ))}
      <div className="glitch-notice" role="status">
        {notice}
      </div>
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
  if (stage === "glitch") return <CurseGlitch />;
  if (stage === "boom") return <CurseBoom />;
  return null;
}
