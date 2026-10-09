import { useGameStore } from "../../stores/gameStore";
import type { HeistPlugin } from "../../plugins/heist";
import "./Museum.css";

/** The pictures on the gallery wall: where each hangs across it, how big, and what is in the frame */
const PICTURES = [
  { left: 4, top: 16, width: 9, height: 22, art: "portrait" },
  { left: 15, top: 24, width: 7, height: 12, art: "landscape" },
  { left: 79, top: 14, width: 8, height: 14, art: "landscape" },
  { left: 89, top: 20, width: 8, height: 24, art: "portrait" },
];

/**
 * Heist's backdrop: a gallery after closing. Pictures in gilt frames on a
 * dark wall, columns either side, velvet ropes along the floor, and
 * searchlight beams swinging down from the ceiling. With the jewel off its
 * plinth the alarm lamps come on and the beams turn red.
 */
export function Museum() {
  const alarm = useGameStore(
    (s) => s.pluginManager.find<HeistPlugin>("heist")?.alarm ?? false,
  );
  return (
    <div className={`museum${alarm ? " is-alarmed" : ""}`} aria-hidden>
      <div className="museum-wall" />
      {PICTURES.map((picture, i) => (
        <span
          key={i}
          className={`museum-picture is-${picture.art}`}
          style={{
            left: `${picture.left}%`,
            top: `${picture.top}%`,
            width: `${picture.width}%`,
            height: `${picture.height}%`,
          }}
        />
      ))}
      <span className="museum-column museum-column-left" />
      <span className="museum-column museum-column-right" />
      <span className="museum-beam museum-beam-a" />
      <span className="museum-beam museum-beam-b" />
      <span className="museum-beam museum-beam-c" />
      <div className="museum-floor" />
      <div className="museum-rope" />
      <span className="museum-lamp museum-lamp-left" />
      <span className="museum-lamp museum-lamp-right" />
    </div>
  );
}
