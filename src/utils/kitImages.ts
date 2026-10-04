import { useEffect, useState } from "react";
import { Color, PieceType } from "../engine";
import type { Piece } from "../engine";

/** The dark line the piece artwork is drawn with */
const INK = "#1b1033";

interface Kit {
  shirt: string;
  /** Second color for vertical stripes, or the shirt color for a plain shirt */
  stripe: string;
  trim: string;
  shorts: string;
  socks: string;
  number: string;
}

const KITS: Record<Color, Kit> = {
  [Color.White]: {
    shirt: "#2f6bff",
    stripe: "#2f6bff",
    trim: "#ffffff",
    shorts: "#ffffff",
    socks: "#2f6bff",
    number: "#ffffff",
  },
  [Color.Black]: {
    shirt: "#e2304a",
    stripe: "#8e1326",
    trim: "#ffd23f",
    shorts: "#1b1033",
    socks: "#e2304a",
    number: "#ffffff",
  },
};

/** Where on each piece the shirt sits, in the artwork's 45 by 45 units: the top and bottom of the shirt, and the number's center */
const FIT: Record<
  PieceType,
  { top: number; hem: number; x: number; y: number }
> = {
  [PieceType.Pawn]: { top: 22, hem: 34, x: 22.5, y: 31 },
  [PieceType.Knight]: { top: 27, hem: 36, x: 26, y: 33.5 },
  [PieceType.Bishop]: { top: 22.5, hem: 30, x: 22.5, y: 28.6 },
  [PieceType.Rook]: { top: 17, hem: 32, x: 22.5, y: 27 },
  [PieceType.Queen]: { top: 20, hem: 34, x: 22.5, y: 30 },
  [PieceType.King]: { top: 20, hem: 34, x: 22.5, y: 30 },
};

/**
 * The kit as a fill for the piece's body: its own colors on the head, then
 * a striped shirt with a V collar, shorts, and hooped socks, shaded so the
 * light falls from the left. Filling the body this way keeps every band
 * inside the piece's own outline.
 */
function kitFill(kit: Kit, type: PieceType, skin: string): string {
  const { top, hem, x } = FIT[type];
  const shorts = hem + 4.5;
  const stripes =
    kit.stripe === kit.shirt
      ? ""
      : Array.from({ length: 12 }, (_, i) => i * 4 + ((x - 1) % 4))
          .map(
            (sx) =>
              `<rect x="${sx}" y="${top}" width="2" height="${hem - top}" fill="${kit.stripe}"/>`,
          )
          .join("");
  return (
    `<linearGradient id="kit-shade" x1="0" y1="0" x2="1" y2="0">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="0.38"/>` +
    `<stop offset="0.38" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset="0.7" stop-color="#000" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="0.32"/>` +
    `</linearGradient>` +
    skin +
    `<pattern id="body" patternUnits="userSpaceOnUse" width="45" height="45">` +
    `<rect width="45" height="45" fill="url(#skin)"/>` +
    `<rect y="${top}" width="45" height="${hem - top}" fill="${kit.shirt}"/>` +
    stripes +
    `<rect y="${top}" width="45" height="1.4" fill="${kit.trim}"/>` +
    `<path d="M${x - 4.4} ${top} L${x} ${top + 4.4} L${x + 4.4} ${top} Z" fill="${kit.trim}"/>` +
    `<path d="M${x - 2.6} ${top} L${x} ${top + 2.6} L${x + 2.6} ${top} Z" fill="${kit.shirt}"/>` +
    `<rect y="${hem}" width="45" height="4.5" fill="${kit.shorts}"/>` +
    `<rect y="${shorts}" width="45" height="${45 - shorts}" fill="${kit.socks}"/>` +
    `<rect y="${shorts + 1.6}" width="45" height="1.2" fill="${kit.trim}"/>` +
    `<rect width="45" height="45" fill="url(#kit-shade)"/>` +
    // Ink lines in the pieces' own outline style, kept inside each piece's outline by the fill
    `<g fill="none" stroke="${INK}" stroke-linejoin="round">` +
    `<path d="M0 ${top} H45" stroke-width="1.6"/>` +
    `<path d="M${x - 4.4} ${top} L${x} ${top + 4.4} L${x + 4.4} ${top}" stroke-width="1.1"/>` +
    `<path d="M0 ${hem} H45" stroke-width="1.6"/>` +
    `<path d="M0 ${shorts} H45" stroke-width="1.2"/>` +
    `</g>` +
    `</pattern>`
  );
}

