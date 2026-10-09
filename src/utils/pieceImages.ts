import { Color } from "../engine";
import type { Piece } from "../engine";
import { useGameStore, GAME_MODES } from "../stores/gameStore";
import { PIECE_PALETTES } from "../theme/piecePalettes";
import type { ThemeId } from "../theme/themes";

const PARTY = `${import.meta.env.BASE_URL}pieces/party/`;
const KINDS = ["P", "N", "B", "R", "Q", "K"];

/** The party pieces' artwork, loaded once so each mode can recolor it on the spot */
const artwork = new Map<string, string>();
const loading: Promise<unknown>[] = [];
for (const color of ["w", "b"]) {
  for (const kind of KINDS) {
    const name = `${color}${kind}`;
    loading.push(
      fetch(`${PARTY}${name}.svg`)
        .then((r) => r.text())
        .then((svg) => artwork.set(name, svg))
        .catch(() => {}),
    );
  }
}
/** Settles once the artwork is in, after which a piece can be had in any mode's colors */
export const artworkLoaded = Promise.all(loading);

const recolored = new Map<string, string>();

/** The artwork with its body gradient's stops swapped for the given colors */
function recolor(svg: string, body: string[]): string {
  let stop = 0;
  return svg.replace(
    /(<linearGradient id="body"[\s\S]*?<\/linearGradient>)/,
    (gradient) =>
      gradient.replace(
        /stop-color="[^"]*"/g,
        () => `stop-color="${body[stop++] ?? body[2]}"`,
      ),
  );
}

/** A round head on a short neck, sized like the pawn's but bigger, for a helmet or cap to sit on */
const HEAD =
  '<path fill="url(#body)" d="M19.4 27 L20.3 21.5 H24.7 L25.6 27 Z"/>' +
  '<circle fill="url(#body)" cx="22.5" cy="17" r="5.5"/>';

/**
 * The queen and king as soldiers: a crown or a cross cannot go under a
 * helmet or a general's cap, so each has a head in its place. The queen's
 * head rises from her collar; the king's sits between his broad shoulders.
 */
function soldierly(name: string, svg: string): string {
  if (name.endsWith("Q"))
    return svg
      .replace(/<g stroke="none">(<circle[^>]*\/>)+<\/g>/, "")
      .replace(/<path d="M8 12a2[^"]*"\/>/, "")
      .replace(/<path[^>]*d="M9 26c8\.5-1\.5 21-1\.5 27 0l[^"]*"\/>/, "")
      .replace(
        '<path stroke-linecap="butt" d="M9 26c0 2',
        (band) => HEAD + band,
      );
  if (name.endsWith("K"))
    return svg
      .replace(/<path stroke-linejoin="miter" d="M22\.5 11\.6[^"]*"\/>/, "")
      .replace(/<path stroke-linejoin="miter" d="M20 8h5"\/>/, "")
      .replace(/<path[^>]*d="M22\.5 25s4\.5-7\.5[^"]*"\/>/, "")
      .replace("</g></svg>", `${HEAD}</g></svg>`);
  return svg;
}

/** The piece's body gradient swapped for the mode's colors */
function themed(name: string, theme: string, body: string[]): string | null {
  const key = `${theme}:${name}`;
  const cached = recolored.get(key);
  if (cached) return cached;
  const svg = artwork.get(name);
  if (!svg) return null;
  const drawn = theme === "trenches" ? soldierly(name, svg) : svg;
  const url = `data:image/svg+xml,${encodeURIComponent(recolor(drawn, body))}`;
  recolored.set(key, url);
  return url;
}

/**
 * Classic pieces while the game poses as a plain chess site, party pieces
 * once cursed, in the colors of whichever mode is on
 */
export function pieceImage(piece: Piece): string {
  const { cursed, currentModeIndex } = useGameStore.getState();
  const name = `${piece.color}${piece.type.toUpperCase()}`;
  if (!cursed) return `${import.meta.env.BASE_URL}pieces/${name}.svg`;
  const theme = GAME_MODES[currentModeIndex]?.theme;
  const palette = theme ? PIECE_PALETTES[theme] : undefined;
  const body = palette?.[piece.color === Color.White ? "light" : "dark"];
  return (body && themed(name, theme!, body)) || `${PARTY}${name}.svg`;
}

