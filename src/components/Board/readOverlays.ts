import type { SquareIndex } from "../../engine";
import type { BoardOverlay } from "../../plugins/types";
import type { PortalColor } from "../../plugins/portalChess";
import type { BattleRoyaleOverlay } from "../../plugins/battleRoyale";
import type { BattleView } from "../../plugins/clashRoyale";
import type { FootballView } from "../../plugins/football";
import type { TugView } from "../../plugins/tugOfWar";
import type { ZombieView } from "../../plugins/zombies";

export interface PortalPair {
  a: SquareIndex;
  b: SquareIndex;
  color: PortalColor;
}

export interface BoardOverlays {
  portalSquares: Map<SquareIndex, PortalColor>;
  portalPairs: PortalPair[];
  hasFog: boolean;
  hasRally: boolean;
  rallyBattle: BattleView | null;
  football: FootballView | null;
  tug: TugView | null;
  zombies: ZombieView | null;
  hillSquares: SquareIndex[];
  /** Rounds each side has held the hill in a row, and how many it takes to win */
  hillStreak: { white: number; black: number; needed: number };
  battleRoyale: BattleRoyaleOverlay | null;
  gravityDirection: string | null;
  gravityAngle: number | null;
  gravityMoves: { from: SquareIndex; to: SquareIndex }[];
  strategoHidden: Set<SquareIndex>;
  strategoLakes: Set<SquareIndex>;
  pendingExplosions: SquareIndex[];
}

/** Gather every active mode's overlays into the data the board renders from */
export function readOverlays(overlays: BoardOverlay[]): BoardOverlays {
  const result: BoardOverlays = {
    portalSquares: new Map(),
    portalPairs: [],
    hasFog: false,
    hasRally: false,
    rallyBattle: null,
    football: null,
    tug: null,
    zombies: null,
    hillSquares: [],
    hillStreak: { white: 0, black: 0, needed: 3 },
    battleRoyale: null,
    gravityDirection: null,
    gravityAngle: null,
    gravityMoves: [],
    strategoHidden: new Set(),
    strategoLakes: new Set(),
    pendingExplosions: [],
  };

  for (const overlay of overlays) {
    switch (overlay.type) {
      case "portal": {
        if (overlay.squares.length !== 2) break;
        const color =
          (overlay.data as { color?: PortalColor })?.color ?? "blue";
        const [a, b] = overlay.squares;
        result.portalPairs.push({ a, b, color });
        result.portalSquares.set(a, color);
        result.portalSquares.set(b, color);
        break;
      }
      case "fog-overlay":
        result.hasFog = true;
        break;
      case "rally-resources":
        result.hasRally = true;
        break;
      case "king-of-hill": {
        result.hillSquares = overlay.squares;
        const data = overlay.data as {
          whiteDomination: number;
          blackDomination: number;
          dominationNeeded: number;
        };
        result.hillStreak = {
          white: data.whiteDomination,
          black: data.blackDomination,
          needed: data.dominationNeeded,
        };
        break;
      }
      case "football":
        result.football = overlay.data as FootballView;
        break;
      case "rally-battle":
        result.rallyBattle = overlay.data as BattleView;
        break;
      case "gravity": {
        const data = overlay.data as {
          direction?: string;
          angle?: number;
          moves?: { from: SquareIndex; to: SquareIndex }[];
        };
        result.gravityDirection = data?.direction ?? null;
        result.gravityAngle = data?.angle ?? null;
        result.gravityMoves = data?.moves ?? [];
        break;
      }
      case "battle-royale":
        result.battleRoyale = overlay.data as BattleRoyaleOverlay;
        break;
      case "stratego-hidden":
        result.strategoHidden = new Set(overlay.squares);
        break;
      case "stratego-lake":
        result.strategoLakes = new Set(overlay.squares);
        break;
      case "minefield":
        result.pendingExplosions = overlay.squares;
        break;
      case "zombies":
        result.zombies = overlay.data as ZombieView;
        break;
      case "tug-of-war":
        result.tug = overlay.data as TugView;
        break;
    }
  }
  return result;
}
