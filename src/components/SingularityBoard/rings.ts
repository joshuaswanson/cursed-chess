/**
 * Each ring's colours on the Singularity board, from the singularity out:
 * the light is redder and the dark darker the nearer the middle, as if
 * falling in. Index 0 is unused, so a ring's number is its index.
 */
export const RING_LIGHT = [
  "",
  "#a33b1a",
  "#cf6a2e",
  "#e49a52",
  "#efc27f",
  "#f4dcae",
  "#f7ecd6",
];
export const RING_DARK = [
  "",
  "#1a0605",
  "#2b0e0a",
  "#3a1a12",
  "#46261a",
  "#4f3122",
  "#573a29",
];
/** Along the files the board is squeezed to two thirds, so it is as tall as it is wide */
export const SQUEEZE = 2 / 3;
