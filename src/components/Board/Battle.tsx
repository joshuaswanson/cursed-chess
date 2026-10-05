import { useEffect, useRef } from "react";
import { Color, PieceType } from "../../engine";
import type { Piece, SquareIndex } from "../../engine";
import { DROP_MS } from "../../plugins/clashRoyale";
import { AIM_MS, SHELL_FALL_MS, TRENCH_RANKS } from "../../plugins/trenches";
import { shakeBoard } from "./useBoardEffects";
import { BAG_TOP, TRENCH_EDGE } from "./trenchFront";
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
  const fired = event.delayMs ?? 0;
  if (event.targetId === unit.id) {
    // A shot that went wide makes the target duck instead
    if (event.miss) {
      return { animation: `unit-duck 300ms ${fired + event.hitMs}ms ease-out` };
    }
    return {
      "--knock-x": px(dir.x * squareSize * 0.16),
      "--knock-y": px(dir.y * squareSize * 0.16),
      animation: `unit-flinch 420ms ${fired + event.hitMs}ms ease-out both`,
    };
  }
  if (event.ranged) {
    return {
      "--kick-x": px(-dir.x * squareSize * (event.weapon ? 0.06 : 0.1)),
      "--kick-y": px(-dir.y * squareSize * (event.weapon ? 0.06 : 0.1)),
      animation: `unit-recoil ${event.weapon ? 160 : 320}ms ${fired}ms ease-out`,
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
  stance,
  entrenched = false,
  aiming = false,
}: {
  sq: SquareIndex;
  piece: Piece;
  view: BattleView;
  flipped: boolean;
  squareSize: number;
  /** Charging across open ground, or caught on the wire */
  stance?: "charging" | "snagged";
  /** Down in a trench, hidden below its near edge */
  entrenched?: boolean;
  /** Manning the front line, his rifle levelled at the enemy */
  aiming?: boolean;
}) {
  const unit = view.units[sq];
  if (!unit) return null;
  const arms = view.arms?.[unit.id];

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
  const firing =
    action?.unitId === unit.id &&
    (action.weapon === "rifle" || action.weapon === "bayonet")
      ? action
      : undefined;
  return (
    <div
      className={`battle-unit side-${team(piece.color)}${tower ? " is-tower" : ""}${stance ? ` is-${stance}` : ""}${entrenched ? " is-entrenched" : ""}${aiming ? " is-aiming" : ""}`}
      style={
        {
          ...arrivalStyle(arrival, flipped, squareSize),
          // Hidden from the top of the sandbags down
          "--trench-edge": `${((0.95 - TRENCH_EDGE + BAG_TOP) / 0.9) * 100}%`,
        } as Style
      }
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
        {arms && <Helmet color={piece.color} type={piece.type} />}
        {arms === "rifle" && (
          <Rifle
            key={firing?.id ?? "rest"}
            rest={aiming ? enemyAngle(piece.color, flipped) : RIFLE_AT_SIDE}
            grip={aiming ? RIFLE_SHOULDER : RIFLE_GRIP}
            side={gripSide(piece.color)}
            aim={firing ? aimAngle(firing, flipped) : null}
            fireMs={Math.max(0, (firing?.delayMs ?? 0) - AIM_MS)}
            thrust={firing?.weapon === "bayonet"}
          />
        )}
      </div>
      {(tower || unit.hp < unit.maxHp) && (
        <HealthBar unit={unit} tower={tower} />
      )}
    </div>
  );
}

/**
 * A rifle held at the ready, pointed toward the enemy line, that swings onto
 * its target and kicks as it fires
 */
