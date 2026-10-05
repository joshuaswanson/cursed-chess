import { useEffect, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import type { AnnouncementType } from "../../stores/gameStore";
import { useTheme } from "../../theme/useTheme";
import type { ModeTheme, ThemeId } from "../../theme/themes";
import { sfx } from "../../audio/sfx";
import { Confetti } from "./Confetti";
import { Portal } from "../Board/Portal";
import { ROPE_TILE } from "../Board/ropeTexture";
import { Color, PieceType } from "../../engine";
import { pieceImage } from "../../utils/pieceImages";
import "./Show.css";

const CLOSE_MS = 450;

/** Each team on the title card's rope, anchor at the far end */
const TUG_TEAMS = [
  {
    color: Color.White,
    line: [PieceType.Rook, PieceType.Knight, PieceType.Pawn],
  },
  {
    color: Color.Black,
    line: [PieceType.Pawn, PieceType.Knight, PieceType.Rook],
  },
];
/** When the title clears and the catchphrase comes in */
const CATCHPHRASE_AT_MS = 1900;

/** Letters that animate one by one, grouped by word so a line only breaks between words */
function Letters({ text }: { text: string }) {
  let index = 0;
  return (
    <>
      {text.split(" ").map((word, w) => (
        <span key={w}>
          {w > 0 && " "}
          <span className="card-word">
            {word.split("").map((ch) => (
              <span
                key={index}
                className="card-letter"
                style={{ "--i": index++ } as React.CSSProperties}
              >
                {ch}
              </span>
            ))}
          </span>
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
          <span className="card-portal card-portal-blue">
            <Portal color="blue" state="spawn" />
          </span>
          <span className="card-portal card-portal-orange">
            <Portal color="orange" state="spawn" />
          </span>
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
    case "fifa":
      return (
        <>
          <span className="card-pitch-line" />
          <span className="card-ball" />
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
    case "zombies":
      return (
        <>
          <span className="card-moon" />
          <svg
            className="card-ooze"
            viewBox="0 0 400 40"
            preserveAspectRatio="none"
          >
            <path d="M0 0 H400 V12 Q390 12 388 26 Q386 34 382 26 Q378 12 360 12 Q340 12 336 30 Q333 40 329 30 Q325 12 300 12 Q270 12 268 22 Q266 28 262 22 Q258 12 220 12 Q190 12 186 34 Q183 42 179 34 Q175 12 140 12 Q110 12 106 24 Q104 30 100 24 Q96 12 60 12 Q30 12 26 32 Q23 40 19 32 Q15 12 0 12 Z" />
          </svg>
        </>
      );
    case "tug":
      return (
        <>
          <span className="card-tug-ground" />
          <div className="card-tug">
            {TUG_TEAMS.map(({ color, line }) => (
              <div key={color} className={`card-tug-team card-tug-team-${color}`}>
                <span className="card-dust" />
                {line.map((type, n) => (
                  <img
                    key={n}
                    src={pieceImage({ type, color })}
                    alt=""
                    style={{ "--n": n } as React.CSSProperties}
                  />
                ))}
              </div>
            ))}
            <div className="card-tug-rope">
              <span
                className="card-tug-strands"
                style={{ "--rope": ROPE_TILE } as React.CSSProperties}
              />
              <svg className="card-tug-pennant" viewBox="0 0 30 34">
                <path d="M3 2 H27 L15 32 Z" />
                <path d="M11 2 H19 L15 22 Z" className="stripe" />
              </svg>
            </div>
          </div>
        </>
      );
    default:
      return null;
  }
}

function ModeCard({ theme, closing }: { theme: ModeTheme; closing: boolean }) {
  const catchphrase = theme.catchphrase;
  return (
    <div
      className={`show-card mode-card${closing ? " closing" : ""}`}
      data-card-theme={theme.id}
      role="status"
    >
      <div className="card-band">
        <Flair theme={theme.id} />
        <div className="card-beats">
          <div className="card-beat card-beat-title">
            <h1 className="card-title" aria-label={theme.title}>
              <Letters text={theme.title} />
            </h1>
          </div>
          <div className="card-beat card-beat-catch">
            <p className="card-catch" aria-label={catchphrase}>
              <Letters text={catchphrase} />
            </p>
          </div>
        </div>
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
    if (shown.type !== "mode") {
      sfx[shown.type]();
      return;
    }
    sfx.modeSting(shown.step);
    const catchphrase = setTimeout(
      () => sfx.modeSting(shown.step + 4),
      CATCHPHRASE_AT_MS,
    );
    return () => clearTimeout(catchphrase);
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
