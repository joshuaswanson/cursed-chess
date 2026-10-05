import type { ThemeId } from "./themes";

/** Top, middle, and bottom of a piece's body, lit from above */
type Body = [string, string, string];

/**
 * Each mode's two armies: your pieces and the foe's, in colors that belong to
 * the mode. The pieces keep their own ink outlines and gold trim.
 */
export const PIECE_PALETTES: Partial<
  Record<ThemeId, { light: Body; dark: Body }>
> = {
  portals: {
    light: ["#f4fbff", "#bfe6ff", "#5fb0ff"],
    dark: ["#ffb26b", "#e0621a", "#5c1a04"],
  },
  fog: {
    light: ["#f7fbfa", "#d6e4e1", "#9fb7b2"],
    dark: ["#7d97a0", "#33474f", "#101a1e"],
  },
  fifa: {
    light: ["#fffdf6", "#ffe7c2", "#f0b977"],
    dark: ["#8a62db", "#3d1f7c", "#170936"],
  },
  tug: {
    light: ["#eef4ff", "#9bbcff", "#2f5fd0"],
    dark: ["#ffa092", "#de3a2b", "#6a1309"],
  },
  royale: {
    light: ["#fff4d6", "#ffc46b", "#d96a1f"],
    dark: ["#6a6260", "#2c2624", "#0c0908"],
  },
  clash: {
    light: ["#e8f1ff", "#8fb4ff", "#2a5fe0"],
    dark: ["#ffb8bd", "#e2304a", "#650a1a"],
  },
  mines: {
    light: ["#ffffff", "#ece6c4", "#a89c58"],
    dark: ["#7d8b45", "#3a461d", "#121807"],
  },
  hill: {
    light: ["#ffffff", "#fff3c4", "#d99a1c"],
    dark: ["#b4693a", "#62300f", "#220b02"],
  },
  gravity: {
    light: ["#effff9", "#a3f0d4", "#2fc49a"],
    dark: ["#bba3ff", "#5e33d8", "#1c0a58"],
  },
  hex: {
    light: ["#eafdff", "#7ff1ff", "#16a8c8"],
    dark: ["#ffa2da", "#e0219c", "#47053a"],
  },
  zombies: {
    light: ["#fbf6e6", "#ddd2b0", "#9e9170"],
    dark: ["#9a7fb8", "#4d3570", "#1a0f2a"],
  },
  // Muddied khaki against field grey
  trenches: {
    light: ["#e2d6ac", "#a8955e", "#4f4528"],
    dark: ["#a7afb1", "#5c676b", "#22292c"],
  },
  stratego: {
    light: ["#e9f0ff", "#86a6e2", "#2b569c"],
    dark: ["#ffb4ab", "#d1352e", "#560e0a"],
  },
};
