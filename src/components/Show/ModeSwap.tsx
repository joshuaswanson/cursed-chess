import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  GAME_MODES,
  MODE_SWAP_CLEAR_MS,
  MODE_SWAP_MS,
  useGameStore,
} from "../../stores/gameStore";
import { THEMES } from "../../theme/themes";
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
  finale: "modes.enable(ALL)",
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

/** The errors that pile up as the site breaks, each a cascade of the same window */
const ERRORS = [
  { title: "chess.exe", text: "chess.exe has stopped responding." },
  { title: "Script error", text: "Uncaught TypeError: rules is undefined" },
];
/** How many windows each cascade of errors piles up, and how big each is */
const CASCADE = 13;
const ERROR_W = 260;
const ERROR_H = 104;

/** Colours a square flashes as the board is hacked */
const NEON = ["#ff2e88", "#21e6ff", "#7dffab", "#ffe45c", "#b26bff", "#ff6a2a"];

/** When each part of it happens, in ms from the start */
const TERMINAL_MS = 300;
const GLITCH_MS = 900;
const TYPE_FROM_MS = 1000;
const CHAR_MS = 30;
const FLOOD_FROM_MS = 1400;
const FLOOD_EVERY_MS = 300;
const FRENZY_MS = 3100;
const ERRORS_MS = [3300, 4500];
const ERROR_EVERY_MS = 85;
const CHARGE_MS = 5700;
const WAVE_MS = 6300;
const WAVE_SPREAD_MS = 1000;
const BAR_CELLS = 14;

/** The shockwave works through the screen in blocks this many pixels across */
const BLOCK_PX = 44;
/** How unevenly the blocks are reached, in pixels, so the front is ragged */
const WAVE_RAGGEDNESS = 90;
/** How far behind the front the blocks keep glitching before they settle into the new mode */
const WAVE_FRONT_PX = 60;
/** How far ahead of the front the screen is already breaking up */
const WAVE_AHEAD_PX = 70;

const fileName = (index: number) =>
  `${GAME_MODES[index].name.toLowerCase().replace(/[^a-z]+/g, "_")}.mode`;

const pick = <T,>(list: readonly T[]) =>
  list[Math.floor(Math.random() * list.length)];

const spread = (n: number) => (Math.random() - 0.5) * 2 * n;

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

const stillScreen = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Shakes the board and the logo, hardest at first and settling */
function shake(strength: number) {
  if (stillScreen()) return;
  const frames = Array.from({ length: 13 }, (_, i) => {
    const left = i === 12 ? 0 : strength * (1 - i / 12) ** 1.6;
    return {
      translate: `${spread(left).toFixed(1)}px ${spread(left).toFixed(1)}px`,
    };
  });
  for (const el of document.querySelectorAll<HTMLElement>(
    ".app > .topbar, .board-shell, .hex-board-wrapper",
  )) {
    el.animate(frames, { duration: 600, easing: "linear" });
  }
}

/** A keyframe that holds until the next, so a glitch jumps and never slides */
const jump = (frame: Keyframe): Keyframe => ({ ...frame, easing: "steps(1)" });

/**
 * Everything the hack does to the page itself. Each glitch is an animation
 * of its own and each style it sets is remembered, so all of it can be
 * stopped and put back the moment the next mode is in.
 */
class Wreckage {
  private running: Animation[] = [];
  private restores: (() => void)[] = [];

  private play(
    el: Element,
    frames: Keyframe[],
    options: KeyframeAnimationOptions,
  ) {
    this.running.push(el.animate(frames, options));
  }

  /** Sets a style on an element for as long as the hack lasts */
  private hold(el: HTMLElement, property: string, value: string) {
    const before = el.style.getPropertyValue(property);
    el.style.setProperty(property, value);
    this.restores.push(() =>
      before
        ? el.style.setProperty(property, before)
        : el.style.removeProperty(property),
    );
  }

  private all(selector: string) {
    return [...document.querySelectorAll<HTMLElement>(selector)];
  }

