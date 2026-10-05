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
        {arms && (
          <Helmet
            color={piece.color}
            type={piece.type}
            tilt={helmetTilt(unit.id)}
          />
        )}
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
      <GunDefs scale={30} />
      <path d="M15 15.5 Q32 22.5 50 14.2" className="rifle-sling" />
      {/* Butt and wrist: oiled walnut, a steel butt plate, the grip narrowing to the action */}
      <path
        d="M2.2 5.6 Q1.6 4.2 3.4 4 L14 4.6 Q18 5.6 21.5 7.4 L28 8 L28 13.6 L22.5 14 Q18.5 15.4 15 16.8 L3.6 17.8 Q1.6 17.8 1.8 16.2 Z"
        className="gun-wood"
      />
      <path
        d="M2.2 5.6 Q1.6 4.2 3.4 4 L4.4 4 L4.6 17.8 L3.6 17.8 Q1.6 17.8 1.8 16.2 Z"
        className="gun-steel"
      />
      {/* The action: receiver, magazine, bolt with its round knob, trigger guard */}
      <path d="M27 7.2 L40 7.4 L40 14.2 L27 14.4 Z" className="gun-steel" />
      <path
        d="M31 14.2 L37.5 14.2 L37 19.2 Q34 20.2 31.4 19.2 Z"
        className="gun-steel"
      />
      <path d="M26 14.2 Q27 18 30.6 17.2" className="gun-guard" />
      <path d="M36.2 7.4 L38.8 3.2" className="gun-bolt" />
      <circle cx="39.2" cy="2.8" r="1.9" className="gun-steel" />
      <path d="M28 8.4 L39.6 8.6" className="gun-shine" />
      {/* Wood to the nose, with two steel bands, then the nose cap and the muzzle */}
      <path
        d="M39.6 7.8 L59 8.6 Q60.2 9 60.2 10.8 Q60.2 12.6 59 13 L39.6 13.8 Z"
        className="gun-wood"
      />
      <path
        d="M46 7.9 h2.4 v5.7 h-2.4 Z M54 8.3 h2.2 v5 h-2.2 Z"
        className="gun-steel"
      />
      <path
        d="M59.6 8.8 L65.4 9.2 L65.4 12.4 L59.6 12.8 Z"
        className="gun-steel"
      />
      <path d="M40 8.6 L58.6 9.3" className="gun-shine" />
      {/* The bayonet, fixed under the muzzle */}
      <path
        d="M62 12 L64.5 12 L71.8 11.2 L64.5 13.8 L62 13.8 Z"
        className="gun-blade"
      />
      <path d="M64.5 12.6 L71 11.5" className="gun-blade-edge" />
      {/* Light across the top, shadow underneath, so it reads as round */}
      <path
        d="M2.2 5.6 Q1.6 4.2 3.4 4 L14 4.6 Q18 5.6 21.5 7.4 L28 8 L28 13.6 L22.5 14 Q18.5 15.4 15 16.8 L3.6 17.8 Q1.6 17.8 1.8 16.2 Z M39.6 7.8 L59 8.6 Q60.2 9 60.2 10.8 Q60.2 12.6 59 13 L39.6 13.8 Z"
        className="gun-round"
      />
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
        <GunDefs scale={34} />
        {/* The belt of brass rounds feeding in from the side */}
        <path d="M24 23 Q27 29 23 33.5" className="mg-belt-cloth" />
        <path
          d="M25.3 24 l3 -0.4 l0.5 2.8 l-3 0.4 Z M25.8 27.4 l3 0 l0.2 2.8 l-3 0 Z M25.4 30.8 l3 0.3 l-0.2 2.8 l-3 -0.3 Z"
          className="mg-round"
        />
        {/* Spade grips and the thumb trigger between them */}
        <path
          d="M1 9 h7 a1.8 1.8 0 0 1 0 3.6 h-7 a1.8 1.8 0 0 1 0 -3.6 Z M1 20.4 h7 a1.8 1.8 0 0 1 0 3.6 h-7 a1.8 1.8 0 0 1 0 -3.6 Z"
          className="gun-wood"
        />
        <path d="M7.4 8 h3.6 v18 h-3.6 Z" className="gun-steel" />
        {/* The receiver box, riveted, with its feed block and rear sight */}
        <path
          d="M10.6 6.4 h23.4 q1.6 0 1.6 1.6 v18 q0 1.6 -1.6 1.6 h-23.4 Z"
          className="gun-steel"
        />
        <path d="M12.5 9 H33 M12.5 25 H33" className="mg-seam" />
        <path
          d="M14 8 h.1 M20 8 h.1 M26 8 h.1 M32 8 h.1 M14 26 h.1 M20 26 h.1 M26 26 h.1 M32 26 h.1"
          className="mg-rivets"
        />
        <path d="M23 18.5 h6 v9 h-6 Z" className="gun-steel" />
        <path d="M17 3.2 h5 v3.4 h-5 Z" className="gun-steel" />
        {/* The water jacket: a fluted steel drum around the barrel, rounded by the light */}
        <path
          d="M35 8.6 h40 q3.6 0 3.6 3.6 v9.6 q0 3.6 -3.6 3.6 h-40 Z"
          className="mg-jacket"
        />
        <path
          d="M40 9 V25 M45 9 V25 M50 9 V25 M55 9 V25 M60 9 V25 M65 9 V25 M70 9 V25 M75 9.3 V24.7"
          className="mg-flutes"
        />
        <path
          d="M35 8.6 h40 q3.6 0 3.6 3.6 v9.6 q0 3.6 -3.6 3.6 h-40 Z"
          className="gun-round"
        />
        <path d="M36 11.5 H77" className="gun-shine" />
        <circle cx="68" cy="25.6" r="1.4" className="gun-steel" />
        {/* The muzzle and its cone of a flash hider */}
        <path d="M78.4 14 h7 v6 h-7 Z" className="gun-steel" />
        <path d="M85 12.6 L98.4 10 L98.4 24 L85 21.4 Z" className="gun-steel" />
        <path d="M85.5 13.4 L97.8 11.2" className="gun-shine" />
        <path
          d="M10.6 6.4 h23.4 q1.6 0 1.6 1.6 v18 q0 1.6 -1.6 1.6 h-23.4 Z"
          className="gun-round"
        />
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

