import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Color } from "../../engine";
import type { FootballView, Kick, Spot } from "../../plugins/football";
import { visualCol, visualRow } from "./boardGeometry";
import { kickFlightMs as flightMs } from "./useBoardEffects";
import type { PlayCall } from "./useBoardEffects";
import { Confetti } from "../Show/Confetti";
import { sfx } from "../../audio/sfx";
import "./Football.css";

/** The kickoff whistle blows as the mode's title card clears */
const KICKOFF_WHISTLE_MS = 4300;
/** Callouts stay up this long after the ball lands */
const AFTERMATH_MS = 1600;

type Style = React.CSSProperties & Record<`--${string}`, string | number>;
type Point = { x: number; y: number };

/** A spot in square units across the screen, measured to its center */
function onScreen(spot: Spot, flipped: boolean): Point {
  return {
    x: (flipped ? 7 - spot.file : spot.file) + 0.5,
    y: (flipped ? spot.rank : 7 - spot.rank) + 0.5,
  };
}

function legLengths(points: Point[]): number[] {
  return points
    .slice(1)
    .map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
}

const pct = (squares: number) => `${squares * 12.5}%`;

/** How far apart the ball's black panels sit across its skin, and from row to row */
const PANEL_GAP = 46;
const PANEL_ROW = 40;
/** The panels of the ball's skin, laid out well past its edges so the skin can roll */
const PANELS = [-2, -1, 0, 1, 2].flatMap((row) =>
  [-3, -2, -1, 0, 1, 2, 3].map((col) => ({
    x: col * PANEL_GAP + (row % 2 ? PANEL_GAP / 2 : 0),
    y: row * PANEL_ROW,
  })),
);

/**
 * A classic black and white panelled ball. Its skin is wider than the ball
 * and slides across it as it rolls, so new panels keep coming round.
 */
