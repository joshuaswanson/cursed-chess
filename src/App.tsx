import { Board } from "./components/Board/Board";
import { HexBoard } from "./components/HexBoard/HexBoard";
import { GameControls } from "./components/GameControls/GameControls";
import { PromotionDialog } from "./components/PromotionDialog/PromotionDialog";
import { Announcement } from "./components/Announcement/Announcement";
import { Timer } from "./components/Timer/Timer";
import { ModePanel } from "./components/ModePanel/ModePanel";
import { RallyPanel } from "./components/RallyPanel/RallyPanel";
import { useGameStore, GAME_MODES } from "./stores/gameStore";
import { useGameLoop } from "./hooks/useGameLoop";
import "./styles/global.css";

function App() {
  useGameLoop();
  const currentModeIndex = useGameStore((s) => s.currentModeIndex);
  const isHexMode = useGameStore((s) => s.isHexMode);
  const hexTransition = useGameStore((s) => s.hexTransition);
  const isPortalMode =
    currentModeIndex >= 0 && GAME_MODES[currentModeIndex].name === "PORTALS";

  return (
    <div className={isPortalMode ? "space-bg" : ""}>
      <div className="page-fog">
        <div className="page-fog-layer page-fog-layer-1" />
        <div className="page-fog-layer page-fog-layer-2" />
      </div>
      <div className="page-fog-bottom">
        <div className="page-fog-layer page-fog-layer-1" />
        <div className="page-fog-layer page-fog-layer-2" />
      </div>
      <div className="page-fog-left">
        <div className="page-fog-side-layer page-fog-side-layer-1" />
        <div className="page-fog-side-layer page-fog-side-layer-2" />
      </div>
      <div className="page-fog-right">
        <div className="page-fog-side-layer page-fog-side-layer-1" />
        <div className="page-fog-side-layer page-fog-side-layer-2" />
      </div>
      <div className="app">
        <header className="app-header">
          <h1 className="app-title">
            <span className="title-unhinged">CURSED</span>
            <span className="title-chess">CHESS</span>
          </h1>
          <p className="app-subtitle">
            You've never played chess like this before
          </p>
        </header>

        <main className="game-layout">
          <div className="board-container">
            {isHexMode ? (
              <div
                className={hexTransition === "morph-in" ? "hex-morph-in" : ""}
              >
                <HexBoard />
              </div>
            ) : (
              <div
                className={hexTransition === "morph-out" ? "hex-morph-out" : ""}
              >
                <Board />
              </div>
            )}
          </div>
          <div className="sidebar">
            <ModePanel />
            <Timer />
            <RallyPanel />
            <GameControls />
          </div>
        </main>

        <PromotionDialog />
        <Announcement />
      </div>
    </div>
  );
}

export default App;
