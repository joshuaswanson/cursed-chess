import { useEffect } from "react";
import { Board } from "./components/Board/Board";
import { PromotionDialog } from "./components/PromotionDialog/PromotionDialog";
import { ShowCards } from "./components/Show/ShowCards";
import { CurseIntro } from "./components/Show/CurseIntro";
import { HexWarp } from "./components/HexWarp/HexWarp";
import { MoveCountdown } from "./components/Countdown/MoveCountdown";
import { SkipBanner } from "./components/Board/SkipBanner";
import { Hud } from "./components/Hud/Hud";
import { PageFog } from "./components/Fog/Fog";
import { Logo } from "./components/Logo/Logo";
import {
  BoringFooter,
  BoringHeader,
  BoringSidebar,
} from "./components/BoringSite/BoringSite";
import { useGameStore } from "./stores/gameStore";
import { useAddress } from "./hooks/useAddress";
import { useGameLoop } from "./hooks/useGameLoop";
import { music } from "./audio/music";
import { sfx } from "./audio/sfx";
import { useTheme } from "./theme/useTheme";
import { themeVars } from "./theme/themes";
import "./styles/global.css";
import { ChessbotCorner } from "./components/Chessbot/ChessbotCorner";
import { BotWindows } from "./components/BoringSite/BotWindows";
import type { FinalePlugin } from "./plugins/finale";
import { t, useLanguage } from "./i18n";
import { later } from "./utils/later";

const HexBoard = later(() =>
  import("./components/HexBoard/HexBoard").then((m) => m.HexBoard),
);
const FoeRallyBar = later(() =>
  import("./components/RallyPanel/RallyPanel").then((m) => m.FoeRallyBar),
);
const YourRallyBar = later(() =>
  import("./components/RallyPanel/RallyPanel").then((m) => m.YourRallyBar),
);
const Backdrop = later(() =>
  import("./components/Backdrop/Backdrop").then((m) => m.Backdrop),
);
const SpaceTraffic = later(() =>
  import("./components/Backdrop/SpaceTraffic").then((m) => m.SpaceTraffic),
);
const TrenchOrders = later(() =>
  import("./components/Trenches/TrenchOrders").then((m) => m.TrenchOrders),
);
const TrenchWeather = later(() =>
  import("./components/Trenches/TrenchWeather").then((m) => m.TrenchWeather),
);
const StormWeather = later(() =>
  import("./components/Board/StormWeather").then((m) => m.StormWeather),
);
const BoringPage = later(() =>
  import("./components/BoringSite/BoringPages").then((m) => m.BoringPage),
);
const MainMenu = later(() =>
  import("./components/MainMenu/MainMenu").then((m) => m.MainMenu),
);
const PauseMenu = later(() =>
  import("./components/PauseMenu/PauseMenu").then((m) => m.PauseMenu),
);
const ModeSwap = later(() =>
  import("./components/Show/ModeSwap").then((m) => m.ModeSwap),
);
const DevNote = later(() =>
  import("./components/DevNote/DevNote").then((m) => m.DevNote),
);
const FinaleEnding = later(() =>
  import("./components/Show/FinaleEnding").then((m) => m.FinaleEnding),
);
const SingularityBoard = later(() =>
  import("./components/SingularityBoard/SingularityBoard").then(
    (m) => m.SingularityBoard,
  ),
);

