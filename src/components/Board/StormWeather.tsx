import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import type { ThunderstormPlugin } from "../../plugins/thunderstorm";
import { sfx } from "../../audio/sfx";
import "../Trenches/Trenches.css";
import "./Thunderstorm.css";

/** Rain over the whole window in Thunderstorm, with the sky lit white by each bolt and the thunder right after */
export function StormWeather() {
  const strike = useGameStore((s) => s.stormStrike);
  const [first] = useState(strike);

  useEffect(() => {
    sfx.rain(true);
    return () => sfx.rain(false);
  }, []);

  useEffect(() => {
    if (strike === first) return;
    const bolt = useGameStore
      .getState()
      .pluginManager.find<ThunderstormPlugin>("thunderstorm")
      ?.lastStrike();
    sfx.thunder(true);
    if (bolt?.killed) sfx.capture();
  }, [strike, first]);

  return (
    <div className="storm-weather" aria-hidden>
      <div className="rain rain-far" />
      <div className="rain rain-near" />
      {strike !== first && <div key={strike} className="storm-flash" />}
    </div>
  );
}
