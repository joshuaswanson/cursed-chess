export type ThemeId =
  | "opening"
  | "portals"
  | "fog"
  | "royale"
  | "clash"
  | "mines"
  | "hill"
  | "gravity"
  | "fifa"
  | "hex"
  | "stratego"
  | "tug"
  | "zombies";

/** Which animated scene sits behind the board */
export type BackdropKind = ThemeId;

export interface ModeTheme {
  id: ThemeId;
  title: string;
  tagline: string;
  /** The short shout that follows the title on the mode's card */
  catchphrase: string;
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
    catchphrase: "Good luck.",
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
    catchphrase: "Let's get this party started!",
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
    catchphrase: "The enemy hides in the fog!",
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
    catchphrase: "Stay away from the edges!",
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
    catchphrase: "Drag and drop to deploy!",
    sky: ["#0c2a6b", "#2c55c9", "#e2304a"],
    accent: "#ffd23f",
    accent2: "#e2304a",
    ink: "#0b1430",
    frame: "#6b3f1d",
    light: "#e9f3c8",
    dark: "#7fb257",
    text: "#fffaf0",
  },
  fifa: {
    id: "fifa",
    title: "FIFA",
    tagline:
      "Click your ball carrier, then a teammate to pass or the goal to shoot. Take the carrier to steal the ball.",
    catchphrase: "Play ball!",
    sky: ["#030a12", "#0b2a1c", "#1d6b35"],
    accent: "#c8ff3d",
    accent2: "#18d4ff",
    ink: "#03140a",
    frame: "#0f1d16",
    light: "#74c95a",
    dark: "#5fb247",
    text: "#f2fff0",
  },
  mines: {
    id: "mines",
    title: "Minefield",
    tagline: "Ten mines are buried. Read the warnings.",
    catchphrase: "Watch your step!",
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
    tagline:
      "Have more pieces on the center than the foe to control it. Hold it three turns in a row to win.",
    catchphrase: "Control the center!",
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
    catchphrase: "The board never stops turning!",
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
    catchphrase: "Chess on hexagons!",
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
    tagline:
      "Their pieces stay masked until they strike. Cross at the bridges.",
    catchphrase: "Enemy pieces are hidden!",
    sky: ["#1c140b", "#3d2c18", "#6b5232"],
    accent: "#d6342f",
    accent2: "#2f5fa8",
    ink: "#1f150a",
    frame: "#5b3a1c",
    light: "#d9cf96",
    dark: "#8f9150",
    text: "#f4ead0",
  },
  tug: {
    id: "tug",
    title: "Tug of War",
    tagline:
      "Pieces on the two middle files grab the rope. Out-muscle them and haul the flag three squares your way.",
    catchphrase: "Heave ho!",
    sky: ["#3f7f2a", "#5fae3a", "#6dbb44"],
    accent: "#f2c14e",
    accent2: "#5fae3a",
    ink: "#2a1a10",
    frame: "#8a5a2b",
    light: "#e8cf9a",
    dark: "#c99e62",
    text: "#2a1a10",
  },
  zombies: {
    id: "zombies",
    title: "Zombies",
    tagline:
      "Captured pieces rise from their graves and bite the way they used to capture. Get your king cornered by the undead and you lose.",
    catchphrase: "Beware the undead!",
    sky: ["#07060f", "#1a1530", "#27402a"],
    accent: "#8fe04a",
    accent2: "#9b6bd6",
    ink: "#0c0a12",
    frame: "#3b3a33",
    light: "#8e8a72",
    dark: "#5b5a48",
    text: "#e8f2d8",
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
