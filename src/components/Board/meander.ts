/** How a river winds: straight in the middle, easing into a sum of sine waves further out */
export interface Meander {
  worldWidth: number;
  /** Half the width of the straight stretch in the middle */
  straightHalf: number;
  /** How far beyond the straight stretch the bends take to reach full size */
  ramp: number;
  /** Amplitude, wavelength over 2π, and phase of each wave */
  waves: [number, number, number][];
}

/** How far the river bends up or down at world position `x` */
export function meanderAt(m: Meander, x: number): number {
  const away = Math.abs(x - m.worldWidth / 2) - m.straightHalf;
  if (away <= 0) return 0;
  const t = Math.min(1, away / m.ramp);
  const ease = t * t * (3 - 2 * t);
  return (
    ease *
    m.waves.reduce(
      (sum, [amp, length, phase]) => sum + amp * Math.sin(x / length + phase),
      0,
    )
  );
}

const glsl = (n: number) => (Number.isInteger(n) ? `${n}.0` : `${n}`);

/** The same bend as `meanderAt`, written in GLSL, as a share of the canvas height */
export function bendSource(bends?: { meander: Meander; worldHeight: number }) {
  if (!bends) return "float riverBend(float u) { return 0.0; }";
  const m = bends.meander;
  const waves = m.waves
    .map(
      ([amp, length, phase]) =>
        `${glsl(amp)} * sin(x / ${glsl(length)} + ${glsl(phase)})`,
    )
    .join(" + ");
  return `
float riverBend(float u) {
  float x = u * ${glsl(m.worldWidth)};
  float away = abs(x - ${glsl(m.worldWidth / 2)}) - ${glsl(m.straightHalf)};
  if (away <= 0.0) return 0.0;
  float t = min(1.0, away / ${glsl(m.ramp)});
  return t * t * (3.0 - 2.0 * t) * (${waves}) / ${glsl(bends.worldHeight)};
}`;
}
