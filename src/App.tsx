import { useEffect } from "react";
import { Board } from "./components/Board/Board";
import { HexBoard } from "./components/HexBoard/HexBoard";
import { GameControls } from "./components/GameControls/GameControls";
import { PromotionDialog } from "./components/PromotionDialog/PromotionDialog";
import { Announcement } from "./components/Announcement/Announcement";
import { Timer } from "./components/Timer/Timer";
import { ModePanel } from "./components/ModePanel/ModePanel";
import { RallyPanel } from "./components/RallyPanel/RallyPanel";
import { Backdrop } from "./components/Backdrop/Backdrop";
import { Logo } from "./components/Logo/Logo";
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
        </header>
      ) : (
        <BoringHeader />
      )}
      <main className="stage">
        <div className="board-container">{board}</div>
        {cursed ? (
          <aside className="hud">
            <ModePanel />
            <Timer />
            <RallyPanel />
            <GameControls />
          </aside>
        ) : (
          <BoringSidebar />
        )}
      </main>
      {!cursed && <BoringFooter />}
      <PromotionDialog />
      <Announcement />
    </div>
  );
}

export default App;
