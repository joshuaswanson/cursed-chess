import { useEffect, useState } from "react";
import { Color } from "../../engine";
import type { SquareIndex } from "../../engine";
import { GUN_NESTS } from "../../plugins/trenches";
import type { TrenchView } from "../../plugins/trenches";
import { visualCol, visualRow } from "./boardGeometry";
import "./TrenchField.css";

type Style = React.CSSProperties & Record<`--${string}`, string | number>;

/** A repeatable scatter in [0, 1) for a square, so its scars stay put */
const scatter = (n: number) => {
  const v = Math.sin(n * 91.345 + 7.7) * 43758.5453;
  return v - Math.floor(v);
};

const cellAt = (sq: SquareIndex, flipped: boolean): Style => ({
  left: `${visualCol(sq, flipped) * 12.5}%`,
  top: `${visualRow(sq, flipped) * 12.5}%`,
});

/** Coils of barbed wire strung between two posts, barbs and all */
function Wire({ sq }: { sq: SquareIndex }) {
  const lean = (scatter(sq) - 0.5) * 16;
  const loops = Array.from({ length: 6 }, (_, i) => {
    const x = 8 + i * 15;
    return `M${x} 58 C${x - 6} 30 ${x + 14} 26 ${x + 12} 50 S${x + 2} 72 ${x + 15} 58`;
  }).join(" ");
  return (
    <svg
      className="wire-coil"
      viewBox="0 0 100 100"
      style={{ rotate: `${lean}deg` }}
      aria-hidden
    >
      <path d="M10 76 L12 34 M90 76 L88 34" className="wire-post" />
      <path d={loops} className="wire-strand" />
      <path d={loops} className="wire-strand wire-glint" />
      <path
        d="M20 42 l3 -3 M36 60 l3 3 M52 40 l3 -3 M66 62 l3 3 M80 44 l3 -3"
        className="wire-barb"
      />
    </svg>
  );
}

/** A soldier's helmet lying where he fell, half sunk in the mud */
function Helmet({
  fallen,
  flipped,
}: {
  fallen: TrenchView["fallen"][number];
  flipped: boolean;
}) {
  const style: Style = {
    ...cellAt(fallen.sq, flipped),
    "--x": `${20 + scatter(fallen.sq + 3) * 30}%`,
    "--y": `${28 + scatter(fallen.sq + 9) * 30}%`,
    rotate: `${fallen.tilt}deg`,
  };
  const ours = fallen.color === Color.White;
  return (
    <span className="fallen" style={style} aria-hidden>
      <svg viewBox="0 0 40 30">
        <ellipse cx="20" cy="22" rx="18" ry="5" className="fallen-mud" />
        {ours ? (
          <>
            <ellipse
              cx="20"
              cy="17"
              rx="17"
              ry="6"
              className="helmet-brim tommy"
            />
            <path
              d="M9 17 Q10 4 20 4 Q30 4 31 17 Z"
              className="helmet-dome tommy"
            />
          </>
        ) : (
          <>
            <path
              d="M5 20 Q4 14 9 13 Q10 3 21 3 Q32 3 32 13 Q37 15 35 20 Z"
              className="helmet-dome fritz"
            />
            <path d="M7 17 Q20 15 34 17" className="helmet-rim" />
          </>
        )}
      </svg>
    </span>
  );
}

/** A flare popping over no man's land, hanging in the rain and lighting it pale */
function useFlares(): { id: number; x: number; drift: number }[] {
  const [flares, setFlares] = useState<
    { id: number; x: number; drift: number }[]
  >([]);
  useEffect(() => {
    let id = 0;
    let timer = 0;
    const next = () => {
      timer = window.setTimeout(
        () => {
          const flare = {
            id: ++id,
            x: 15 + Math.random() * 70,
            drift: (Math.random() - 0.5) * 20,
          };
          setFlares((all) => [...all.slice(-2), flare]);
          next();
        },
        7000 + Math.random() * 9000,
      );
    };
    next();
    return () => clearTimeout(timer);
  }, []);
  return flares;
}

/**
 * What the fighting leaves on the board, between the ground and the pieces:
 * the machine gun nests, wire strung across no man's land, shell craters, the
 * helmets of the fallen, and flares drifting down over it all
 */
export function TrenchField({
  view,
  flipped,
}: {
  view: TrenchView;
  flipped: boolean;
}) {
  const flares = useFlares();
  return (
    <div className="trench-field" aria-hidden>
      {view.craters.map((sq) => (
        <span
          key={`c${sq}`}
          className="crater"
          style={{
            ...cellAt(sq, flipped),
            rotate: `${scatter(sq) * 180}deg`,
          }}
        />
      ))}
      {(Object.keys(GUN_NESTS) as Color[]).map((color) => {
        const enemyAbove = (color === Color.White) !== flipped;
        return (
          <span
            key={`n${color}`}
            className={`gun-nest ${enemyAbove ? "faces-up" : "faces-down"}`}
            style={cellAt(GUN_NESTS[color], flipped)}
          />
        );
      })}
      {view.fallen.map((f) => (
        <Helmet key={`f${f.sq}`} fallen={f} flipped={flipped} />
      ))}
      {view.wire.map((sq) => (
        <span key={`w${sq}`} className="wire-cell" style={cellAt(sq, flipped)}>
          <Wire sq={sq} />
        </span>
      ))}
      {flares.map((flare) => (
        <span
          key={flare.id}
          className="flare"
          style={
            { "--x": `${flare.x}%`, "--drift": `${flare.drift}%` } as Style
          }
        >
          <i />
        </span>
      ))}
    </div>
  );
}
