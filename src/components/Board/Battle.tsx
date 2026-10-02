import { useEffect, useRef } from "react";
import { Color, PieceType } from "../../engine";
import type { Piece, SquareIndex } from "../../engine";
import { DROP_MS } from "../../plugins/clashRoyale";
import type { BattleEvent, BattleView, Unit } from "../../plugins/clashRoyale";
import { pieceImage } from "../../utils/pieceImages";
import { offsetBetween, visualCol, visualRow } from "./boardGeometry";
import { sfx } from "../../audio/sfx";
import "./Battle.css";

type Style = React.CSSProperties & Record<`--${string}`, string>;
type AttackEvent = Extract<BattleEvent, { kind: "attack" }>;
type ArrivalEvent = Extract<BattleEvent, { kind: "move" | "deploy" }>;

/** The drop animation lands at this fraction of its length */
const DROP_LANDS_AT = 0.78;
const MAX_SOUNDS_PER_TICK = 4;

const team = (color: Color) => (color === Color.White ? "blue" : "red");
const px = (n: number) => `${Math.round(n)}px`;
const css = (style: Style) => style;

/** Unit vector in pixels from one square toward another */
function heading(
  from: SquareIndex,
  to: SquareIndex,
  flipped: boolean,
): { x: number; y: number } {
  const { x, y } = offsetBetween(to, from, flipped, 1);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function arrivalStyle(
  event: ArrivalEvent | undefined,
  flipped: boolean,
  squareSize: number,
): Style | undefined {
  if (event?.kind === "deploy") {
    return {
      "--drop-h": px(squareSize * 4),
      animation: `unit-drop ${Math.round(DROP_MS / DROP_LANDS_AT)}ms linear both`,
    };
  }
  if (event?.kind === "move") {
    const from = offsetBetween(event.from, event.to, flipped, squareSize);
    return {
      "--from-x": px(from.x),
      "--from-y": px(from.y),
      "--hop": px(
        squareSize * (0.18 + (0.05 * Math.hypot(from.x, from.y)) / squareSize),
      ),
      "--tilt": `${from.x > 0 ? -9 : 9}deg`,
      animation: `unit-march ${event.ms}ms ${event.delayMs}ms linear both`,
    };
  }
  return undefined;
}

function actionStyle(
  event: AttackEvent | undefined,
  unit: Unit,
  flipped: boolean,
  squareSize: number,
): Style | undefined {
  if (!event) return undefined;
  const dir = heading(event.from, event.to, flipped);
  if (event.targetId === unit.id) {
    return {
      "--knock-x": px(dir.x * squareSize * 0.16),
      "--knock-y": px(dir.y * squareSize * 0.16),
      animation: `unit-flinch 420ms ${event.hitMs}ms ease-out both`,
    };
  }
  if (event.ranged) {
    return {
      "--kick-x": px(-dir.x * squareSize * 0.1),
      "--kick-y": px(-dir.y * squareSize * 0.1),
      animation: "unit-recoil 320ms ease-out",
    };
  }
  return {
    "--lunge-x": px(dir.x * squareSize * 0.38),
    "--lunge-y": px(dir.y * squareSize * 0.38),
    animation: "unit-lunge 340ms ease-in-out",
  };
}

function HealthBar({ unit, tower }: { unit: Unit; tower: boolean }) {
  const share = `${Math.max(0, unit.hp) / unit.maxHp} 1`;
  return (
    <div className="unit-hp">
      <div className="unit-hp-track">
        <span className="unit-hp-lag" style={{ scale: share }} />
        <span className="unit-hp-fill" style={{ scale: share }} />
      </div>
      {tower && <span className="unit-hp-num">{Math.max(0, unit.hp)}</span>}
    </div>
  );
}

/** A piece fighting in the battle: it marches, lunges, flinches, and shows its health */
export function BattleUnit({
  sq,
  piece,
  view,
  flipped,
  squareSize,
}: {
  sq: SquareIndex;
  piece: Piece;
  view: BattleView;
  flipped: boolean;
  squareSize: number;
}) {
  const unit = view.units[sq];
  if (!unit) return null;

  let arrival: ArrivalEvent | undefined;
  let action: AttackEvent | undefined;
  for (let i = view.events.length - 1; i >= 0; i--) {
    const e = view.events[i];
    if (!arrival && (e.kind === "move" || e.kind === "deploy")) {
      if (e.unitId === unit.id) arrival = e;
    }
    if (!action && e.kind === "attack") {
      const attacking = e.unitId === unit.id && e.from === sq;
      const struck = e.targetId === unit.id && e.to === sq;
      if (attacking || struck) action = e;
    }
  }

  const tower = piece.type === PieceType.King;
  return (
    <div
      className={`battle-unit side-${team(piece.color)}${tower ? " is-tower" : ""}`}
      style={arrivalStyle(arrival, flipped, squareSize)}
    >
      <span className="unit-base" />
      <div
        key={action?.id ?? 0}
        className="unit-body"
        style={actionStyle(action, unit, flipped, squareSize)}
      >
        <img
          src={pieceImage(piece)}
          alt={`${piece.color}${piece.type}`}
          className="unit-img"
          draggable={false}
        />
      </div>
      {(tower || unit.hp < unit.maxHp) && (
        <HealthBar unit={unit} tower={tower} />
      )}
    </div>
  );
}

function Effect({
  event,
  flipped,
  squareSize,
}: {
  event: BattleEvent;
  flipped: boolean;
  squareSize: number;
}) {
  const cell = (sq: SquareIndex): Style => ({
    left: `${visualCol(sq, flipped) * 12.5}%`,
    top: `${visualRow(sq, flipped) * 12.5}%`,
  });

  switch (event.kind) {
    case "attack": {
      const travel = offsetBetween(event.to, event.from, flipped, squareSize);
      const hitAt = { animationDelay: `${event.hitMs}ms` };
      return (
        <>
          {event.ranged && (
            <span
              className={`bolt side-${team(event.color)}`}
              style={css({
                ...cell(event.from),
                "--dx": px(travel.x),
                "--dy": px(travel.y),
                rotate: `${Math.atan2(travel.y, travel.x)}rad`,
                animationDuration: `${event.hitMs}ms`,
              })}
            />
          )}
          <span className="hit-spark" style={{ ...cell(event.to), ...hitAt }} />
          <span
            className={`hit-number${event.kill ? " is-kill" : ""}`}
            style={css({
              ...cell(event.to),
              ...hitAt,
              "--drift": `${((event.id % 5) - 2) * 6}%`,
            })}
          >
            -{event.damage}
          </span>
        </>
      );
    }
    case "death": {
      const away = heading(event.from, event.sq, flipped);
      const delay = { animationDelay: `${event.delayMs}ms` };
      return (
        <>
          <img
            src={pieceImage(event.piece)}
            className="unit-ghost"
            style={css({
              ...cell(event.sq),
              ...delay,
              "--kx": px(
                (away.x || (event.id % 2 ? 1 : -1)) * squareSize * 1.4,
              ),
              "--spin": `${event.id % 2 ? 1 : -1}turn`,
            })}
            draggable={false}
            alt=""
          />
          <span className="ko-puff" style={{ ...cell(event.sq), ...delay }} />
        </>
      );
    }
    case "deploy":
      return (
        <>
          <span
            className="drop-shadow"
            style={{ ...cell(event.sq), animationDuration: `${DROP_MS}ms` }}
          />
          <span
            className={`drop-ring side-${team(event.color)}`}
            style={{ ...cell(event.sq), animationDelay: `${DROP_MS}ms` }}
          />
        </>
      );
    default:
      return null;
  }
}

function playEvent(event: BattleEvent): void {
  const later = (ms: number, play: () => void) => setTimeout(play, ms);
  switch (event.kind) {
    case "attack":
      if (event.ranged) sfx.zap();
      else sfx.swing();
      later(event.hitMs, () => sfx.hit(event.kill));
      break;
    case "death":
      later(event.delayMs, () => sfx.knockout());
      break;
    case "deploy":
      sfx.drop(DROP_MS / 1000);
      break;
  }
}

function useBattleSounds(events: BattleEvent[]): void {
  const heard = useRef(0);
  useEffect(() => {
    const fresh = events.filter((e) => e.id > heard.current);
    if (fresh.length === 0) return;
    heard.current = fresh[fresh.length - 1].id;
    fresh.slice(-MAX_SOUNDS_PER_TICK).forEach(playEvent);
  }, [events]);
}

/** Projectiles, sparks, damage numbers, knockouts, and landing rings above the board */
export function BattleEffects({
  view,
  flipped,
  squareSize,
}: {
  view: BattleView;
  flipped: boolean;
  squareSize: number;
}) {
  useBattleSounds(view.events);
  return (
    <div
      className="battle-effects"
      style={{ "--sq": px(squareSize) } as Style}
      aria-hidden
    >
      {view.events.map((event) => (
        <Effect
          key={event.id}
          event={event}
          flipped={flipped}
          squareSize={squareSize}
        />
      ))}
    </div>
  );
}
