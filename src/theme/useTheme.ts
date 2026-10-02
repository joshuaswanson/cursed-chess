import { useGameStore, GAME_MODES } from "../stores/gameStore";
import { THEMES } from "./themes";
import type { ModeTheme } from "./themes";

/** The look of the channel currently on air */
export function useTheme(): ModeTheme {
  const modeIndex = useGameStore((s) => s.currentModeIndex);
  const cursed = useGameStore((s) => s.cursed);
  if (!cursed) return THEMES.opening;
  // Between the curse breaking through and the first mode starting
  if (modeIndex < 0) return THEMES[GAME_MODES[0].theme];
  return THEMES[GAME_MODES[modeIndex].theme];
}
