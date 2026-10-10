import { GAME_MODES } from "../stores/gameStore";
import type { ThemeId } from "../theme/themes";

/** The modes that can be played with a friend so far */
const ONLINE_MODES: ThemeId[] = [
  "portals",
  "fog",
  "fifa",
  "tug",
  "mines",
  "royale",
  "hill",
  "gravity",
  "hex",
  "lanterns",
  "zombies",
  "stratego",
];

/** Whether a mode is one of those a friend can be played at */
function playableOnline(theme: ThemeId): boolean {
  return ONLINE_MODES.includes(theme);
}

/** The modes on offer to play online, as indexes into the list of every mode */
export function onlineModeIndexes(): number[] {
  return GAME_MODES.flatMap((mode, i) =>
    !mode.beta && playableOnline(mode.theme) ? [i] : [],
  );
}
