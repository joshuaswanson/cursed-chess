/** One repeat of the rope, 16 units wide: three strand turns packed close, each bulging past the core */
const WIDTH = 16;
const PITCH = 9;
const TILE = PITCH * 3;
/** How far each strand leans off straight across the rope: steep, so it runs long along the rope's length */
export const STRAND_LEAN = 62;
/** Half a strand's length, enough to cross the rope at that lean, and its thickness */
const STRAND_HALF = 16;
const STRAND_THICK = 3.8;
const TONES = ["#c9a066", "#b88d52", "#d6b077"];

/**
 * One turn of a strand, in its own frame with the rope's width along x: a
 * wispy S that swells in the middle and tapers to a point at each edge, where
 * it tucks behind the next turn
 */
export function strandPath(halfWidth: number, thickness: number): string {
  const w = halfWidth;
  const t = thickness;
  return (
    `M${-w} 0 C${-w * 0.35} ${-t * 1.9} ${w * 0.15} ${-t * 0.2} ${w} ${-t * 0.35} ` +
    `C${w * 0.35} ${t * 1.9} ${-w * 0.15} ${t * 0.2} ${-w} 0 Z`
  );
}

/** Fibres running along a strand turn, following its S */
export function fibrePaths(halfWidth: number, thickness: number): string[] {
  const w = halfWidth;
  const t = thickness;
  return [-0.45, 0, 0.45].map(
    (k) =>
      `M${-w * 0.8} ${t * k * 0.6} C${-w * 0.3} ${t * (k - 1.1)} ${w * 0.2} ${t * (k * 0.5)} ${w * 0.8} ${t * (k * 0.6 - 0.3)}`,
  );
}

/** One turn of a strand slanting across the rope */
function lobe(y: number, tone: string): string {
  const at = `translate(${WIDTH / 2} ${y}) rotate(-${STRAND_LEAN})`;
  const [low, mid, high] = fibrePaths(STRAND_HALF, STRAND_THICK);
  return (
    `<g transform="${at}">` +
    `<path d="${strandPath(STRAND_HALF, STRAND_THICK)}" fill="${tone}" stroke="#4a2c12" stroke-width="0.8" stroke-linejoin="round"/>` +
    `<path d="${strandPath(STRAND_HALF, STRAND_THICK)}" fill="url(#hl)"/>` +
    `<path d="${low} ${high}" fill="none" stroke="#7a5228" stroke-width="0.45" stroke-opacity="0.8"/>` +
    `<path d="${mid}" fill="none" stroke="#f3dcae" stroke-width="0.55" stroke-opacity="0.85"/>` +
    `</g>`
  );
}

/**
 * A tile of twisted rope: each strand turn is drawn over the one before, so
 * the lobes overlap like woven strands and the edges come out bumpy. The
 * lobes past either end repeat into the next tile, so the rope runs on
 * without a seam.
 */
function tile(shaded = false): string {
  const rows = [-3, -2, -1, 0, 1, 2, 3, 4, 5];
  const lobes = rows
    .map((k) => lobe(k * PITCH, TONES[((k % 3) + 3) % 3]))
    .join("");
  // The rounding is laid only over the strands themselves
  const silhouette = rows
    .map(
      (k) =>
        `<path transform="translate(${WIDTH / 2} ${k * PITCH}) rotate(-${STRAND_LEAN})" d="${strandPath(STRAND_HALF, STRAND_THICK)}" fill="#fff"/>`,
    )
    .join("");
  const rounding = shaded
    ? `<mask id="strands" maskUnits="userSpaceOnUse" x="0" y="0" width="${WIDTH}" height="${TILE}">${silhouette}</mask>` +
      `<rect width="${WIDTH}" height="${TILE}" fill="url(#round)" mask="url(#strands)"/>`
    : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${TILE}" viewBox="0 0 ${WIDTH} ${TILE}">` +
    `<defs><linearGradient id="hl" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="0.3"/>` +
    `<stop offset="0.45" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="0.35"/>` +
    `</linearGradient>` +
    // Darker toward both edges, so the rope reads as round
    `<linearGradient id="round" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${WIDTH}" y2="0">` +
    `<stop offset="0" stop-color="#281608" stop-opacity="0.5"/>` +
    `<stop offset="0.3" stop-color="#281608" stop-opacity="0"/>` +
    `<stop offset="0.45" stop-color="#fff5dc" stop-opacity="0.22"/>` +
    `<stop offset="0.6" stop-color="#fff5dc" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#281608" stop-opacity="0.55"/>` +
    `</linearGradient></defs>${lobes}${rounding}</svg>`
  );
}

export const ROPE_TILE = `url("data:image/svg+xml,${encodeURIComponent(tile())}")`;
/** The rope's texture shaded round, as an image address, for laying it along a curve */
export const ROPE_TILE_SHADED_URL = `data:image/svg+xml,${encodeURIComponent(tile(true))}`;
/** The tile's height as a share of its width */
export const ROPE_TILE_RATIO = TILE / WIDTH;
