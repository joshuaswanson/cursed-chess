import { useSyncExternalStore } from "react";
import { sfx } from "../../audio/sfx";
import { LANGUAGES, setLanguage, t, useLanguage } from "../../i18n";
import { MuteIcon, SoundIcon } from "../Hud/icons";
import "./Settings.css";

/** The game's settings, on a card of their own: the language, and the sound */
export function Settings({ onClose }: { onClose: () => void }) {
  const language = useLanguage();
  const soundOn = useSyncExternalStore(sfx.subscribe, sfx.isEnabled);
  return (
    <div className="settings">
      <h2 className="pause-title">{t("Settings")}</h2>
      <section className="settings-row" aria-labelledby="settings-language">
        <h3 id="settings-language" className="settings-label">
          {t("Language")}
        </h3>
        <div className="settings-choices">
          {LANGUAGES.map(({ id, name }) => (
            <button
              key={id}
              type="button"
              lang={id}
              className="pause-btn settings-choice"
              aria-pressed={language === id}
              onClick={() => setLanguage(id)}
            >
              {name}
            </button>
          ))}
        </div>
      </section>
      <section className="settings-row" aria-labelledby="settings-sound">
        <h3 id="settings-sound" className="settings-label">
          {t("Sound")}
        </h3>
        <button
          type="button"
          className="pause-btn"
          aria-pressed={soundOn}
          onClick={() => sfx.setEnabled(!soundOn)}
        >
          {soundOn ? <SoundIcon /> : <MuteIcon />}
          {soundOn ? t("Sound on") : t("Sound off")}
        </button>
      </section>
      <button
        type="button"
        className="pause-btn pause-resume"
        onClick={onClose}
        autoFocus
      >
        {t("Done")}
      </button>
    </div>
  );
}

/** The settings over the main menu, under a dimmed screen */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="pause-overlay"
      role="dialog"
      aria-modal
      aria-label={t("Settings")}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="pause-card">
        <Settings onClose={onClose} />
      </div>
    </div>
  );
}
