import { BELTS, beltDirection } from "../../plugins/conveyor";
import "./Conveyor.css";

/** The belts' rollers and rails, with arrows showing which way each one runs */
export function BeltRails({ run }: { run: number }) {
  const arrows = Array.from({ length: BELTS }, (_, belt) => {
    const lo = belt * 100 + 50;
    const hi = 800 - lo;
    const mid = 400;
    // Clockwise is up the left, along the top, down the right, back along the bottom
    const spots: [number, number, number][] = [
      [lo, mid, -90],
      [mid, lo, 0],
      [hi, mid, 90],
      [mid, hi, 180],
    ];
    const turn = beltDirection(belt) > 0 ? 0 : 180;
    return spots.map(([x, y, angle], i) => (
      <path
        key={`${belt}-${i}`}
        className={`belt-arrow belt-arrow-${belt}`}
        d="M-9 -12 L5 0 L-9 12"
        transform={`translate(${x} ${y}) rotate(${angle + turn})`}
      />
    ));
  });
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
      <g key={run} className="belt-arrows">
        {arrows}
      </g>
    </svg>
  );
}
