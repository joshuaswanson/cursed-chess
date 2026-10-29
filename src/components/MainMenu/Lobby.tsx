import { useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { hostGame, joinGame, leaveGame } from "../../net/multiplayer";
import "./Lobby.css";
import { t } from "../../i18n";

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
    <section className="lobby" aria-label={t("Play a friend online")}>
      <h2 className="lobby-title">{t("Play a friend")}</h2>
      {!link && (
        <div className="lobby-ways">
          <div className="lobby-way">
            <p>{t("Start a game and send your friend the code.")}</p>
            <button type="button" className="lobby-btn" onClick={hostGame}>
              {t("Host a game")}
            </button>
          </div>
          <form
            className="lobby-way"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) joinGame(code);
            }}
          >
            <label htmlFor="lobby-code">{t("Got a code from a friend?")}</label>
            <input
              id="lobby-code"
              className="lobby-input"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t("CODE")}
              maxLength={5}
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="lobby-btn" disabled={!code.trim()}>
              {t("Join")}
            </button>
          </form>
        </div>
      )}
      {link?.role === "host" && link.status === "waiting" && (
        <div className="lobby-status">
          <p>{t("Give your friend this code:")}</p>
          <output className="lobby-code">{link.code}</output>
          <p className="lobby-hint">{t("Waiting for them to join")}</p>
        </div>
      )}
      {link?.role === "guest" && link.status === "connecting" && (
        <p className="lobby-status">
          {t("Joining game {code}", { code: link.code })}
        </p>
      )}
      {link?.status === "connected" && (
        <p className="lobby-status">
          {link.role === "host"
            ? t("Your friend is here. Pick a mode to play.")
            : t("You are in. Waiting for your friend to pick a mode.")}
        </p>
      )}
      {link?.status === "lost" && (
        <p className="lobby-status lobby-lost">
          {t("The connection was lost, or no game was found under that code.")}
        </p>
      )}
      <button type="button" className="lobby-btn lobby-leave" onClick={close}>
        {link ? t("Leave") : t("Back")}
      </button>
    </section>
  );
}
