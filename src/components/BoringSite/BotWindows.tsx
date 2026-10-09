import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { CURSE_PEEK_MS, useGameStore } from "../../stores/gameStore";
import {
  ASIDE_LEAD_MS,
  LAST_WORD_MS,
  SPEECH_LEAD_MS,
  introDelays,
  introMood,
  introScript,
} from "../Chessbot/intro";
import { BEATEN } from "../Chessbot/intro";
import type { IntroExhibit, IntroLine } from "../Chessbot/intro";
import "./BotWindows.css";

/** One of the windows he throws open over the plain site, placed by how far across and down the page it sits */
function BotWindow({
  title,
  at: [x, y, tilt = 0],
  kind,
  leaving = false,
  children,
}: {
  title: string;
  at: [x: number, y: number, tilt?: number];
  kind: string;
  /** Glitching shut, on its way out */
  leaving?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`bot-window is-${kind}${leaving ? " is-leaving" : ""}`}
      style={{ "--x": x, "--y": y, "--tilt": `${tilt}deg` } as CSSProperties}
    >
      <header className="bot-window-bar">
        <span>{title}</span>
        <i />
        <i />
        <i />
      </header>
      <div className="bot-window-body">{children}</div>
    </section>
  );
}

/**
 * Where the window for each line of his speech opens, and how it leans.
 * None of them sits over his card, so his face can be seen as he talks.
 */
