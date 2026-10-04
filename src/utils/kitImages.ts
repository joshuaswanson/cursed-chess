import { useEffect, useState } from "react";
import { Color, PieceType } from "../engine";
import type { Piece } from "../engine";

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
    `<rect y="${top}" width="45" height="1.3" fill="${kit.trim}"/>` +
    `<path d="M${x - 4.2} ${top} L${x} ${top + 4.2} L${x + 4.2} ${top} Z" fill="${kit.trim}"/>` +
    `<path d="M${x - 2.6} ${top} L${x} ${top + 2.5} L${x + 2.6} ${top} Z" fill="${kit.shirt}"/>` +
    `<rect y="${hem - 0.9}" width="45" height="0.9" fill="#000" fill-opacity="0.25"/>` +
    `<rect y="${hem}" width="45" height="4.5" fill="${kit.shorts}"/>` +
    `<rect y="${shorts}" width="45" height="${45 - shorts}" fill="${kit.socks}"/>` +
    `<rect y="${shorts + 1.6}" width="45" height="1.2" fill="${kit.trim}"/>` +
    `<rect width="45" height="45" fill="url(#kit-shade)"/>` +
    `</pattern>`
  );
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
            `<text x="${fit.x}" y="${fit.y}" text-anchor="middle" font-family="Bungee, Rubik, sans-serif" font-size="${(number > 9 ? 6.4 : 7.4) * (piece.type === PieceType.Bishop ? 0.8 : 1)}" fill="${kit.number}" stroke="#1b1033" stroke-width="1.6" paint-order="stroke" stroke-linejoin="round">${number}</text></svg>`,
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
