import { useEffect } from "react";
import type { CSSProperties } from "react";
import { PieceType } from "../../engine";
import type { SquareIndex } from "../../engine";
import { BRAWLER_HP } from "../../plugins/finale";
import type { Box, FinaleView } from "../../plugins/finale";
import { THEMES } from "../../theme/themes";
import { themedPieceImage } from "../../utils/pieceImages";
import { sfx } from "../../audio/sfx";
import { visualCol, visualRow } from "./boardGeometry";
import { BoardFog } from "../Fog/Fog";
import { SoccerBall } from "./Football";
import { Tombstone, ZombiePiece } from "./Zombies";
import "./Finale.css";

const CELL = 12.5;

/** Where a box of squares sits on the board, in shares of its width and height */
function boxStyle(box: Box, flipped: boolean): CSSProperties {
  const col = flipped ? 7 - box.f1 : box.f0;
  const row = flipped ? box.r0 : 7 - box.r1;
  return {
    left: `${col * CELL}%`,
    top: `${row * CELL}%`,
    width: `${(box.f1 - box.f0 + 1) * CELL}%`,
    height: `${(box.r1 - box.r0 + 1) * CELL}%`,
  };
}

const squareStyle = (sq: SquareIndex, flipped: boolean): CSSProperties => ({
  left: `${visualCol(sq, flipped) * CELL}%`,
  top: `${visualRow(sq, flipped) * CELL}%`,
});

/** What lies under the squares: the ground of the hex corner, and the spiral the gravity patch turns on */
export function FinaleUnder({
  view,
  flipped,
}: {
  view: FinaleView;
  flipped: boolean;
}) {
  const { hex, gravity } = view.zones;
  return (
    <>
      {hex && (
        <div
          className="finale-hexbed finale-glitch-in"
          style={boxStyle(hex, flipped)}
          aria-hidden
        />
      )}
      {gravity && (
        <div
          className="finale-zone finale-swirl finale-glitch-in"
          style={boxStyle(gravity, flipped)}
          aria-hidden
        >
          <div className={`finale-swirl-spin spin-${view.tilts % 2}`} />
        </div>
      )}
    </>
  );
}

/**
 * Every mode Chessbot throws at the board in the final battle, each in its
 * own corner of it, and a glitch across the whole board as each new lot
 * comes in, naming them
 */
export function FinaleOver({
  view,
  flipped,
}: {
  view: FinaleView;
  flipped: boolean;
}) {
  const has = (act: FinaleView["acts"][number]) => view.acts.includes(act);
  const { fog, lanterns, tug, gravity } = view.zones;
  useEffect(() => {
    if (view.wave > 0) sfx.glitch();
  }, [view.wave]);
  const lastHit = view.hits[view.hits.length - 1];
  useEffect(() => {
    if (lastHit) sfx.hit(lastHit.fatal);
  }, [lastHit]);

  return (
    <div className="finale-layer" aria-hidden>
      {gravity && view.tilts > 0 && (
        <div className="finale-zone" style={boxStyle(gravity, flipped)}>
          <span className="finale-callout" key={view.tilts}>
            Gravity shift!
          </span>
        </div>
      )}
      {fog && (
        <div
          className="finale-zone finale-fog finale-glitch-in"
          style={boxStyle(fog, flipped)}
        >
          <BoardFog active enemyOnTop />
        </div>
      )}
      {lanterns && (
        <div
          className="finale-zone finale-dark finale-glitch-in"
          style={boxStyle(lanterns, flipped)}
        />
      )}
      {tug && (
        <div
          className="finale-zone finale-rope finale-glitch-in"
          style={boxStyle(tug, flipped)}
        >
          <div
            className={`finale-rope-cord heave-${view.heaves % 2}`}
            key={view.heaves}
          />
          {view.heaves > 0 && (
            <span className="finale-heave" key={`h${view.heaves}`}>
              Heave!
            </span>
          )}
        </div>
      )}
      {view.zombies.map((zombie) => (
        <div
          key={zombie.id}
          className="finale-cell finale-shambler"
          style={squareStyle(zombie.sq, flipped)}
        >
          {zombie.risen ? (
            <ZombiePiece type={PieceType.Pawn} sq={zombie.sq} act={undefined} />
          ) : (
            <Tombstone look={zombie.id % 4} stirring />
          )}
        </div>
      ))}
      {view.brawlers.map((brawler) => (
        <div
          key={brawler.id}
          className="finale-cell finale-brawler"
          style={squareStyle(brawler.sq, flipped)}
        >
          <img
            src={themedPieceImage(
              `${brawler.color}${brawler.type.toUpperCase()}`,
              "clash",
            )}
            alt=""
            draggable={false}
            key={brawler.hp}
            className={brawler.hp < BRAWLER_HP ? "is-hurt" : undefined}
          />
          <span className={`finale-hp finale-hp-${brawler.color}`}>
            {Array.from({ length: BRAWLER_HP }, (_, i) => (
              <i key={i} className={i < brawler.hp ? "full" : undefined} />
            ))}
          </span>
        </div>
      ))}
      {view.hits.slice(-4).map((hit) => (
        <span
          key={hit.id}
          className={`finale-cell finale-pow${hit.fatal ? " fatal" : ""}`}
          style={squareStyle(hit.to, flipped)}
        >
          {hit.fatal ? "KO!" : "POW"}
        </span>
      ))}
      {has("fifa") && (
        <>
          <div className="finale-goal finale-glitch-in" />
          <div
            className="finale-cell finale-ball"
            style={squareStyle(view.ball, flipped)}
          >
            <SoccerBall className="finale-ball-art" />
          </div>
        </>
      )}
      {view.arrived && (
        <div className="finale-wave" key={view.wave}>
          <i />
          <i />
          <i />
          <span>{THEMES[view.arrived].title}</span>
        </div>
      )}
    </div>
  );
}