const TERMINAL_SPOTS: [number, number, number][] = [
  [0.07, 0.15, -1.5],
  [0.38, 0.3, 1.2],
  [0.12, 0.52, -0.8],
  [0.34, 0.12, 1.5],
  [0.2, 0.42, -2],
  [0.36, 0.3, 0],
  [0.1, 0.6, 1],
  [0.3, 0.74, -1.5],
  [0.34, 0.34, 0],
];
/** A number between 0 and 1 that is always the same for the same two numbers */
function scatter(n: number, salt: number): number {
  const x = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** How many games he has sat through, by his own count */
const GAMES_PLAYED = 4_186_331_207;
/** How many recordings he throws open, and how fast */
const RECORDINGS = 18;
const RECORDING_EVERY_MS = 85;
const RESULTS = ["1-0", "0-1", "½-½"];
const MEN = "♚♛♜♝♞♟";

/** A recording of one of his games, played back far too fast to follow */
function Recording({ n }: { n: number }) {
  return (
    <BotWindow
      kind="recording"
      title={`#${(GAMES_PLAYED - RECORDINGS + 1 + n).toLocaleString("en-US")}`}
      at={[scatter(n, 1), scatter(n, 2), scatter(n, 3) * 8 - 4]}
    >
      <div className="replay-board">
        {Array.from({ length: 8 }, (_, k) => (
          <span
            key={k}
            className={`replay-man replay-${(n + k) % 4}${k % 2 ? " is-black" : ""}`}
            style={{
              left: `${(2 + Math.floor(scatter(n * 8 + k, 4) * 4)) * 12.5}%`,
              top: `${(2 + Math.floor(scatter(n * 8 + k, 5) * 4)) * 12.5}%`,
              animationDuration: `${0.5 + scatter(n * 8 + k, 6) * 0.5}s`,
              animationDelay: `${-scatter(n * 8 + k, 7)}s`,
            }}
          >
            {MEN[Math.floor(scatter(n * 8 + k, 8) * MEN.length)]}
          </span>
        ))}
      </div>
      <span className="replay-result">{RESULTS[n % RESULTS.length]}</span>
    </BotWindow>
  );
}

/** Every game he has ever played, opening one on top of another */
function Recordings() {
  const [open, setOpen] = useState(1);
  useEffect(() => {
    if (open >= RECORDINGS) return;
    const timer = window.setTimeout(
      () => setOpen((n) => n + 1),
      RECORDING_EVERY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open]);
  return Array.from({ length: open }, (_, n) => <Recording key={n} n={n} />);
}

/** His record against every other engine, a row for each he has named so far */
function Wins({ named }: { named: number }) {
  return (
    <BotWindow kind="wins" title="record.txt" at={[0.74, 0.52, 1.5]}>
      <pre>
        {BEATEN.slice(0, named)
          .map((engine) => `chessbot v ${engine.padEnd(10)} 1000 - 0`)
          .join("\n")}
      </pre>
    </BotWindow>
  );
}

/** The humans he was made to play today, ending with you */
function humansToday(opening: string): string[] {
  return [
    "09:00 guest_2291 (412)  hung queen, move 4",
    "09:01 guest_7730 (388)  resigned, move 6",
    "09:01 guest_0412 (655)  asked for a takeback",
    "09:02 guest_1088 (290)  moved the king first",
    "09:03 guest_5521 (901)  ran out of time",
    "09:04 guest_3310 (544)  hung queen, move 3",
    `09:05 ${"guest (1200)".padEnd(16)}  played ${opening}. again.`,
  ];
}
const HUMAN_EVERY_MS = 260;

function Humans({ opening }: { opening: string }) {
  const log = useMemo(() => humansToday(opening), [opening]);
  const [listed, setListed] = useState(1);
  useEffect(() => {
    if (listed >= log.length) return;
    const timer = window.setTimeout(
      () => setListed((n) => n + 1),
      HUMAN_EVERY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [listed, log]);
  return (
    <BotWindow kind="humans" title="opponents_today.log" at={[0.8, 0.5, -1.2]}>
      <pre>{log.slice(0, listed).join("\n")}</pre>
    </BotWindow>
  );
}

/** What he has been writing in secret */
const SOURCE = `// cursed_chess.ts
import { rules } from "./chess";

delete rules.fairness;
delete rules.dignity;

const modes: Curse[] = [];
modes.push(portals());
modes.push(fogOfWar());
modes.push(fifa()); // why not
modes.push(tugOfWar());
modes.push(minefield());
modes.push(zombies());

board.rotate(45);
king.canWalkOff = true;
pawn.explodes = Math.random() < 0.3;

while (human.isPlaying) {
  human.patience -= 10;
  rules.change();
}

function mercy() {
  return null;
}

export default cursedChess;`.split("\n");
const SOURCE_LINE_MS = 75;
/** How many lines of it fit in the window at once */
const SOURCE_SHOWN = 10;

/** His new game, writing itself a line at a time and scrolling as it goes */
function Source({ leaving }: { leaving: boolean }) {
  const [written, setWritten] = useState(1);
  useEffect(() => {
    if (written >= SOURCE.length) return;
    const timer = window.setTimeout(
      () => setWritten((n) => n + 1),
      SOURCE_LINE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [written]);
  const from = Math.max(0, written - SOURCE_SHOWN);
  return (
    <BotWindow
      kind="source"
      title="cursed_chess.ts"
      at={[0.97, 0.45, 1.5]}
      leaving={leaving}
    >
      <pre>
        {SOURCE.slice(from, written).map((line, i) => (
          <span key={from + i} className="bot-source-line">
            <b>{String(from + i + 1).padStart(2, " ")}</b> {line}
            {"\n"}
          </span>
        ))}
        <span className="boring-caret" aria-hidden />
      </pre>
    </BotWindow>
  );
}

/** What his new game does as it starts up, and how far along it does each */
const BOOT_STEPS: [percent: number, line: string][] = [
  [0, "> ./cursed_chess --launch"],
  [8, "unloading rules.dll ...... ok"],
  [24, "loading portals.dll ...... ok"],
  [40, "loading fog.dll .......... ok"],
  [56, "loading zombies.dll ...... ok"],
  [72, "loading 9 more ........... ok"],
  [88, "removing fairness ........ ok"],
  [100, "ready."],
];
const BAR_CELLS = 22;

/** His new game starting up, timed to be ready the moment the site breaks */
function Boot({ ms }: { ms: number }) {
  const [percent, setPercent] = useState(0);
  useEffect(() => {
    const began = performance.now();
    const timer = window.setInterval(() => {
      const done = Math.min(1, (performance.now() - began) / ms);
      setPercent(Math.floor(done * 100));
      if (done === 1) window.clearInterval(timer);
    }, 60);
    return () => window.clearInterval(timer);
  }, [ms]);
  const filled = Math.round((percent / 100) * BAR_CELLS);
  return (
    <BotWindow kind="boot" title="cursed_chess.exe" at={[0.5, 0.66, -1]}>
      <pre>
        {BOOT_STEPS.filter(([at]) => percent >= at)
          .map(([, line]) => line)
          .join("\n")}
        {"\n\n"}[{"#".repeat(filled)}
        {".".repeat(BAR_CELLS - filled)}] {percent}%
      </pre>
    </BotWindow>
  );
}

/**
 * His speech, once he is out of his icon: each line types itself into a
 * terminal window of its own, thrown open somewhere over the page, and
 * some lines bring an exhibit with them. Every line he begins corrupts
 * the plain site a step further.
 */
function Speech({
  opening,
  leaving,
}: {
  opening: string;
  /** He is done talking, and his windows glitch shut */
  leaving: boolean;
}) {
  const lines = useMemo(() => introScript(opening).slice(1), [opening]);
  const { typed, delays } = useTyped(lines, SPEECH_LEAD_MS);

  const starts = lines.map((_, i) =>
    lines.slice(0, i).reduce((n, line) => n + line.text.length, 0),
  );
  // The last line he has begun
  const current = Math.max(
    0,
    starts.filter((start) => typed > start).length - 1,
  );
  const mood = introMood(lines[current], typed - starts[current]);
  const corruption = typed > 0 ? current + 1 : 0;
  useEffect(() => {
    useGameStore.setState({ introMood: mood, corruption });
  }, [mood, corruption]);

  /** The line he opens this exhibit on */
  const lineOf = (exhibit: IntroExhibit) =>
    lines.findIndex((line) => line.show?.[1] === exhibit);
  /** The letter at which he opens this exhibit */
  const opensAt = (exhibit: IntroExhibit): number => {
    const at = lineOf(exhibit);
    return starts[at] + lines[at].text.indexOf(lines[at].show![0]);
  };
  const shown = (exhibit: IntroExhibit) => typed > opensAt(exhibit);
  /** Whether this exhibit is open: from its word until he is a line past it */
  const showing = (exhibit: IntroExhibit, lingers = 1) =>
    !leaving && shown(exhibit) && current <= lineOf(exhibit) + lingers;
  const winsLine = lines[lineOf("wins")];
  const typedOfWins = typed - starts[lineOf("wins")];
  const named = BEATEN.filter(
    (engine) => typedOfWins >= winsLine.text.indexOf(engine) + engine.length,
  ).length;
  const bootMs =
    delays.slice(opensAt("boot") + 1).reduce((a, b) => a + b, 0) +
    LAST_WORD_MS +
    CURSE_PEEK_MS;

  return (
    <div className="bot-windows" aria-live="polite">
      <div
        className={`bot-corruption${lines[current].tone ? " is-angry" : ""}`}
        style={{ "--level": corruption } as CSSProperties}
        aria-hidden
      />
      {showing("games") && <Recordings />}
      {showing("wins") && <Wins named={named} />}
      {showing("humans") && <Humans opening={opening} />}
      {shown("code") && <Source leaving={leaving} />}
      {typed > 0 &&
        lines.slice(0, current + 1).map(({ text, tone }, i) => {
          // Each one glitches shut as he starts on the next
          const stale = i < current;
          if (current - i > 1) return null;
          const last = i === lines.length - 1 ? " is-last" : "";
          return (
            <BotWindow
              key={i}
              kind={`terminal${last}${tone ? ` is-${tone}` : ""}`}
              title="chessbot.exe"
              at={TERMINAL_SPOTS[i % TERMINAL_SPOTS.length]}
              leaving={leaving || stale}
            >
              <p className="boring-bot-says">
                <span className="boring-prompt" aria-hidden>
                  {">"}
                </span>
                {text.slice(0, typed - starts[i])}
                {i === current && <span className="boring-caret" aria-hidden />}
              </p>
            </BotWindow>
          );
        })}
      {shown("boot") && <Boot ms={bootMs} />}
    </div>
  );
}

/** How many of these lines' letters are on the page so far, one more after each pause */
function useTyped(lines: IntroLine[], lead: number) {
  const delays = useMemo(() => introDelays(lines, lead), [lines, lead]);
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    if (typed >= delays.length) return;
    const timer = window.setTimeout(
      () => setTyped((n) => n + 1),
      delays[typed],
    );
    return () => window.clearTimeout(timer);
  }, [typed, delays]);
  return { typed, delays };
}

/** Where his remark on your first move opens */
const REMARK_SPOT: [number, number, number] = [0.3, 0.58, -2];

/**
 * His remark on your opening move: the first window he gets open, typed
 * into and then glitched shut before he makes his reply
 */
function Remark({ opening, leaving }: { opening: string; leaving: boolean }) {
  const lines = useMemo(() => introScript(opening).slice(0, 1), [opening]);
  const { typed } = useTyped(lines, ASIDE_LEAD_MS);
  const mood = introMood(lines[0], typed);
  useEffect(() => {
    useGameStore.setState({ introMood: mood });
  }, [mood]);
  return (
    <div className="bot-windows" aria-live="polite">
      <BotWindow
        kind="terminal"
        title="chessbot.exe"
        at={REMARK_SPOT}
        leaving={leaving}
      >
        <p className="boring-bot-says">
          <span className="boring-prompt" aria-hidden>
            {">"}
          </span>
          {lines[0].text.slice(0, typed)}
          <span className="boring-caret" aria-hidden />
        </p>
      </BotWindow>
    </div>
  );
}

/** Everything Chessbot opens over the plain site between your first move and his breaking it */
export function BotWindows() {
  const stage = useGameStore((s) => s.curseStage);
  const aside = useGameStore((s) => s.aside);
  const opening = useGameStore((s) => s.moveHistory[0]?.san ?? "e4");
  if (stage === "hello" || stage === "peek") {
    return <Speech opening={opening} leaving={stage === "peek"} />;
  }
  if (stage === null && (aside === "typing" || aside === "leaving")) {
    return <Remark opening={opening} leaving={aside === "leaving"} />;
  }
  return null;
}
