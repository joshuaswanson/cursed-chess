import { memo, useEffect, useState } from "react";
import type { SquareIndex } from "../../engine";
import type { TrenchView } from "../../plugins/trenches";
import { visualCol, visualRow } from "./boardGeometry";
import { ShellHole } from "./ShellHole";
import { Flare } from "./Flare";
import type { FlareShot } from "./Flare";
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

/**
 * Flares going up over no man's land now and then, fired from one trench or
 * the other, sometimes two in quick succession
 */
function useFlares(flipped: boolean): FlareShot[] {
  const [flares, setFlares] = useState<FlareShot[]>([]);
  useEffect(() => {
    let id = 0;
    let timer = 0;
    const fire = () => {
      // From just in front of one side's front trench, on the screen
      const near = Math.random() < 0.5;
      const row = near !== flipped ? 5 : 2;
      const shot: FlareShot = {
        id: ++id,
        x: 0.1 + Math.random() * 0.8,
        y: (row + (near !== flipped ? 0.1 : 0.9)) / 8,
        drift: (Math.random() - 0.5) * 0.18,
        rise: 0.18 + Math.random() * 0.12,
      };
      setFlares((all) => [...all.slice(-2), shot]);
    };
    const next = () => {
      timer = window.setTimeout(
        () => {
          fire();
          if (Math.random() < 0.25)
            window.setTimeout(fire, 700 + Math.random() * 900);
          next();
        },
        8000 + Math.random() * 10000,
      );
    };
    next();
    return () => clearTimeout(timer);
  }, [flipped]);
  return flares;
}

/**
 * What the fighting leaves on the board, between the ground and the pieces:
 * wire strung across no man's land, and flares drifting down over it all
 */
function TrenchFieldLayer({
  view,
  flipped,
}: {
  view: TrenchView;
  flipped: boolean;
}) {
  const flares = useFlares(flipped);
  return (
    <>
      <div className="trench-field" aria-hidden>
        {view.wire.map((sq) => (
          <span
            key={`w${sq}`}
            className="wire-cell"
            style={cellAt(sq, flipped)}
          >
            <Wire sq={sq} />
          </span>
        ))}
      </div>
      {/* Up in the sky, over the sandbags and the men */}
      <div className="flare-sky" aria-hidden>
        {flares.map((shot) => (
          <Flare key={shot.id} shot={shot} />
        ))}
      </div>
    </>
  );
}

/** The shell holes the fighting has churned into the board, under the trench lines and their sandbags */
function BoardCratersLayer({
  view,
  flipped,
}: {
  view: TrenchView;
  flipped: boolean;
}) {
  return (
    <div className="board-craters" aria-hidden>
      {view.craters.map((c) => {
        // Files and ranks from a1's corner, to the screen, either way round
        const left = flipped ? 8 - c.x : c.x;
        const top = flipped ? c.y : 8 - c.y;
        return (
          <ShellHole
            key={c.seed}
            seed={c.seed}
            style={{
              left: `${(left - c.r) * 12.5}%`,
              top: `${(top - c.r) * 12.5}%`,
              width: `${c.r * 25}%`,
              height: `${c.r * 25}%`,
            }}
          />
        );
      })}
    </div>
  );
}

type FieldProps = { view: TrenchView; flipped: boolean };

/** Whether the wire and the shell holes are as they were, the only parts of the view these draw */
const sameGround = (a: FieldProps, b: FieldProps) =>
  a.flipped === b.flipped &&
  a.view.wire.join() === b.view.wire.join() &&
  a.view.craters.map((c) => c.seed).join() ===
    b.view.craters.map((c) => c.seed).join();

// The game re-renders the board many times a second; these redraw only when the ground changes
export const TrenchField = memo(TrenchFieldLayer, sameGround);
export const BoardCraters = memo(BoardCratersLayer, sameGround);
