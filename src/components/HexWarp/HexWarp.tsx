import { useLayoutEffect, useRef, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { pieceImage } from "../../utils/pieceImages";
import { coordKey } from "../../engine/hex";
import { sfx } from "../../audio/sfx";
import "./HexWarp.css";

interface Flight {
  key: string;
  src: string;
  from: DOMRect;
  to: DOMRect;
  delay: number;
}

const FLIGHT_MS = 900;

/** Board tiles that snap into hexagons and blast outward as the square board breaks up */
export function BoardShatter({ flipped }: { flipped: boolean }) {
  return (
    <div className="board-shatter" aria-hidden>
      {Array.from({ length: 64 }, (_, i) => {
        const row = Math.floor(i / 8);
        const col = i % 8;
        const dx = col - 3.5;
        const dy = row - 3.5;
        const dist = Math.hypot(dx, dy);
        const rank = flipped ? row : 7 - row;
        const file = flipped ? 7 - col : col;
        return (
          <span
            key={i}
            className={`shard ${(rank + file) % 2 ? "light" : "dark"}`}
            style={
              {
                left: `${col * 12.5}%`,
                top: `${row * 12.5}%`,
                "--sx": `${(dx / (dist || 1)) * (120 + dist * 60)}px`,
                "--sy": `${(dy / (dist || 1)) * (120 + dist * 60)}px`,
                "--sr": `${(i % 2 ? 1 : -1) * (90 + (i % 5) * 50)}deg`,
                animationDelay: `${Math.round((4.95 - dist) * 45)}ms`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}

/**
 * Remembers where every piece sat on the square board, then flies each one
 * along an arc to the hex cell it was given.
 */
export function HexWarp() {
  const stage = useGameStore((s) => s.hexTransition);
  const arrivals = useGameStore((s) => s.hexArrivals);
  const origins = useRef(new Map<number, DOMRect>());
  const [flights, setFlights] = useState<Flight[]>([]);

  useLayoutEffect(() => {
    if (stage !== "morph-out") return;
    sfx.shatter();
    origins.current.clear();
    for (const el of document.querySelectorAll<HTMLElement>("[data-sq]")) {
      const img = el.querySelector("img.piece-img");
      if (img)
        origins.current.set(Number(el.dataset.sq), img.getBoundingClientRect());
    }
  }, [stage]);

  useLayoutEffect(() => {
    if (stage !== "morph-in") return;
    sfx.warp();
    const next: Flight[] = [];
    arrivals.forEach(({ from, to, piece }, i) => {
      const fromRect = origins.current.get(from);
      // The real piece already sits at its final spot and size, hidden until the flight lands
      const target = document.querySelector(
        `[data-hex-piece="${coordKey(to)}"]`,
      );
      if (!fromRect || !target) return;
      next.push({
        key: `${from}-${coordKey(to)}`,
        src: pieceImage(piece),
        from: fromRect,
        to: target.getBoundingClientRect(),
        delay: 120 + i * 18,
      });
    });
    setFlights(next);
  }, [stage, arrivals]);

  if (stage !== "morph-in") return null;
  return (
    <div className="hex-warp" aria-hidden>
      {flights.map((f) => (
        <FlyingPiece key={f.key} flight={f} />
      ))}
    </div>
  );
}

function FlyingPiece({ flight }: { flight: Flight }) {
  const ref = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { from, to } = flight;
    // Measured center to center, since the piece scales about its center
    const dx = to.x + to.width / 2 - (from.x + from.width / 2);
    const dy = to.y + to.height / 2 - (from.y + from.height / 2);
    const scaleEnd = to.width / from.width;
    const lift = -Math.max(80, Math.abs(dx) * 0.3);
    el.animate(
      [
        { transform: "translate(0, 0) scale(1.25) rotate(0deg)" },
        {
          transform: `translate(${dx * 0.5}px, ${dy * 0.5 + lift}px) scale(1.7) rotate(200deg)`,
          offset: 0.5,
        },
        {
          transform: `translate(${dx}px, ${dy}px) scale(${scaleEnd}) rotate(360deg)`,
        },
      ],
      {
        duration: FLIGHT_MS,
        delay: flight.delay,
        easing: "cubic-bezier(0.45, 0, 0.3, 1)",
        fill: "both",
      },
    );
  }, [flight]);

  return (
    <img
      ref={ref}
      src={flight.src}
      className="warp-piece"
      style={{
        left: flight.from.x,
        top: flight.from.y,
        width: flight.from.width,
        height: flight.from.height,
      }}
      alt=""
    />
  );
}
