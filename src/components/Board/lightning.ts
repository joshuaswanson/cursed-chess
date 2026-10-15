/**
 * How strongly a bolt of lightning lights everything, 0 to 1, as time
 * passes after it strikes, in ms: a dim glow as it reaches down, a blinding
 * flash as it hits, flickers as it strikes again down the same path, and
 * the dark closing in again as it dies away. The flash over the window and
 * the lit sky follow the same timeline in their keyframes.
 */
const LIGHTNING: [ms: number, light: number][] = [
  [0, 0.3],
  [75, 1],
  [110, 0.25],
  [160, 1],
  [210, 0.35],
  [270, 0.95],
  [420, 0.7],
  [650, 0.3],
  [950, 0],
];

export function lightningAt(ms: number): number {
  const after = LIGHTNING.findIndex(([at]) => at > ms);
  if (after === -1) return 0;
  if (after === 0) return LIGHTNING[0][1];
  const [t0, v0] = LIGHTNING[after - 1];
  const [t1, v1] = LIGHTNING[after];
  return v0 + ((v1 - v0) * (ms - t0)) / (t1 - t0);
}
