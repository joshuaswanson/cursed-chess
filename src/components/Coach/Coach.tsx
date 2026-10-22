import { Fragment, useId, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { centre } from "./box";
import type { Box } from "./box";
import "./Coach.css";

interface Hole {
  selector: string;
  /** How far past the element the hole reaches, in pixels: all round, or across and down */
  pad?: number | [number, number];
  round?: boolean;
}

/** An element's box, and how round its corners are */
type Outline = Box & { radius: number };

const boxesOf = (selector: string): Outline[] =>
  [...document.querySelectorAll(selector)].map((el) => {
    const { left, top, width, height } = el.getBoundingClientRect();
    const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
    return { left, top, width, height, radius };
  });

const hole = (box: Outline, { pad = 0, round }: Omit<Hole, "selector">) => {
  const [padX, padY] = typeof pad === "number" ? [pad, pad] : pad;
  if (round) {
    const { x, y } = centre(box);
    const r = Math.max(box.width, box.height) / 2 + Math.max(padX, padY);
    return <circle cx={x} cy={y} r={r} />;
  }
  const radius = box.radius && box.radius + Math.min(padX, padY);
  return (
    <rect
      x={box.left - padX}
      y={box.top - padY}
      width={box.width + padX * 2}
      height={box.height + padY * 2}
      rx={radius}
    />
  );
};

/** A dark sheet over one box, with every hole cut through it. Holes may overlap. */
function Sheet({
  className,
  over,
  holes,
}: {
  className: string;
  over: Outline;
  holes: Hole[];
}) {
  const id = useId();
  return (
    <svg className={className}>
      <mask id={id} maskUnits="userSpaceOnUse">
        <rect
          x={over.left}
          y={over.top}
          width={over.width}
          height={over.height}
          rx={over.radius}
          fill="#fff"
        />
        <g fill="#000">
          {holes.flatMap((h) =>
            boxesOf(h.selector).map((box, i) => (
              <Fragment key={`${h.selector}${i}`}>{hole(box, h)}</Fragment>
            )),
          )}
        </g>
      </mask>
      <rect width="100%" height="100%" mask={`url(#${CSS.escape(id)})`} />
    </svg>
  );
}

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
    radius: 0,
  };
  const under = boxesOf(tipOver)[0];
  const shaded = shade && boxesOf(shade.over)[0];
  if (!under) return null;
  return createPortal(
    <div className="coach" aria-hidden>
      <Sheet className="coach-dark" over={page} holes={lit} />
      {shade && shaded && (
        <Sheet className="coach-shade" over={shaded} holes={shade.lit} />
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
