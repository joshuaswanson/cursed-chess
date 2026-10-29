import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../../stores/gameStore";
import { sfx } from "../../audio/sfx";
import type { DevNoteText } from "./notes";
import "./DevNote.css";
import { t } from "../../i18n";

/** How long Stephen's message is up before Chessbot catches it */
const CAUGHT_AT_MS = 2600;
/** How long Chessbot's rewrite takes to come through */
const REWRITE_MS = 1100;
const REWRITE_STEP_MS = 45;
const NOISE = "█▓▒#%@$?01";

/** `text` with only its first `share` come through, the rest still noise */
function halfWritten(text: string, share: number): string {
  const settled = Math.floor(text.length * share);
  return [...text]
    .map((letter, i) =>
      i < settled || letter === " "
        ? letter
        : NOISE[Math.floor(Math.random() * NOISE.length)],
    )
    .join("");
}

/** Stephen from site support, writing in from the plain chess site Chessbot took over */
export function DevNote() {
  const note = useGameStore((s) => s.devNote);
  return note ? <Note key={note.sentAt} note={note} /> : null;
}

function Note({ note }: { note: DevNoteText }) {
  const dismiss = useGameStore((s) => s.dismissDevNote);
  const [rewritten, setRewritten] = useState<string | null>(null);
  const [hacking, setHacking] = useState(false);
  const ok = useRef<HTMLButtonElement>(null);
  const rewrite = note.rewrite && t(note.rewrite);
  const done = !rewrite || (rewritten === rewrite && !hacking);

  useEffect(() => {
    sfx.notify();
  }, []);

  useEffect(() => {
    if (!rewrite) return;
    let step: ReturnType<typeof setInterval> | undefined;
    const caught = setTimeout(() => {
      sfx.glitch();
      setHacking(true);
      const started = performance.now();
      step = setInterval(() => {
        const share = (performance.now() - started) / REWRITE_MS;
        setRewritten(share >= 1 ? rewrite : halfWritten(rewrite, share));
        if (share < 1) return;
        clearInterval(step);
        setHacking(false);
      }, REWRITE_STEP_MS);
    }, CAUGHT_AT_MS);
    return () => {
      clearTimeout(caught);
      clearInterval(step);
    };
  }, [rewrite]);

  useEffect(() => {
    if (done) ok.current?.focus();
  }, [done]);

  const close = () => {
    if (done) dismiss();
  };

  return (
    <div
      className={"dev-note" + (hacking ? " is-hacked" : "")}
      role="alertdialog"
      aria-labelledby="dev-note-from"
      aria-describedby="dev-note-text"
      onClick={close}
    >
      <div className="dev-note-head">
        <span className="dev-note-avatar" aria-hidden>
          S
        </span>
        <span className="dev-note-from" id="dev-note-from">
          <b>Stephen</b>
          <small>{t("Site Support")}</small>
        </span>
        <time className="dev-note-time">{t(note.sentAt)}</time>
      </div>
      <p
        className={
          "dev-note-text" + (rewritten === null ? "" : " is-rewritten")
        }
        id="dev-note-text"
      >
        {rewritten ?? t(note.text)}
      </p>
      <button
        ref={ok}
        type="button"
        className="dev-note-ok"
        disabled={!done}
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
      >
        OK
      </button>
    </div>
  );
}
