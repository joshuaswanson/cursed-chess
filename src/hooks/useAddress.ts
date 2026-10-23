import { useEffect } from "react";
import { GAME_MODES, useGameStore } from "../stores/gameStore";
import type { GameStore } from "../stores/gameStore";

const MENU = "menu";

/** A mode's name as it reads in the address: King of the Hill is king-of-the-hill */
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Where the game is, as the part of the address after the #: the menu, a
 * mode played on its own, or nothing for Story Mode. Online games are left
 * out of the address, as a link cannot bring a friend back with them.
 */
function placeOf(s: GameStore): string | null {
  if (s.net) return null;
  if (s.menuOpen) return MENU;
  if (s.playMode === "single" && s.currentModeIndex >= 0) {
    return slug(GAME_MODES[s.currentModeIndex].name);
  }
  return "";
}

/** Takes the game to the place the address names, if it is not there already */
function goTo(place: string): void {
  const s = useGameStore.getState();
  const here = placeOf(s);
  if (here === null || here === place) return;
  const index = GAME_MODES.findIndex(
    (mode) => !mode.finale && slug(mode.name) === place,
  );
  if (place === MENU || index >= 0) s.openMenu();
  if (index >= 0) s.startSingle(index);
  if (place === "") s.startAdventure();
}

const placeInAddress = () => decodeURIComponent(location.hash.slice(1));

/** Keeps the address in step with the menu and the mode being played, so either can be linked to */
export function useAddress(): void {
  useEffect(() => {
    goTo(placeInAddress());
    const follow = () => goTo(placeInAddress());
    window.addEventListener("hashchange", follow);
    // Once the store has settled, so a change made in several steps adds one entry
    let settling = false;
    const record = () => {
      settling = false;
      const place = placeOf(useGameStore.getState());
      if (place === null || place === placeInAddress()) return;
      history.pushState(
        null,
        "",
        place ? `#${place}` : location.pathname + location.search,
      );
    };
    const stopWatching = useGameStore.subscribe(() => {
      if (settling) return;
      settling = true;
      queueMicrotask(record);
    });
    return () => {
      window.removeEventListener("hashchange", follow);
      stopWatching();
    };
  }, []);
}
