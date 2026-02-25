import { Board } from "./components/Board/Board";
import { GameControls } from "./components/GameControls/GameControls";
import { PromotionDialog } from "./components/PromotionDialog/PromotionDialog";
import { Announcement } from "./components/Announcement/Announcement";
import { Timer } from "./components/Timer/Timer";
import { ModePanel } from "./components/ModePanel/ModePanel";
import { RallyPanel } from "./components/RallyPanel/RallyPanel";
import "./styles/global.css";

function App() {
  return (
    <>
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
            <span className="title-unhinged">CHAOS</span>
            <span className="title-chess">CHESS</span>
          </h1>
          <p className="app-subtitle">Chess, but nothing is sacred</p>
        </header>

        <main className="game-layout">
          <div className="board-container">
            <Board />
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
    </>
  );
}

export default App;
