import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import type { AnnouncementType } from "../../stores/gameStore";
import { useTheme } from "../../theme/useTheme";
import type { ModeTheme, ThemeId } from "../../theme/themes";
import { sfx } from "../../audio/sfx";
import { Confetti } from "./Confetti";
import "./Show.css";

const CLOSE_MS = 450;

function Letters({ text }: { text: string }) {
  return (
    <>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          className="card-letter"
          style={{ "--i": i } as React.CSSProperties}
        >
          {ch === " " ? " " : ch}
        </span>
      ))}
    </>
  );
}

/** Decorations that give each mode's title card its own entrance */
function Flair({ theme }: { theme: ThemeId }) {
  switch (theme) {
    case "portals":
      return (
        <>
          <span className="card-portal card-portal-blue" />
          <span className="card-portal card-portal-orange" />
        </>
      );
    case "fog":
      return (
        <>
          <span className="card-mist card-mist-a" />
          <span className="card-mist card-mist-b" />
        </>
      );
    case "royale":
      return (
        <svg
          className="card-cracks"
          viewBox="0 0 400 100"
          preserveAspectRatio="none"
        >
          <path d="M0 60 L60 50 L90 70 L150 40 L210 62 L260 30 L320 55 L400 38" />
          <path d="M150 40 L170 10 M260 30 L250 0 M90 70 L100 100 M320 55 L340 100" />
        </svg>
      );
    case "clash":
      return (
        <>
          <span className="card-team card-team-blue" />
          <span className="card-team card-team-red" />
          <svg
            className="card-bolt"
            viewBox="0 0 40 100"
            preserveAspectRatio="none"
          >
            <path d="M24 0 L8 46 L20 46 L12 100 L34 38 L22 38 Z" />
          </svg>
        </>
      );
    case "mines":
      return <span className="card-ping" />;
    case "hill":
      return (
        <>
          <span className="card-rays" />
          <svg className="card-crown" viewBox="0 0 100 70">
            <path d="M8 60 L14 18 L34 40 L50 6 L66 40 L86 18 L92 60 Z" />
            <rect x="8" y="58" width="84" height="10" rx="3" />
          </svg>
        </>
      );
    case "gravity":
      return <span className="card-spiral" />;
    case "hex":
      return (
        <>
          <span className="card-synth-sun" />
          <span className="card-synth-grid" />
        </>
      );
    case "stratego":
      return <span className="card-stamp-ring" />;
    default:
      return null;
  }
}

function ModeCard({ theme, closing }: { theme: ModeTheme; closing: boolean }) {
  return (
    <div
      className={`show-card mode-card${closing ? " closing" : ""}`}
      data-card-theme={theme.id}
      role="status"
    >
      <div className="card-band">
        <Flair theme={theme.id} />
        <h1 className="card-title" aria-label={theme.title}>
          <Letters text={theme.title} />
        </h1>
        <p className="card-tagline">{theme.tagline}</p>
      </div>
    </div>
  );
}

const RESULT_COPY: Record<
  Exclude<AnnouncementType, "mode">,
  { title: string; detail: string }
> = {
  win: { title: "You win!", detail: "A point for you." },
  lose: { title: "You lose!", detail: "A point for the foe." },
  draw: { title: "Draw!", detail: "Nobody scores this round." },
};

function ResultCard({
  kind,
  closing,
}: {
  kind: Exclude<AnnouncementType, "mode">;
  closing: boolean;
}) {
  const copy = RESULT_COPY[kind];
  return (
    <div
      className={`show-card result-card result-${kind}${closing ? " closing" : ""}`}
      role="status"
    >
      {kind === "win" && <span className="result-rays" />}
      {kind === "lose" && (
        <svg
          className="result-shatter"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path d="M50 50 L0 8 M50 50 L28 0 M50 50 L72 0 M50 50 L100 18 M50 50 L100 70 M50 50 L66 100 M50 50 L22 100 M50 50 L0 64" />
          <path d="M36 38 L58 30 L68 52 L52 66 L32 58 Z" />
        </svg>
      )}
      <div className="result-plate">
        <h1 className="result-title" aria-label={copy.title}>
          <Letters text={copy.title} />
        </h1>
        <p className="result-detail">{copy.detail}</p>
      </div>
      {kind === "win" && <Confetti count={110} seed={7} />}
    </div>
  );
}

/** Title cards for each new mode and the result of every game */
export function ShowCards() {
  const announcement = useGameStore((s) => s.announcement);
  const type = useGameStore((s) => s.announcementType);
  const modeIndex = useGameStore((s) => s.currentModeIndex);
  const theme = useTheme();
  const [shown, setShown] = useState<{
    type: AnnouncementType;
    theme: ModeTheme;
    step: number;
    key: number;
  } | null>(null);
  const [closing, setClosing] = useState(false);
  const [prev, setPrev] = useState(announcement);

  // Keep the last card mounted while its exit plays
  if (announcement !== prev) {
    setPrev(announcement);
    if (announcement) {
      setShown({
        type,
        theme,
        step: modeIndex + 1,
        key: (shown?.key ?? 0) + 1,
      });
      setClosing(false);
    } else if (shown) {
      setClosing(true);
    }
  }

  useEffect(() => {
    if (!shown || closing) return;
    if (shown.type === "mode") sfx.modeSting(shown.step);
    else sfx[shown.type]();
  }, [shown, closing]);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => {
      setShown(null);
      setClosing(false);
    }, CLOSE_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  if (!shown) return null;
  return shown.type === "mode" ? (
    <ModeCard key={shown.key} theme={shown.theme} closing={closing} />
  ) : (
    <ResultCard key={shown.key} kind={shown.type} closing={closing} />
  );
}
