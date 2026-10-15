import "./Conveyor.css";

/** The belts' rollers and rails */
export function BeltRails() {
  return (
    <svg className="belt-rails" viewBox="0 0 800 800" aria-hidden>
      {[100, 200, 300].map((inset) => (
        <g key={inset}>
          <rect
            className="belt-rail"
            x={inset}
            y={inset}
            width={800 - inset * 2}
            height={800 - inset * 2}
          />
          <rect
            className="belt-rail-stripes"
            x={inset}
            y={inset}
            width={800 - inset * 2}
            height={800 - inset * 2}
          />
        </g>
      ))}
    </svg>
  );
}
