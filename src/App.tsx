import { useEffect } from "react";
import { Board } from "./components/Board/Board";
import { HexBoard } from "./components/HexBoard/HexBoard";
import { PromotionDialog } from "./components/PromotionDialog/PromotionDialog";
import { ShowCards } from "./components/Show/ShowCards";
import { CurseIntro } from "./components/Show/CurseIntro";
import { HexWarp } from "./components/HexWarp/HexWarp";
import { Hud } from "./components/Hud/Hud";
import { FoeRallyBar, YourRallyBar } from "./components/RallyPanel/RallyPanel";
import { Backdrop } from "./components/Backdrop/Backdrop";
import { PageFog } from "./components/Fog/Fog";
import { Logo, OnAir } from "./components/Logo/Logo";
import {
  BoringFooter,
  BoringHeader,
  BoringSidebar,
} from "./components/BoringSite/BoringSite";
import { useGameStore } from "./stores/gameStore";
import { useGameLoop } from "./hooks/useGameLoop";
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

  useEffect(() => {
    document.title = cursed ? "CURSED CHESS" : "Play Chess Online";
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
    (curseStage ? ` curse-${curseStage}` : "");

  return (
    <div className={appClass} style={themeVars(theme)} data-theme={theme.id}>
      {cursed && <Backdrop theme={theme.id} />}
      {cursed ? (
        <header className="topbar">
          <Logo />
          <OnAir title={theme.title} />
        </header>
      ) : (
        <BoringHeader />
      )}
      <main className="stage">
        <div className="board-container">
          {cursed && <FoeRallyBar />}
          {board}
          {cursed && <YourRallyBar />}
        </div>
        {cursed ? <Hud /> : <BoringSidebar />}
      </main>
      {!cursed && <BoringFooter />}
      <PageFog active={theme.id === "fog"} />
      <PromotionDialog />
      <ShowCards />
      <CurseIntro />
      <HexWarp />
    </div>
  );
}

export default App;
