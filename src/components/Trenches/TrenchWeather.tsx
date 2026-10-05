import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { sfx } from "../../audio/sfx";
import "./Trenches.css";

/**
 * Rain driving down over the whole front, and lightning that lights it white
 * now and then, with the thunder rolling in after
 */
export function TrenchWeather() {
  const paused = useGameStore((s) => s.paused);
  const [strike, setStrike] = useState<{ id: number; x: number } | null>(null);

  useEffect(() => {
    sfx.rain(true);
    return () => sfx.rain(false);
  }, []);

  useEffect(() => {
    if (paused) return;
    let timer = 0;
    let id = 0;
    const next = () => {
      timer = window.setTimeout(
        () => {
          const close = Math.random() < 0.35;
          setStrike({ id: ++id, x: 10 + Math.random() * 80 });
          // Sound is slower than light: the further the strike, the longer the wait
          window.setTimeout(
            () => sfx.thunder(close),
            close ? 120 : 700 + Math.random() * 1400,
          );
          next();
        },
        8000 + Math.random() * 12000,
      );
    };
    next();
    return () => clearTimeout(timer);
  }, [paused]);

  return (
    <div className="trench-weather" aria-hidden>
      <div className="rain rain-far" />
      <div className="rain rain-near" />
      {strike && (
        <div key={strike.id} className="lightning">
          <svg
            className="bolt"
            viewBox="0 0 60 300"
            style={{ left: `${strike.x}%` }}
          >
            <path d="M34 0 L22 90 L36 96 L14 190 L30 196 L8 300 L40 180 L26 174 L46 86 L32 80 L44 0 Z" />
          </svg>
        </div>
      )}
    </div>
  );
}