  /** He sits in front of everything he does, glowing as he works */
  lift() {
    const dock = document.querySelector<HTMLElement>(".chessbot-dock");
    const hud = document.querySelector<HTMLElement>(".hud");
    if (hud) this.hold(hud, "z-index", "auto");
    if (dock) {
      this.hold(dock, "z-index", "61");
      this.hold(dock, "position", "relative");
    }
    const head = document.querySelector(".chessbot-dock .chessbot-head");
    if (!head || stillScreen()) return;
    const glow = "drop-shadow(0 0 8px #7dffab) drop-shadow(0 0 18px #2bd47a)";
    this.play(
      head,
      [
        { translate: "0 0", rotate: "-4deg", filter: glow },
        { translate: "0 -4%", rotate: "4deg", filter: glow },
      ],
      { duration: 160, iterations: Infinity, direction: "alternate" },
    );
  }

  /** Squares flash, pieces twitch, and the board jolts now and then */
  glitch() {
    if (stillScreen()) return;
    for (const sq of this.all(".board .square, .hex-cell")) {
      const [a, b] = [pick(NEON), pick(NEON)];
      this.play(
        sq,
        [
          jump({ boxShadow: "none", offset: 0 }),
          jump({ boxShadow: `inset 0 0 0 999px ${a}`, offset: 0.66 }),
          jump({ boxShadow: "none", offset: 0.76 }),
          jump({ boxShadow: `inset 0 0 0 999px ${b}`, offset: 0.84 }),
          jump({ boxShadow: "none", offset: 0.9 }),
        ],
        { duration: 1800, delay: Math.random() * 1600, iterations: Infinity },
      );
    }
    for (const piece of this.all(".board .piece-img, .hex-board img")) {
      this.play(
        piece,
        [
          jump({ translate: "0 0", filter: "none", offset: 0 }),
          jump({
            translate: "4px -2px",
            filter:
              "drop-shadow(3px 0 0 #21e6ff) drop-shadow(-3px 0 0 #ff2e88)",
            offset: 0.62,
          }),
          jump({
            translate: "-3px 1px",
            filter: "invert(1) hue-rotate(90deg)",
            offset: 0.68,
          }),
          jump({ translate: "0 0", filter: "none", offset: 0.8 }),
        ],
        { duration: 1600, delay: Math.random() * 1600, iterations: Infinity },
      );
    }
    for (const board of this.all(".board-container")) {
      this.play(
        board,
        [
          jump({
            translate: "0 0",
            clipPath: "none",
            filter: "none",
            offset: 0,
          }),
          jump({
            translate: "6px 0",
            filter: "hue-rotate(60deg) saturate(2)",
            offset: 0.57,
          }),
          jump({ translate: "0 0", filter: "none", offset: 0.59 }),
          jump({
            translate: "-12px 0",
            clipPath: "inset(0 0 58% 0)",
            filter: "hue-rotate(160deg) saturate(3)",
            offset: 0.84,
          }),
          jump({
            translate: "10px 3px",
            clipPath: "inset(42% 0 0 0)",
            filter: "invert(1) hue-rotate(90deg)",
            offset: 0.87,
          }),
          jump({
            translate: "0 0",
            clipPath: "none",
            filter: "none",
            offset: 0.93,
          }),
        ],
        { duration: 1300, iterations: Infinity },
      );
    }
  }

