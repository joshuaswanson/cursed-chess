import type { CSSProperties } from "react";
import { GAME_MODES } from "../../stores/gameStore";
import { THEMES } from "../../theme/themes";

/** Each story mode's sky, as it flickers through the dark behind the final battle */
const SKIES = GAME_MODES.filter((m) => !m.singleOnly && !m.finale).map(
  (m) => THEMES[m.theme].sky,
);
const BANDS = 9;

/** The dark behind the final battle, torn by strips of the sky of every mode he has played */
export function Corrupted() {
  return (
    <div className="corrupted">
      {Array.from({ length: BANDS }, (_, i) => {
        const sky = SKIES[(i * 5) % SKIES.length];
        return (
          <span
            key={i}
            className="corrupted-band"
            style={
              {
                top: `${(i / BANDS) * 100 + ((i * 37) % 5)}%`,
                height: `${4 + ((i * 13) % 9)}%`,
                background: `linear-gradient(90deg, ${sky[0]}, ${sky[1]}, ${sky[2]})`,
                animationDelay: `${-((i * 0.73) % 4.1)}s`,
                animationDuration: `${3.2 + ((i * 0.9) % 2.6)}s`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
