import type { CSSProperties } from "react";
import { Color } from "../../engine";
import type { SquareIndex } from "../../engine";
import { SNAIL_CRAWL_MS } from "../../plugins/immortalSnail";
import type { Snail, SnailView } from "../../plugins/immortalSnail";
import { pieceImage } from "../../utils/pieceImages";
import { visualCol, visualRow } from "./boardGeometry";
import "./Snails.css";

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

/** A snail, side on, facing right: its foot, its shell, and its eyes on stalks */
export function SnailArt({ color, look }: { color: Color; look: number }) {
  const [outer, inner, line] = SHELLS[color];
  return (
    <svg className="snail-art" viewBox="0 0 64 48" aria-hidden>
      {/* The foot, and its shine */}
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
      {/* The eyes on their stalks, leaning toward the king it is after */}
      <g className="snail-stalks" style={{ rotate: `${look}deg` }}>
        <path
          d="M51 35 C 52 28, 53 22, 55 16 M55 35 C 57 29, 59 24, 62 19"
          fill="none"
          stroke="#1b2414"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        <path
          d="M51 35 C 52 28, 53 22, 55 16 M55 35 C 57 29, 59 24, 62 19"
          fill="none"
          stroke="#b8c7a1"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="55" cy="15" r="3.2" fill="#1b2414" />
        <circle cx="62" cy="18" r="3.2" fill="#1b2414" />
        <circle cx="55.8" cy="14.2" r="1" fill="#fff" />
        <circle cx="62.8" cy="17.2" r="1" fill="#fff" />
      </g>
      {/* The shell, coiled */}
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
 * the move that sets it off, with a trail of slime drying behind it, a
 * count of the moves until it crawls again, and whatever it ate shrinking
 * away under it
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
      {view.snails.flatMap((snail) =>
        snail.trail.map((sq, i) => (
          <span
            key={`${snail.color}-${sq}-${i}`}
            className="snail-slime"
            style={{
              ...at(sq, flipped),
              opacity: ((i + 1) / snail.trail.length) * 0.75,
            }}
          />
        )),
      )}
      {view.snails.map(
        (snail) =>
          snail.ate && (
            <img
              key={`${snail.color}-ate-${snail.ate.crawl}`}
              className="snail-eaten"
              src={pieceImage(snail.ate.piece)}
              alt=""
              draggable={false}
              style={at(snail.ate.sq, flipped)}
            />
          ),
      )}
      {view.snails.map((snail) => {
        const { faceLeft, look } = gaze(snail, flipped);
        return (
          <div
            key={snail.color}
            className={`snail snail-${snail.color}`}
            style={at(snail.sq, flipped)}
          >
            <div className={`snail-body${faceLeft ? " faces-left" : ""}`}>
              <SnailArt color={snail.color} look={look} />
            </div>
            <span className="snail-count">{snail.movesLeft}</span>
          </div>
        );
      })}
    </div>
  );
}
