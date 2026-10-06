const surfaces = new WeakMap<HTMLCanvasElement, OffscreenCanvas>();

/**
 * A canvas's drawing surface, handed over to the compositor: what is drawn
 * on it reaches the screen without the page around it having to repaint,
 * which on a busy page costs far more than the drawing itself. A canvas can
 * only be handed over once, so its surface is kept for it.
 */
export function surfaceOf(canvas: HTMLCanvasElement): OffscreenCanvas {
  let surface = surfaces.get(canvas);
  if (!surface) {
    surface = canvas.transferControlToOffscreen();
    surfaces.set(canvas, surface);
  }
  return surface;
}