  /**
   * The site comes apart: squares are knocked loose and some fall out,
   * pieces thrash and smear, the board tears and doubles, and the panel
   * beside it loses its styling and slumps
   */
  break() {
    this.stop();
    if (stillScreen()) return;
    for (const sq of this.all(".board .square, .hex-cell")) {
      const [a, b] = [pick(NEON), pick(NEON)];
      this.play(
        sq,
        [
          jump({ boxShadow: "none", offset: 0 }),
          jump({ boxShadow: `inset 0 0 0 999px ${a}`, offset: 0.5 }),
          jump({ boxShadow: "none", offset: 0.62 }),
          jump({ boxShadow: `inset 0 0 0 999px ${b}`, offset: 0.8 }),
          jump({ boxShadow: "none", offset: 0.9 }),
        ],
        { duration: 550, delay: Math.random() * 500, iterations: Infinity },
      );
      // Knocked loose, and left lying where it ends up
      this.play(
        sq,
        [
          { translate: "0 0", rotate: "0deg" },
          {
            translate: `${spread(12).toFixed(0)}px ${(spread(10) + 5).toFixed(0)}px`,
            rotate: `${spread(13).toFixed(0)}deg`,
          },
        ],
        {
          duration: 300,
          delay: Math.random() * 1800,
          fill: "forwards",
          easing: "steps(3)",
        },
      );
      if (Math.random() < 0.14) {
        this.play(sq, [{ opacity: 1 }, { opacity: 0 }], {
          duration: 200,
          delay: 400 + Math.random() * 2200,
          fill: "forwards",
          easing: "steps(2)",
        });
      }
    }
    for (const piece of this.all(".board .piece-img, .hex-board img")) {
      this.play(
        piece,
        [
          jump({
            translate: "0 0",
            scale: "1",
            rotate: "0deg",
            filter: "none",
            opacity: 1,
            offset: 0,
          }),
          jump({
            translate: "-8px 3px",
            scale: "1.25 0.7",
            filter:
              "drop-shadow(5px 0 0 #ff2e88) drop-shadow(-5px 0 0 #21e6ff)",
            offset: 0.2,
          }),
          jump({
            translate: "7px -7px",
            rotate: "14deg",
            filter: "invert(1) hue-rotate(120deg)",
            offset: 0.4,
          }),
          jump({
            translate: "-4px 9px",
            scale: "0.7 1.35",
            filter: "brightness(3) saturate(0)",
            offset: 0.6,
          }),
          jump({
            translate: "11px 0",
            rotate: "-16deg",
            filter: "hue-rotate(200deg) saturate(4)",
            opacity: 0.35,
            offset: 0.8,
          }),
        ],
        { duration: 360, delay: Math.random() * 360, iterations: Infinity },
      );
    }
    for (const board of this.all(".board-container")) {
      this.play(
        board,
        [
          jump({
            translate: "0 0",
            filter: "none",
            clipPath: "none",
            offset: 0,
          }),
          jump({
            translate: "-6px 2px",
            filter: "hue-rotate(160deg) saturate(3)",
            clipPath: "inset(0 0 64% 0)",
            offset: 0.12,
          }),
          jump({
            translate: "5px -3px",
            filter: "invert(1) hue-rotate(90deg)",
            clipPath: "none",
            offset: 0.25,
          }),
          jump({
            translate: "-2px 4px",
            filter: "none",
            clipPath: "inset(30% 0 22% 0)",
            offset: 0.4,
          }),
          jump({
            translate: "7px 0",
            filter: "hue-rotate(-90deg) saturate(2)",
            clipPath: "inset(0 0 0 18%)",
            offset: 0.55,
          }),
          jump({
            translate: "0 0",
            filter: "none",
            clipPath: "none",
            offset: 0.62,
          }),
          jump({
            translate: "-8px -2px",
            filter: "invert(1)",
            clipPath: "inset(55% 0 0 0)",
            offset: 0.78,
          }),
          jump({
            translate: "3px 1px",
            filter: "none",
            clipPath: "inset(10% 0 70% 0)",
            offset: 0.88,
          }),
        ],
        { duration: 900, iterations: Infinity },
      );
    }
    for (const shell of this.all(".board-shell, .hex-board")) {
      this.hold(
        shell,
        "filter",
        "drop-shadow(6px 0 0 rgba(255, 0, 90, 0.7)) drop-shadow(-6px 0 0 rgba(0, 220, 255, 0.7))",
      );
    }
    // The panel loses its styling: plain fonts, outlines showing, cards slumped
    this.all(".hud-card").forEach((card, i) => {
      this.hold(card, "outline", "2px dashed #ff2e4d");
      this.hold(card, "outline-offset", "2px");
      this.play(
        card,
        [
          { translate: "0 0", rotate: "0deg" },
          {
            translate: `${spread(14).toFixed(0)}px ${8 + i * 6}px`,
            rotate: `${((i % 2 ? 1 : -1) * (2 + Math.random() * 4)).toFixed(1)}deg`,
          },
        ],
        {
          duration: 260,
          delay: 300 + i * 260,
          fill: "forwards",
          easing: "steps(2)",
        },
      );
    });
    for (const el of this.all(
      ".hud-card, .hud-card *, .topbar .logo, .topbar .logo *",
    )) {
      this.hold(el, "font-family", '"Times New Roman", Times, serif');
      this.hold(el, "letter-spacing", "0");
      this.hold(el, "text-transform", "none");
    }
  }

