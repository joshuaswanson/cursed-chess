import { useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import "./Coach.css";

export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Hole {
  selector: string;
  /** How far past the element the hole reaches, in pixels */
  pad?: number;
  round?: boolean;
}

const boxesOf = (selector: string): Box[] =>
  [...document.querySelectorAll(selector)].map((el) => {
    const { left, top, width, height } = el.getBoundingClientRect();
    return { left, top, width, height };
  });

export const centre = (box: Box) => ({
  x: box.left + box.width / 2,
  y: box.top + box.height / 2,
});

const cut = (box: Box, { pad = 0, round }: Omit<Hole, "selector"> = {}) => {
  const w = box.width + pad * 2;
  const h = box.height + pad * 2;
  if (!round) return `M${box.left - pad} ${box.top - pad}h${w}v${h}h${-w}z`;
  const { x, y } = centre(box);
  const r = Math.max(w, h) / 2;
  return `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0z`;
};

const sheet = (around: Box, holes: Hole[]) =>
  `path(evenodd, "${cut(around)}${holes
    .flatMap((hole) => boxesOf(hole.selector).map((box) => cut(box, hole)))
    .join("")}")`;

/** How often the lit parts are found again, as they can move about */
const MEASURE_MS = 250;

/**
 * A lesson given over the game: the page goes dark but for the parts that
 * matter, with a line of instruction. Clicks pass straight through it.
 */
export function Coach({
  lit,
  shade,
  tip,
  tipOver,
  tipAt = 0.5,
  children,
}: {
  /** What the dark leaves alone */
  lit: Hole[];
  /** A lighter dimming inside one lit part, with holes of its own */
  shade?: { over: string; lit: Hole[] };
  tip: string;
  /** The element the tip sits over, and how far down it */
  tipOver: string;
  tipAt?: number;
  children?: ReactNode;
}) {
  const [, setMeasured] = useState(0);
  useLayoutEffect(() => {
    const measure = () => setMeasured((n) => n + 1);
    const timer = window.setInterval(measure, MEASURE_MS);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, []);

  const page = {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  };
  const under = boxesOf(tipOver)[0];
  const shaded = shade && boxesOf(shade.over)[0];
  if (!under) return null;
  return createPortal(
    <div className="coach" aria-hidden>
      <div className="coach-dark" style={{ clipPath: sheet(page, lit) }} />
      {shade && shaded && (
        <div
          className="coach-shade"
          style={{ clipPath: sheet(shaded, shade.lit) }}
        />
      )}
      <p
        className="coach-tip"
        style={{
          left: centre(under).x,
          top: under.top + under.height * tipAt,
        }}
      >
        {tip}
      </p>
      {children}
    </div>,
    document.body,
  );
}
