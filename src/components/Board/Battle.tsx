import { memo, useEffect, useLayoutEffect, useRef } from "react";
import { Color, PieceType } from "../../engine";
import type { Piece, SquareIndex } from "../../engine";
import { DROP_MS } from "../../plugins/clashRoyale";
import { AIM_MS, SHELL_FALL_MS, TRENCH_RANKS } from "../../plugins/trenches";
import { shakeBoard } from "./useBoardEffects";
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

/**
 * Replays an element's CSS animations from the start each time the key
 * changes: a new shot, flinch, or lunge, without building the element anew
 */
function useReplay<T extends Element>(key: number) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    if (!key) return;
    for (const animation of ref.current?.getAnimations() ?? []) {
      if (!(animation instanceof CSSAnimation)) continue;
      animation.currentTime = 0;
      animation.play();
    }
  }, [key]);
  return ref;
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
  entrenched,
  aiming = false,
}: {
  sq: SquareIndex;
  piece: Piece;
  view: BattleView;
  flipped: boolean;
  squareSize: number;
  /** Charging across open ground, or caught on the wire */
  stance?: "charging" | "snagged" | "peeking" | "crouched";
  /** Down in a trench behind sandbags, the clip-path that hides him below their tops */
  entrenched?: string | null;
  /** Manning the front line, his rifle levelled at the enemy */
  aiming?: boolean;
}) {
  const unit = view.units[sq];
  let arrival: ArrivalEvent | undefined;
  let action: AttackEvent | undefined;
  for (let i = view.events.length - 1; unit && i >= 0; i--) {
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

  const bodyRef = useReplay<HTMLDivElement>(action?.id ?? 0);
  if (!unit) return null;
  const arms = view.arms?.[unit.id];
  const tower = piece.type === PieceType.King;
  const firing =
    action?.unitId === unit.id &&
    (action.weapon === "rifle" ||
      action.weapon === "bayonet" ||
      action.weapon === "sniper")
      ? action
      : undefined;
  const held =
    arms === "sniper"
      ? arms
      : arms === "rifle" || arms === "grenadier"
        ? "rifle"
        : null;
  return (
    <div
      className={`battle-unit side-${team(piece.color)}${tower ? " is-tower" : ""}${stance ? ` is-${stance}` : ""}${entrenched ? " is-entrenched" : ""}${aiming ? " is-aiming" : ""}`}
      style={
        {
          ...arrivalStyle(arrival, flipped, squareSize),
          "--hunch": `${unit.id % 2 ? 9 : -9}deg`,
          ...(entrenched && { "--parapet": entrenched }),
        } as Style
      }
    >
      <span className="unit-base" />
      <div
        ref={bodyRef}
        className="unit-body"
        style={actionStyle(action, unit, flipped, squareSize)}
      >
        <img
          src={pieceImage(piece)}
          alt={`${piece.color}${piece.type}`}
          className="unit-img"
          draggable={false}
        />
        {arms === "general" && (
          <GeneralCap color={piece.color} tilt={helmetTilt(unit.id) * 0.5} />
        )}
        {arms === "general" && <FieldGlasses />}
        {arms && arms !== "general" && (
          <Helmet
            color={piece.color}
            type={piece.type}
            tilt={helmetTilt(unit.id)}
          />
        )}
        {arms === "grenadier" && (
          <GrenadeBelt german={piece.color === Color.Black} />
        )}
        {arms === "vickers" && (
          <CarriedVickers german={piece.color === Color.Black} />
        )}
        {held && (
          <Rifle
            kind={held}
            // A burst's rounds are one swing onto the target, not one each
            shot={firing ? firing.id - (firing.round ?? 0) : 0}
            rest={aiming ? enemyAngle(piece.color, sq, flipped) : RIFLE_AT_SIDE}
            grip={aiming ? RIFLE_SHOULDER : RIFLE_GRIP}
            side={gripSide(sq, flipped)}
            aim={firing ? aimAngle(firing, flipped) : null}
            fireMs={Math.max(0, (firing?.delayMs ?? 0) - AIM_MS)}
            thrust={firing?.weapon === "bayonet"}
            german={piece.color === Color.Black}
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
const Rifle = memo(function Rifle({
  kind,
  rest,
  grip,
  side,
  aim,
  fireMs,
  thrust = false,
  german = false,
  shot,
}: {
  /** Which shot this is, so each new one swings the rifle up afresh */
  shot: number;
  kind: "rifle" | "sniper";
  rest: number;
  /** Where he holds it, from his middle, in squares */
  grip: { x: number; y: number };
  /** Which hand he holds it in: 1 for his right, -1 for his left */
  side: number;
  aim: number | null;
  fireMs: number;
  /** Driven forward with the bayonet, in place of firing */
  thrust?: boolean;
  /** A German's Mauser, in place of a British Lee-Enfield */
  german?: boolean;
}) {
  const style: Style = {
    "--grip-x": `${50 + (side * grip.x * 100) / 0.9}%`,
    "--grip-y": `${50 + (grip.y * 100) / 0.9}%`,
    "--rest": `${rest}deg`,
    "--aim": `${aim ?? rest}deg`,
    "--fire": `${fireMs}ms`,
  };
  const ref = useReplay<SVGSVGElement>(shot);
  return (
    <svg
      ref={ref}
      className={`unit-rifle${aim === null ? "" : thrust ? " thrusting" : " firing"}`}
      viewBox="0 0 72 22"
      style={style}
      aria-hidden
    >
      <GunDefs scale={30} />
      {german ? (
        <Mauser scoped={kind === "sniper"} />
      ) : (
        <Enfield scoped={kind === "sniper"} />
      )}
    </svg>
  );
});

/**
 * A Gewehr 98: a long, slim Mauser with a straight wrist, its magazine flush
 * in the stock, the bolt handle sticking straight out, and the long blade of
 * a butcher bayonet fixed, or for a sniper a sight in its place
 */
function Mauser({ scoped }: { scoped: boolean }) {
  return (
    <>
      <path d="M14 15 Q32 21 52 13.6" className="rifle-sling" />
      <path
        d="M1.6 6.6 Q1.4 5 3 5 L18 6.6 L28 8.2 L28 13.2 L18 14.6 L3.4 16.8 Q1.6 17 1.8 15 Z"
        className="gun-wood"
      />
      <path
        d="M1.6 6.6 Q1.4 5 3 5 L4 5.1 L4.2 16.8 L3.4 16.8 Q1.6 17 1.8 15 Z"
        className="gun-steel"
      />
      <path d="M27 7.8 L37 7.9 L37 13.4 L27 13.6 Z" className="gun-steel" />
      <path d="M33.6 7.9 L35 3.6" className="gun-bolt" />
      <circle cx="35.2" cy="3.2" r="1.5" className="gun-steel" />
      <path d="M25.6 13.4 Q26.8 16.6 30 16" className="gun-guard" />
      <path d="M36.6 8.3 L61 9.1 L61 12.5 L36.6 13.1 Z" className="gun-wood" />
      <path
        d="M44 8.5 h1.8 v4.4 h-1.8 Z M56 8.9 h1.8 v3.6 h-1.8 Z"
        className="gun-steel"
      />
      <path
        d="M60.6 9.4 L66.4 9.7 L66.4 11.9 L60.6 12.2 Z"
        className="gun-steel"
      />
      <path d="M37 9 L60 9.7" className="gun-shine" />
      {scoped ? (
        <>
          <path d="M24.5 1.6 h17 v3.4 h-17 Z" className="gun-steel" />
          <path
            d="M22.6 0.8 h3 v5 h-3 Z M40.8 1 h3.2 v4.6 h-3.2 Z"
            className="gun-steel"
          />
          <path d="M30 5 v2.6 M36 5 v2.6" className="gun-guard" />
          <ellipse cx="44" cy="3.3" rx="0.7" ry="1.9" className="gun-lens" />
        </>
      ) : (
        <>
          <path
            d="M62.5 12.2 L65 12.2 L72 10.9 Q73 11.6 72 12.6 L65 14.6 L62.5 14.4 Z"
            className="gun-blade"
          />
          <path d="M65 13 L71.6 11.6" className="gun-blade-edge" />
        </>
      )}
      <path
        d="M1.6 6.6 Q1.4 5 3 5 L18 6.6 L28 8.2 L28 13.2 L18 14.6 L3.4 16.8 Q1.6 17 1.8 15 Z M36.6 8.3 L61 9.1 L61 12.5 L36.6 13.1 Z"
        className="gun-round"
      />
    </>
  );
}

/** A Lee-Enfield: walnut and blued steel, a bayonet fixed, or for a sniper a telescopic sight in its place */
function Enfield({ scoped }: { scoped: boolean }) {
  return (
    <>
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
      {scoped ? (
        <>
          {/* A telescopic sight, offset over the action */}
          <path d="M24.5 1.4 h18 v3.6 h-18 Z" className="gun-steel" />
          <path
            d="M22.5 0.6 h3 v5.2 h-3 Z M41.5 0.8 h3.4 v4.8 h-3.4 Z"
            className="gun-steel"
          />
          <path d="M30 5 v2.4 M37 5 v2.4" className="gun-guard" />
          <ellipse cx="44.9" cy="3.2" rx="0.7" ry="2" className="gun-lens" />
          <path d="M25 2.2 H42" className="gun-shine" />
        </>
      ) : (
        <>
          {/* The bayonet, fixed under the muzzle */}
          <path
            d="M62 12 L64.5 12 L71.8 11.2 L64.5 13.8 L62 13.8 Z"
            className="gun-blade"
          />
          <path d="M64.5 12.6 L71 11.5" className="gun-blade-edge" />
        </>
      )}
      {/* Light across the top, shadow underneath, so it reads as round */}
      <path
        d="M2.2 5.6 Q1.6 4.2 3.4 4 L14 4.6 Q18 5.6 21.5 7.4 L28 8 L28 13.6 L22.5 14 Q18.5 15.4 15 16.8 L3.6 17.8 Q1.6 17.8 1.8 16.2 Z M39.6 7.8 L59 8.6 Q60.2 9 60.2 10.8 Q60.2 12.6 59 13 L39.6 13.8 Z"
        className="gun-round"
      />
    </>
  );
}

/**
 * A Mills bomb: a cast-iron egg segmented into a grid of studs, painted
 * khaki and worn bare at the edges, the brass filler plug at its base, the
 * striker lever down its side and the ring of the safety pin at its top
 */
function MillsBomb({ id }: { id: string }) {
  const studs: { x: number; y: number }[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 4; col++) {
      const y = -4.2 + row * 2.1;
      const width = 3.4 * Math.sqrt(1 - (y / 5.4) ** 2);
      studs.push({ x: -width + ((col + 0.5) * width * 2) / 4, y });
    }
  }
  return (
    <>
      <defs>
        <radialGradient id={`${id}-iron`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#9a9a6a" />
          <stop offset="0.5" stopColor="#5f6340" />
          <stop offset="1" stopColor="#262818" />
        </radialGradient>
        <clipPath id={`${id}-egg`}>
          <ellipse cx="0" cy="0" rx="4" ry="5.4" />
        </clipPath>
      </defs>
      {/* The striker lever, curving down the side from the top */}
      <path d="M1.2 -5.6 Q4.6 -5.4 4.8 -2 L4.6 3" className="mills-lever" />
      <ellipse
        cx="0"
        cy="0"
        rx="4"
        ry="5.4"
        fill={`url(#${id}-iron)`}
        className="mills-body"
      />
      <g clipPath={`url(#${id}-egg)`}>
        <path
          d="M-5 -3.2 Q0 -2.7 5 -3.2 M-5 -1.1 Q0 -0.6 5 -1.1 M-5 1 Q0 1.5 5 1 M-5 3.1 Q0 3.6 5 3.1 M-1.8 -6 Q-2.3 0 -1.8 6 M1.8 -6 Q2.3 0 1.8 6 M0 -6 V6"
          className="mills-grooves"
        />
        {studs.map((p, i) => (
          <ellipse
            key={i}
            cx={p.x - 0.25}
            cy={p.y - 0.3}
            rx="0.45"
            ry="0.35"
            className="mills-glint"
          />
        ))}
      </g>
      <path d="M-1.6 5 h3.2 v1.3 h-3.2 Z" className="mills-plug" />
      <path d="M-1 -5.2 h2 v-1.2 h-2 Z" className="mills-cap" />
      <circle cx="-1.8" cy="-6.6" r="1.3" className="mills-ring" />
    </>
  );
}

/**
 * A German stick grenade, the potato masher: a sheet-steel can of
 * explosive on a turned wooden handle, the pull cord's porcelain bead
 * tucked in the end of the handle
 */
function StickGrenade() {
  return (
    <>
      <rect
        x="-1.2"
        y="-1"
        width="2.4"
        height="13"
        rx="0.8"
        className="stick-handle"
      />
      <path d="M-1.2 4 H1.2 M-1.2 8 H1.2" className="stick-grain" />
      <circle cx="0" cy="12.4" r="0.7" className="stick-bead" />
      <rect
        x="-3.6"
        y="-7.4"
        width="7.2"
        height="7"
        rx="1.2"
        className="stick-head"
      />
      <path d="M-3.6 -6.2 H3.6 M-3.6 -1.6 H3.6" className="stick-seam" />
      <path d="M-2.6 -6.8 V-1" className="stick-shine" />
    </>
  );
}

/** Grenades hung on an assault trooper's belt: Mills bombs for your army, stick grenades for theirs */
const GrenadeBelt = memo(function GrenadeBelt({
  german = false,
}: {
  german?: boolean;
}) {
  return german ? (
    <svg className="unit-grenades german" viewBox="-11 -9 22 23" aria-hidden>
      <g transform="translate(-5 0) rotate(-14)">
        <StickGrenade />
      </g>
      <g transform="translate(5 1) rotate(12)">
        <StickGrenade />
      </g>
    </svg>
  ) : (
    <svg className="unit-grenades" viewBox="-11 -7.5 22 15" aria-hidden>
      <g transform="translate(-5 0) rotate(-8)">
        <MillsBomb id="belt-a" />
      </g>
      <g transform="translate(5.5 0.5) rotate(10)">
        <MillsBomb id="belt-b" />
      </g>
    </svg>
  );
});

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

/** The Vickers gun itself: water jacket, receiver, spade grips, flash hider, and its belt of rounds */
function VickersBody({ german = false }: { german?: boolean }) {
  if (german) return <Mg08Body />;
  return (
    <>
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
    </>
  );
}

/**
 * The MG 08, the German Maxim: a smooth, plump water jacket with its filler
 * cap, the bulbous muzzle booster at its end, the receiver and spade grips
 * behind, and its belt of rounds
 */
function Mg08Body() {
  return (
    <>
      <GunDefs scale={34} />
      <path d="M24 23 Q27 29 23 33.5" className="mg-belt-cloth" />
      <path
        d="M25.3 24 l3 -0.4 l0.5 2.8 l-3 0.4 Z M25.8 27.4 l3 0 l0.2 2.8 l-3 0 Z M25.4 30.8 l3 0.3 l-0.2 2.8 l-3 -0.3 Z"
        className="mg-round"
      />
      <path
        d="M1 9 h7 a1.8 1.8 0 0 1 0 3.6 h-7 a1.8 1.8 0 0 1 0 -3.6 Z M1 20.4 h7 a1.8 1.8 0 0 1 0 3.6 h-7 a1.8 1.8 0 0 1 0 -3.6 Z"
        className="gun-wood"
      />
      <path d="M7.4 8 h3.6 v18 h-3.6 Z" className="gun-steel" />
      <path
        d="M10.6 6.8 h22 q1.6 0 1.6 1.6 v17.2 q0 1.6 -1.6 1.6 h-22 Z"
        className="gun-steel"
      />
      <path d="M12.5 9.4 H31.6 M12.5 24.6 H31.6" className="mg-seam" />
      <path d="M23 18.5 h6 v9 h-6 Z" className="gun-steel" />
      {/* The jacket, smooth and fat, and its filler cap */}
      <path
        d="M33.6 8.2 h38 q4.4 0 4.4 4.4 v8.8 q0 4.4 -4.4 4.4 h-38 Z"
        className="mg-jacket mg08-jacket"
      />
      <path d="M56 6.2 h4.4 v2.6 h-4.4 Z" className="gun-steel" />
      <path
        d="M33.6 8.2 h38 q4.4 0 4.4 4.4 v8.8 q0 4.4 -4.4 4.4 h-38 Z"
        className="gun-round"
      />
      <path d="M35 11.2 H74" className="gun-shine" />
      {/* The muzzle booster, a round bulb on the end of the barrel */}
      <path d="M76 14.4 h6 v5.2 h-6 Z" className="gun-steel" />
      <ellipse cx="88" cy="17" rx="7" ry="5.6" className="gun-steel" />
      <ellipse cx="86.4" cy="15" rx="3.6" ry="1.6" className="gun-shine-fill" />
      <path d="M94.6 15.4 h3.6 v3.2 h-3.6 Z" className="gun-steel" />
      <path
        d="M10.6 6.8 h22 q1.6 0 1.6 1.6 v17.2 q0 1.6 -1.6 1.6 h-22 Z"
        className="gun-round"
      />
    </>
  );
}

/** A machine gunner's Vickers, or a German's MG 08, carried over his shoulder until he digs it in */
const CarriedVickers = memo(function CarriedVickers({
  german = false,
}: {
  german?: boolean;
}) {
  return (
    <svg className="carried-vickers" viewBox="0 0 100 34" aria-hidden>
      <VickersBody german={german} />
    </svg>
  );
});

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
      {color === Color.White ? (
        <svg className="mg-tripod" viewBox="0 0 40 40">
          <path
            d="M20 20 L5 35 M20 20 L35 35 M20 20 L20 3"
            className="mg-legs"
          />
          <path d="M3 35 h5 M32 35 h5 M18 3 h4" className="mg-feet" />
          <circle cx="20" cy="20" r="4.5" className="mg-head" />
        </svg>
      ) : (
        /* The MG 08's sled mount: a heavy steel frame that folds out flat */
        <svg className="mg-tripod mg-sled" viewBox="0 0 40 40">
          <path d="M8 36 L12 8 L28 8 L32 36" className="mg-legs" />
          <path d="M10 24 H30 M11 15 H29" className="mg-legs" />
          <path d="M6 36 h5 M29 36 h5" className="mg-feet" />
          <circle cx="20" cy="20" r="4.5" className="mg-head" />
        </svg>
      )}
      <svg className="mg-gun" viewBox="0 0 100 34">
        <VickersBody german={color === Color.Black} />
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
            gripSide(event.from, flipped) * holdFor(event.from).x * squareSize,
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
/**
 * A general's peaked cap, for the king: khaki with the scarlet band and
 * gilt badge of a British staff general, or field grey with the red band
 * and cockade of a German one, the peak trimmed with gold oak leaves
 */
const GeneralCap = memo(function GeneralCap({
  color,
  tilt,
}: {
  color: Color;
  tilt: number;
}) {
  const british = color === Color.White;
  return (
    <svg
      className="unit-helmet general-cap"
      viewBox="0 0 44 26"
      style={{ "--tilt": `${tilt}deg` } as Style}
      aria-hidden
    >
      <defs>
        <linearGradient id={`cap-crown-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={british ? "#a99a6a" : "#8d958e"} />
          <stop offset="1" stopColor={british ? "#6f6440" : "#59615b"} />
        </linearGradient>
      </defs>
      {/* The crown, wide and flat on top, swelling out over the band */}
      <path
        d="M6 10 Q4 4 22 3 Q40 4 38 10 L35 14 L9 14 Z"
        fill={`url(#cap-crown-${color})`}
        className="cap-edge"
      />
      <path d="M8 6.5 Q22 4 36 6.5" className="cap-crease" />
      {/* The scarlet band, and the badge on it */}
      <path d="M9 13 L35 13 L34.6 18 L9.4 18 Z" className="cap-band" />
      {british ? (
        <path
          d="M22 9.6 l1.4 2.4 l2.6 0.2 l-2 1.8 l0.7 2.6 l-2.7 -1.4 l-2.7 1.4 l0.7 -2.6 l-2 -1.8 l2.6 -0.2 Z"
          className="cap-badge"
        />
      ) : (
        <>
          <circle cx="22" cy="10.4" r="1.6" className="cap-cockade-outer" />
          <circle cx="22" cy="15.5" r="1.9" className="cap-cockade-outer" />
          <circle cx="22" cy="15.5" r="0.9" className="cap-cockade-inner" />
        </>
      )}
      {/* The peak, black and glossy, with gold oak leaves along it */}
      <path
        d="M8.6 17.6 Q22 16.4 35.4 17.6 Q30 23 22 23 Q14 23 8.6 17.6 Z"
        className="cap-peak"
      />
      <path
        d="M12 19 q2 -1 3 0 q1 -1 3 0 q1 -1 3 0 q1 -1 3 0 q1 -1 3 0 q1 -1 3 0"
        className="cap-oak"
      />
      <path d="M14 18.4 Q22 17.6 30 18.4" className="cap-gloss" />
    </svg>
  );
});

/** A general's field glasses, hung on their strap */
const FieldGlasses = memo(function FieldGlasses() {
  return (
    <svg className="field-glasses" viewBox="0 0 20 14" aria-hidden>
      <path d="M3 1 Q10 6 17 1" className="glasses-strap" />
      <rect
        x="2.6"
        y="4.4"
        width="6"
        height="8.4"
        rx="2"
        className="glasses-barrel"
      />
      <rect
        x="11.4"
        y="4.4"
        width="6"
        height="8.4"
        rx="2"
        className="glasses-barrel"
      />
      <rect
        x="8.2"
        y="6.4"
        width="3.6"
        height="2.6"
        rx="0.6"
        className="glasses-barrel"
      />
      <ellipse cx="5.6" cy="12.4" rx="2.4" ry="0.9" className="glasses-lens" />
      <ellipse cx="14.4" cy="12.4" rx="2.4" ry="0.9" className="glasses-lens" />
    </svg>
  );
});

/** Each man wears his helmet at his own slight angle */
const helmetTilt = (id: number) => (((id * 7919) % 13) - 6) * 1.4;

/** Pieces with a chin for a strap to go under; rooks, queens, and kings wear theirs with no strap showing */
const STRAPPED = new Set<PieceType>([
  PieceType.Pawn,
  PieceType.Bishop,
  PieceType.Knight,
]);

const Helmet = memo(function Helmet({
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
            href={`${GUN_TEXTURES}helmet_grain.png`}
            width="44"
            height="44"
            preserveAspectRatio="none"
          />
        </pattern>
        <radialGradient id="helmet-sheen">
          <stop offset="0.3" stopColor="#fffce6" stopOpacity="0.26" />
          <stop offset="1" stopColor="#fffce6" stopOpacity="0" />
        </radialGradient>
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
});

/**
 * A soldier in his kit, standing still, for showing him off the board: on a
 * squad card, his helmet, his weapon, and whatever else he carries
 */
export function Soldier({ type, color }: { type: PieceType; color: Color }) {
  const piece = { type, color };
  return (
    <span className="soldier unit-body">
      <img
        src={pieceImage(piece)}
        alt=""
        className="unit-img"
        draggable={false}
      />
      {type === PieceType.King ? (
        <>
          <GeneralCap color={color} tilt={0} />
          <FieldGlasses />
        </>
      ) : (
        <Helmet
          color={color}
          type={type}
          tilt={type === PieceType.Rook ? 0 : -4}
        />
      )}
      {type === PieceType.Knight && (
        <GrenadeBelt german={color === Color.Black} />
      )}
      {type === PieceType.Rook && (
        <CarriedVickers german={color === Color.Black} />
      )}
      {(type === PieceType.Pawn ||
        type === PieceType.Knight ||
        type === PieceType.Queen ||
        type === PieceType.Bishop) && (
        <Rifle
          kind={type === PieceType.Bishop ? "sniper" : "rifle"}
          rest={RIFLE_AT_SIDE}
          grip={RIFLE_GRIP}
          side={1}
          aim={null}
          fireMs={0}
          shot={0}
          german={color === Color.Black}
        />
      )}
    </span>
  );
}

/** A rifle is carried upright at its man's side while he waits */
const RIFLE_AT_SIDE = -90;
/** Where a rifleman grips his rifle at his side, from his middle, in squares */
const RIFLE_GRIP = { x: 0.2, y: 0.22 };
/** Which side of a man, on screen, his rifle is on: toward the middle of the board, so the two halves of the line face inward */
const gripSide = (sq: SquareIndex, flipped: boolean) =>
  visualCol(sq, flipped) < 4 ? 1 : -1;
/** Where a man in the front line holds his rifle to his shoulder, levelled over the parapet */
const RIFLE_SHOULDER = { x: 0.1, y: 0.02 };
const FRONT_RANKS = Object.values(TRENCH_RANKS).map((t) => t.front);
/** How a man on a square holds his rifle: at his shoulder in the front line, otherwise at his side */
const holdFor = (sq: SquareIndex) =>
  FRONT_RANKS.includes(sq >> 4) ? RIFLE_SHOULDER : RIFLE_GRIP;

/** The angle, in degrees, straight at the enemy line, a touch off true so the rifles splay */
function enemyAngle(color: Color, sq: SquareIndex, flipped: boolean): number {
  const ahead = towardEnemy(color, flipped);
  return (
    (Math.atan2(ahead.y, ahead.x) * 180) / Math.PI + gripSide(sq, flipped) * 10
  );
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

/** A repeatable scatter in [0, 1), so an explosion's debris flies the same way each render */
const scatter = (n: number) => {
  const v = Math.sin(n * 78.233 + 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * A high-explosive burst: a white-hot flash, a fireball rolling outward and
 * darkening to smoke, a column of earth and clods hurled up and raining back
 * down, and a pall of black smoke that climbs and hangs. Size 1 is a shell,
 * spanning several squares.
 */
function Explosion({
  id,
  style,
  delayMs,
  size,
}: {
  id: number;
  style: Style;
  delayMs: number;
  size: number;
}) {
  const clods = Array.from({ length: Math.round(34 * size + 10) }, (_, i) => {
    const r = (k: number) => scatter(id * 97 + i * 13 + k);
    const up = 0.6 + r(1) * 2.2;
    return {
      dx: (r(2) * 2 - 1) * (0.4 + up * 0.35),
      up,
      fall: 0.2 + r(3) * 0.9,
      size: 2 + r(4) * 9,
      dur: 0.7 + r(5) * 0.7,
      spin: (r(6) * 2 - 1) * 900,
      tone: r(7),
      shape: `${30 + r(8) * 40}% ${30 + r(9) * 40}% ${30 + r(10) * 40}% ${30 + r(11) * 40}%`,
    };
  });
  const puffs = Array.from({ length: 9 }, (_, i) => {
    const r = (k: number) => scatter(id * 61 + i * 7 + k + 500);
    return {
      x: (r(1) * 2 - 1) * 0.55,
      rise: 0.6 + r(2) * 1.6,
      size: 0.9 + r(3) * 1.1,
      delay: r(4) * 0.35,
      drift: (r(5) * 2 - 1) * 0.5,
      shade: 30 + r(6) * 40,
    };
  });
  return (
    <span
      className="explosion"
      style={css({
        ...style,
        "--blast": String(size),
        "--at": `${delayMs}ms`,
      })}
    >
      <span className="blast-smoke">
        {puffs.map((p, i) => (
          <i
            key={i}
            style={css({
              "--x": String(p.x),
              "--rise": String(p.rise),
              "--size": String(p.size),
              "--drift": String(p.drift),
              "--shade": `rgb(${p.shade}, ${p.shade - 4}, ${p.shade - 8})`,
              animationDelay: `calc(var(--at) + ${(p.delay * 1000).toFixed(0)}ms)`,
            })}
          />
        ))}
      </span>
      <span className="blast-fire">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="blast-flash" />
      <span className="blast-earth">
        {clods.map((c, i) => (
          <i
            key={i}
            style={css({
              "--dx": String(c.dx),
              "--up": String(c.up),
              "--fall": String(c.fall),
              "--size": String(c.size),
              "--spin": `${c.spin}deg`,
              "--tone":
                c.tone > 0.6 ? "#2a1d12" : c.tone > 0.3 ? "#3d2c1c" : "#55402a",
              borderRadius: c.shape,
              animationDuration: `${c.dur.toFixed(2)}s`,
            })}
          />
        ))}
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
      if (event.weapon === "bayonet" || event.weapon === "shrapnel") {
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
    case "grenade": {
      const travel = offsetBetween(event.to, event.from, flipped, squareSize);
      return (
        <>
          <span
            className="grenade-flight"
            style={css({
              ...cell(event.from),
              "--dx": px(travel.x),
              "--dy": px(travel.y),
              "--lob": px(
                -squareSize *
                  (0.7 + Math.hypot(travel.x, travel.y) / squareSize / 4),
              ),
              animationDelay: `${event.delayMs}ms`,
              animationDuration: `${event.flightMs}ms`,
            })}
          >
            <span
              className="grenade-arc"
              style={{
                animationDelay: `${event.delayMs}ms`,
                animationDuration: `${event.flightMs}ms`,
              }}
            >
              <svg className="grenade-bomb" viewBox="-6 -8 12 15">
                {event.color === Color.Black ? (
                  <StickGrenade />
                ) : (
                  <MillsBomb id={`thrown-${event.id}`} />
                )}
              </svg>
            </span>
          </span>
          <Explosion
            id={event.id}
            style={cell(event.to)}
            delayMs={event.delayMs + event.flightMs}
            size={0.6}
          />
        </>
      );
    }
    case "shell":
      return (
        <Explosion
          id={event.id}
          style={{
            ...cell(event.sq),
            // On the spot in the square where its crater opens
            translate: `${((flipped ? 1 - event.at.x : event.at.x) - 0.5) * 100}% ${((flipped ? event.at.y : 1 - event.at.y) - 0.5) * 100}%`,
          }}
          delayMs={event.delayMs + SHELL_FALL_MS}
          size={1.7}
        />
      );
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
        if (event.round === 0) later(fired, sfx.machineGun);
      } else if (event.weapon === "rifle") {
        later(fired, sfx.rifle);
      } else if (event.weapon === "sniper") {
        later(fired, sfx.sniper);
      } else if (event.weapon === "shrapnel") {
        break;
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
    case "grenade":
      later(event.delayMs, sfx.swing);
      later(event.delayMs + event.flightMs, () => {
        sfx.grenade();
        shakeBoard();
      });
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