const GUN_TEXTURES = `${import.meta.env.BASE_URL}textures/trenches/`;

/**
 * Oiled walnut and blued, worn steel from photographs, and the light that
 * rounds a stock or a barrel, at a scale to suit the drawing they fill
 */
function GunDefs({ scale }: { scale: number }) {
  return (
    <defs>
      <pattern
        id={`gun-wood-${scale}`}
        width={scale}
        height={scale}
        patternUnits="userSpaceOnUse"
      >
        <image
          href={`${GUN_TEXTURES}gun_wood.jpg`}
          width={scale}
          height={scale}
          preserveAspectRatio="none"
        />
      </pattern>
      <pattern
        id={`gun-steel-${scale}`}
        width={scale}
        height={scale}
        patternUnits="userSpaceOnUse"
      >
        <image
          href={`${GUN_TEXTURES}gun_steel.jpg`}
          width={scale}
          height={scale}
          preserveAspectRatio="none"
        />
      </pattern>
      <linearGradient id="gun-round" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
        <stop offset="0.3" stopColor="#fff" stopOpacity="0.05" />
        <stop offset="0.6" stopColor="#000" stopOpacity="0.1" />
        <stop offset="1" stopColor="#000" stopOpacity="0.55" />
      </linearGradient>
    </defs>
  );
}

/** A soldier's steel helmet: the flat British one for your army, the German one for theirs */
/** Each man wears his helmet at his own slight angle */
const helmetTilt = (id: number) => (((id * 7919) % 13) - 6) * 1.4;

/** Pieces with a chin for a strap to go under; rooks, queens, and kings wear theirs with no strap showing */
const STRAPPED = new Set<PieceType>([
  PieceType.Pawn,
  PieceType.Bishop,
  PieceType.Knight,
]);

