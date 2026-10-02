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

function squaresApart(event: AttackEvent): number {
  return Math.hypot(
    visualCol(event.to, false) - visualCol(event.from, false),
    visualRow(event.to, false) - visualRow(event.from, false),
  );
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
  const reach = Math.max(0.38, squaresApart(event) - 0.62);
  return {
    "--lunge-x": px(dir.x * squareSize * reach),
    "--lunge-y": px(dir.y * squareSize * reach),
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

/** Contact lands this far into the sword swing */
const SWING_CONTACT = 0.45;
const SWING_MS = 300;

/** A sword held just short of the target that sweeps through it as the blow lands */
function Sword({ event, flipped }: { event: AttackEvent; flipped: boolean }) {
  const dir = heading(event.from, event.to, flipped);
  const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
  const side = event.id % 2 ? 1 : -1;
  const pivotCol = visualCol(event.to, flipped) + 0.5 - dir.x * 0.5;
  const pivotRow = visualRow(event.to, flipped) + 0.5 - dir.y * 0.5;
  return (
    <span
      className="sword"
      style={css({
        left: `${pivotCol * 12.5}%`,
        top: `${pivotRow * 12.5}%`,
        "--swing-from": `${angle - 80 * side}deg`,
        "--swing-hit": `${angle}deg`,
        "--swing-to": `${angle + 60 * side}deg`,
        animationDelay: `${Math.max(0, event.hitMs - SWING_MS * SWING_CONTACT)}ms`,
        animationDuration: `${SWING_MS}ms`,
      })}
    >
      <svg viewBox="0 0 100 28">
        <defs>
          <linearGradient id="blade-shine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="0.5" stopColor="#c9d3df" />
            <stop offset="1" stopColor="#7d8896" />
          </linearGradient>
        </defs>
        <path
          d="M22 10 L90 10 L100 14 L90 18 L22 18 Z"
          fill="url(#blade-shine)"
          stroke="#4b5260"
          strokeWidth="1.2"
        />
        <path d="M24 14 L86 14" stroke="#8e99a8" strokeWidth="1.2" />
        <rect x="5" y="11" width="13" height="6" rx="2" fill="#7a4a22" />
        <rect x="16" y="3" width="6" height="22" rx="2.5" fill="#ffd23f" />
        <circle cx="4" cy="14" r="3.6" fill="#ffd23f" />
      </svg>
    </span>
  );
}

/** An arrow that arcs from shooter to target, turning to follow its path */
function Arrow({
  event,
  travel,
  start,
  squareSize,
}: {
  event: AttackEvent;
  travel: { x: number; y: number };
  start: Style;
  squareSize: number;
}) {
  const length = Math.hypot(travel.x, travel.y) || 1;
  const dir = { x: travel.x / length, y: travel.y / length };
  // The arc bows toward the top of the screen, or to one side on straight up-and-down shots
  let bow = { x: dir.y, y: -dir.x };
  if (Math.abs(bow.y) < 0.05) bow = { x: event.id % 2 ? 1 : -1, y: 0 };
  else if (bow.y > 0) bow = { x: -bow.x, y: -bow.y };
  const height = Math.min(length * 0.22, squareSize * 0.7);
  const turn = dir.x * bow.y - dir.y * bow.x > 0 ? 1 : -1;
  const tilt = Math.atan2(height * Math.PI, length);
  const angle = Math.atan2(dir.y, dir.x);
  const duration = `${event.hitMs}ms`;
  return (
    <span
      className={`arrow side-${team(event.color)}`}
      style={css({
        ...start,
        "--dx": px(travel.x),
        "--dy": px(travel.y),
        animationDuration: duration,
      })}
    >
      <span
        className="arrow-lob"
        style={css({
          "--lob-x": px(bow.x * height),
          "--lob-y": px(bow.y * height),
          animationDuration: duration,
        })}
      >
        <svg
          className="arrow-shaft"
          viewBox="0 0 100 20"
          style={css({
            "--turn-from": `${angle + turn * tilt}rad`,
            "--turn-to": `${angle - turn * tilt}rad`,
            animationDuration: duration,
          })}
        >
          <path
            className="arrow-fletch"
            d="M0 2 L18 8.5 L12 10 L18 11.5 L0 18 L6 10 Z"
          />
          <rect x="4" y="8.7" width="80" height="2.6" rx="1.3" fill="#8a5a2b" />
          <path
            d="M78 3.5 L100 10 L78 16.5 L83 10 Z"
            fill="#e6ecf2"
            stroke="#4b5260"
            strokeWidth="1.2"
          />
        </svg>
      </span>
    </span>
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
          {!event.ranged && (
            <span
              className="slash"
              style={{
                ...cell(event.to),
                ...hitAt,
                rotate: `${Math.atan2(travel.y, travel.x) + Math.PI / 2}rad`,
              }}
            >
              <svg viewBox="0 0 100 100">
                <path d="M14 74 Q50 6 86 74" />
              </svg>
            </span>
          )}
          {event.ranged ? (
            <Arrow
              event={event}
              travel={travel}
              start={cell(event.from)}
              squareSize={squareSize}
            />
          ) : (
            <Sword event={event} flipped={flipped} />
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
      if (event.ranged) sfx.bowShot();
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
