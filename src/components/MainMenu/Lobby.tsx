import { useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { hostGame, joinGame, leaveGame } from "../../net/multiplayer";
import "./Lobby.css";

/**
 * Where an online game is set up: open one and pass the code on, or type
 * in a friend's. Once the two are joined, the host picks what to play from
 * the cards below, and the guest waits for them.
 */
export function Lobby() {
  const link = useGameStore((s) => s.net);
  const [code, setCode] = useState("");
  const close = () => {
    leaveGame();
    useGameStore.setState({ lobbyOpen: false });
  };

  return (
    <section className="lobby" aria-label="Play a friend online">
      <h2 className="lobby-title">Play a friend</h2>
      {!link && (
        <div className="lobby-ways">
          <div className="lobby-way">
            <p>Start a game and send your friend the code.</p>
            <button type="button" className="lobby-btn" onClick={hostGame}>
              Host a game
            </button>
          </div>
          <form
            className="lobby-way"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) joinGame(code);
            }}
          >
            <label htmlFor="lobby-code">Got a code from a friend?</label>
            <input
              id="lobby-code"
              className="lobby-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              maxLength={5}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="lobby-btn" disabled={!code.trim()}>
              Join
            </button>
          </form>
        </div>
      )}
      {link?.role === "host" && link.status === "waiting" && (
        <div className="lobby-status">
          <p>Give your friend this code:</p>
          <output className="lobby-code">{link.code}</output>
          <p className="lobby-hint">Waiting for them to join</p>
        </div>
      )}
      {link?.role === "guest" && link.status === "connecting" && (
        <p className="lobby-status">Joining game {link.code}</p>
      )}
      {link?.status === "connected" && (
        <p className="lobby-status">
          {link.role === "host"
            ? "Your friend is here. Pick a mode to play."
            : "You are in. Waiting for your friend to pick a mode."}
        </p>
      )}
      {link?.status === "lost" && (
        <p className="lobby-status lobby-lost">
          The connection was lost, or no game was found under that code.
        </p>
      )}
      <button type="button" className="lobby-btn lobby-leave" onClick={close}>
        {link ? "Leave" : "Back"}
      </button>
    </section>
  );
}