  /** He glows white-hot as he gets ready to let go */
  charge() {
    const head = document.querySelector(".chessbot-dock .chessbot-head");
    if (!head || stillScreen()) return;
    this.play(
      head,
      [
        jump({
          scale: "1.08",
          translate: "2px 0",
          filter:
            "drop-shadow(0 0 10px #ffffff) drop-shadow(0 0 24px #7dffab) drop-shadow(0 0 48px #21e6ff)",
          offset: 0,
        }),
        jump({ scale: "1.18", translate: "-2px -1px", offset: 0.5 }),
      ],
      { duration: 120, iterations: Infinity },
    );
  }

  /** Every glitch stopped */
  stop() {
    for (const animation of this.running) animation.cancel();
    this.running = [];
  }

  /** Every glitch stopped and every style put back */
  clear() {
    this.stop();
    for (const restore of this.restores.reverse()) restore();
    this.restores = [];
  }
}

/**
 * Between two modes of the adventure, Chessbot hacks the site from his spot
 * beside the board: the board flashes and glitches, then the site breaks
 * apart and its errors pile up, until he lets go a shockwave of glitch that
 * turns everything into the next mode
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
    // Each cascade of errors trails off down across the board, clear of him
    const errors = ERRORS.flatMap((error, n) => {
      const x0 = board.left + (n === 0 ? 10 : (board.right - board.left) * 0.3);
      const y0 = board.top + (n === 0 ? 20 : (board.bottom - board.top) * 0.28);
      return Array.from({ length: CASCADE }, (_, k) => ({
        ...error,
        key: `${n}-${k}`,
        left: x0 + k * (n === 0 ? 22 : 17),
        top: y0 + k * (n === 0 ? 17 : 22),
        late: ERRORS_MS[n] + k * ERROR_EVERY_MS,
      })).filter(
        (e) =>
          !overlaps(
            {
              left: e.left,
              top: e.top,
              right: e.left + ERROR_W,
              bottom: e.top + ERROR_H,
            },
            near,
          ),
      );
    });
    return { bot, terminal, termWidth, windows, w, h, errors };
  });

  const [now, setNow] = useState(0);
  const [wreckage] = useState(() => new Wreckage());

  useEffect(() => {
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(t) {
      setNow(t - start);
      if (t - start < CHARGE_MS) frame = requestAnimationFrame(tick);
    });
    const at = (ms: number, fn: () => void) => window.setTimeout(fn, ms);
    wreckage.lift();
    const timers = [
      at(0, () => sfx.glitch()),
      at(TERMINAL_MS, () => sfx.zap()),
      at(GLITCH_MS, () => {
        sfx.glitch();
        wreckage.glitch();
      }),
      at(FRENZY_MS, () => {
        sfx.rumble(1);
        wreckage.break();
      }),
      ...ERRORS_MS.map((ms) => at(ms, () => sfx.glitch())),
      at(CHARGE_MS, () => {
        sfx.zap();
        wreckage.charge();
      }),
      at(WAVE_MS, () => {
        sfx.boom();
        shake(20);
      }),
    ];
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((t) => window.clearTimeout(t));
      wreckage.clear();
    };
  }, [wreckage]);

  // The moment the next mode is in, every trace of the hack comes off the page
  useEffect(() => {
    if (!switched) return;
    wreckage.clear();
    sfx.glitch();
  }, [switched, wreckage]);

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
  const { bot } = scene;

  return (
    <div className="mode-swap" aria-hidden>
      {!switched && (
        <>
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

          {scene.errors.map((e) => (
            <section
              key={e.key}
              className="mode-swap-error"
              style={{
                left: e.left,
                top: e.top,
                width: ERROR_W,
                height: ERROR_H,
                animationDelay: `${e.late}ms`,
              }}
            >
              <header>
                <span>{e.title}</span>
                <i>×</i>
              </header>
              <p>
                <b>!</b>
                {e.text}
              </p>
              <footer>
                <span>OK</span>
              </footer>
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
        </>
      )}
      <Shockwave bot={bot} to={to} />
    </div>
  );
}

/**
 * The shockwave of glitch, drawn on one canvas: a ragged front of broken
 * blocks blasting out from him, the next mode's colours behind it, and once
 * that mode is in place the blocks glitching away off it
 */
