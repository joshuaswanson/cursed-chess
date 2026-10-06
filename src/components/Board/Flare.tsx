import { useLayoutEffect, useRef } from "react";
import { sfx } from "../../audio/sfx";

/** How long a flare climbs, and how long it then burns as it falls, in milliseconds */
const CLIMB_MS = 1100;
const BURN_MS = 6500;
const TOTAL_MS = CLIMB_MS + BURN_MS;
const PUFFS = 14;

export interface FlareShot {
  id: number;
  /** Where it is fired from, and how far it drifts by the time it burns out, as shares of the board */
  x: number;
  y: number;
  drift: number;
  /** How high it climbs, as a share of the board above where it was fired */
  rise: number;
}

/**
 * Where the flare is at a moment of its flight, as shares of the board: it
 * shoots up, slowing, then falls slow and drifting as it burns
 */
function positionAt(shot: FlareShot, ms: number) {
  if (ms <= CLIMB_MS) {
    const t = ms / CLIMB_MS;
    const climb = 1 - (1 - t) ** 2.4;
    return { x: shot.x + shot.drift * 0.2 * t, y: shot.y - shot.rise * climb };
  }
  const t = (ms - CLIMB_MS) / BURN_MS;
  return {
    x: shot.x + shot.drift * (0.2 + 0.8 * t),
    y: shot.y - shot.rise + shot.rise * 0.55 * t ** 1.3,
  };
}

/** A keyframe placing a full-board layer so its origin sits on a point of the board */
const at = (p: { x: number; y: number }) => ({
  transform: `translate(${(p.x * 100).toFixed(2)}%, ${(p.y * 100).toFixed(2)}%)`,
});

/**
 * A Very light fired over no man's land: it climbs from the trench on a
 * trail of smoke, bursts into a harsh flickering glare, and sinks slowly as
 * it burns, lighting the mud beneath it a cold white
 */
export function Flare({ shot }: { shot: FlareShot }) {
  const head = useRef<HTMLSpanElement>(null);
  const glow = useRef<HTMLSpanElement>(null);
  const puffs = useRef<(HTMLElement | null)[]>([]);

  useLayoutEffect(() => {
    const path = Array.from({ length: 41 }, (_, i) =>
      at(positionAt(shot, (i / 40) * TOTAL_MS)),
    );
    const offsets = path.map((_, i) => i / 40);
    const frames = path.map((p, i) => ({ ...p, offset: offsets[i] }));
    const animations = [
      head.current?.animate(frames, { duration: TOTAL_MS, fill: "both" }),
      glow.current?.animate(frames, { duration: TOTAL_MS, fill: "both" }),
    ];
    // Smoke left hanging where the flare has been, spreading and drifting off
    puffs.current.forEach((puff, n) => {
      if (!puff) return;
      const ms = (n / (PUFFS - 1)) * (TOTAL_MS * 0.85);
      const p = positionAt(shot, ms);
      puff.style.transform = at(p).transform;
      animations.push(
        puff.firstElementChild?.animate(
          [
            { opacity: 0, scale: 0.3, translate: "0 0" },
            { opacity: 0.75, scale: 0.6, offset: 0.08 },
            { opacity: 0, scale: 2.4, translate: "18px -10px" },
          ],
          { duration: 3200, delay: ms, fill: "both", easing: "ease-out" },
        ),
      );
    });
    sfx.flare(TOTAL_MS / 1000);
    return () => animations.forEach((a) => a?.cancel());
  }, [shot]);

  return (
    <span className="flare-shot" aria-hidden>
      {Array.from({ length: PUFFS }, (_, n) => (
        <span
          key={n}
          className="flare-layer"
          ref={(el) => {
            puffs.current[n] = el;
          }}
        >
          <i className="flare-smoke" />
        </span>
      ))}
      <span
        ref={glow}
        className="flare-layer"
        style={
          {
            "--burn": `${BURN_MS}ms`,
            "--climb": `${CLIMB_MS}ms`,
          } as React.CSSProperties
        }
      >
        <i className="flare-light" />
      </span>
      <span
        ref={head}
        className="flare-layer"
        style={
          {
            "--burn": `${BURN_MS}ms`,
            "--climb": `${CLIMB_MS}ms`,
          } as React.CSSProperties
        }
      >
        <i className="flare-burst" />
        <i className="flare-core" />
      </span>
    </span>
  );
}
