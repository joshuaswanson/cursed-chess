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
import { useTheme } from "./theme/useTheme";
import { themeVars } from "./theme/themes";
import "./styles/global.css";
import { ChessbotCorner } from "./components/Chessbot/ChessbotCorner";
import { MainMenu } from "./components/MainMenu/MainMenu";

function App() {
  useGameLoop();
  const theme = useTheme();
  const cursed = useGameStore((s) => s.cursed);
  const curseStage = useGameStore((s) => s.curseStage);
  const playMode = useGameStore((s) => s.playMode);
  const menuOpen = useGameStore((s) => s.menuOpen);
  const aside = useGameStore((s) => s.aside);
  const isHexMode = useGameStore((s) => s.isHexMode);
  const hexTransition = useGameStore((s) => s.hexTransition);
  const introDone = useGameStore((s) => s.introDone);
  const siteTab = useGameStore((s) => s.siteTab);
  const onFakePage = !cursed && siteTab !== "Play";

  useEffect(() => {
    document.title = cursed ? "CURSED CHESS" : "Totally Normal Chess";
  }, [cursed]);

  // The soundtrack kicks in once the curse takes hold
  useEffect(() => {
    music.set(cursed);
  }, [cursed]);

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
    (curseStage ? ` curse-${curseStage}` : "") +
    // Still glitching while he gloats
    (curseStage === "oops" ? " curse-glitch" : "") +
    // Your first move lets him through: the plain site glitches hard as he
    // breaks in and again as he is shut out, twitches while he types, and
    // then holds still while you think over your next move
    (cursed || !aside || aside === "said"
      ? ""
      : aside === "typing"
        ? " unease-typing"
        : " unease-burst");

  return (
    <div className={appClass} style={themeVars(theme)} data-theme={theme.id}>
      {cursed && <Backdrop theme={theme.id} />}
      {/* He runs the adventure; a mode picked from the menu is played without him */}
      {(cursed || (curseStage !== null && curseStage !== "hello")) &&
        playMode === "adventure" &&
        !menuOpen && <ChessbotCorner />}
      {cursed ? (
        <header className="topbar">
          <Logo />
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
      <PageFog active={theme.id === "fog" && introDone} />
      {cursed && theme.id === "portals" && <SpaceTraffic />}
      {cursed && theme.id === "trenches" && <TrenchWeather />}
      <PromotionDialog />
      <ShowCards />
      <CurseIntro />
      <MainMenu />
      <HexWarp />
    </div>
  );
}

export default App;
