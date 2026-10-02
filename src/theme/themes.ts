export type ThemeId =
  | "opening"
  | "portals"
  | "fog"
  | "royale"
  | "clash"
  | "mines"
  | "hill"
  | "gravity"
  | "hex"
  | "stratego";

/** Which animated scene sits behind the board */
export type BackdropKind = ThemeId;

export interface ModeTheme {
  id: ThemeId;
  title: string;
  tagline: string;
  /** Three stops of the sky behind everything, top to bottom */
  sky: [string, string, string];
  /** Main highlight color for this channel */
  accent: string;
  /** Second color that plays against the accent */
  accent2: string;
  /** Ink used for outlines and hard shadows */
  ink: string;
  /** Board bezel color */
  frame: string;
  light: string;
  dark: string;
  /** Text color on top of the sky */
  text: string;
}

export const THEMES: Record<ThemeId, ModeTheme> = {
  opening: {
    id: "opening",
    title: "Chess",
    tagline: "Play chess online against the computer.",
    sky: ["#f2f2f2", "#f2f2f2", "#f2f2f2"],
    accent: "#81b64c",
    accent2: "#5d9948",
    ink: "#312e2b",
    frame: "#312e2b",
    light: "#eeeed2",
    dark: "#769656",
    text: "#312e2b",
  },
  portals: {
    id: "portals",
    title: "Portals",
    tagline: "Step into one, burst out of the other.",
    sky: ["#05031c", "#1b0b4f", "#4a1170"],
    accent: "#ff8a1a",
    accent2: "#2f9bff",
    ink: "#070320",
    frame: "#14104a",
    light: "#d9dcff",
    dark: "#6658d6",
    text: "#e8e9ff",
  },
  fog: {
    id: "fog",
    title: "Fog of war",
    tagline: "Their half is lost in the mist. Trust your gut.",
    sky: ["#0d1720", "#253842", "#51666a"],
    accent: "#bfe8de",
    accent2: "#f2d27a",
    ink: "#081016",
    frame: "#24343a",
    light: "#d4dfdb",
    dark: "#6d8580",
    text: "#e6f2ef",
  },
  royale: {
    id: "royale",
    title: "Battle royale",
    tagline: "The edge is crumbling. Get to the middle.",
    sky: ["#140303", "#5c0d06", "#d9480f"],
    accent: "#ff7a1a",
    accent2: "#ffd23f",
    ink: "#1a0503",
    frame: "#2e0f0a",
    light: "#f6d5ae",
    dark: "#b4583a",
    text: "#fff0e0",
  },
  clash: {
    id: "clash",
    title: "Clash royale",
    tagline: "Pieces fight on their own. Drag in backup.",
    sky: ["#0c2a6b", "#2c55c9", "#e2304a"],
    accent: "#ffd23f",
    accent2: "#e2304a",
    ink: "#0b1430",
    frame: "#6b3f1d",
    light: "#e9f3c8",
    dark: "#7fb257",
    text: "#fffaf0",
  },
  mines: {
    id: "mines",
    title: "Minefield",
    tagline: "Ten mines are buried. Read the warnings.",
    sky: ["#1b2210", "#3c4a1f", "#6d7a33"],
    accent: "#ffcc00",
    accent2: "#ff4f2e",
    ink: "#141808",
    frame: "#2d3314",
    light: "#ece4b9",
    dark: "#8c9148",
    text: "#f8f4d8",
  },
  hill: {
    id: "hill",
    title: "King of the hill",
    tagline: "Hold three of the four center squares for three rounds.",
    sky: ["#ff9a1f", "#ffcf3f", "#fff2a8"],
    accent: "#c4320a",
    accent2: "#7a3cff",
    ink: "#3d1a00",
    frame: "#8a4b00",
    light: "#fff3bf",
    dark: "#e3a33c",
    text: "#3d1a00",
  },
  gravity: {
    id: "gravity",
    title: "Gravity",
    tagline: "Everything falls. The board keeps turning.",
    sky: ["#12052e", "#3d1494", "#00b3a7"],
    accent: "#3ee6b0",
    accent2: "#ff4fa3",
    ink: "#0e0326",
    frame: "#2b1263",
    light: "#ecdfff",
    dark: "#8e5cf0",
    text: "#f3ecff",
  },
  hex: {
    id: "hex",
    title: "Hex chess",
    tagline: "Same armies, six directions.",
    sky: ["#0d0221", "#4a0a77", "#ff2e88"],
    accent: "#ff2e88",
    accent2: "#21e6ff",
    ink: "#0d0221",
    frame: "#2a0845",
    light: "#ffd1f0",
    dark: "#a04ad6",
    text: "#ffe8fb",
  },
  stratego: {
    id: "stratego",
    title: "Stratego",
    tagline: "Their pieces stay masked until they strike.",
    sky: ["#04404f", "#0a8fa3", "#7fe0d0"],
    accent: "#ffd23f",
    accent2: "#ff6a4d",
    ink: "#032a33",
    frame: "#0b5f6b",
    light: "#f8e8c4",
    dark: "#d4a868",
    text: "#f2fffb",
  },
};

/** CSS custom properties that skin the whole app for a channel */
export function themeVars(theme: ModeTheme): React.CSSProperties {
  return {
    "--sky-1": theme.sky[0],
    "--sky-2": theme.sky[1],
    "--sky-3": theme.sky[2],
    "--accent": theme.accent,
    "--accent-2": theme.accent2,
    "--ink": theme.ink,
    "--frame": theme.frame,
    "--tile-light": theme.light,
    "--tile-dark": theme.dark,
    "--sky-text": theme.text,
  } as React.CSSProperties;
}
