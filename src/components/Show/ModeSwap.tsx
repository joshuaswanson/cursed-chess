import { useEffect, useLayoutEffect, useState } from "react";
import type { CSSProperties } from "react";
import { GAME_MODES, MODE_SWAP_MS, useGameStore } from "../../stores/gameStore";
import type { ThemeId } from "../../theme/themes";
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

/** What pours through the windows he throws open as he breaks into the site */
const CODE = [
  "nmap totallynormalchess.com",
  "GET /admin 200 OK",
  "password: ********  ACCEPTED",
  "sudo su chessbot",
  "DROP TABLE fair_rules;",
  "UPDATE players SET rating = 0;",
  "chmod 777 /var/www/chess",
  "firewall.disable()",
  "rm -rf /fair_play",
  "curl -X DELETE /api/rules",
  "inject <script>cursed.js</script>",
  "deface index.html",
  "cat /etc/passwd",
  "logs.wipe()",
  "ACCESS GRANTED",
  "upload malware.pak 100%",
];

/** Where each window of code opens, as how far across and down the screen and how it leans; none over him in the middle */
const FLOOD: [x: number, y: number, tilt: number][] = [
  [0.02, 0.06, -3],
  [0.74, 0.04, 2],
  [0.04, 0.68, 2],
  [0.76, 0.7, -2],
  [0.3, 0.02, 1],
  [0.52, 0.82, -1],
  [0.01, 0.38, -1.5],
  [0.8, 0.36, 3],
  [0.22, 0.84, 2.5],
  [0.56, 0.08, -2.5],
  [0.12, 0.2, 1.5],
  [0.66, 0.6, 1],
];

/** When the parts of it happen, in ms from the start */
const TERMINAL_MS = 150;
const FLOOD_FROM_MS = 450;
const FLOOD_EVERY_MS = 150;
const TYPE_FROM_MS = 700;
const CHAR_MS = 22;
const RUMBLE_MS = 900;
const YANK_MS = 3500;
const FLASH_MS = 4550;
const BAR_CELLS = 16;

const fileName = (index: number) =>
  `${GAME_MODES[index].name.toLowerCase().replace(/[^a-z]+/g, "_")}.mode`;

/** Shakes the game, hardest at first and settling */
function shake(strength: number) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const frames = Array.from({ length: 13 }, (_, i) => {
    const left = i === 12 ? 0 : strength * (1 - i / 12) ** 1.6;
    return {
      translate: `${((Math.random() - 0.5) * 2 * left).toFixed(1)}px ${((Math.random() - 0.5) * 2 * left).toFixed(1)}px`,
    };
  });
  for (const el of document.querySelectorAll<HTMLElement>(
    ".app > .topbar, .app > .stage",
  )) {
    el.animate(frames, { duration: 600, easing: "linear" });
  }
}

/** The width and height of a window of code, as in the CSS */
const windowSize = () => ({
  w: Math.min(250, window.innerWidth * 0.4),
  h: 128,
});

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const overlaps = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** Where he sits and what he is saying, with room round it, so nothing is put over him */
function zoneOfBot(): Box | null {
  const boxes = [
    ".chessbot-dock .chessbot-head",
    ".chessbot-dock .chessbot-speech",
  ]
    .map((selector) =>
      document.querySelector(selector)?.getBoundingClientRect(),
    )
    .filter((r): r is DOMRect => r !== undefined && r.width > 0);
  if (boxes.length === 0) return null;
  const pad = 26;
  return {
    left: Math.min(...boxes.map((r) => r.left)) - pad,
    top: Math.min(...boxes.map((r) => r.top)) - pad,
    right: Math.max(...boxes.map((r) => r.right)) + pad,
    bottom: Math.max(...boxes.map((r) => r.bottom)) + pad,
  };
}

/** A hole in the dark over him, so he stays in plain sight while the rest of the screen goes */
function spotlight(zone: Box): CSSProperties {
  const x = (zone.left + zone.right) / 2;
  const y = (zone.top + zone.bottom) / 2;
  const rx = ((zone.right - zone.left) / 2) * 1.35;
  const ry = ((zone.bottom - zone.top) / 2) * 1.35;
  const mask = `radial-gradient(${rx}px ${ry}px at ${x}px ${y}px, transparent 70%, #000 100%)`;
  return { maskImage: mask, WebkitMaskImage: mask };
}

