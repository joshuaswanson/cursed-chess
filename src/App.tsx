import { useEffect } from "react";
import { Board } from "./components/Board/Board";
import { HexBoard } from "./components/HexBoard/HexBoard";
import { PromotionDialog } from "./components/PromotionDialog/PromotionDialog";
import { ShowCards } from "./components/Show/ShowCards";
import { CurseIntro } from "./components/Show/CurseIntro";
import { HexWarp } from "./components/HexWarp/HexWarp";
import { MoveCountdown } from "./components/Countdown/MoveCountdown";
import { SkipBanner } from "./components/Board/SkipBanner";
import { Hud } from "./components/Hud/Hud";
import { FoeRallyBar, YourRallyBar } from "./components/RallyPanel/RallyPanel";
import { Backdrop } from "./components/Backdrop/Backdrop";
import { SpaceTraffic } from "./components/Backdrop/SpaceTraffic";
import { TrenchOrders } from "./components/Trenches/TrenchOrders";
import { TrenchWeather } from "./components/Trenches/TrenchWeather";
import { StormWeather } from "./components/Board/StormWeather";
import { BoringPage } from "./components/BoringSite/BoringPages";
import { PageFog } from "./components/Fog/Fog";
import { Logo } from "./components/Logo/Logo";
import {
  BoringFooter,
  BoringHeader,
  BoringSidebar,
} from "./components/BoringSite/BoringSite";
import { useGameStore } from "./stores/gameStore";
import { useGameLoop } from "./hooks/useGameLoop";
import { music } from "./audio/music";
import { sfx } from "./audio/sfx";
import { useTheme } from "./theme/useTheme";
import { themeVars } from "./theme/themes";
import "./styles/global.css";
import { ChessbotCorner } from "./components/Chessbot/ChessbotCorner";
import { MainMenu } from "./components/MainMenu/MainMenu";
import { PauseMenu } from "./components/PauseMenu/PauseMenu";
import { ModeSwap } from "./components/Show/ModeSwap";
import { BotWindows } from "./components/BoringSite/BotWindows";

function App() {
  useGameLoop();
  const theme = useTheme();
  const cursed = useGameStore((s) => s.cursed);
  const curseStage = useGameStore((s) => s.curseStage);
  const playMode = useGameStore((s) => s.playMode);
  const menuOpen = useGameStore((s) => s.menuOpen);
  const aside = useGameStore((s) => s.aside);
  const corruption = useGameStore((s) => s.corruption);
  const isHexMode = useGameStore((s) => s.isHexMode);
  const hexTransition = useGameStore((s) => s.hexTransition);
  const introDone = useGameStore((s) => s.introDone);
  const siteTab = useGameStore((s) => s.siteTab);
  const userPaused = useGameStore((s) => s.userPaused);
  const pauseShown = cursed && userPaused && !menuOpen;
  const modeSwapping = useGameStore((s) => s.modeSwap !== null);
  const onFakePage = !cursed && siteTab !== "Play";

  useEffect(() => {
    document.title = cursed ? "CURSED CHESS" : "Totally Normal Chess";
  }, [cursed]);

  // The soundtrack kicks in once the curse takes hold. It stays off in the
  // trenches, where there is only the guns and the rain.
  const musicOn = cursed && theme.id !== "trenches" && !pauseShown;
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

  const board = isHexMode ? (
    <div className={hexTransition === "morph-in" ? "hex-morph-in" : ""}>
      <HexBoard />
    </div>
  ) : (
    <div className={hexTransition === "morph-out" ? "hex-morph-out" : ""}>
      <Board />
    </div>
  );

  const appClass =
    "app" +
    (cursed ? " is-cursed" : " is-boring") +
    (modeSwapping ? " mode-swapping" : "") +
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
            aria-label="Pause"
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
      {cursed && theme.id === "storm" && <StormWeather />}
      {cursed && <ModeSwap />}
      {pauseShown && <PauseMenu />}
      <PromotionDialog />
      <ShowCards />
      <CurseIntro />
      <HexWarp />
    </div>
  );
}

export default App;
