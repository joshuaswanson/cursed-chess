/** A rectangle on screen, in pixels */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** The middle of a box */
export const centre = (box: Box) => ({
  x: box.left + box.width / 2,
  y: box.top + box.height / 2,
});