function App() {
  // Everything is drawn again in a newly chosen language
  useLanguage();
  useGameLoop();
  useAddress();
  const theme = useTheme();
  const cursed = useGameStore((s) => s.cursed);
  const curseStage = useGameStore((s) => s.curseStage);
  const playMode = useGameStore((s) => s.playMode);
  const menuOpen = useGameStore((s) => s.menuOpen);
  const aside = useGameStore((s) => s.aside);
  const corruption = useGameStore((s) => s.corruption);
  const isHexMode = useGameStore((s) => s.isHexMode);
  const singular = useGameStore((s) => !!s.pluginManager.find("singularity"));
  const hexTransition = useGameStore((s) => s.hexTransition);
  const introDone = useGameStore((s) => s.introDone);
  const siteTab = useGameStore((s) => s.siteTab);
  const userPaused = useGameStore((s) => s.userPaused);
  const modeIndex = useGameStore((s) => s.currentModeIndex);
  const finale = useGameStore((s) => s.finaleStage);
  const fighting = finale === "battle" || finale === "deleting";
  // The rain and the bolts from the sky come with the storm in the final battle
  const finaleStorm = useGameStore(
    (s) =>
      s.finaleStage === "battle" &&
      !!s.pluginManager.find<FinalePlugin>("finale")?.acts.includes("storm"),
  );
  const pauseShown = cursed && userPaused && !menuOpen;
  const onFakePage = !cursed && siteTab !== "Play";

  useEffect(() => {
    document.title = cursed ? "CURSED CHESS" : t("Totally Normal Chess");
  }, [cursed]);

  // The soundtrack kicks in once the curse takes hold. It stays off in the
  // trenches, where there is only the guns and the rain.
  // It cuts out as Chessbot is deleted, and comes back for the credits
  const musicOn =
    finale === "credits" ||
    (cursed && theme.id !== "trenches" && !pauseShown && finale !== "deleting");
  useEffect(() => {
    music.set(musicOn);
  }, [musicOn]);

  useEffect(() => {
    sfx.hold(pauseShown);
  }, [pauseShown]);

  // In FIFA the top goal reaches up under the logo, and a click there is a shot
  const pauseFromLogo = (e: React.MouseEvent) => {
    const goal = document
      .elementsFromPoint(e.clientX, e.clientY)
      .find((el) => el.matches(".goal.attacked"));
    if (goal instanceof HTMLElement) goal.click();
    else useGameStore.getState().togglePause();
  };

  // Each mode gets a board of its own, so nothing done to the last one carries over
  const board = isHexMode ? (
    <div
      key={`hex-${modeIndex}`}
      className={hexTransition === "morph-in" ? "hex-morph-in" : ""}
    >
      <HexBoard />
    </div>
  ) : singular ? (
    <div key={`singularity-${modeIndex}`}>
      <SingularityBoard />
    </div>
  ) : (
    <div
      key={`board-${modeIndex}`}
      className={hexTransition === "morph-out" ? "hex-morph-out" : ""}
    >
      <Board />
    </div>
  );

  const appClass =
    "app" +
    (cursed ? " is-cursed" : " is-boring") +
    (curseStage ? ` curse-${curseStage}` : "") +
    // Still glitching while he gloats
    (curseStage === "oops" ? " curse-glitch" : "") +
    // Each line of his speech leaves the plain site a step worse, and none
    // of it mends
    (cursed || !curseStage
      ? ""
      : Array.from({ length: corruption }, (_, i) => ` corrupt-${i + 1}`).join(
          "",
        )) +
    // Your first move lets him through: the plain site glitches hard as he
    // breaks in and again as he is shut out, twitches while he types, and
    // then holds still while you think over your next move
    (fighting ? " is-finale" : "") +
    (finale === "deleting" ? " finale-deleting" : "") +
    (finale === "peek" ? " finale-hiccup" : "") +
    (cursed || !aside || aside === "said"
      ? ""
      : aside === "typing"
        ? " unease-typing"
        : " unease-burst");

  // The menu covers everything, so nothing under it is kept on the page: a
  // whole board and its backdrop would only be laid out and animated unseen
  if (menuOpen) {
    return (
      <div className={appClass} style={themeVars(theme)} data-theme={theme.id}>
        <MainMenu />
      </div>
    );
  }

  return (
    <div className={appClass} style={themeVars(theme)} data-theme={theme.id}>
      {cursed && <Backdrop theme={theme.id} />}
      {/* While he breaks the plain site he peeks up from the corner of the
          screen; once the game is his, he sits in the panel beside the board */}
      {!cursed && curseStage !== null && curseStage !== "hello" && (
        <ChessbotCorner />
      )}
      {cursed ? (
        <header className="topbar">
          <button
            type="button"
            className="logo-button"
            aria-label={t("Pause")}
            onClick={pauseFromLogo}
          >
            <Logo />
          </button>
        </header>
      ) : (
        <BoringHeader />
      )}
      {onFakePage ? (
        <main className="stage">
          <BoringPage tab={siteTab} />
        </main>
      ) : (
        <main className="stage">
          <div className="board-container">
            {cursed && <FoeRallyBar />}
            <div className="board-stack">
              {board}
              <MoveCountdown />
              {/* Where Chessbot is not there to say so, a banner does */}
              {(!cursed || playMode === "single") && <SkipBanner />}
            </div>
            {cursed && <YourRallyBar />}
            {cursed && theme.id === "trenches" && <TrenchOrders />}
          </div>
          {cursed ? <Hud /> : <BoringSidebar />}
        </main>
      )}
      {!cursed && <BoringFooter />}
      {!cursed && <BotWindows />}
      <PageFog active={theme.id === "fog" && introDone} />
      {cursed && theme.id === "portals" && <SpaceTraffic />}
      {cursed && theme.id === "trenches" && <TrenchWeather />}
      {cursed && (theme.id === "storm" || finaleStorm) && (
        <StormWeather rainy={theme.id === "storm"} />
      )}
      {cursed && <ModeSwap />}
      <DevNote />
      <FinaleEnding />
      {pauseShown && <PauseMenu />}
      <PromotionDialog />
      <ShowCards />
      <CurseIntro />
      <HexWarp />
    </div>
  );
}

export default App;
