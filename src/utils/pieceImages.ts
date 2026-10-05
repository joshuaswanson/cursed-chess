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

/** The piece's body gradient swapped for the mode's colors */
function themed(name: string, theme: string, body: string[]): string | null {
  const key = `${theme}:${name}`;
  const cached = recolored.get(key);
  if (cached) return cached;
  const svg = artwork.get(name);
  if (!svg) return null;
  let stop = 0;
  const painted = svg.replace(
    /(<linearGradient id="body"[\s\S]*?<\/linearGradient>)/,
    (gradient) =>
      gradient.replace(
        /stop-color="[^"]*"/g,
        () => `stop-color="${body[stop++] ?? body[2]}"`,
      ),
  );
  const url = `data:image/svg+xml,${encodeURIComponent(painted)}`;
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