function Shockwave({ bot, to }: { bot: { x: number; y: number }; to: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    el.width = width;
    el.height = height;

    // The next mode's colours, painted once and cut from block by block
    const world = document.createElement("canvas");
    world.width = width;
    world.height = height;
    const paint = world.getContext("2d")!;
    const sky = THEMES[GAME_MODES[to].theme].sky;
    const gradient = paint.createLinearGradient(0, 0, width, height);
    sky.forEach((color, i) =>
      gradient.addColorStop(i / (sky.length - 1), color),
    );
    paint.fillStyle = gradient;
    paint.fillRect(0, 0, width, height);
    paint.fillStyle = "rgba(0, 0, 0, 0.16)";
    for (let y = 0; y < height; y += 3) paint.fillRect(0, y, width, 1);

    const cols = Math.ceil(width / BLOCK_PX);
    const rows = Math.ceil(height / BLOCK_PX);
    const blocks = Array.from({ length: cols * rows }, (_, i) => {
      const x = (i % cols) * BLOCK_PX;
      const y = Math.floor(i / cols) * BLOCK_PX;
      return {
        x,
        y,
        reachedAt:
          Math.hypot(x + BLOCK_PX / 2 - bot.x, y + BLOCK_PX / 2 - bot.y) +
          Math.random() * WAVE_RAGGEDNESS,
        gone: MODE_SWAP_MS + Math.random() * (MODE_SWAP_CLEAR_MS - 250),
        color: pick(NEON),
      };
    });
    const reach = Math.max(...blocks.map((b) => b.reachedAt)) + WAVE_FRONT_PX;

    const settled = (x: number, y: number) =>
      ctx.drawImage(world, x, y, BLOCK_PX, BLOCK_PX, x, y, BLOCK_PX, BLOCK_PX);
    const glitchBlock = (x: number, y: number, color: string) => {
      const dx = spread(10);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = Math.random() < 0.5 ? color : "#05090a";
      ctx.fillRect(x + dx, y, BLOCK_PX, BLOCK_PX);
      ctx.globalAlpha = 1;
      // A sliver of the new world, torn and shifted
      if (Math.random() < 0.5) {
        const band = 4 + Math.random() * 14;
        const by = y + Math.random() * (BLOCK_PX - band);
        ctx.drawImage(
          world,
          x,
          by,
          BLOCK_PX,
          band,
          x + spread(18),
          by,
          BLOCK_PX,
          band,
        );
      }
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      for (let k = 0; k < 3; k++) {
        ctx.fillRect(x + dx, y + Math.random() * BLOCK_PX, BLOCK_PX, 1);
      }
    };

    const start = performance.now();
    let frame = 0;
    const draw = (t: number) => {
      frame = requestAnimationFrame(draw);
      const ms = t - start;
      if (ms < WAVE_MS) return;
      ctx.clearRect(0, 0, width, height);
      if (ms > MODE_SWAP_MS + MODE_SWAP_CLEAR_MS) return;
      const radius =
        Math.min(1, (ms - WAVE_MS) / WAVE_SPREAD_MS) ** 1.4 * reach;
      for (const b of blocks) {
        if (ms >= MODE_SWAP_MS) {
          // Gone, or glitching as it goes
          if (ms > b.gone) continue;
          if (ms > b.gone - 120) glitchBlock(b.x, b.y, b.color);
          else settled(b.x, b.y);
          continue;
        }
        const ahead = radius - b.reachedAt;
        if (ahead > WAVE_FRONT_PX) settled(b.x, b.y);
        else if (ahead > -WAVE_AHEAD_PX) glitchBlock(b.x, b.y, b.color);
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [bot, to]);
  return <canvas ref={canvas} className="mode-swap-shockwave" />;
}