function Rifle({
  rest,
  grip,
  side,
  aim,
  fireMs,
  thrust = false,
}: {
  rest: number;
  /** Where he holds it, from his middle, in squares */
  grip: { x: number; y: number };
  /** Which hand he holds it in: 1 for his right, -1 for his left */
  side: number;
  aim: number | null;
  fireMs: number;
  /** Driven forward with the bayonet, in place of firing */
  thrust?: boolean;
}) {
  const style: Style = {
    "--grip-x": `${50 + (side * grip.x * 100) / 0.9}%`,
    "--grip-y": `${50 + (grip.y * 100) / 0.9}%`,
    "--rest": `${rest}deg`,
    "--aim": `${aim ?? rest}deg`,
    "--fire": `${fireMs}ms`,
  };
  return (
    <svg
      className={`unit-rifle${aim === null ? "" : thrust ? " thrusting" : " firing"}`}
      viewBox="0 0 72 22"
      style={style}
      aria-hidden
    >
      <path d="M16 15 Q32 22 50 14" className="rifle-sling" />
      <path
        d="M1 7 Q1 4 4 4 L15 4.5 L22 7.5 L28 8 L28 13.5 L22 14 L15 16.5 L4 17.5 Q1 17.5 1 14.5 Z"
        className="rifle-wood"
      />
      <path d="M4 9 Q10 8 16 9 M4 13 Q10 12.5 15 13" className="rifle-grain" />
      <rect
        x="27"
        y="7"
        width="12"
        height="7.5"
        rx="1.6"
        className="rifle-steel"
      />
      <path d="M33.5 14.5 L32 18.5" className="rifle-bolt" />
      <circle cx="31.6" cy="19" r="2" className="rifle-steel" />
      <path d="M38 7.6 L58 8.4 L58 13.2 L38 14 Z" className="rifle-wood" />
      <rect
        x="57"
        y="9.2"
        width="10"
        height="3.4"
        rx="1.2"
        className="rifle-steel"
      />
      <rect
        x="45"
        y="7.3"
        width="2.4"
        height="7"
        rx="0.6"
        className="rifle-band"
      />
      <rect
        x="54"
        y="7.8"
        width="2.4"
        height="6"
        rx="0.6"
        className="rifle-band"
      />
      <path d="M65 9.6 L72 10.9 L65 12.2 Z" className="rifle-blade" />
    </svg>
  );
}

/** Where the machine gun pivots, ahead of its gunner toward the enemy, and how far out its muzzle is, in squares */
const MG_PIVOT_AHEAD = 0.12;
const MG_REACH = 0.62;
/** How far from a rifleman's middle his muzzle sits, in squares */
const RIFLE_REACH = 0.55;

/** Which way is toward the enemy for a side, on screen: up the board for the side at the bottom */
function towardEnemy(color: Color, flipped: boolean): { x: number; y: number } {
  return { x: 0, y: (color === Color.White) !== flipped ? -1 : 1 };
}

/**
 * The machine guns, each on its tripod in front of its gunner, drawn on the
 * side of him it stands: behind a gunner facing away up the board, in front
 * of one facing the viewer, where it rests on the sandbags. Each traverses
 * onto whatever it is firing at.
 */
export function TrenchGuns({
  view,
  board,
  flipped,
  facing,
}: {
  view: BattleView;
  board: { get: (sq: SquareIndex) => Piece | null };
  flipped: boolean;
  /** Which guns to draw: those facing away from the viewer, or toward */
  facing: "away" | "toward";
}) {
  const guns = Object.entries(view.units).flatMap(([key, unit]) => {
    const sq = Number(key);
    const piece = board.get(sq);
    if (view.arms?.[unit.id] !== "mg" || !piece) return [];
    const away = towardEnemy(piece.color, flipped).y < 0;
    if ((facing === "away") !== away) return [];
    const burst = [...view.events]
      .reverse()
      .find(
        (e): e is AttackEvent =>
          e.kind === "attack" && e.unitId === unit.id && e.weapon === "mg",
      );
    return [{ sq, color: piece.color, burst }];
  });
  return (
    <div className={`trench-guns guns-${facing}`} aria-hidden>
      {guns.map(({ sq, color, burst }) => (
        <span
          key={sq}
          className="trench-gun"
          style={{
            left: `${visualCol(sq, flipped) * 12.5}%`,
            top: `${visualRow(sq, flipped) * 12.5}%`,
          }}
        >
          <MachineGun
            color={color}
            flipped={flipped}
            aim={burst ? aimAngle(burst, flipped) : null}
          />
        </span>
      ))}
    </div>
  );
}

/**
 * The machine gun on its tripod in front of the gunner. It traverses onto
 * whatever it is firing at and stays trained there through the burst, then
 * settles back toward the enemy line.
 */
