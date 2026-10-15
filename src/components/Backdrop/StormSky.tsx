import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { sfx } from "../../audio/sfx";
import "./StormSky.css";

/** The shortest and longest wait between flickers of far-off lightning */
const SHEET_GAP_MS: [number, number] = [3500, 8000];

/**
 * The night sky, black until a bolt lights it and shows the storm clouds
 * against it, with far-off lightning flickering now and then and its
 * thunder rumbling in a while later
 */
export function StormSky() {
  const strike = useGameStore((s) => s.stormStrike);
  const paused = useGameStore((s) => s.paused);
  const [first] = useState(strike);
  const [sheet, setSheet] = useState<{ id: number; x: number } | null>(null);

  useEffect(() => {
    if (paused) return;
    let timer = 0;
    let rumble = 0;
    let id = 0;
    const next = () => {
      const [shortest, longest] = SHEET_GAP_MS;
      timer = window.setTimeout(
        () => {
          setSheet({ id: ++id, x: 10 + Math.random() * 80 });
          // Sound is slower than light: far off, the thunder comes seconds later
          rumble = window.setTimeout(
            () => sfx.thunder(false),
            1200 + Math.random() * 1800,
          );
          next();
        },
        shortest + Math.random() * (longest - shortest),
      );
    };
    next();
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(rumble);
    };
  }, [paused]);

  return (
    <>
      {sheet && (
        <div
          key={sheet.id}
          className="storm-sheet"
          style={{ "--x": `${sheet.x}%` } as React.CSSProperties}
        />
      )}
      {strike !== first && (
        <div key={strike} className="storm-sky-lit">
          <div className="storm-clouds storm-clouds-far" />
          <div className="storm-clouds storm-clouds-near" />
        </div>
      )}
    </>
  );
}