function Helmet({
  color,
  type,
  tilt,
}: {
  color: Color;
  type: PieceType;
  tilt: number;
}) {
  const tommy = color === Color.White;
  const strapped = STRAPPED.has(type);
  return (
    <svg
      className={`unit-helmet helmet-on-${type}`}
      viewBox="0 0 44 26"
      style={{ "--tilt": `${tilt}deg` } as Style}
      aria-hidden
    >
      <defs>
        <radialGradient id="tommy-dome" cx="0.36" cy="0.25" r="0.85">
          <stop offset="0" stopColor="#a49d6c" />
          <stop offset="0.45" stopColor="#6f6942" />
          <stop offset="1" stopColor="#3a3722" />
        </radialGradient>
        <linearGradient id="tommy-brim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a845a" />
          <stop offset="1" stopColor="#4c4830" />
        </linearGradient>
        <radialGradient id="fritz-dome" cx="0.36" cy="0.22" r="0.85">
          <stop offset="0" stopColor="#97a19b" />
          <stop offset="0.45" stopColor="#5e6863" />
          <stop offset="1" stopColor="#2e3532" />
        </radialGradient>
        <pattern
          id="helmet-steel"
          width="44"
          height="26"
          patternUnits="userSpaceOnUse"
        >
          <image
            href={`${GUN_TEXTURES}helmet_metal.jpg`}
            width="44"
            height="44"
            preserveAspectRatio="none"
          />
        </pattern>
      </defs>
      {tommy ? (
        <>
          {/* Its shadow on the head, and the chin strap hanging down */}
          <ellipse cx="22" cy="20" rx="14" ry="3.2" className="helmet-cast" />
          {strapped && (
            <path
              d="M14.5 18.4 Q15.5 24 22 25 Q28.5 24 29.5 18.4"
              className="helmet-strap"
            />
          )}
          <ellipse
            cx="22"
            cy="18.6"
            rx="21"
            ry="4.8"
            className="helmet-under"
          />
          <ellipse
            cx="22"
            cy="17.9"
            rx="12"
            ry="2.3"
            className="helmet-liner"
          />
          <ellipse
            cx="22"
            cy="17"
            rx="21"
            ry="4.5"
            fill="url(#tommy-brim)"
            className="helmet-edge"
          />
          <ellipse cx="22" cy="17" rx="21" ry="4.5" className="helmet-steel" />
          <ellipse cx="22" cy="17" rx="20.4" ry="4" className="helmet-roll" />
          <path
            d="M9.6 17 C10 7 15 3.2 22 3.2 C29 3.2 34 7 34.4 17 Z"
            fill="url(#tommy-dome)"
            className="helmet-edge"
          />
          <path
            d="M9.6 17 C10 7 15 3.2 22 3.2 C29 3.2 34 7 34.4 17 Z"
            className="helmet-steel"
          />
          <circle cx="22" cy="3.9" r="1" className="helmet-rivet" />
          {/* Knocks and dents, and mud splashed up from the trench floor */}
          <path d="M27.5 9 q1.6 1 1 2.6" className="helmet-dent" />
          <path d="M14 12.5 q1.2 -0.4 1.8 0.6" className="helmet-dent" />
          <path
            d="M12 15.6 q1.4 -1.2 2.6 -0.2 q-1 1 -2.6 0.2 Z M30 14.8 q1 -0.8 2 0 q-0.8 0.8 -2 0 Z M5 18.6 q1.6 -0.6 2.4 0.4 q-1.2 0.6 -2.4 -0.4 Z"
            className="helmet-mud"
          />
          <ellipse
            cx="16.5"
            cy="7.5"
            rx="3.6"
            ry="1.6"
            className="helmet-sheen"
          />
        </>
      ) : (
        <>
          <ellipse cx="22" cy="21.5" rx="14" ry="3" className="helmet-cast" />
          {strapped && (
            <path
              d="M13.6 19.6 Q15 25 22 25.8 Q29 25 30.4 19.6"
              className="helmet-strap"
            />
          )}
          <path
            d="M3.6 22.4 Q4.6 16.2 8.2 13.2 C9.2 4.2 15 1.6 22 1.6 C29 1.6 34.8 4.2 35.8 13.2 Q39.4 16.2 40.4 22.4 Q31 19.8 22 19.9 Q13 19.8 3.6 22.4 Z"
            fill="url(#fritz-dome)"
            className="helmet-edge"
          />
          <path
            d="M3.6 22.4 Q4.6 16.2 8.2 13.2 C9.2 4.2 15 1.6 22 1.6 C29 1.6 34.8 4.2 35.8 13.2 Q39.4 16.2 40.4 22.4 Q31 19.8 22 19.9 Q13 19.8 3.6 22.4 Z"
            className="helmet-steel"
          />
          {/* The visor's edge and the flare of the neck guard */}
          <path d="M8.6 15.6 Q22 12.2 35.4 15.6" className="helmet-visor" />
          <path d="M8.2 13.2 Q22 10.4 35.8 13.2" className="helmet-crease" />
          {/* The ventilation lugs, one each side */}
          <circle cx="10.6" cy="10.4" r="1.9" className="helmet-lug" />
          <circle cx="33.4" cy="10.4" r="1.9" className="helmet-lug" />
          <path d="M25 6 q1.6 1.2 0.8 2.8" className="helmet-dent" />
          <path
            d="M14.6 16.8 q1.4 -1.2 2.8 -0.2 q-1 1 -2.8 0.2 Z M28 17.4 q1 -0.8 2.2 0 q-0.8 0.8 -2.2 0 Z M5.6 20.4 q1.4 -0.8 2.4 0.2 q-1.2 0.8 -2.4 -0.2 Z"
            className="helmet-mud"
          />
          <ellipse cx="16" cy="6" rx="3.8" ry="1.7" className="helmet-sheen" />
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
