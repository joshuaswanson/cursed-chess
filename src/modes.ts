import type { ModePlugin } from "./plugins/types";
import type { ThemeId } from "./theme/themes";
import { BattleRoyalePlugin } from "./plugins/battleRoyale";
import { ConveyorPlugin } from "./plugins/conveyor";
import { FinalePlugin } from "./plugins/finale";
import { FogOfWarPlugin } from "./plugins/fogOfWar";
import { FootballPlugin } from "./plugins/football";
import { GravityPlugin } from "./plugins/gravity";
import { ImmortalSnailPlugin } from "./plugins/immortalSnail";
import { KingOfTheHillPlugin } from "./plugins/kingOfTheHill";
import { LanternsPlugin } from "./plugins/lanterns";
import { MinefieldPlugin } from "./plugins/minefield";
import { PortalChessPlugin } from "./plugins/portalChess";
import { RallyPlugin } from "./plugins/clashRoyale";
import { SingularityPlugin } from "./plugins/singularity";
import { StrategoPlugin } from "./plugins/stratego";
import { ThunderstormPlugin } from "./plugins/thunderstorm";
import { TrenchesPlugin } from "./plugins/trenches";
import { TugOfWarPlugin } from "./plugins/tugOfWar";
import { ZombiesPlugin } from "./plugins/zombies";

/** How long the mode's title card owns the screen: the title, then its catchphrase */
export const MODE_CARD_MS = 4200;
/** When the hex board has finished assembling itself */
export const HEX_MORPH_DONE_MS = 6900;

export interface GameMode {
  name: string;
  theme: ThemeId;
  create: () => ModePlugin[];
  durationSeconds?: number;
  /** How long play stays paused after the mode starts */
  introHoldMs?: number;
  isHex?: boolean;
  /** Modes with their own way to add pieces skip the top-up */
  noReinforcements?: boolean;
  /**
   * Modes won some other way than checkmate, so the kings walk off and leave
   * it to the troops. These have no clock: they run until one side wins.
   */
  kingsSitOut?: boolean;
  /** Modes with no clock that run until one side wins, kings and all */
  untilWon?: boolean;
  /** How many ranks deep its board is, where that is not the usual eight */
  ranks?: number;
  /** How many files wide its board is, where that is not the usual eight */
  files?: number;
  /** Left out of the adventure: played only when picked from the main menu */
  singleOnly?: boolean;
  /** Still being tried out: listed apart from the finished modes on the main menu */
  beta?: boolean;
  /** The battle that ends Story Mode, reached only by playing through it */
  finale?: boolean;
}

export const GAME_MODES: GameMode[] = [
  {
    name: "PORTALS",
    theme: "portals",
    create: () => [new PortalChessPlugin()],
  },
  {
    name: "FOG OF WAR",
    theme: "fog",
    create: () => [new FogOfWarPlugin()],
    // The fog drifts in for 5s once the title cards clear
    introHoldMs: MODE_CARD_MS + 5200,
  },
  {
    name: "FIFA",
    theme: "fifa",
    create: () => [new FootballPlugin()],
    kingsSitOut: true,
  },
  {
    name: "TUG OF WAR",
    theme: "tug",
    create: () => [new TugOfWarPlugin()],
    kingsSitOut: true,
  },
  {
    name: "MINEFIELD",
    theme: "mines",
    create: () => [new MinefieldPlugin()],
  },
  {
    name: "BATTLE ROYALE",
    theme: "royale",
    create: () => [new BattleRoyalePlugin()],
    untilWon: true,
  },
  {
    name: "CLASH ROYALE",
    theme: "clash",
    create: () => [new RallyPlugin()],
    noReinforcements: true,
    durationSeconds: 75,
  },
  {
    name: "KING OF THE HILL",
    theme: "hill",
    create: () => [new KingOfTheHillPlugin()],
    kingsSitOut: true,
  },
  {
    name: "THUNDERSTORM",
    theme: "storm",
    create: () => [new ThunderstormPlugin()],
  },
  {
    name: "GRAVITY",
    theme: "gravity",
    create: () => [new GravityPlugin()],
  },
  {
    name: "HEX CHESS",
    theme: "hex",
    create: () => [],
    durationSeconds: 60,
    introHoldMs: HEX_MORPH_DONE_MS,
    isHex: true,
  },
  {
    name: "SINGULARITY",
    theme: "singularity",
    create: () => [new SingularityPlugin()],
    noReinforcements: true,
    untilWon: true,
    singleOnly: true,
    beta: true,
  },
  {
    name: "IMMORTAL SNAIL",
    theme: "snail",
    create: () => [new ImmortalSnailPlugin()],
    noReinforcements: true,
    untilWon: true,
    singleOnly: true,
    beta: true,
  },
  {
    name: "TRENCHES",
    theme: "trenches",
    create: () => [new TrenchesPlugin()],
    noReinforcements: true,
    untilWon: true,
    singleOnly: true,
    beta: true,
  },
  {
    name: "ZOMBIES",
    theme: "zombies",
    create: () => [new ZombiesPlugin()],
  },
  {
    name: "STRATEGO",
    theme: "stratego",
    create: () => [new StrategoPlugin()],
  },
  {
    name: "FACTORY FLOOR",
    theme: "conveyor",
    create: () => [new ConveyorPlugin()],
  },
  {
    name: "LANTERNS",
    theme: "lanterns",
    create: () => [new LanternsPlugin()],
  },
  {
    name: "FINAL BATTLE",
    theme: "finale",
    create: () => [new FinalePlugin()],
    noReinforcements: true,
    untilWon: true,
    finale: true,
  },
];
