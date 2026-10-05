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

function App() {
  useGameLoop();
  const theme = useTheme();
  const cursed = useGameStore((s) => s.cursed);
  const curseStage = useGameStore((s) => s.curseStage);
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

  // Dev mode is available everywhere, including the plain site before the curse
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        useGameStore.getState().toggleDevMode();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    (curseStage ? ` curse-${curseStage}` : "");

  return (
    <div className={appClass} style={themeVars(theme)} data-theme={theme.id}>
      {cursed && <Backdrop theme={theme.id} />}
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
              <SkipBanner />
            </div>
            {cursed && <YourRallyBar />}
          </div>
          {cursed ? <Hud /> : <BoringSidebar />}
        </main>
      )}
      {!cursed && <BoringFooter />}
      <PageFog active={theme.id === "fog" && introDone} />
      {cursed && theme.id === "portals" && <SpaceTraffic />}
      <PromotionDialog />
      <ShowCards />
      <CurseIntro />
      <HexWarp />
    </div>
  );
}

export default App;
