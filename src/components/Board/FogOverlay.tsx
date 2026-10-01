const ENEMY_LAYERS = 12;
const STATIC_LAYERS = [13, 14, 15, 16, 17];
const FRIENDLY_LAYERS = [1, 3, 5, 8];

/** Thick fog over the enemy half and a thin haze over the player's half */
export function FogOverlay({
  enemyOnTop,
  exiting,
}: {
  enemyOnTop: boolean;
  exiting: boolean;
}) {
  const exitClass = exiting ? " fog-exit" : "";
  return (
    <>
      <div
        className={`fog-overlay ${enemyOnTop ? "fog-top" : "fog-bottom"}${exitClass}`}
      >
        {Array.from({ length: ENEMY_LAYERS }, (_, i) => (
          <div key={i} className={`fog-layer fog-layer-${i + 1}`} />
        ))}
        {STATIC_LAYERS.map((n) => (
          <div key={n} className={`fog-layer-static fog-layer-${n}`} />
        ))}
      </div>
      <div
        className={`fog-overlay fog-friendly ${enemyOnTop ? "fog-bottom" : "fog-top"}${exitClass}`}
      >
        {FRIENDLY_LAYERS.map((n) => (
          <div key={n} className={`fog-layer fog-layer-${n}`} />
        ))}
      </div>
    </>
  );
}
