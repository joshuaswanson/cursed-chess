import { Board } from "./components/Board/Board";
import { GameControls } from "./components/GameControls/GameControls";
import { PromotionDialog } from "./components/PromotionDialog/PromotionDialog";
import { Announcement } from "./components/Announcement/Announcement";
import { Timer } from "./components/Timer/Timer";
import "./styles/global.css";

function App() {
  return (
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
          <Timer />
          <GameControls />
        </div>
      </main>

      <PromotionDialog />
      <Announcement />
    </div>
  );
}

export default App;