/** Block shirt digits drawn on a 4 by 6 grid, the way numbers are cut from felt */
const DIGITS: Record<string, string> = {
  "0": "M0 0H4V6H0Z",
  "1": "M1 1.2L2.2 0V6M1 6H3.4",
  "2": "M0 0H4V3H0V6H4",
  "3": "M0 0H4V6H0M1.2 3H4",
  "4": "M0 0V3.4H4M3.2 0V6",
  "5": "M4 0H0V3H4V6H0",
  "6": "M4 0H0V6H4V3H0",
  "7": "M0 0H4V6",
  "8": "M0 0H4V6H0ZM0 3H4",
  "9": "M4 3H0V0H4V6H0",
};

/** The number in block digits, centered on (x, y), with a dark outline round each stroke */
function shirtNumber(
  number: number,
  x: number,
  y: number,
  height: number,
  color: string,
): string {
  const digits = String(number).split("");
  const scale = height / 6;
  const advance = 5.6;
  const width = digits.length * advance - (advance - 4);
  const strokes = digits
    .map(
      (d, i) =>
        `<path transform="translate(${i * advance} 0)" d="${DIGITS[d]}"/>`,
    )
    .join("");
  const at = `translate(${x - (width * scale) / 2} ${y - height / 2}) scale(${scale})`;
  const line = (stroke: string, w: number) =>
    `<g transform="${at}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="square" stroke-linejoin="miter">${strokes}</g>`;
  return line(INK, 3.1) + line(color, 1.5);
}

const cache = new Map<string, Promise<string>>();

/**
 * The party piece dressed in its team's football kit: the body is recolored
 * into a shirt, shorts, and socks that follow the piece's own outline, with
 * the squad number printed on the shirt.
 */
export function kitImage(
  base: string,
  piece: Piece,
  number: number,
): Promise<string> {
  const key = `${piece.color}${piece.type}${number}`;
  let made = cache.get(key);
  if (!made) {
    made = fetch(base)
      .then((r) => r.text())
      .then((svg) => {
        const kit = KITS[piece.color];
        const fit = FIT[piece.type];
        const numbered = svg
          .replace(
            /<linearGradient id="body"[\s\S]*?<\/linearGradient>/,
            (body) =>
              kitFill(kit, piece.type, body.replace('id="body"', 'id="skin"')),
          )
          .replace(
            "</svg>",
            shirtNumber(
              number,
              fit.x,
              fit.y - 2.2,
              piece.type === PieceType.Bishop ? 4.2 : 5.4,
              kit.number,
            ) + "</svg>",
          );
        return URL.createObjectURL(
          new Blob([numbered], { type: "image/svg+xml" }),
        );
      });
    cache.set(key, made);
  }
  return made;
}

const kitKey = (piece: Piece, number: number) =>
  `${piece.color}${piece.type}${number}`;

/**
 * Kit pictures for the players on the pitch, loaded as they are needed.
 * Returns a lookup that gives the plain piece until its kit is ready.
 */
export function useKitImages(
  players: { piece: Piece; number: number }[],
  plain: (piece: Piece) => string,
): (piece: Piece, number: number | undefined) => string {
  const [ready, setReady] = useState<Record<string, string>>({});
  const wanted = players
    .map(({ piece, number }) => kitKey(piece, number))
    .sort()
    .join(",");
  useEffect(() => {
    let live = true;
    for (const { piece, number } of players) {
      const key = kitKey(piece, number);
      if (ready[key]) continue;
      kitImage(plain(piece), piece, number).then((url) => {
        if (live) setReady((now) => ({ ...now, [key]: url }));
      });
    }
    return () => {
      live = false;
    };
    // Only a change in who is on the pitch calls for new kits
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted]);
  return (piece, number) =>
    number === undefined
      ? plain(piece)
      : (ready[kitKey(piece, number)] ?? plain(piece));
}
