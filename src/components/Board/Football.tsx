import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Color } from "../../engine";
import type { FootballView, Kick, Spot } from "../../plugins/football";
import { visualCol, visualRow } from "./boardGeometry";
import { Confetti } from "../Show/Confetti";
import { sfx } from "../../audio/sfx";
import "./Football.css";

/** The kickoff whistle blows as the mode's title card clears */
const KICKOFF_WHISTLE_MS = 4300;
const PASS_MS_PER_SQUARE = 95;
const SHOT_MS_PER_SQUARE = 55;
const MIN_FLIGHT_MS = 260;
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

/** How long the ball is in the air for a kick */
function flightMs(kick: Kick): number {
  const total = legLengths(
    kick.waypoints.map((w) => ({ x: w.file, y: w.rank })),
  ).reduce((a, b) => a + b, 0);
  const perSquare =
    kick.kind === "shot" ? SHOT_MS_PER_SQUARE : PASS_MS_PER_SQUARE;
  return Math.max(MIN_FLIGHT_MS, Math.round(total * perSquare + 120));
}

const pct = (squares: number) => `${squares * 12.5}%`;

/** A classic black and white panelled ball */
export function SoccerBall({ className }: { className?: string }) {
  const patches = [0, 72, 144, 216, 288];
  return (
    <svg className={className} viewBox="-50 -50 100 100" aria-hidden>
      <defs>
        <radialGradient id="ball-shade" cx="0.36" cy="0.32" r="0.75">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.65" stopColor="#e9edf2" />
          <stop offset="1" stopColor="#9aa3ad" />
        </radialGradient>
        <clipPath id="ball-clip">
          <circle r="46" />
        </clipPath>
      </defs>
      <circle r="47" fill="url(#ball-shade)" stroke="#1a1d22" strokeWidth="3" />
      <g clipPath="url(#ball-clip)" fill="#1a1d22">
        <path d="M0 -15 L14.3 -4.6 L8.8 12.1 L-8.8 12.1 L-14.3 -4.6 Z" />
        {patches.map((a) => (
          <g key={a} transform={`rotate(${a})`}>
            <path d="M-11 -50 L11 -50 L14 -38 L0 -30 L-14 -38 Z" />
            <path
              d="M0 -15 L0 -30"
              stroke="#1a1d22"
              strokeWidth="2.5"
              fill="none"
            />
          </g>
        ))}
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

/** One goal: posts, crossbar, and a net that bulges when the ball hits it */
export function Goal({
  atTop,
  defender,
  attacked,
  shotChance,
  noShotReason,
  scoredKick,
  onShoot,
}: {
  atTop: boolean;
  defender: Color;
  /** The goal you shoot at */
  attacked: boolean;
  shotChance: number | null;
  noShotReason: string;
  scoredKick: Kick | null;
  onShoot: () => void;
}) {
  const [nudge, setNudge] = useState(0);
  const shootable = shotChance !== null;
  const onClick = () => {
    if (shootable) onShoot();
    else setNudge((n) => n + 1);
  };
  return (
    <div
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
        <g transform={atTop ? undefined : "translate(0 62) scale(1 -1)"}>
          <polygon points="-6,58 406,58 384,8 16,8" className="goal-turf" />
          <g
            className={`goal-net${scoredKick ? " bulge" : ""}`}
            key={scoredKick?.id ?? 0}
            style={
              scoredKick
                ? { animationDelay: `${flightMs(scoredKick) - 40}ms` }
                : undefined
            }
          >
            <polygon
              points="0,56 400,56 384,6 16,6"
              fill={`url(#net-${defender})`}
            />
            <path d="M16 6 H384" className="goal-backbar" />
            <path d="M0 56 L16 6 M400 56 L384 6" className="goal-sidebar" />
          </g>
          <path d="M0 56 H400" className="goal-crossbar" />
          <circle cx="0" cy="56" r="7" className="goal-post" />
          <circle cx="400" cy="56" r="7" className="goal-post" />
        </g>
      </svg>
      {shootable && (
        <span className="shoot-label">
          Shoot <b>{Math.round(shotChance * 100)}%</b>
        </span>
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
  const inNet = kick.outcome === "goal";
  return (
    <>
      <div
        ref={groundRef}
        className="ball-flight"
        hidden={landed && !inNet}
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
function GoalCelebration({ kick }: { kick: Kick }) {
  const delay = flightMs(kick);
  const ours = kick.color === Color.White;
  return (
    <div
      className={`goal-celebration${ours ? "" : " theirs"}`}
      style={{ animationDelay: `${delay}ms` } as Style}
      aria-live="assertive"
    >
      <span className="goal-word" style={{ "--delay": `${delay}ms` } as Style}>
        {"GOAL!".split("").map((ch, i) => (
          <span key={i} style={{ "--i": i } as Style}>
            {ch}
          </span>
        ))}
      </span>
      {ours && <Confetti count={120} seed={kick.id + 11} delayMs={delay} />}
    </div>
  );
}

function playKick(kick: Kick): void {
  sfx.kick(kick.kind === "shot");
  const land = flightMs(kick);
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
export function FootballLayer({
  view,
  carried,
  flipped,
  squareSize,
}: {
  view: FootballView;
  carried: boolean;
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

  const col = visualCol(view.ball, flipped);
  const row = visualRow(view.ball, flipped);
  const restStyle: Style = carried
    ? { left: pct(col + 0.74), top: pct(row + 0.8), "--size": 0.34 }
    : { left: pct(col + 0.5), top: pct(row + 0.56), "--size": 0.44 };
  const ballAway = recent !== null && (!landed || recent.outcome === "goal");

  return (
    <div
      className="football-layer"
      style={{ "--sq": `${squareSize}px` } as Style}
    >
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
          key={recent.id}
          kick={recent}
          landed={landed}
          flipped={flipped}
          squareSize={squareSize}
        />
      )}
      {recent?.outcome === "goal" && (
        <GoalCelebration key={recent.id} kick={recent} />
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