export function SoccerBall({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="-50 -50 100 100" aria-hidden>
      <defs>
        <radialGradient id="ball-shade" cx="0.36" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.65" stopColor="#e9edf2" />
          <stop offset="1" stopColor="#9aa3ad" />
        </radialGradient>
        {/* Darkens toward the rim, so the flat skin reads as a round ball */}
        <radialGradient id="ball-round" cx="0.4" cy="0.36" r="0.72">
          <stop offset="0.55" stopColor="#0b0e12" stopOpacity="0" />
          <stop offset="1" stopColor="#0b0e12" stopOpacity="0.5" />
        </radialGradient>
        <clipPath id="ball-clip">
          <circle r="46" />
        </clipPath>
      </defs>
      <circle r="47" fill="url(#ball-shade)" stroke="#1a1d22" strokeWidth="3" />
      <g clipPath="url(#ball-clip)">
        <g className="ball-skin" fill="#1a1d22" stroke="#1a1d22">
          {PANELS.map(({ x, y }) => (
            <g key={`${x},${y}`} transform={`translate(${x} ${y})`}>
              {/* The seams running to the panels beside and below */}
              <path
                d={`M0 0 H${PANEL_GAP} M0 0 L${PANEL_GAP / 2} ${PANEL_ROW} M0 0 L${-PANEL_GAP / 2} ${PANEL_ROW}`}
                strokeWidth="2.2"
                fill="none"
              />
              <path
                d="M0 -13 L12.4 -4 L7.6 10.5 L-7.6 10.5 L-12.4 -4 Z"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </g>
        <circle r="47" fill="url(#ball-round)" />
      </g>
      <ellipse
        cx="-16"
        cy="-20"
        rx="12"
        ry="7"
        fill="#fff"
        opacity="0.7"
        transform="rotate(-30 -16 -20)"
      />
    </svg>
  );
}

/** Mowed stripes and the white lines of a football pitch, drawn over the squares */
export function Pitch() {
  useEffect(() => {
    const whistle = setTimeout(() => sfx.whistle(false), KICKOFF_WHISTLE_MS);
    return () => clearTimeout(whistle);
  }, []);

  const half = (flip: boolean) => (
    <g transform={flip ? "translate(0 800) scale(1 -1)" : undefined}>
      <rect x="100" y="0" width="600" height="200" />
      <rect x="200" y="0" width="400" height="100" />
      <circle cx="400" cy="140" r="5" className="pitch-spot" />
      <path d="M330 200 A90 90 0 0 0 470 200" />
      <path d="M0 25 A25 25 0 0 0 25 0" />
      <path d="M775 0 A25 25 0 0 0 800 25" />
    </g>
  );
  return (
    <svg
      className="pitch"
      viewBox="0 0 800 800"
      preserveAspectRatio="none"
      aria-hidden
    >
      <g className="pitch-stripes">
        {[0, 2, 4, 6].map((row) => (
          <rect key={row} x="0" y={row * 100} width="800" height="100" />
        ))}
      </g>
      <g className="pitch-lines">
        <rect x="3" y="3" width="794" height="794" />
        <path d="M0 400 H800" />
        <circle cx="400" cy="400" r="90" />
        <circle cx="400" cy="400" r="6" className="pitch-spot" />
        {half(false)}
        {half(true)}
      </g>
    </svg>
  );
}

/** The net's outline and back bar, pushed out at `x` by `stretch` */
const netOutline = (x: number, stretch: number) =>
  `M0 56 L16 6 Q${x} ${6 - stretch} 384 6 L400 56 Z`;
const netBackBar = (x: number, stretch: number) =>
  `M16 6 Q${x} ${6 - stretch} 384 6`;
/** How far the net balloons and springs back as the ball hits it */
const NET_STRETCH = [0, 70, 34, 48, 44];

/** One goal: posts, crossbar, and a net that stretches around the ball when it goes in */
export function Goal({
  atTop,
  flipped,
  defender,
  attacked,
  shotChance,
  shotExitFile,
  noShotReason,
  scoredKick,
  postKick,
  onShoot,
}: {
  atTop: boolean;
  flipped: boolean;
  defender: Color;
  /** The goal you shoot at */
  attacked: boolean;
  shotChance: number | null;
  /** Where along the goal line that shot would cross it */
  shotExitFile: number | null;
  noShotReason: string;
  scoredKick: Kick | null;
  /** A shot that just struck this goal's woodwork */
  postKick: Kick | null;
  onShoot: () => void;
}) {
  const [nudge, setNudge] = useState(0);
  const goalRef = useRef<HTMLDivElement>(null);

  // The frame shudders when the ball cracks against a post
  useEffect(() => {
    if (!postKick) return;
    const hit = setTimeout(() => {
      goalRef.current?.animate(
        [
          { translate: "0 0" },
          { translate: "3px -2px" },
          { translate: "-3px 1px" },
          { translate: "2px 0" },
          { translate: "-1px 0" },
          { translate: "0 0" },
        ],
        { duration: 420, easing: "ease-out" },
      );
    }, timeToPost(postKick));
    return () => clearTimeout(hit);
  }, [postKick]);
  const netRef = useRef<SVGAnimateElement>(null);
  const barRef = useRef<SVGAnimateElement>(null);
  const shootable = shotChance !== null;
  const onClick = () => {
    if (shootable) onShoot();
    else setNudge((n) => n + 1);
  };

  // Where across the mouth the ball goes in, in the goal's 0 to 400 units
  const entry = scoredKick?.waypoints[scoredKick.waypoints.length - 1];
  const entryCol = entry ? (flipped ? 7 - entry.file : entry.file) : 3.5;
  const ballX = Math.min(380, Math.max(20, ((entryCol + 0.5 - 2) / 4) * 400));
  const arrival = scoredKick ? flightMs(scoredKick) : 0;

  useEffect(() => {
    if (!scoredKick) return;
    const hit = setTimeout(() => {
      netRef.current?.beginElement();
      barRef.current?.beginElement();
    }, arrival + 120);
    return () => clearTimeout(hit);
  }, [scoredKick, arrival]);

  const flip = atTop ? undefined : "translate(0 62) scale(1 -1)";
  const stretchValues = (shape: (x: number, s: number) => string) =>
    NET_STRETCH.map((st) => shape(ballX, st)).join(";");
  return (
    <div
      ref={goalRef}
      className={`goal ${atTop ? "goal-top" : "goal-bottom"}${attacked ? " attacked" : ""}${shootable ? " shootable" : ""}`}
      data-goal={defender}
      onClick={attacked ? onClick : undefined}
      role={attacked ? "button" : undefined}
      aria-label={
        shootable
          ? `Shoot, ${Math.round(shotChance * 100)} percent chance`
          : attacked
            ? noShotReason
            : undefined
      }
    >
      <svg viewBox="0 0 400 62" preserveAspectRatio="none" aria-hidden>
        <g transform={flip}>
          <polygon points="-6,58 406,58 384,8 16,8" className="goal-turf" />
        </g>
      </svg>
      {scoredKick && (
        <span
          key={scoredKick.id}
          className="goal-ball"
          style={
            {
              left: `${(ballX / 400) * 100}%`,
              "--dir": atTop ? 1 : -1,
              animationDelay: `${arrival}ms`,
            } as React.CSSProperties
          }
        >
          <SoccerBall className="ball-svg" />
        </span>
      )}
      <svg viewBox="0 0 400 62" preserveAspectRatio="none" aria-hidden>
        <defs>
          <pattern
            id={`net-${defender}`}
            width="14"
            height="12"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 6 L7 0 L14 6 L7 12 Z"
              fill="none"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="1.4"
            />
          </pattern>
        </defs>
        <g transform={flip}>
          <g key={scoredKick?.id ?? 0}>
            <path d={netOutline(ballX, 0)} fill={`url(#net-${defender})`}>
              <animate
                ref={netRef}
                attributeName="d"
                values={stretchValues(netOutline)}
                keyTimes="0;0.3;0.6;0.8;1"
                dur="0.9s"
                begin="indefinite"
                fill="freeze"
              />
            </path>
            <path d={netBackBar(ballX, 0)} className="goal-backbar">
              <animate
                ref={barRef}
                attributeName="d"
                values={stretchValues(netBackBar)}
                keyTimes="0;0.3;0.6;0.8;1"
                dur="0.9s"
                begin="indefinite"
                fill="freeze"
              />
            </path>
            <path d="M0 56 L16 6 M400 56 L384 6" className="goal-sidebar" />
          </g>
          <path d="M0 56 H400" className="goal-crossbar" />
          <circle cx="0" cy="56" r="7" className="goal-post" />
          <circle cx="400" cy="56" r="7" className="goal-post" />
        </g>
      </svg>
      {shootable && (
        <>
          {/* Marked the way a pass is: a dashed outline round the mouth, and a turning ring to aim at */}
          <span className="shot-frame" aria-hidden />
          <span
            className="shot-ring"
            style={{
              left: `${(((flipped ? 7 - (shotExitFile ?? 3.5) : (shotExitFile ?? 3.5)) + 0.5 - 2) / 4) * 100}%`,
            }}
            aria-hidden
          />
          <span className="shoot-label">
            Shoot <b>{Math.round(shotChance * 100)}%</b>
          </span>
        </>
      )}
      {!shootable && nudge > 0 && (
        <span key={nudge} className="shoot-label no-shot">
          {noShotReason}
        </span>
      )}
    </div>
  );
}

const CALLOUT: Record<Kick["outcome"], string | null> = {
  received: null,
  intercepted: "Intercepted!",
  saved: "Saved!",
  wide: "Wide!",
  post: "Off the post!",
  goal: null,
};

/** Keyframes for the ball's path along the grass and its height above it */
function flightKeyframes(kick: Kick, points: Point[], squareSize: number) {
  const start = points[0];
  const legs = legLengths(points);
  const total = legs.reduce((a, b) => a + b, 0) || 1;
  let travelled = 0;
  const ground: Keyframe[] = [{ translate: "0 0", offset: 0 }];
  const air: Keyframe[] = [{ translate: "0 0", offset: 0 }];
  legs.forEach((length, i) => {
    const from = travelled / total;
    travelled += length;
    const to = travelled / total;
    const p = points[i + 1];
    const loft = kick.kind === "pass" && i === 0 ? 0.32 : 0.1;
    const lift = squareSize * Math.min(1.1, loft * length);
    air.push({ translate: `0 ${-lift}px`, offset: (from + to) / 2 });
    air.push({ translate: "0 0", offset: to });
    ground.push({
      translate: `${(p.x - start.x) * squareSize}px ${(p.y - start.y) * squareSize}px`,
      offset: to,
    });
  });
  return { ground, air };
}

/** The ball flying along a kick's path, with its shadow on the grass */
function BallFlight({
  kick,
  landed,
  flipped,
  squareSize,
}: {
  kick: Kick;
  landed: boolean;
  flipped: boolean;
  squareSize: number;
}) {
  const groundRef = useRef<HTMLDivElement>(null);
  const airRef = useRef<HTMLDivElement>(null);
  const points = kick.waypoints.map((w) => onScreen(w, flipped));
  const start = points[0];
  const end = points[points.length - 1];
  const duration = flightMs(kick);
  const frames = JSON.stringify(flightKeyframes(kick, points, squareSize));

  useLayoutEffect(() => {
    const { ground, air } = JSON.parse(frames) as {
      ground: Keyframe[];
      air: Keyframe[];
    };
    const timing = { duration, easing: "linear", fill: "forwards" as const };
    const animations = [
      groundRef.current?.animate(ground, timing),
      airRef.current?.animate(air, timing),
    ];
    return () => animations.forEach((a) => a?.cancel());
  }, [frames, duration]);

  const callout = CALLOUT[kick.outcome];
  return (
    <>
      <div
        ref={groundRef}
        className="ball-flight"
        hidden={landed}
        style={{ left: pct(start.x), top: pct(start.y) }}
      >
        <span className="ball-shadow" />
        <div ref={airRef} className="ball-air">
          <SoccerBall
            className={`ball-svg spinning${kick.kind === "shot" ? " fast" : ""}`}
          />
        </div>
      </div>
      {kick.outcome === "received" && (
        <span
          className="ball-trap"
          style={{
            left: pct(end.x),
            top: pct(end.y),
            animationDelay: `${duration - 60}ms`,
          }}
        />
      )}
      {callout && (
        <span
          className={`kick-callout callout-${kick.outcome}`}
          style={
            {
              left: pct(Math.min(7.2, Math.max(0.8, end.x))),
              top: pct(Math.min(7.4, Math.max(0.4, end.y))),
              animationDelay: `${duration}ms`,
              "--tilt": `${kick.id % 2 ? 6 : -6}deg`,
            } as Style
          }
        >
          {callout}
        </span>
      )}
    </>
  );
}

/** GOAL! across the board, with confetti and a roaring crowd */
function GoalCelebration({
  kick,
  layer,
  squareSize,
}: {
  kick: Kick;
  /** The layer over the board that it is laid out against */
  layer: React.RefObject<HTMLDivElement | null>;
  squareSize: number;
}) {
  const delay = flightMs(kick);
  const ours = kick.color === Color.White;
  // Drawn on the page itself, over the board, so it comes out in front of
  // everything standing around the pitch, the countdown board included
  const [box, setBox] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    const measure = () =>
      setBox(layer.current?.getBoundingClientRect() ?? null);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [layer]);
  const page = document.querySelector(".app");
  if (!box || !page) return null;
  return createPortal(
    <div
      className="goal-over"
      style={
        {
          left: box.left,
          top: box.top,
          width: box.width,
          height: box.height,
          "--sq": `${squareSize}px`,
        } as Style
      }
    >
      <div
        className={`goal-celebration${ours ? "" : " theirs"}`}
        style={{ animationDelay: `${delay}ms` } as Style}
        aria-live="assertive"
      >
        <span
          className="goal-word"
          style={{ "--delay": `${delay}ms` } as Style}
        >
          {"GOOOAAALLL!".split("").map((ch, i) => (
            <span key={i} style={{ "--i": i } as Style}>
              {ch}
            </span>
          ))}
        </span>
        {ours && <Confetti count={120} seed={kick.id + 11} delayMs={delay} />}
      </div>
    </div>,
    page,
  );
}

/** When a shot off the woodwork reaches the post, before it bounces back */
function timeToPost(kick: Kick): number {
  const [from, post, back] = kick.waypoints;
  const toPost = Math.hypot(post.file - from.file, post.rank - from.rank);
  const rebound = Math.hypot(back.file - post.file, back.rank - post.rank);
  return (flightMs(kick) * toPost) / (toPost + rebound);
}

function playKick(kick: Kick): void {
  sfx.kick(kick.kind === "shot");
  const land = flightMs(kick);
  if (kick.outcome === "post") {
    setTimeout(() => {
      sfx.post();
      sfx.crowd("ooh");
    }, timeToPost(kick));
  }
  setTimeout(() => {
    switch (kick.outcome) {
      case "received":
        sfx.thud();
        break;
      case "intercepted":
        sfx.thud();
        sfx.crowd("ooh");
        break;
      case "saved":
        sfx.kick(false);
        sfx.crowd("ooh");
        break;
      case "wide":
        sfx.crowd("ooh");
        break;
      case "post":
        sfx.thud();
        break;
      case "goal":
        sfx.crowd("roar");
        sfx.whistle(true);
        break;
    }
  }, land);
}

/**
 * The ball: at the carrier's feet or loose on the grass, flying when kicked.
 * Kicks made before this mounted are not replayed.
 */
/** How far behind the goal line a shot's line is drawn to, in squares */
const SHOT_LINE_REACH = 0.45;

/** The line a shot would take: dashes running from the carrier into the goal, ending in an arrowhead */
function ShotLine({ from, to }: { from: Point; to: Point }) {
  const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
  // It starts clear of the carrier, so it does not run across the piece
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const clear = Math.min(0.55, length / 2) / length;
  from = {
    x: from.x + (to.x - from.x) * clear,
    y: from.y + (to.y - from.y) * clear,
  };
  return (
    <svg
      className="shot-line"
      viewBox="0 0 8 8"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d={`M${from.x} ${from.y} L${to.x} ${to.y}`}
        className="shot-line-dash"
      />
      <path
        d="M0 0 L-0.3 -0.17 L-0.3 0.17 Z"
        className="shot-line-head"
        transform={`translate(${to.x} ${to.y}) rotate(${angle})`}
      />
    </svg>
  );
}

export function FootballLayer({
  view,
  carried,
  shotExitFile,
  flipped,
  squareSize,
}: {
  view: FootballView;
  carried: boolean;
  /** Where along the goal line your shot would cross it, while your carrier is picked and has one */
  shotExitFile: number | null;
  flipped: boolean;
  squareSize: number;
}) {
  const kick = view.lastKick;
  const [seenId, setSeenId] = useState(kick?.id ?? 0);
  const [recent, setRecent] = useState<Kick | null>(null);
  const [landed, setLanded] = useState(false);
  if (kick && kick.id !== seenId) {
    setSeenId(kick.id);
    setRecent(kick);
    setLanded(false);
  }
  // A new game clears the last kick, so the ball comes back out of the net
  if (!kick && recent) {
    setSeenId(0);
    setRecent(null);
  }

  useEffect(() => {
    if (!recent) return;
    playKick(recent);
    const land = flightMs(recent);
    const timers = [setTimeout(() => setLanded(true), land)];
    // After a goal the ball stays in the net until the next game
    if (recent.outcome !== "goal") {
      timers.push(setTimeout(() => setRecent(null), land + AFTERMATH_MS));
    }
    return () => timers.forEach(clearTimeout);
  }, [recent]);

  const layerRef = useRef<HTMLDivElement>(null);
  const col = visualCol(view.ball, flipped);
  const row = visualRow(view.ball, flipped);
  const restStyle: Style = carried
    ? { left: pct(col + 0.74), top: pct(row + 0.8), "--size": 0.34 }
    : { left: pct(col + 0.5), top: pct(row + 0.56), "--size": 0.44 };
  const ballAway = recent !== null && (!landed || recent.outcome === "goal");

  return (
    <div
      ref={layerRef}
      className="football-layer"
      style={{ "--sq": `${squareSize}px` } as Style}
    >
      {!ballAway && shotExitFile !== null && (
        <ShotLine
          from={{ x: col + 0.5, y: row + 0.5 }}
          to={{
            x: (flipped ? 7 - shotExitFile : shotExitFile) + 0.5,
            y: flipped ? 8 + SHOT_LINE_REACH : -SHOT_LINE_REACH,
          }}
        />
      )}
      {!ballAway && (
        <div
          className={`ball-rest${carried ? " carried" : " loose"}`}
          style={restStyle}
        >
          <span className="ball-shadow" />
          <SoccerBall className="ball-svg" />
        </div>
      )}
      {recent && (
        <BallFlight
          key={`flight-${recent.id}`}
          kick={recent}
          landed={landed}
          flipped={flipped}
          squareSize={squareSize}
        />
      )}
      {recent?.outcome === "goal" && (
        <GoalCelebration
          key={`goal-${recent.id}`}
          kick={recent}
          layer={layerRef}
          squareSize={squareSize}
        />
      )}
    </div>
  );
}

/** The marker on a teammate the selected carrier can pass to */
export function PassMarker({ chance }: { chance: number }) {
  return (
    <>
      <span className="pass-ring" aria-hidden />
      <span className="pass-chance">{Math.round(chance * 100)}%</span>
    </>
  );
}

const LINES: Record<string, string[]> = {
  "goal-ours": [
    "GOAL! No. {n} buries it!",
    "GOAL! What a strike from No. {n}!",
    "Top bins! No. {n} wheels away!",
  ],
  "goal-theirs": [
    "They score. No. {n} punishes the defense.",
    "Goal for the visitors. No. {n} with the finish.",
  ],
  saved: [
    "Saved! What a dive!",
    "Denied! The keeper is having a day.",
    "Blocked! Bodies on the line!",
  ],
  wide: [
    "Wide! Row Z says thank you.",
    "Off target. The crowd groans.",
    "That one is going into orbit.",
  ],
  post: ["Off the post! So close!", "CLANG! The woodwork says no."],
  received: [
    "Lovely ball from No. {n}.",
    "Tidy pass. Keep it moving.",
    "No. {n} picks out a teammate.",
  ],
  intercepted: ["Cut out! Read it all the way.", "Intercepted! Sloppy, that."],
  won: [
    "No. {n} wins it back!",
    "Robbed! No. {n} takes it off him.",
    "No. {n} pounces on the loose touch!",
  ],
  kickoff: ["And we're under way!"],
};

const KICKOFF_CALL_MS = KICKOFF_WHISTLE_MS + 200;

/** A TV-style ticker under the pitch with a line for each bit of play */
export function Commentary({ call }: { call: PlayCall | null }) {
  const [line, setLine] = useState<{ key: string; text: string } | null>(null);
  useEffect(() => {
    const kickoff = setTimeout(
      () => setLine({ key: "kickoff", text: LINES.kickoff[0] }),
      KICKOFF_CALL_MS,
    );
    return () => clearTimeout(kickoff);
  }, []);
  useEffect(() => {
    if (!call) return;
    const options = LINES[call.kind] ?? [];
    if (options.length === 0) return;
    const seed = [...call.key].reduce((a, ch) => a + ch.charCodeAt(0), 0);
    const pick = options[seed % options.length];
    const filled =
      call.number !== undefined
        ? pick.replace("{n}", String(call.number))
        : pick.replace("No. {n}", "the player");
    const text = filled.charAt(0).toUpperCase() + filled.slice(1);
    const say = setTimeout(
      () => setLine({ key: call.key, text }),
      call.delayMs,
    );
    return () => clearTimeout(say);
  }, [call]);

  return (
    <div className="commentary" aria-live="polite">
      <span className="commentary-live">LIVE</span>
      <span className="commentary-text" key={line?.key ?? "quiet"}>
        {line?.text ?? "Warming up..."}
      </span>
    </div>
  );
}
