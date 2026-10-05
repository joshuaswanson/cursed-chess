/** One repeat of the rope, 16 units wide: three strand turns, each bulging past the core */
const WIDTH = 16;
const PITCH = 8;
const TILE = PITCH * 3;
const TONES = ["#c9a066", "#b88d52", "#d6b077"];

/** One turn of a strand: a fat lobe slanting across the rope */
function lobe(y: number, tone: string): string {
  const at = `translate(${WIDTH / 2} ${y}) rotate(-38)`;
  return (
    `<g transform="${at}">` +
    `<ellipse rx="8.5" ry="5" fill="${tone}" stroke="#4a2c12" stroke-width="0.9"/>` +
    `<ellipse rx="8.5" ry="5" fill="url(#hl)"/>` +
    `<path d="M-6.5 -1.6 Q0 -2.6 6.5 -1.6 M-7 1.2 Q0 0.4 7 1.2" fill="none" stroke="#7a5228" stroke-width="0.45" stroke-opacity="0.75"/>` +
    `<path d="M-5 -0.3 Q0 -1.1 5 -0.3" fill="none" stroke="#f3dcae" stroke-width="0.5" stroke-opacity="0.8"/>` +
    `</g>`
  );
}

/**
 * A tile of twisted rope: each strand turn is drawn over the one before, so
 * the lobes overlap like woven strands and the edges come out bumpy. The
 * lobes past either end repeat into the next tile, so the rope runs on
 * without a seam.
 */
function tile(): string {
  const lobes = [-1, 0, 1, 2, 3]
    .map((k) => lobe(k * PITCH, TONES[((k % 3) + 3) % 3]))
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${TILE}" viewBox="0 0 ${WIDTH} ${TILE}">` +
    `<defs><linearGradient id="hl" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="0.3"/>` +
    `<stop offset="0.45" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="0.35"/>` +
    `</linearGradient></defs>${lobes}</svg>`
  );
}

export const ROPE_TILE = `url("data:image/svg+xml,${encodeURIComponent(tile())}")`;