/** Where on screen a thing is, by its middle, or the middle of the screen if it is not there */
function middleOf(selector: string): { x: number; y: number } {
  const r = document.querySelector(selector)?.getBoundingClientRect();
  return r
    ? { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

/**
 * Between two modes of the adventure, Chessbot hacks the site from his spot
 * beside the board: alarms go off, a terminal and windows of code fly out
 * of him all over the screen, he breaks in and swaps the mode files, the old
 * board is torn away, and the site is his in a flash
 */
export function ModeSwap() {
  const swap = useGameStore((s) => s.modeSwap);
  if (!swap) return null;
  return <Swap key={swap.id} from={swap.from} to={swap.to} />;
}

function Swap({ from, to }: { from: number; to: number }) {
  const lines = [
    "ssh root@totallynormalchess.com",
    `rm ${fileName(from)}`,
    `upload ${fileName(to)}`,
    RULES[GAME_MODES[to].theme],
    "deploy --now",
  ];
  const total = lines.reduce((sum, line) => sum + line.length, 0);
  const typedBy = TYPE_FROM_MS + total * CHAR_MS;

  // Everything flies out of him, wherever he sits, and the terminal lands over the board
  const [{ bot, board }] = useState(() => ({
    bot: middleOf(".chessbot-dock .chessbot-head"),
    board: middleOf(".board-container"),
  }));
  // Where he is once his line is up, which the dark and the windows keep clear of
  const [zone, setZone] = useState<Box | null>(null);
  useLayoutEffect(() => setZone(zoneOfBot()), []);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(t) {
      setNow(t - start);
      if (t - start < MODE_SWAP_MS) frame = requestAnimationFrame(tick);
    });
    const at = (ms: number, fn: () => void) => window.setTimeout(fn, ms);
    const timers = [
      at(0, () => sfx.glitch()),
      at(TERMINAL_MS, () => {
        sfx.zap();
        shake(10);
      }),
      at(RUMBLE_MS, () => sfx.rumble(1)),
      at(YANK_MS, () => {
        sfx.collapse();
        shake(10);
      }),
      at(FLASH_MS, () => {
        sfx.boom();
        shake(22);
      }),
    ];
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((t) => window.clearTimeout(t));
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
  const uploaded = Math.min(
    1,
    Math.max(0, (now - YANK_MS) / (FLASH_MS - YANK_MS - 150)),
  );
  const cells = Math.round(uploaded * BAR_CELLS);

  return (
    <div
      className={`mode-swap${zone && (zone.top + zone.bottom) / 2 < window.innerHeight / 2 ? " tape-low" : ""}`}
      style={
        {
          "--swap-ms": `${MODE_SWAP_MS}ms`,
          ...(zone && spotlight(zone)),
        } as CSSProperties
      }
      aria-live="polite"
    >
      <span className="mode-swap-alert" />
      <div className="mode-swap-flood" aria-hidden>
        {FLOOD.map(([x, y, tilt], i) => {
          const { w, h } = windowSize();
          const left = x * (window.innerWidth - w);
          const top = y * (window.innerHeight - h);
          const box = { left, top, right: left + w, bottom: top + h };
          if (zone && overlaps(box, zone)) return null;
          return (
            <section
              key={i}
              className="mode-swap-window"
              style={
                {
                  "--x": x,
                  "--y": y,
                  "--bot-x": `${bot.x}px`,
                  "--bot-y": `${bot.y}px`,
                  "--tilt": `${tilt}deg`,
                  "--late": `${FLOOD_FROM_MS + i * FLOOD_EVERY_MS}ms`,
                  "--scroll": `${0.9 + (i % 4) * 0.25}s`,
                } as CSSProperties
              }
            >
              <header>
                <span>{`exploit_${(i * 7919) % 1000}.sh`}</span>
                <i />
                <i />
                <i />
              </header>
              <pre>
                {[0, 1].map((round) =>
                  CODE.map((_, k) => {
                    const line = CODE[(k + i * 5) % CODE.length];
                    return (
                      <span key={`${round}-${k}`}>
                        {line}
                        {"\n"}
                      </span>
                    );
                  }),
                )}
              </pre>
            </section>
          );
        })}
      </div>
      <div className="mode-swap-tape" aria-hidden>
        <span>{"SECURITY BREACH   ACCESS GRANTED   ".repeat(8)}</span>
      </div>
      <section
        className="mode-swap-terminal"
        style={
          {
            left: board.x,
            top: board.y,
            "--from-x": `${bot.x - board.x}px`,
            "--from-y": `${bot.y - board.y}px`,
          } as CSSProperties
        }
      >
        <header>
          <span>root@totallynormalchess</span>
          <i />
          <i />
          <i />
        </header>
        <pre>
          {shown.map((line, i) => (
            <span key={i}>
              {"> "}
              {line}
              {typing && i === shown.length - 1 && (
                <span className="mode-swap-caret" />
              )}
              {"\n"}
            </span>
          ))}
        </pre>
      </section>
      {now > YANK_MS - 100 && (
        <div
          className="mode-swap-hacked"
          style={{ left: board.x, top: board.y }}
        >
          <b>Site hacked</b>
          <span>totallynormalchess.com is now under new management</span>
          <span>{`[${"#".repeat(cells)}${".".repeat(BAR_CELLS - cells)}] ${fileName(to)} ${Math.round(uploaded * 100)}%`}</span>
        </div>
      )}
      <span className="mode-swap-flash" />
    </div>
  );
}
