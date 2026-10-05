import { Color } from "../engine";
import type { Piece } from "../engine";
import { useGameStore, GAME_MODES } from "../stores/gameStore";
import { PIECE_PALETTES } from "../theme/piecePalettes";

const PARTY = `${import.meta.env.BASE_URL}pieces/party/`;
const KINDS = ["P", "N", "B", "R", "Q", "K"];

/** The party pieces' artwork, loaded once so each mode can recolor it on the spot */
const artwork = new Map<string, string>();
for (const color of ["w", "b"]) {
  for (const kind of KINDS) {
    const name = `${color}${kind}`;
    fetch(`${PARTY}${name}.svg`)
      .then((r) => r.text())
      .then((svg) => artwork.set(name, svg))
      .catch(() => {});
  }
}

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

/** The piece's body gradient swapped for the mode's colors */
function themed(name: string, theme: string, body: string[]): string | null {
  const key = `${theme}:${name}`;
  const cached = recolored.get(key);
  if (cached) return cached;
  const svg = artwork.get(name);
  if (!svg) return null;
  const url = `data:image/svg+xml,${encodeURIComponent(recolor(svg, body))}`;
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

/** The rotting grey green the undead turn, whatever army they came from */
const ZOMBIE_BODY = ["#b8c393", "#6c784a", "#262d16"];

/**
 * Decay painted into a zombie's flesh: dark rot and purple bruising spread
 * through it, pale mould specks, weeping sores, and grime caked on the base.
 * It fills the body only, so the piece's outline stays crisp.
 */
const ROT_FILL = `<filter id="rot" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.16" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 0.16 0 0 0 0 0.14 0 0 0 0 0.05 -4 0 0 0 1.8"/></filter><filter id="bruise" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.1" numOctaves="2" seed="9"/><feColorMatrix values="0 0 0 0 0.33 0 0 0 0 0.12 0 0 0 0 0.27 0 -5 0 0 1.95"/></filter><filter id="mould" x="0" y="0" width="1" height="1"><feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves="1" seed="2"/><feColorMatrix values="0 0 0 0 0.8 0 0 0 0 0.84 0 0 0 0 0.55 0 0 5 0 -2.9"/></filter><linearGradient id="grime" gradientUnits="userSpaceOnUse" x1="0" y1="28" x2="0" y2="42"><stop offset="0" stop-color="#141808" stop-opacity="0"/><stop offset="1" stop-color="#141808" stop-opacity="0.6"/></linearGradient><pattern id="rotten" patternUnits="userSpaceOnUse" width="45" height="45"><rect width="45" height="45" fill="url(#body)"/><rect width="45" height="45" filter="url(#rot)"/><rect width="45" height="45" filter="url(#bruise)"/><rect width="45" height="45" filter="url(#mould)"/><rect width="45" height="45" fill="url(#grime)"/><g fill="#3a0e10" stroke="#b9a070" stroke-width="0.5"><ellipse cx="18.5" cy="30" rx="1.7" ry="1.3"/><ellipse cx="27" cy="22" rx="1.2" ry="1.5"/><ellipse cx="25" cy="35" rx="1.4" ry="1"/><ellipse cx="21" cy="15" rx="0.9" ry="1.1"/></g></pattern>`;

const rotted = new Map<string, string>();

/** A piece as a zombie: the light army's artwork gone grey green and rotten through */
export function zombieImage(type: Piece["type"]): string {
  const name = `w${type.toUpperCase()}`;
  const cached = rotted.get(name);
  if (cached) return cached;
  const svg = artwork.get(name);
  if (!svg) return `${PARTY}${name}.svg`;
  const rotten = recolor(svg, ZOMBIE_BODY)
    .replace("</defs>", `${ROT_FILL}</defs>`)
    .replace(/fill="url\(#body\)"/g, 'fill="url(#rotten)"')
    .replace(/stroke="#1b1033"/g, 'stroke="#141c0a"');
  const url = `data:image/svg+xml,${encodeURIComponent(rotten)}`;
  rotted.set(name, url);
  return url;
}
