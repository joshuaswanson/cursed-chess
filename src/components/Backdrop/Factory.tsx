/** How many crates ride the belt along the back wall at once */
const CRATES = 7;

/** Conveyor's backdrop: a factory floor at night, girders overhead, warning beacons turning, and crates riding a belt along the back wall */
export function Factory() {
  return (
    <div className="factory" aria-hidden>
      <div className="factory-girders" />
      <span className="factory-beacon factory-beacon-left" />
      <span className="factory-beacon factory-beacon-right" />
      <div className="factory-belt">
        {Array.from({ length: CRATES }, (_, i) => (
          <i
            key={i}
            className="factory-crate"
            style={{ animationDelay: `${(-i * 18) / CRATES}s` }}
          />
        ))}
      </div>
    </div>
  );
}
