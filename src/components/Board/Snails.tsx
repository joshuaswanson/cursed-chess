import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { Color } from "../../engine";
import type { SquareIndex } from "../../engine";
import { SNAIL_CRAWL_MS } from "../../plugins/immortalSnail";
import type { Snail, SnailView } from "../../plugins/immortalSnail";
import { pieceImage } from "../../utils/pieceImages";
import { sfx } from "../../audio/sfx";
import { visualCol, visualRow } from "./boardGeometry";
import "./Snails.css";

/** How far into its crawl the snail is when its head touches the piece in its way */
const TOUCHES = 0.55;
/** The slime is drawn in units of a hundred to a square, and is this many of them wide at its widest, either side of its middle */
const SLIME_UNIT = 100;
const SLIME_WIDTH = 9;

/** How wide the trail is at a point along it: uneven, as slime is, and tapering where it starts */
function slimeHalfWidth(x: number, length: number, seed: number): number {
  const taper = Math.min(1, x / 22) ** 0.6;
  const uneven =
    0.78 +
    0.14 * Math.sin(x * 0.11 + seed * 1.7) +
    0.08 * Math.sin(x * 0.29 + seed * 0.6);
  return SLIME_WIDTH * taper * uneven * (0.92 + 0.08 * (x / length));
}

/** The edge of the trail, out along one side and back along the other */
function slimeOutline(length: number, seed: number): string {
  const steps = Math.max(8, Math.round(length / 6));
  const along = Array.from(
    { length: steps + 1 },
    (_, i) => (i / steps) * length,
  );
  const side = (sign: number, xs: number[]) =>
    xs.map(
      (x) =>
        `${x.toFixed(1)} ${(sign * slimeHalfWidth(x, length, seed)).toFixed(1)}`,
    );
  return `M${[...side(-1, along), ...side(1, [...along].reverse())].join(" L")}Z`;
}

