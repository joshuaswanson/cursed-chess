/**
 * Mud: fractal noise lit from one side so it reads as clods, ruts, and
 * footprints, tinted wet brown, with standing water pooled in the low spots
 * and pale grit scattered through it. Drawn once as a tile that repeats.
 */
const MUD_TILE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="420">` +
    `<filter id="m" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="5" seed="4" stitchTiles="stitch" result="n"/>` +
    `<feDiffuseLighting in="n" surfaceScale="4" diffuseConstant="1.1" lighting-color="#fff" result="lit"><feDistantLight azimuth="235" elevation="38"/></feDiffuseLighting>` +
    `<feFlood flood-color="#5c4a35" result="base"/>` +
    `<feComposite in="lit" in2="base" operator="arithmetic" k1="1.05" k2="0" k3="0.12" k4="0" result="mud"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed="11" stitchTiles="stitch" result="p"/>` +
    `<feColorMatrix in="p" type="matrix" values="0 0 0 0 0.34  0 0 0 0 0.34  0 0 0 0 0.31  26 0 0 0 -16.1" result="pools"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.011" numOctaves="3" seed="11" stitchTiles="stitch" result="p2"/>` +
    `<feColorMatrix in="p2" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.38  0 0 0 0 0.3  26 0 0 0 -15.6" result="rims"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="1" seed="2" stitchTiles="stitch" result="g"/>` +
    `<feColorMatrix in="g" type="matrix" values="0 0 0 0 0.68  0 0 0 0 0.6  0 0 0 0 0.48  0 0 0 9 -8.1" result="grit"/>` +
    `<feMerge><feMergeNode in="mud"/><feMergeNode in="rims"/><feMergeNode in="pools"/><feMergeNode in="grit"/></feMerge>` +
    `</filter><rect width="420" height="420" filter="url(#m)"/></svg>`,
)}")`;

/** Trenches' backdrop: a field of mud under a dark sky's light, the board one stretch of it */
export function MudField() {
  return (
    <div className="mud-field" style={{ backgroundImage: MUD_TILE }}>
      <div className="mud-gloom" />
      <div className="mud-smoke mud-smoke-a" />
      <div className="mud-smoke mud-smoke-b" />
    </div>
  );
}
