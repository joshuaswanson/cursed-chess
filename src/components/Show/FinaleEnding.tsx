import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useGameStore } from "../../stores/gameStore";
import { Chessbot } from "../Chessbot/Chessbot";
import { sfx } from "../../audio/sfx";
import "./FinaleEnding.css";

/** How often the glitches crackle while he is deleted */
const MELTDOWN_CRACKLE_MS = 420;
/** How long he looks about from behind the move list before he winks */
const WINK_AFTER_MS = 1500;
/** How far his head comes out from behind the move list, in pixels */
const PEEK_PX = 84;
const PEEK_SIZE = 110;

/** The whole site breaking up as he is deleted, worse the longer it goes on */
function Meltdown({ erased }: { erased: boolean }) {
  useEffect(() => {
    sfx.glitch();
    const timer = window.setInterval(() => sfx.glitch(), MELTDOWN_CRACKLE_MS);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (erased) sfx.shatter();
  }, [erased]);
  return (
    <div
      className={`curse-glitch-layer finale-meltdown${erased ? " is-erased" : ""}`}
      aria-hidden
    >
      <div className="glitch-scanlines" />
      <div className="glitch-static" />
      {[12, 31, 48, 66, 83].map((top, i) => (
        <span
          key={i}
          className="glitch-tear"
          style={{ top: `${top}%`, animationDelay: `${i * -0.29}s` }}
        />
      ))}
      {erased && <p className="finale-erased-text">chessbot.exe deleted</p>}
    </div>
  );
}

interface Peek {
  /** The edge of the move list he peeks out from behind */
  edge: number;
  top: number;
}

/** Where he peeks out: from behind the left edge of the move list on the plain site */
function usePeekSpot(): Peek | null {
  const [spot] = useState<Peek | null>(() => {
    const panel = document.querySelector(".boring-panel");
    if (!panel) return null;
    const box = panel.getBoundingClientRect();
    return { edge: box.left, top: box.top + box.height * 0.3 };
  });
  return spot;
}

/** Chessbot, not quite gone, peeking out from behind the move list, and the picture closing in on his wink */
function PeekAndIris({ closing }: { closing: boolean }) {
  const spot = usePeekSpot();
  const [winked, setWinked] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setWinked(true), WINK_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);
  if (!spot) return null;
  const centre = {
    "--iris-x": `${spot.edge - PEEK_PX / 2}px`,
    "--iris-y": `${spot.top + PEEK_SIZE * 0.45}px`,
  } as CSSProperties;
  return (
    <>
      <div
        className="finale-peek"
        style={{
          left: spot.edge - PEEK_SIZE,
          top: spot.top,
          width: PEEK_SIZE,
          height: PEEK_SIZE,
        }}
        aria-hidden
      >
        <div className="finale-peek-bot">
          <Chessbot mood={winked ? "wink" : "sly"} grounded={false} />
        </div>
      </div>
      {closing && <div className="finale-iris" style={centre} aria-hidden />}
    </>
  );
}

const PLAYTESTERS = ["Arthur", "Lena"];

const CAST: [string, string][] = [
  ["Chessbot", "Himself"],
  ["Stephen", "Site Support"],
  ["The Kill Switch Team", "On PTO"],
  ["You", "The Hero"],
];

/** The credits, rolling up a black screen, and the way back to the menu */
function Credits() {
  const finish = useGameStore((s) => s.finishStory);
  const [rolled, setRolled] = useState(false);
  return (
    <div className="finale-credits" role="dialog" aria-label="Credits">
      <div className="credits-roll" onAnimationEnd={() => setRolled(true)}>
        <h1 className="credits-title">Cursed Chess</h1>
        <p className="credits-by">
          <small>A game by</small>
          Joshua Swanson
        </p>
        <h2>Starring</h2>
        <dl className="credits-cast">
          {CAST.map(([who, as]) => (
            <div key={who}>
              <dt>{who}</dt>
              <dd>{as}</dd>
            </div>
          ))}
        </dl>
        <section className="credits-thanks">
          <h2>Special thanks</h2>
          <ul className="credits-names">
            {PLAYTESTERS.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
          <p>
            My playtesters, who played every broken build, found the bugs, and
            told me what was fun. This game is better because of you.
          </p>
        </section>
        <h2>Music</h2>
        <p>maksymmalko</p>
        <p className="credits-note">
          No chess pieces were permanently harmed in the making of this game.
        </p>
      </div>
      <div className={`credits-end${rolled ? " is-shown" : ""}`}>
        <p>Thanks for playing</p>
        <button type="button" onClick={finish}>
          Main menu
        </button>
      </div>
      {!rolled && (
        <button type="button" className="credits-skip" onClick={finish}>
          Skip
        </button>
      )}
    </div>
  );
}

/** The site's breakdown through the final battle, and how Story Mode ends: Chessbot deleted, the plain site back, his wink, and the credits */
export function FinaleEnding() {
  const stage = useGameStore((s) => s.finaleStage);
  if (stage === "battle") {
    return (
      <div className="curse-glitch-layer finale-static" aria-hidden>
        <div className="glitch-scanlines" />
        <span className="glitch-tear" />
      </div>
    );
  }
  if (stage === "deleting" || stage === "erased") {
    return <Meltdown erased={stage === "erased"} />;
  }
  if (stage === "peek" || stage === "iris") {
    return <PeekAndIris closing={stage === "iris"} />;
  }
  if (stage === "credits") return <Credits />;
  return null;
}
