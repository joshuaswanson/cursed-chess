import type { CSSProperties, ReactNode } from "react";
import type { ThemeId } from "../../theme/themes";
import "./ModePreview.css";

const PIECES = `${import.meta.env.BASE_URL}pieces/party/`;

/** A piece standing in a scene, placed by its middle in percent of the scene */
function Piece({
  is,
  x,
  y,
  size = 26,
  className = "",
  children,
}: {
  /** Colour and kind, as in the artwork's file names: wN, bQ */
  is: string;
  x: number;
  y: number;
  size?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <span
      className={`pv-piece ${className}`}
      style={
        { left: `${x}%`, top: `${y}%`, width: `${size}%` } as CSSProperties
      }
    >
      <img src={`${PIECES}${is}.svg`} alt="" draggable={false} />
      {children}
    </span>
  );
}

/** Something that happens in each mode, played on a loop in a little window */
const SCENES: Partial<Record<ThemeId, ReactNode>> = {
  // A knight steps into the blue portal and bursts out of the orange one
  portals: (
    <>
      <span className="pv-portal pv-blue" style={{ left: "24%", top: "56%" }} />
      <span
        className="pv-portal pv-orange"
        style={{ left: "76%", top: "56%" }}
      />
      <Piece is="wN" x={24} y={50} className="pv-into-portal" />
      <Piece is="wN" x={76} y={50} className="pv-out-of-portal" />
    </>
  ),
  // The enemy's pieces are swallowed by a bank of fog rolling over them
  fog: (
    <>
      <Piece is="bR" x={22} y={34} />
      <Piece is="bQ" x={50} y={32} />
      <Piece is="bN" x={78} y={34} />
      <Piece is="wP" x={50} y={78} size={22} />
      <span className="pv-fog pv-fog-a" />
      <span className="pv-fog pv-fog-b" />
      <span className="pv-fog pv-fog-c" />
    </>
  ),
  // A rook runs up and belts the ball into the net
  fifa: (
    <>
      <span className="pv-goal" />
      <Piece is="wR" x={22} y={56} className="pv-kicker" />
      <span className="pv-ball" />
      <span className="pv-shout pv-goal-shout">GOAL!</span>
    </>
  ),
  // Both teams heave on the rope, the flag sliding one way then the other
  tug: (
    <>
      <span className="pv-mud" />
      <span className="pv-tug">
        <span className="pv-rope" />
        <span className="pv-flag" />
        <Piece is="wP" x={12} y={50} size={22} />
        <Piece is="wN" x={28} y={48} size={24} />
        <Piece is="bN" x={72} y={48} size={24} />
        <Piece is="bP" x={88} y={50} size={22} />
      </span>
    </>
  ),
  // A pawn steps forward onto exactly the wrong square
  mines: (
    <>
      <span className="pv-warning" style={{ left: "38%", top: "62%" }}>
        2
      </span>
      <span className="pv-warning" style={{ left: "66%", top: "30%" }}>
        1
      </span>
      <Piece is="wP" x={30} y={56} className="pv-walks-on-mine" />
      <span className="pv-blast" style={{ left: "62%", top: "56%" }} />
    </>
  ),
  // The edge of the board falls away tile by tile, closing in on the king
  royale: (
    <>
      <span className="pv-tiles">
        {Array.from({ length: 15 }, (_, i) => {
          const col = i % 5;
          const row = Math.floor(i / 5);
          const edge = col === 0 || col === 4 || row === 0 || row === 2;
          return (
            <i
              key={i}
              className={edge ? "pv-doomed" : ""}
              style={{ "--n": (col + row * 2) % 7 } as CSSProperties}
            />
          );
        })}
      </span>
      <Piece is="wK" x={50} y={50} size={24} className="pv-nervous" />
    </>
  ),
  // Two pieces go at each other on their own, health bars draining
  clash: (
    <>
      <Piece is="wN" x={32} y={58} className="pv-lunge-right">
        <span className="pv-hp pv-hp-blue" />
      </Piece>
      <Piece is="bB" x={68} y={58} className="pv-lunge-left">
        <span className="pv-hp pv-hp-red" />
      </Piece>
      <span className="pv-spark" style={{ left: "50%", top: "52%" }} />
    </>
  ),
  // A king hops onto the hill and the count climbs to three
  hill: (
    <>
      <span className="pv-hill" />
      <Piece is="wK" x={50} y={50} className="pv-takes-hill" />
      <span className="pv-count">
        <i>1</i>
        <i>2</i>
        <i>3</i>
      </span>
    </>
  ),
  // The board turns on its side and everything slides down it
  gravity: (
    <span className="pv-tilting">
      <Piece is="wP" x={24} y={30} size={22} className="pv-falls pv-falls-a" />
      <Piece is="bN" x={50} y={30} size={24} className="pv-falls pv-falls-b" />
      <Piece is="wR" x={76} y={30} size={22} className="pv-falls pv-falls-c" />
    </span>
  ),
  // A bishop glides across a board of hexagons
  hex: (
    <>
      <span className="pv-hexes">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} style={{ "--n": i % 3 } as CSSProperties} />
        ))}
      </span>
      <Piece is="wB" x={24} y={66} size={22} className="pv-glides" />
    </>
  ),
  // A pawn attacks a hidden piece, which turns out to be a queen
  stratego: (
    <>
      <Piece is="bP" x={24} y={34} className="pv-hidden">
        <span className="pv-mask">?</span>
      </Piece>
      <Piece is="bQ" x={52} y={34} className="pv-hidden pv-revealed">
        <span className="pv-mask">?</span>
      </Piece>
      <Piece is="bP" x={80} y={34} className="pv-hidden">
        <span className="pv-mask">?</span>
      </Piece>
      <Piece is="wP" x={52} y={78} size={22} className="pv-attacks-up" />
    </>
  ),
  // A captured pawn claws its way back out of its grave
  zombies: (
    <>
      <span className="pv-grave" />
      <span className="pv-rises">
        <Piece is="bP" x={50} y={50} size={100} className="pv-undead" />
      </span>
      <span className="pv-dirt" />
      <Piece is="wP" x={76} y={64} size={22} className="pv-shivers" />
    </>
  ),
  // Rifle fire crosses no man's land in the rain, and a shell lands short
  trenches: (
    <>
      <span className="pv-sandbags pv-sandbags-far" />
      <span className="pv-sandbags pv-sandbags-near" />
      <span className="pv-tracer pv-tracer-a" />
      <span className="pv-tracer pv-tracer-b" />
      <span className="pv-tracer pv-tracer-c" />
      <span className="pv-shell" />
      <span className="pv-rain" />
    </>
  ),
};

/** A mode's little scene, in its own colours */
export function ModePreview({ theme }: { theme: ThemeId }) {
  return (
    <span className={`mode-preview scene-${theme}`} aria-hidden>
      {SCENES[theme]}
    </span>
  );
}
