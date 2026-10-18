import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { GAME_MODES, MODE_SWAP_MS, useGameStore } from "../../stores/gameStore";
import { THEMES } from "../../theme/themes";
import type { ThemeId } from "../../theme/themes";
import { boardFiles, boardRanks } from "../../utils/squareUtils";
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

/** Code pouring through the windows he throws open */
const CODE = [
  "patch rules.dll --force",
  "for piece in board: piece.loyalty = 0",
  "rm -rf /fair_play",
  "override(win_condition)",
  "inject(chaos, level=9000)",
  "kings.trust = false",
  "undo_button.delete()",
  "physics.enabled = maybe",
  "while (you.winning) cheat()",
  "assert chessbot.wins",
  "sudo make_it_worse",
  "load cursed_sprites.pak",
  "random.seed(evil)",
  "touch_move = strict",
  "compile mischief.c -O3",
  "board.rewrite()",
];

/** What each square of the board turns out to be running, underneath */
const UNDERNEATH = [
  "mov rook",
  "jmp e4",
  "xor king",
  "0xDEAD",
  "if(win)",
  "null",
  "ERR 0x4F",
  "goto 64",
  "pawn++",
  "nop",
  "ret 0",
  "seg 0x8",
  "cmp q,k",
  "!!!",
  "0b1010",
  "halt?",
];

/** Where the windows of code open, as how far across and down the screen and how they lean */
const FLOOD: [x: number, y: number, tilt: number][] = [
  [0.02, 0.06, -3],
  [0.74, 0.04, 2],
  [0.04, 0.72, 2],
  [0.78, 0.74, -2],
  [0.3, 0.02, 1],
  [0.52, 0.86, -1],
  [0.01, 0.38, -1.5],
  [0.84, 0.4, 3],
  [0.22, 0.88, 2.5],
  [0.58, 0.04, -2.5],
];

/** Colours a square flashes as the board is hacked */
const NEON = ["#ff2e88", "#21e6ff", "#7dffab", "#ffe45c", "#b26bff", "#ff6a2a"];
const GLYPHS = "01<>{}[]#$%&*+=?/|~^";
const STREAM = 44;

/** When each part of it happens, in ms from the start */
const TERMINAL_MS = 300;
const STREAM_MS = 500;
const GLITCH_MS = 900;
const TYPE_FROM_MS = 1000;
const CHAR_MS = 30;
const FLOOD_FROM_MS = 1400;
const FLOOD_EVERY_MS = 300;
const FRENZY_MS = 3100;
const UNDERNEATH_MS = 4400;
const UNDERNEATH_OVER_MS = 1200;
const CHARGE_MS = 5700;
const WAVE_MS = 6300;
const WAVE_SPREAD_MS = 1000;
const BAR_CELLS = 14;

type Phase = "wake" | "glitch" | "frenzy" | "underneath" | "charge" | "wave";

const phaseAt = (ms: number): Phase =>
  ms >= WAVE_MS
    ? "wave"
    : ms >= CHARGE_MS
      ? "charge"
      : ms >= UNDERNEATH_MS
        ? "underneath"
        : ms >= FRENZY_MS
          ? "frenzy"
          : ms >= GLITCH_MS
            ? "glitch"
            : "wake";

const fileName = (index: number) =>
  `${GAME_MODES[index].name.toLowerCase().replace(/[^a-z]+/g, "_")}.mode`;

const pick = <T,>(list: readonly T[]) =>
  list[Math.floor(Math.random() * list.length)];

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const boxOf = (selector: string): Box | null => {
  const r = document.querySelector(selector)?.getBoundingClientRect();
  return r && r.width > 0
    ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    : null;
};

const overlaps = (a: Box, b: Box) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

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

/**
 * Between two modes of the adventure, Chessbot hacks the board from his
 * spot beside it: code streams out of him into it, its squares flash and
 * its pieces glitch, then each square flips over to show the code it runs
 * on, and a shockwave of glitch blasts out from him and turns everything
 * into the next mode
 */