function MachineGun({
  color,
  flipped,
  aim,
}: {
  color: Color;
  flipped: boolean;
  aim: number | null;
}) {
  const ahead = towardEnemy(color, flipped);
  const rest = (Math.atan2(ahead.y, ahead.x) * 180) / Math.PI;
  const style: Style = {
    "--pivot-y": `${50 + ahead.y * MG_PIVOT_AHEAD * 100}%`,
    "--turn": `${aim ?? rest}deg`,
  };
  return (
    <span className="unit-mg" style={style} aria-hidden>
      <svg className="mg-tripod" viewBox="0 0 40 40">
        <path d="M20 20 L5 35 M20 20 L35 35 M20 20 L20 3" className="mg-legs" />
        <path d="M3 35 h5 M32 35 h5 M18 3 h4" className="mg-feet" />
        <circle cx="20" cy="20" r="4.5" className="mg-head" />
      </svg>
      <svg className="mg-gun" viewBox="0 0 100 34">
        <path
          d="M30 22 Q36 30 30 33 M33 23 l2.4 -0.6 l0.8 3.4 l-2.4 0.6 Z M31 27 l2.4 -0.2 l0.4 3.4 l-2.4 0.2 Z M29 31 l2.4 0.2 l-0.2 2.4 l-2.4 -0.2 Z"
          className="mg-belt"
        />
        <rect x="1" y="9" width="7" height="3.6" rx="1.6" className="mg-grip" />
        <rect
          x="1"
          y="20"
          width="7"
          height="3.6"
          rx="1.6"
          className="mg-grip"
        />
        <rect x="7" y="8" width="4" height="17" rx="1" className="mg-steel" />
        <rect
          x="10"
          y="6.5"
          width="24"
          height="20"
          rx="2"
          className="mg-steel"
        />
        <path d="M12 9.5 H32 M12 23.5 H32" className="mg-seam" />
        <rect
          x="18"
          y="3.5"
          width="5"
          height="3.5"
          rx="0.8"
          className="mg-steel"
        />
        <rect
          x="33"
          y="9"
          width="44"
          height="15"
          rx="4"
          className="mg-jacket"
        />
        <path
          d="M38 9.5 V23.5 M43 9.5 V23.5 M48 9.5 V23.5 M53 9.5 V23.5 M58 9.5 V23.5 M63 9.5 V23.5 M68 9.5 V23.5 M73 9.5 V23.5"
          className="mg-flutes"
        />
        <rect x="76" y="14" width="10" height="5" rx="1" className="mg-steel" />
        <path d="M85 12.5 L98 10 L98 23 L85 20.5 Z" className="mg-steel" />
      </svg>
    </span>
  );
}

/**
 * A rifle or machine gun round: a muzzle flash, a tracer streaking to the
 * target, and either a hit or a spray of mud where it went wide
 */
function Gunshot({
  event,
  flipped,
  squareSize,
}: {
  event: AttackEvent;
  flipped: boolean;
  squareSize: number;
}) {
  const fired = event.delayMs ?? 0;
  const impact = event.impact ?? { x: 0, y: 0 };
  const sign = flipped ? -1 : 1;
  const end = {
    x: (visualCol(event.to, flipped) + 0.5 + impact.x * sign) * squareSize,
    y: (visualRow(event.to, flipped) + 0.5 + impact.y * sign) * squareSize,
  };
  // Rounds leave from the muzzle: the machine gun's, ahead of its gunner, or the rifle's
  const middle = {
    x: (visualCol(event.from, flipped) + 0.5) * squareSize,
    y: (visualRow(event.from, flipped) + 0.5) * squareSize,
  };
  const ahead = towardEnemy(event.color, flipped);
  const pivot =
    event.weapon === "mg"
      ? {
          x: middle.x + ahead.x * MG_PIVOT_AHEAD * squareSize,
          y: middle.y + ahead.y * MG_PIVOT_AHEAD * squareSize,
        }
      : {
          x:
            middle.x +
            gripSide(event.color) * holdFor(event.from).x * squareSize,
          y: middle.y + holdFor(event.from).y * squareSize,
        };
  const toEnd = Math.hypot(end.x - pivot.x, end.y - pivot.y) || 1;
  const reach = (event.weapon === "mg" ? MG_REACH : RIFLE_REACH) * squareSize;
  const start = {
    x: pivot.x + ((end.x - pivot.x) / toEnd) * reach,
    y: pivot.y + ((end.y - pivot.y) / toEnd) * reach,
  };
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const landed = { animationDelay: `${fired + event.hitMs}ms` };
  const at = (p: { x: number; y: number }): Style => ({
    left: px(p.x),
    top: px(p.y),
  });
  // Hit marks fill a square's worth of room, centred on where the round lands
  const around = (p: { x: number; y: number }): Style => ({
    left: px(p.x - squareSize / 2),
    top: px(p.y - squareSize / 2),
  });
  return (
    <>
      <span
        className={`muzzle-flash weapon-${event.weapon}`}
        style={css({
          ...at(start),
          rotate: `${angle}rad`,
          animationDelay: `${fired}ms`,
        })}
      />
      <span
        className={`tracer weapon-${event.weapon}`}
        style={css({
          ...at(start),
          transform: `rotate(${angle}rad)`,
          "--length": px(length),
          "--angle": `${angle}rad`,
          animationDelay: `${fired}ms`,
          animationDuration: `${event.hitMs}ms`,
        })}
      />
      {event.miss ? (
        <span
          className="mud-splash"
          style={css({ ...around(end), ...landed })}
        />
      ) : (
        <>
          <span
            className="hit-spark"
            style={css({ ...around(end), ...landed })}
          />
          <span
            className={`hit-number${event.kill ? " is-kill" : ""}`}
            style={css({
              ...around(end),
              ...landed,
              "--drift": `${((event.id % 5) - 2) * 6}%`,
            })}
          >
            -{event.damage}
          </span>
        </>
      )}
    </>
  );
}

