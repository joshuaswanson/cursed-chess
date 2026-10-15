import { Fragment, useId, useLayoutEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { centre } from "./box";
import type { Box } from "./box";
import "./Coach.css";

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

const hole = (box: Box, { pad = 0, round }: Omit<Hole, "selector">) => {
  if (round) {
    const { x, y } = centre(box);
    const r = Math.max(box.width, box.height) / 2 + pad;
    return <circle cx={x} cy={y} r={r} />;
  }
  return (
    <rect
      x={box.left - pad}
      y={box.top - pad}
      width={box.width + pad * 2}
      height={box.height + pad * 2}
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
  over: Box;
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