export function ModeSwap() {
  const swap = useGameStore((s) => s.modeSwap);
  if (!swap) return null;
  return (
    <Swap
      key={swap.id}
      from={swap.from}
      to={swap.to}
      switched={swap.switched}
    />
  );
}

function Swap({
  from,
  to,
  switched,
}: {
  from: number;
  to: number;
  switched: boolean;
}) {
  const lines = [
    `unload ${fileName(from)}`,
    `load ${fileName(to)}`,
    RULES[GAME_MODES[to].theme],
    "deploy --now",
  ];
  const total = lines.reduce((sum, line) => sum + line.length, 0);
  const typedBy = TYPE_FROM_MS + total * CHAR_MS;

  // Laid out once, from where everything is on screen as it starts
  const [scene] = useState(() => {
    const head = boxOf(".chessbot-dock .chessbot-head");
    const bot = head
      ? { x: (head.left + head.right) / 2, y: (head.top + head.bottom) / 2 }
      : { x: window.innerWidth - 120, y: 120 };
    const board = boxOf(".board") ??
      boxOf(".hex-board") ??
      boxOf(".board-container") ?? {
        left: window.innerWidth * 0.2,
        top: window.innerHeight * 0.15,
        right: window.innerWidth * 0.6,
        bottom: window.innerHeight * 0.85,
      };
    const hud = boxOf(".hud");
    const termWidth = Math.min(360, hud ? hud.right - hud.left : 360);
    const terminal = {
      x: hud ? (hud.left + hud.right) / 2 : bot.x,
      y: (head?.bottom ?? bot.y) + 24,
    };
    const termBox: Box = {
      left: terminal.x - termWidth / 2,
      top: terminal.y,
      right: terminal.x + termWidth / 2,
      bottom: terminal.y + 190,
    };
    const near: Box = {
      left: bot.x - 90,
      top: bot.y - 90,
      right: bot.x + 260,
      bottom: bot.y + 90,
    };
    const w = Math.min(220, window.innerWidth * 0.4);
    const h = 116;
    const windows = FLOOD.flatMap(([x, y, tilt], i) => {
      const left = x * (window.innerWidth - w);
      const top = y * (window.innerHeight - h);
      const box = { left, top, right: left + w, bottom: top + h };
      return [board, termBox, near].some((b) => overlaps(box, b))
        ? []
        : [{ left, top, tilt, i }];
    });
    const files = boardFiles();
    const ranks = boardRanks();
    const tiles = Array.from({ length: files * ranks }, (_, i) => ({
      i,
      late: UNDERNEATH_MS + Math.random() * UNDERNEATH_OVER_MS,
      lines: [pick(UNDERNEATH), pick(UNDERNEATH), pick(UNDERNEATH)],
      broken: Math.random() < 0.18,
    }));
    const glyphs = Array.from({ length: STREAM }, (_, i) => ({
      char: pick(GLYPHS.split("")),
      tx: board.left + Math.random() * (board.right - board.left) - bot.x,
      ty: board.top + Math.random() * (board.bottom - board.top) - bot.y,
      late: (i / STREAM) * 700,
      color: pick(["#7dffab", "#7dffab", "#c8ffd9", "#21e6ff"]),
    }));
    const reach = Math.max(
      ...[
        [0, 0],
        [window.innerWidth, 0],
        [0, window.innerHeight],
        [window.innerWidth, window.innerHeight],
      ].map(([x, y]) => Math.hypot(x - bot.x, y - bot.y)),
    );
    return {
      bot,
      board,
      files,
      ranks,
      terminal,
      termWidth,
      windows,
      w,
      h,
      tiles,
      glyphs,
      reach: reach + 60,
      // How far round him the wave leaves him in sight
      clear: head
        ? Math.max(head.right - head.left, head.bottom - head.top) / 2 + 14
        : 60,
    };
  });

  const [now, setNow] = useState(0);
  const phase = phaseAt(now);

  useEffect(() => {
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(t) {
      setNow(t - start);
      if (t - start < MODE_SWAP_MS) frame = requestAnimationFrame(tick);
    });
    const at = (ms: number, fn: () => void) => window.setTimeout(fn, ms);
    const timers = [
      at(0, () => sfx.glitch()),
      at(TERMINAL_MS, () => sfx.zap()),
      at(GLITCH_MS, () => sfx.glitch()),
      at(FRENZY_MS, () => sfx.rumble(1)),
      at(UNDERNEATH_MS, () => sfx.glitch()),
      at(CHARGE_MS, () => sfx.zap()),
      at(WAVE_MS, () => {
        sfx.boom();
        shake(20);
      }),
    ];
    // Every square of the board flashes and glitches in its own time
    const squares = document.querySelectorAll<HTMLElement>(
      ".board .square, .hex-cell",
    );
    for (const sq of squares) {
      sq.style.setProperty(
        "--swap-late",
        `${(Math.random() * 1.6).toFixed(2)}s`,
      );
      sq.style.setProperty("--swap-flash", pick(NEON));
      sq.style.setProperty("--swap-flash-2", pick(NEON));
    }
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((t) => window.clearTimeout(t));
      for (const sq of squares) {
        sq.style.removeProperty("--swap-late");
        sq.style.removeProperty("--swap-flash");
        sq.style.removeProperty("--swap-flash-2");
      }
    };
  }, []);

  // The game itself shows what stage the hack is at, for its board and his glow
  useEffect(() => {
    const app = document.querySelector<HTMLElement>(".app");
    if (!app) return;
    if (switched) delete app.dataset.swap;
    else app.dataset.swap = phase;
  }, [phase, switched]);
  useEffect(
    () => () => {
      const app = document.querySelector<HTMLElement>(".app");
      if (app) delete app.dataset.swap;
    },
    [],
  );
  useEffect(() => {
    if (switched) sfx.glitch();
  }, [switched]);

  let left = Math.max(0, Math.floor((now - TYPE_FROM_MS) / CHAR_MS));
  const shown = lines.flatMap((line) => {
    if (left <= 0) return [];
    const part = line.slice(0, left);
    left -= line.length;
    return [part];
  });
  const typing = now < typedBy;
  const built = Math.min(
    1,
    Math.max(0, (now - typedBy) / (CHARGE_MS - typedBy)),
  );
  const cells = Math.round(built * BAR_CELLS);

  const { bot, board } = scene;
  const sky = THEMES[GAME_MODES[to].theme].sky;
  const newWorld = `repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.16) 0 1px, transparent 1px 3px), linear-gradient(160deg, ${sky[0]}, ${sky[1]}, ${sky[2]})`;
  const spread = Math.min(1, Math.max(0, (now - WAVE_MS) / WAVE_SPREAD_MS));
  const radius = spread ** 1.6 * scene.reach;
  // He stays in sight through it all, the wave blasting out from round him
  const aroundHim = `radial-gradient(circle at ${bot.x}px ${bot.y}px, transparent ${scene.clear}px, #000 ${scene.clear + 10}px)`;
  const ring = (r: number, width: number) =>
    `radial-gradient(circle at ${bot.x}px ${bot.y}px, transparent ${r - width}px, #000 ${r - width * 0.6}px, #000 ${r}px, transparent ${r + 3}px)`;

  return (
    <div className="mode-swap" aria-hidden>
      {!switched && (
        <>
          {now >= STREAM_MS && now < WAVE_MS && (
            <div className="mode-swap-stream">
              {scene.glyphs.map((g, i) => (
                <i
                  key={i}
                  style={
                    {
                      left: bot.x,
                      top: bot.y,
                      color: g.color,
                      "--tx": `${g.tx}px`,
                      "--ty": `${g.ty}px`,
                      animationDelay: `${g.late}ms`,
                    } as CSSProperties
                  }
                >
                  {g.char}
                </i>
              ))}
            </div>
          )}

          <div
            className="mode-swap-underneath"
            style={{
              left: board.left,
              top: board.top,
              width: board.right - board.left,
              height: board.bottom - board.top,
              gridTemplateColumns: `repeat(${scene.files}, 1fr)`,
              gridTemplateRows: `repeat(${scene.ranks}, 1fr)`,
              fontSize: (board.right - board.left) / scene.files / 7,
            }}
          >
            {scene.tiles.map((tile) => (
              <span
                key={tile.i}
                className={tile.broken ? "is-broken" : undefined}
                style={{ animationDelay: `${tile.late}ms` }}
              >
                {tile.lines.map((line, k) => (
                  <b key={k}>{line}</b>
                ))}
              </span>
            ))}
          </div>

          {scene.windows.map(({ left: x, top: y, tilt, i }, n) => (
            <section
              key={i}
              className="mode-swap-window"
              style={
                {
                  left: x,
                  top: y,
                  width: scene.w,
                  height: scene.h,
                  rotate: `${tilt}deg`,
                  "--from-x": `${bot.x - x - scene.w / 2}px`,
                  "--from-y": `${bot.y - y - scene.h / 2}px`,
                  "--late": `${FLOOD_FROM_MS + n * FLOOD_EVERY_MS}ms`,
                  "--scroll": `${0.9 + (i % 4) * 0.25}s`,
                } as CSSProperties
              }
            >
              <header>
                <span>{`patch_${(i * 7919) % 1000}.exe`}</span>
                <i />
                <i />
                <i />
              </header>
              <pre>
                {[0, 1].map((round) =>
                  CODE.map((_, k) => (
                    <span key={`${round}-${k}`}>
                      {CODE[(k + i * 5) % CODE.length]}
                      {"\n"}
                    </span>
                  )),
                )}
              </pre>
            </section>
          ))}

          <section
            className="mode-swap-terminal"
            style={
              {
                left: scene.terminal.x,
                top: scene.terminal.y,
                width: scene.termWidth,
                "--from-x": `${bot.x - scene.terminal.x}px`,
                "--from-y": `${bot.y - scene.terminal.y}px`,
              } as CSSProperties
            }
          >
            <header>
              <span>chessbot.exe</span>
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
              {!typing && (
                <span className="mode-swap-build">
                  {`[${"#".repeat(cells)}${".".repeat(BAR_CELLS - cells)}] ${Math.round(built * 100)}%`}
                </span>
              )}
            </pre>
          </section>

          {radius > 0 && (
            <>
              <div
                className="mode-swap-wave"
                style={{
                  background: newWorld,
                  clipPath: `circle(${radius}px at ${bot.x}px ${bot.y}px)`,
                  maskImage: aroundHim,
                  WebkitMaskImage: aroundHim,
                }}
              />
              {radius - 34 > scene.clear && (
                <div
                  className="mode-swap-ring"
                  style={{
                    maskImage: ring(radius, 34),
                    WebkitMaskImage: ring(radius, 34),
                  }}
                />
              )}
              {radius - 86 > scene.clear && (
                <div
                  className="mode-swap-ring is-trailing"
                  style={{
                    maskImage: ring(radius - 70, 16),
                    WebkitMaskImage: ring(radius - 70, 16),
                  }}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Once the next mode is in place, the new world that swept over it falls away bit by bit */}
      {switched && (
        <div
          className="mode-swap-dissolve"
          style={{ maskImage: aroundHim, WebkitMaskImage: aroundHim }}
        >
          {Array.from({ length: 96 }, (_, i) => {
            const col = i % 12;
            const row = Math.floor(i / 12);
            return (
              <i
                key={i}
                style={{
                  left: `${(col / 12) * 100}%`,
                  top: `${(row / 8) * 100}%`,
                  backgroundImage: newWorld,
                  backgroundSize: "100vw 100vh",
                  backgroundPosition: `${(-col / 12) * window.innerWidth}px ${(-row / 8) * window.innerHeight}px`,
                  animationDelay: `${Math.round(((i * 37) % 96) * 6.5)}ms`,
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