/** A soldier's steel helmet: the flat British one for your army, the German one for theirs */
function Helmet({ color, type }: { color: Color; type: PieceType }) {
  return (
    <svg
      className={`unit-helmet helmet-on-${type}`}
      viewBox="0 0 44 26"
      aria-hidden
    >
      <defs>
        <linearGradient id="brodie-dome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9a9564" />
          <stop offset="0.5" stopColor="#6c6842" />
          <stop offset="1" stopColor="#45422a" />
        </linearGradient>
        <linearGradient id="brodie-brim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#837e54" />
          <stop offset="1" stopColor="#4e4b30" />
        </linearGradient>
        <pattern
          id="helmet-steel"
          width="44"
          height="26"
          patternUnits="userSpaceOnUse"
        >
          <image
            href={`${import.meta.env.BASE_URL}textures/trenches/helmet_metal.jpg`}
            width="44"
            height="44"
            preserveAspectRatio="none"
          />
        </pattern>
        <linearGradient id="stahl-dome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b9590" />
          <stop offset="0.55" stopColor="#5b6560" />
          <stop offset="1" stopColor="#363d3a" />
        </linearGradient>
      </defs>
      {color === Color.White ? (
        <>
          <ellipse
            cx="22"
            cy="18.4"
            rx="20.5"
            ry="4.6"
            className="helmet-underside"
          />
          <ellipse
            cx="22"
            cy="17"
            rx="20.5"
            ry="4.4"
            fill="url(#brodie-brim)"
            className="helmet-edge"
          />
          <path
            d="M10 17 C10.5 6 15 3.5 22 3.5 C29 3.5 33.5 6 34 17 Z"
            fill="url(#brodie-dome)"
            className="helmet-edge"
          />
          <path
            d="M10 17 C10.5 6 15 3.5 22 3.5 C29 3.5 33.5 6 34 17 Z"
            className="helmet-steel"
          />
          <ellipse
            cx="22"
            cy="17"
            rx="20.5"
            ry="4.4"
            className="helmet-steel"
          />
          <path d="M3.5 16.4 Q22 13 40.5 16.4" className="helmet-glint" />
          <circle cx="22" cy="4.4" r="1.1" className="helmet-rivet" />
          <path d="M14 10 Q16.5 6 22 5.8" className="helmet-shine" />
        </>
      ) : (
        <>
          <path
            d="M4 21 C3 16 6 14.2 9 13.6 C10 4.8 15 2 23 2 C31 2 35.6 5 36.6 12.2 L40.4 13.8 C41.4 15.2 40.8 17.2 39.2 17.6 C30 15.6 20 16 12.6 18 C9.4 19 6.2 21.4 4 21 Z"
            fill="url(#stahl-dome)"
            className="helmet-edge"
          />
          <path
            d="M4 21 C3 16 6 14.2 9 13.6 C10 4.8 15 2 23 2 C31 2 35.6 5 36.6 12.2 L40.4 13.8 C41.4 15.2 40.8 17.2 39.2 17.6 C30 15.6 20 16 12.6 18 C9.4 19 6.2 21.4 4 21 Z"
            className="helmet-steel"
          />
          <path d="M8.5 16.4 Q24 13.2 38.8 15.6" className="helmet-rim" />
          <circle cx="13.5" cy="10.8" r="1.7" className="helmet-lug" />
          <path d="M15 7.5 Q18 3.8 24 3.7" className="helmet-shine" />
        </>
      )}
    </svg>
  );
}

