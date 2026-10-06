import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { inline } from "../../utils/inlineImage";

/** The look of each drawing, as worked out from the page's stylesheets, that an image must carry itself */
const LOOK = [
  "fill",
  "fill-opacity",
  "fill-rule",
  "stroke",
  "stroke-width",
  "stroke-opacity",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-miterlimit",
  "opacity",
  "filter",
  "mix-blend-mode",
  "display",
  "visibility",
  "paint-order",
  "stop-color",
  "stop-opacity",
];

/** How far past its shapes a drawing's image reaches, for the width of their outlines */
const MARGIN = 3;

interface Art {
  url: string;
  /** Where the image sits over the drawing's own box, in percent of it */
  left: number;
  top: number;
  width: number;
  height: number;
}

const done = new Map<string, Art>();
const underway = new Map<string, Promise<Art>>();

/**
 * Turns a drawing on the page into a standalone image: every shape keeps
 * the look the stylesheets gave it, textures come along as data, and the
 * image reaches as far as the shapes do, past the drawing's own box.
 */
async function bake(svg: SVGSVGElement): Promise<Art> {
  const view = svg.viewBox.baseVal;
  const reach = svg.getBBox();
  const x = Math.min(view.x, reach.x - MARGIN);
  const y = Math.min(view.y, reach.y - MARGIN);
  const right = Math.max(view.x + view.width, reach.x + reach.width + MARGIN);
  const bottom = Math.max(
    view.y + view.height,
    reach.y + reach.height + MARGIN,
  );
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const originals = svg.querySelectorAll("*");
  copy.querySelectorAll("*").forEach((shape, i) => {
    const look = getComputedStyle(originals[i]);
    (shape as SVGElement).setAttribute(
      "style",
      LOOK.map((name) => `${name}:${look.getPropertyValue(name)}`).join(";"),
    );
    shape.removeAttribute("class");
  });
  copy.removeAttribute("class");
  copy.removeAttribute("style");
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("viewBox", `${x} ${y} ${right - x} ${bottom - y}`);
  copy.setAttribute("width", String(right - x));
  copy.setAttribute("height", String(bottom - y));
  copy.setAttribute("overflow", "hidden");
  await Promise.all(
    [...copy.querySelectorAll("image")].map(async (image) =>
      image.setAttribute("href", await inline(image.getAttribute("href")!)),
    ),
  );
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(copy)], {
      type: "image/svg+xml",
    }),
  );
  const image = new Image();
  image.src = url;
  await image.decode();
  return {
    url,
    left: ((x - view.x) / view.width) * 100,
    top: ((y - view.y) / view.height) * 100,
    width: ((right - x) / view.width) * 100,
    height: ((bottom - y) / view.height) * 100,
  };
}

/**
 * A drawing that never changes, drawn as shapes the first time it is seen
 * and as one shared image ever after. Every soldier on the front carries
 * the same few kinds of kit, so a few images stand in for thousands of
 * shapes the page would otherwise restyle and repaint.
 */
export function BakedArt({
  name,
  viewBox,
  children,
}: {
  /** Which drawing this is; every drawing with the same name looks the same */
  name: string;
  viewBox: string;
  children: ReactNode;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [, setBaked] = useState(0);
  const art = done.get(name);

  useEffect(() => {
    if (done.has(name)) return;
    let live = true;
    let making = underway.get(name);
    if (!making && ref.current) {
      making = bake(ref.current).then((made) => {
        done.set(name, made);
        return made;
      });
      underway.set(name, making);
    }
    making?.then(() => live && setBaked((n) => n + 1)).catch(() => {});
    return () => {
      live = false;
    };
  }, [name]);

  if (!art)
    return (
      <svg ref={ref} viewBox={viewBox}>
        {children}
      </svg>
    );
  return (
    <>
      {/* Holds the drawing's own box, so whatever it sits in keeps its size */}
      <svg viewBox={viewBox} />
      <img
        className="baked-art"
        src={art.url}
        alt=""
        draggable={false}
        style={{
          left: `${art.left}%`,
          top: `${art.top}%`,
          width: `${art.width}%`,
          height: `${art.height}%`,
        }}
      />
    </>
  );
}
