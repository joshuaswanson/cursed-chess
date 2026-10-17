import { useEffect, useState } from "react";
import { GAME_MODES, MODE_SWAP_MS, useGameStore } from "../../stores/gameStore";
import type { ThemeId } from "../../theme/themes";
import { Chessbot } from "../Chessbot/Chessbot";
import { sfx } from "../../audio/sfx";
import "./ModeSwap.css";

/** The line of code that sets up each mode's rules */
const RULES: Record<ThemeId, string> = {
  opening: "rules.reset()",
  portals: "portals.spawn(4)",
  fog: "vision.radius = 1",
  royale: "edges.collapse(every: 3)",
  clash: "turns = off; elixir = on",
  mines: "mines.bury(at: random)",
  hill: "hill.raise(center)",
  gravity: "gravity.enable()",
  fifa: "kings.bench(); ball.drop()",
  hex: 'board.shape = "hex"',
  stratego: "enemy.mask(all)",
  tug: "rope.tie(everyone)",
  zombies: "graves.open()",
  trenches: "war.declare()",
  lanterns: "lights.off(); lanterns.give(4)",
  conveyor: "belts.install()",
  heist: "alarms.arm()",
  storm: "lights.off(); sky.storm()",
  pacman: "pellets.scatter()",
};

/** When he starts typing, how long each character takes, and how long the build bar runs */
const TYPE_FROM_MS = 450;
const CHAR_MS = 26;
const BUILD_MS = 520;
/** How long before the next mode the screen breaks up */
const GLITCH_MS = 380;
const BAR_CELLS = 14;

const fileName = (index: number) =>
  `${GAME_MODES[index].name.toLowerCase().replace(/[^a-z]+/g, "_")}.mode`;

/**
 * Between two modes of the adventure, Chessbot comes up in front of the
 * board and rewrites the game: he unloads the mode just played, loads the
 * next, patches in its rules, builds it, and the screen breaks up as it goes
 * live
 */
export function ModeSwap() {
  const swap = useGameStore((s) => s.modeSwap);
  if (!swap) return null;
  return <Swap key={swap.id} from={swap.from} to={swap.to} />;
}

function Swap({ from, to }: { from: number; to: number }) {
  const lines = [
    `unload ${fileName(from)}`,
    `load ${fileName(to)}`,
    RULES[GAME_MODES[to].theme],
    "deploy",
  ];
  const total = lines.reduce((sum, line) => sum + line.length, 0);
  const typedBy = TYPE_FROM_MS + total * CHAR_MS;
  const builtBy = typedBy + BUILD_MS;

  const [now, setNow] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(t) {
      setNow(t - start);
      if (t - start < MODE_SWAP_MS) frame = requestAnimationFrame(tick);
    });
    const glitch = window.setTimeout(
      () => sfx.glitch(),
      MODE_SWAP_MS - GLITCH_MS,
    );
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(glitch);
    };
  }, []);

  let left = Math.max(0, Math.floor((now - TYPE_FROM_MS) / CHAR_MS));
  const shown = lines.flatMap((line) => {
    if (left <= 0) return [];
    const part = line.slice(0, left);
    left -= line.length;
    return [part];
  });
  const typing = now < typedBy;
  const built = Math.min(1, Math.max(0, (now - typedBy) / BUILD_MS));
  const cells = Math.round(built * BAR_CELLS);
  const glitching = now > MODE_SWAP_MS - GLITCH_MS;

  return (
    <div
      className={`mode-swap${glitching ? " is-glitching" : ""}`}
      aria-live="polite"
    >
      <div className="mode-swap-stage">
        <div className="mode-swap-bot">
          <Chessbot mood={now > builtBy ? "laugh" : "smug"} />
        </div>
        <section className="mode-swap-terminal">
          <header>
            <span>chessbot.exe</span>
            <i />
            <i />
            <i />
          </header>
          <pre>
            {shown.map((line, i) => (
              <span key={i} className="mode-swap-line">
                {"> "}
                {line}
                {typing && i === shown.length - 1 && (
                  <span className="mode-swap-caret" />
                )}
                {"\n"}
              </span>
            ))}
            {!typing && (
              <span className="mode-swap-build">
                {`[${"#".repeat(cells)}${".".repeat(BAR_CELLS - cells)}] ${Math.round(built * 100)}%`}
                {built === 1 && "  ok"}
              </span>
            )}
          </pre>
        </section>
      </div>
    </div>
  );
}