/** A wavering line of light along the trail, a little off its middle */
function slimeShine(length: number, seed: number): string {
  const steps = Math.max(6, Math.round(length / 10));
  return (
    "M" +
    Array.from({ length: steps + 1 }, (_, i) => {
      const x = 8 + (i / steps) * (length - 14);
      const y = -2.2 + 1.3 * Math.sin(x * 0.13 + seed);
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" L")
  );
}

/** A few beads of light on the trail: where each is, and how big */
function slimeGlints(length: number, seed: number): [number, number, number][] {
  const count = Math.max(2, Math.round(length / 40));
  return Array.from({ length: count }, (_, i) => {
    const x =
      ((i + 0.5 + 0.3 * Math.sin(seed * 3.1 + i * 2.3)) / count) * length;
    return [
      x,
      2.4 * Math.sin(seed + i * 1.9),
      1 + 0.5 * Math.abs(Math.sin(i * 7 + seed)),
    ];
  });
}

/** How far down its square a snail's foot is, where its slime is laid */
const FOOT_HEIGHT = 0.68;
/** How long after the touch the piece hits the board */
const FALL_MS = 420;

/** Where a square is on the board, as shares of its width and height */
const at = (sq: SquareIndex, flipped: boolean): CSSProperties => ({
  left: `${visualCol(sq, flipped) * 12.5}%`,
  top: `${visualRow(sq, flipped) * 12.5}%`,
});

/** Each side's shell: its outer whorl, its inner whorl, and the line of its spiral */
const SHELLS: Record<Color, [string, string, string]> = {
  [Color.White]: ["#fff4dc", "#e9c98f", "#9a6a35"],
  [Color.Black]: ["#9b5a2e", "#5e3216", "#24110a"],
};

/** One eye on its stalk, which sways and springs about the stalk's foot */
function Stalk({
  foot,
  eye,
  bend,
  late = false,
}: {
  foot: [number, number];
  eye: [number, number];
  /** The point the stalk curves by on its way up */
  bend: [number, number];
  /** The second stalk moves a beat behind the first */
  late?: boolean;
}) {
  const d = `M${foot[0]} ${foot[1]} Q ${bend[0]} ${bend[1]}, ${eye[0]} ${eye[1] + 1}`;
  return (
    <g
      className={`snail-stalk${late ? " is-late" : ""}`}
      style={{ transformOrigin: `${foot[0]}px ${foot[1]}px` }}
    >
      <path
        d={d}
        fill="none"
        stroke="#1b2414"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      <path
        d={d}
        fill="none"
        stroke="#b8c7a1"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx={eye[0]} cy={eye[1]} r="3.2" fill="#1b2414" />
      <circle cx={eye[0] + 0.8} cy={eye[1] - 0.8} r="1" fill="#fff" />
    </g>
  );
}

/**
 * A snail, side on, facing right: its foot, its shell, and its eyes on
 * stalks. Its parts are apart so that, crawling, the foot can stretch and
 * gather, the head ride the front of it, and the shell bob along on top.
 */
export function SnailArt({ color, look }: { color: Color; look: number }) {
  const [outer, inner, line] = SHELLS[color];
  return (
    <svg className="snail-art" viewBox="0 -6 72 54" aria-hidden>
      <g className="snail-foot">
        <path
          d="M6 40 C 10 33, 30 33, 50 34 C 56 34.5, 60 37, 60 40 C 60 43, 54 44, 48 44 L 10 44 C 6 44, 4 42, 6 40 Z"
          fill="#b8c7a1"
          stroke="#1b2414"
          strokeWidth="2"
        />
        <path
          d="M14 39 C 26 37, 40 37, 52 38"
          fill="none"
          stroke="#e9f2dc"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.8"
        />
      </g>
      <g className="snail-head">
        {/* Leaning toward the king it is after */}
        <g className="snail-stalks" style={{ rotate: `${look}deg` }}>
          <Stalk foot={[51, 35]} bend={[52.5, 25]} eye={[55, 15]} />
          <Stalk foot={[55, 35]} bend={[58, 27]} eye={[62, 18]} late />
        </g>
      </g>
      <g className="snail-shell">
        <circle
          cx="28"
          cy="24"
          r="15"
          fill={outer}
          stroke="#1b2414"
          strokeWidth="2.2"
        />
        <path
          d="M28 24 m0 -2 a2 2 0 1 1 -0.1 0 M28 24 C 33 24, 33 17, 27.5 16.5 C 20 16, 19 27, 25 30.5 C 32 34.5, 40 28, 38 19.5 C 36 11, 24 8, 17 14"
          fill="none"
          stroke={line}
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M28 24 C 33 24, 33 17, 27.5 16.5 C 20 16, 19 27, 25 30.5"
          fill={inner}
          opacity="0.45"
        />
        <path
          d="M18 15 C 21 12, 25 11, 29 11.5"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />
      </g>
    </svg>
  );
}

/** How far its eye stalks lean, and which way it faces, to look at the king it hunts */
function gaze(snail: Snail, flipped: boolean) {
  if (snail.prey === null) return { faceLeft: false, look: 0 };
  const dx = visualCol(snail.prey, flipped) - visualCol(snail.sq, flipped);
  const dy = visualRow(snail.prey, flipped) - visualRow(snail.sq, flipped);
  const faceLeft = dx < 0;
  const lean = Math.atan2(dy, Math.abs(dx) || 1) * (180 / Math.PI);
  return { faceLeft, look: Math.max(-35, Math.min(35, lean * 0.5)) };
}

/**
 * The immortal snails on the board, each gliding a square at a time after
 * the move that sets it off, with a trail of slime drying behind it and a
 * count of the moves until it crawls again. Whatever it touches, it only
 * taps, and that piece keels over dead.
 */
export function Snails({
  view,
  flipped,
  delayMs,
}: {
  view: SnailView;
  flipped: boolean;
  /** How long a crawl waits for the move before it to land */
  delayMs: number;
}) {
  const touchMs = delayMs + SNAIL_CRAWL_MS * TOUCHES;
  // A tap, and a thud as the piece hits the board, once for each piece it gets
  const heard = useRef(new Set<string>());
  const meals = view.snails
    .filter((snail) => snail.ate?.crawl === snail.crawls)
    .map((snail) => `${snail.color}-${snail.crawls}`)
    .join(" ");
  useEffect(() => {
    const fresh = meals.split(" ").filter((m) => m && !heard.current.has(m));
    if (fresh.length === 0) return;
    for (const meal of fresh) heard.current.add(meal);
    const timers = [
      setTimeout(() => sfx.tap(), touchMs),
      setTimeout(() => sfx.thud(), touchMs + FALL_MS),
    ];
    return () => timers.forEach(clearTimeout);
  }, [meals, touchMs]);
  return (
    <div
      className="snails"
      style={
        {
          "--crawl-ms": `${SNAIL_CRAWL_MS}ms`,
          "--crawl-after": `${delayMs}ms`,
        } as CSSProperties
      }
      aria-hidden
    >
      {/* The slime behind it: laid as it crawls, then drying away once it has stopped */}
      {view.snails.flatMap((snail) =>
        snail.trail.map((from, i) => {
          const to = snail.trail[i + 1] ?? snail.sq;
          const dx = visualCol(to, flipped) - visualCol(from, flipped);
          const dy = visualRow(to, flipped) - visualRow(from, flipped);
          // Counted from the crawl that laid it, so it is the same trail until it is gone
          const crawl = snail.crawls - (snail.trail.length - 1 - i);
          const length = Math.hypot(dx, dy) * SLIME_UNIT;
          return (
            <svg
              key={`${snail.color}-${crawl}`}
              className="snail-slime"
              viewBox={`0 ${-SLIME_WIDTH} ${length} ${SLIME_WIDTH * 2}`}
              preserveAspectRatio="none"
              style={{
                left: `${(visualCol(from, flipped) + 0.5) * 12.5}%`,
                top: `${(visualRow(from, flipped) + FOOT_HEIGHT) * 12.5}%`,
                width: `${Math.hypot(dx, dy) * 12.5}%`,
                height: `${((SLIME_WIDTH * 2) / SLIME_UNIT) * 12.5}%`,
                rotate: `${Math.atan2(dy, dx)}rad`,
              }}
            >
              <path
                className="snail-slime-wet"
                d={slimeOutline(length, crawl)}
              />
              <path
                className="snail-slime-shine"
                d={slimeShine(length, crawl)}
              />
              {slimeGlints(length, crawl).map(([x, y, r]) => (
                <circle
                  key={x}
                  className="snail-slime-glint"
                  cx={x}
                  cy={y}
                  r={r}
                />
              ))}
            </svg>
          );
        }),
      )}
      {/* Whatever it touches keels over, dead, and lies there a moment */}
      {view.snails.map((snail) => {
        if (!snail.ate || snail.ate.crawl !== snail.crawls) return null;
        const came = snail.trail[snail.trail.length - 1];
        const across =
          came === undefined
            ? 1
            : visualCol(snail.ate.sq, flipped) - visualCol(came, flipped);
        return (
          <img
            key={`${snail.color}-dead-${snail.crawls}`}
            className={`snail-victim${across < 0 ? " falls-left" : ""}`}
            src={pieceImage(snail.ate.piece)}
            alt=""
            draggable={false}
            style={at(snail.ate.sq, flipped)}
          />
        );
      })}
      {view.snails.map((snail) => {
        const { faceLeft, look } = gaze(snail, flipped);
        const tapping = snail.ate?.crawl === snail.crawls;
        return (
          <div
            key={snail.color}
            className={`snail snail-${snail.color}`}
            style={at(snail.sq, flipped)}
          >
            <div className={`snail-body${faceLeft ? " faces-left" : ""}`}>
              {/* Each crawl it stretches and gathers its way along, with a light tap of its head on whatever is in its way */}
              <div
                key={`crawl-${snail.crawls}`}
                className={
                  snail.crawls === 0
                    ? undefined
                    : `snail-crawling${tapping ? " snail-tap" : ""}`
                }
              >
                <SnailArt color={snail.color} look={look} />
              </div>
            </div>
            <span className="snail-count">{snail.movesLeft}</span>
          </div>
        );
      })}
    </div>
  );
}