/** A party piece in the colors a mode gives it, named as in the artwork's files: wN, bQ */
export function themedPieceImage(name: string, theme: ThemeId): string {
  const body = PIECE_PALETTES[theme]?.[name.startsWith("w") ? "light" : "dark"];
  return (body && themed(name, theme, body)) || `${PARTY}${name}.svg`;
}

/** The sickly green the undead turn, whatever army they came from, palest where the light falls */
const ZOMBIE_BODY = ["#d4e6a5", "#93b062", "#4d6233"];

/**
 * Decay painted into a zombie's flesh, filling the body only: soft rot
 * blotches, dark veins, a stitched scar, a torn patch down to the bone, a
 * rotted-through hole, and grime caked on the base. The features sit where
 * every piece has body, in the artwork's 45 unit square.
 */
const ROT_FILL =
  `<filter id="rot" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.12" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 0.2 0 0 0 0 0.26 0 0 0 0 0.09 -3.5 0 0 0 1.6"/></filter>` +
  `<linearGradient id="grime" gradientUnits="userSpaceOnUse" x1="0" y1="30" x2="0" y2="42"><stop offset="0" stop-color="#1a2208" stop-opacity="0"/><stop offset="1" stop-color="#1a2208" stop-opacity="0.65"/></linearGradient>` +
  `<pattern id="rotten" patternUnits="userSpaceOnUse" width="45" height="45">` +
  `<rect width="45" height="45" fill="url(#body)"/>` +
  `<rect width="45" height="45" filter="url(#rot)" opacity="0.75"/>` +
  `<rect width="45" height="45" fill="url(#grime)"/>` +
  `<path d="M11 19 q3 2 5 1 t5 3 M16 20 q1 3 3 4 M31 13 q-2 3 -1 6 t-3 4 M30 18 q2 1 3 3 M14 36 q2 -2 4 -1" fill="none" stroke="#5b2d55" stroke-width="0.55" stroke-linecap="round" opacity="0.75"/>` +
  `<path d="M12 31.5 L33 25.5" stroke="#4a1418" stroke-width="1.2" stroke-linecap="round"/>` +
  `<path d="M14.6 29.6 l0.9 2.6 M18.3 28.6 l0.9 2.6 M22 27.5 l0.9 2.6 M25.7 26.5 l0.9 2.6 M29.4 25.4 l0.9 2.6" stroke="#efe4c4" stroke-width="0.6" stroke-linecap="round"/>` +
  `<path d="M24.3 34 l2.4 -1.6 l3.2 0.4 l1.6 1.6 l-0.8 2.2 l-3.4 0.8 l-2.6 -1.2 Z" fill="#3a0d10" stroke="#a8875e" stroke-width="0.5" stroke-linejoin="round"/>` +
  `<path d="M25.6 36 l4.4 -2.6" stroke="#efe6cc" stroke-width="0.9" stroke-linecap="round"/>` +
  `<circle cx="18" cy="16" r="1.3" fill="#1d1206" stroke="#8a7a3a" stroke-width="0.5"/>` +
  `</pattern>` +
  // Warps the whole piece a touch, so its outline sags and runs like it is rotting away
  `<filter id="decay" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.3" numOctaves="2" seed="7" result="warp"/><feDisplacementMap in="SourceGraphic" in2="warp" scale="1.2" xChannelSelector="R" yChannelSelector="G"/></filter>`;

const rotted = new Map<string, string>();

/** A piece as a zombie: the light army's artwork gone green and rotten through */
export function zombieImage(type: Piece["type"]): string {
  const name = `w${type.toUpperCase()}`;
  const cached = rotted.get(name);
  if (cached) return cached;
  const svg = artwork.get(name);
  if (!svg) return `${PARTY}${name}.svg`;
  const rotten = recolor(svg, ZOMBIE_BODY)
    .replace(/fill="url\(#body\)"/g, 'fill="url(#rotten)"')
    .replace("</defs>", `${ROT_FILL}</defs>`)
    .replace(/stroke="#1b1033"/g, 'stroke="#1b2a0e"')
    .replace(
      /<\/defs>([\s\S]*)<\/svg>\s*$/,
      '</defs><g filter="url(#decay)">$1</g></svg>',
    );
  const url = `data:image/svg+xml,${encodeURIComponent(rotten)}`;
  rotted.set(name, url);
  return url;
}
