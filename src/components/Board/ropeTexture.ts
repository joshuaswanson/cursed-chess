/** One repeat of the rope: three strands twisting past, 20 units wide */
const WIDTH = 20;
const PITCH = 11;
const TILE = PITCH * 3;
const TONES = ["#d8b072", "#c99e5e", "#e2bd83"];

/** A strand crossing the rope on the diagonal, from its left edge at y to its right edge lower down */
function strand(y: number): string {
  const h = PITCH;
  return (
    `M-1 ${y} C6 ${y - 3} 13 ${y + 4} ${WIDTH + 1} ${y + 7} ` +
    `L${WIDTH + 1} ${y + 7 + h} C13 ${y + 4 + h} 6 ${y - 3 + h} -1 ${y + h} Z`
  );
}

/** A fibre running along a strand, `t` of the way across it */
function fibre(y: number, t: number): string {
  const o = PITCH * t;
  return `M-1 ${y + o} C6 ${y - 3 + o} 13 ${y + 4 + o} ${WIDTH + 1} ${y + 7 + o}`;
}

/**
 * A tile of three-strand twisted rope, each strand shaded across its width
 * with fibres along it and a dark groove where the strands meet
 */
function tile(): string {
  const strands = [-1, 0, 1, 2]
    .flatMap((k) =>
      [k * PITCH - TILE, k * PITCH, k * PITCH + TILE].map((y) => ({ y, k })),
    )
    .map(({ y, k }) => {
      const tone = TONES[((k % 3) + 3) % 3];
      return (
        `<path d="${strand(y)}" fill="${tone}"/>` +
        `<path d="${strand(y)}" fill="url(#s)"/>` +
        [0.3, 0.5, 0.72]
          .map(
            (t, i) =>
              `<path d="${fibre(y, t)}" fill="none" stroke="${i === 1 ? "#f3dcae" : "#a87a3f"}" stroke-width="0.6" stroke-opacity="0.8"/>`,
          )
          .join("") +
        `<path d="${fibre(y, 0)}" fill="none" stroke="#5a3a1a" stroke-width="1.4"/>`
      );
    })
    .join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${TILE}" viewBox="0 0 ${WIDTH} ${TILE}">` +
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#000" stop-opacity="0.35"/>` +
    `<stop offset="0.45" stop-color="#fff" stop-opacity="0.18"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity="0.3"/>` +
    `</linearGradient></defs>${strands}</svg>`
  );
}

export const ROPE_TILE = `url("data:image/svg+xml,${encodeURIComponent(tile())}")`;
