import { TUNNEL_RANKS } from "../../plugins/pacman";
import "./PacMan.css";

/** How far each wall stands out from the board's edge, in squares: the arcade's double line */
const WALLS = [0.1, 0.24];
/** How far the tunnels run out past the board, in squares */
const TUNNEL_REACH = 0.75;
const CORNER = 0.18;

/** The maze's double blue wall round the board, open on each side into a tunnel */
export function PacMaze() {
  const top = Math.min(...TUNNEL_RANKS.map((rank) => 7 - rank));
  const bottom = Math.max(...TUNNEL_RANKS.map((rank) => 7 - rank)) + 1;
  const paths = WALLS.map((d) => {
    const spread = d - WALLS[0];
    const gapTop = top - spread;
    const gapBottom = bottom + spread;
    const near = -d;
    const far = 8 + d;
    const r = CORNER + spread;
    const wall =
      `M${near} ${gapTop} L${near} ${near + r} Q${near} ${near} ${near + r} ${near}` +
      ` L${far - r} ${near} Q${far} ${near} ${far} ${near + r} L${far} ${gapTop}` +
      ` M${far} ${gapBottom} L${far} ${far - r} Q${far} ${far} ${far - r} ${far}` +
      ` L${near + r} ${far} Q${near} ${far} ${near} ${far - r} L${near} ${gapBottom}`;
    const tunnels = [gapTop, gapBottom]
      .flatMap((y) => [
        `M${near} ${y} L${-TUNNEL_REACH - 0.24} ${y}`,
        `M${far} ${y} L${8 + TUNNEL_REACH + 0.24} ${y}`,
      ])
      .join(" ");
    return `${wall} ${tunnels}`;
  });
  return (
    <svg className="pac-maze" viewBox="-1.4 -0.4 10.8 8.8" aria-hidden>
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

/** A pellet on its square, or one being eaten as the piece that ate it passes */
export function PacPellet({
  power,
  eatenAfterMs,
}: {
  power: boolean;
  /** When this pellet is eaten in the move being shown */
  eatenAfterMs?: number;
}) {
  const eating = eatenAfterMs !== undefined;
  return (
    <span
      className={`pac-dot${power ? " pac-power" : ""}${eating ? " pac-eating" : ""}`}
      style={eating ? { animationDelay: `${eatenAfterMs}ms` } : undefined}
      aria-hidden
    />
  );
}