/** A rifle is carried upright at its man's side while he waits */
const RIFLE_AT_SIDE = -90;
/** Where a rifleman grips his rifle at his side, from his middle, in squares: your army holds it on the right, theirs on the left */
const RIFLE_GRIP = { x: 0.2, y: 0.22 };
const gripSide = (color: Color) => (color === Color.White ? 1 : -1);
/** Where a man in the front line holds his rifle to his shoulder, levelled over the parapet */
const RIFLE_SHOULDER = { x: 0.1, y: 0.02 };
const FRONT_RANKS = Object.values(TRENCH_RANKS).map((t) => t.front);
/** How a man on a square holds his rifle: at his shoulder in the front line, otherwise at his side */
const holdFor = (sq: SquareIndex) =>
  FRONT_RANKS.includes(sq >> 4) ? RIFLE_SHOULDER : RIFLE_GRIP;

/** The angle, in degrees, straight at the enemy line, a touch off true so the rifles splay */
function enemyAngle(color: Color, flipped: boolean): number {
  const ahead = towardEnemy(color, flipped);
  return (Math.atan2(ahead.y, ahead.x) * 180) / Math.PI + gripSide(color) * 10;
}

/** The angle, in degrees, from a shooter to where his round is going */
function aimAngle(event: AttackEvent, flipped: boolean): number {
  const dir = heading(event.from, event.to, flipped);
  return (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
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
      if (event.weapon === "bayonet") {
        const struck = { animationDelay: `${event.hitMs}ms` };
        return event.miss ? null : (
          <>
            <span
              className="hit-spark"
              style={{ ...cell(event.to), ...struck }}
            />
            <span
              className={`hit-number${event.kill ? " is-kill" : ""}`}
              style={css({
                ...cell(event.to),
                ...struck,
                "--drift": `${((event.id % 5) - 2) * 6}%`,
              })}
            >
              -{event.damage}
            </span>
          </>
        );
      }
      if (event.weapon) {
        return (
          <Gunshot event={event} flipped={flipped} squareSize={squareSize} />
        );
      }
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
          {!event.miss && (
            <>
              <span
                className="hit-spark"
                style={{ ...cell(event.to), ...hitAt }}
              />
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
          )}
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
    case "shell": {
      const lands = { animationDelay: `${event.delayMs + SHELL_FALL_MS}ms` };
      return (
        <>
          <span
            className="shell-shadow"
            style={{
              ...cell(event.sq),
              animationDelay: `${event.delayMs}ms`,
              animationDuration: `${SHELL_FALL_MS}ms`,
            }}
          />
          <span
            className="shell-flash"
            style={{ ...cell(event.sq), ...lands }}
          />
          <span className="shell-plume" style={{ ...cell(event.sq), ...lands }}>
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
          <span
            className="shell-smoke"
            style={{ ...cell(event.sq), ...lands }}
          />
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
    case "attack": {
      const fired = event.delayMs ?? 0;
      if (event.weapon === "mg") {
        if (event.round === 0) sfx.machineGun();
      } else if (event.weapon === "rifle") {
        later(fired, sfx.rifle);
      } else if (event.weapon === "bayonet") {
        sfx.swing();
      } else if (event.ranged) {
        sfx.bowShot();
      } else {
        sfx.swing();
      }
      if (!event.miss) later(fired + event.hitMs, () => sfx.hit(event.kill));
      break;
    }
    case "death":
      later(event.delayMs, () => sfx.knockout());
      break;
    case "deploy":
      sfx.drop(DROP_MS / 1000);
      break;
    case "shell":
      later(event.delayMs, sfx.incoming);
      later(event.delayMs + SHELL_FALL_MS, () => {
        sfx.boom();
        shakeBoard();
      });
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
