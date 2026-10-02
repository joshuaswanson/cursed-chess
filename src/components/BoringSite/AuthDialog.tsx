import { useEffect, useState } from "react";
import { Color, PieceType } from "../../engine";
import type { Piece } from "../../engine";
import { pieceImage } from "../../utils/pieceImages";
import "./AuthDialog.css";

export type AuthMode = "login" | "signup";

const PIECE_NAMES = ["pawn", "knight", "bishop", "rook", "queen", "king"];

/** Each rule appears once every rule before it is satisfied */
const PASSWORD_RULES: { text: string; test: (pw: string) => boolean }[] = [
  { text: "Must be at least 8 characters.", test: (pw) => pw.length >= 8 },
  { text: "Must include a number.", test: (pw) => /\d/.test(pw) },
  { text: "Must include an uppercase letter.", test: (pw) => /[A-Z]/.test(pw) },
  {
    text: "Must include the name of a chess piece.",
    test: (pw) => PIECE_NAMES.some((name) => pw.toLowerCase().includes(name)),
  },
  {
    text: "The digits must add up to 8.",
    test: (pw) =>
      [...pw].filter((c) => /\d/.test(c)).reduce((sum, d) => sum + +d, 0) === 8,
  },
  {
    text: "Must include a strong opening move (try e4).",
    test: (pw) => pw.toLowerCase().includes("e4"),
  },
  {
    text: 'Must not contain the letter "e".',
    test: (pw) => !pw.toLowerCase().includes("e"),
  },
];

function SignUpForm({ onClose }: { onClose: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nameChecked, setNameChecked] = useState(false);

  const shown: { text: string; ok: boolean }[] = [];
  for (const rule of PASSWORD_RULES) {
    const ok = rule.test(password);
    shown.push({ text: rule.text, ok });
    if (!ok) break;
  }
  const allPass =
    password.length > 0 && PASSWORD_RULES.every((r) => r.test(password));
  const name = username.trim();

  return (
    <>
      <h2 id="auth-title">Create your account</h2>
      <label className="auth-field">
        <span>Username</span>
        <input
          value={username}
          onChange={(e) => {
            setUsername(e.target.value);
            setNameChecked(false);
          }}
          onBlur={() => setNameChecked(name.length > 0)}
          autoComplete="off"
        />
      </label>
      {nameChecked && name && (
        <p className="auth-error">
          &ldquo;{name}&rdquo; is already taken by a pawn. Try <b>{name}_2</b>,{" "}
          <b>{name}_but_worse</b>, or <b>gary</b>.
        </p>
      )}
      <label className="auth-field">
        <span>Password</span>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="off"
        />
      </label>
      {password.length > 0 && (
        <ul className="auth-rules">
          {shown.map((rule) => (
            <li key={rule.text} className={rule.ok ? "ok" : "bad"}>
              {rule.text}
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="boring-btn auth-submit"
        disabled={!allPass}
      >
        Create account
      </button>
      <button type="button" className="auth-link" onClick={onClose}>
        Give up and continue as Guest
      </button>
    </>
  );
}

const CAPTCHA_POSITION: (Piece | null)[] = (() => {
  const board: (Piece | null)[] = Array(16).fill(null);
  const bishop = { type: PieceType.Bishop, color: Color.White };
  board[1] = bishop;
  board[6] = { type: PieceType.Knight, color: Color.Black };
  board[9] = { type: PieceType.Bishop, color: Color.Black };
  board[12] = { type: PieceType.Pawn, color: Color.White };
  board[14] = { type: PieceType.Queen, color: Color.Black };
  return board;
})();

function LogInForm({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"form" | "captcha" | "failed">("form");
  const [picked, setPicked] = useState<Set<number>>(new Set());

  if (step === "form") {
    return (
      <>
        <h2 id="auth-title">Log in</h2>
        <label className="auth-field">
          <span>Username or email</span>
          <input autoComplete="off" />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input type="password" autoComplete="off" />
        </label>
        <button
          type="button"
          className="boring-btn auth-submit"
          onClick={() => setStep("captcha")}
        >
          Log in
        </button>
        <button type="button" className="auth-link" onClick={onClose}>
          Forgot password? So did we.
        </button>
      </>
    );
  }

  return (
    <>
      <h2 id="auth-title">Verify you are human</h2>
      <p className="auth-note">Select every square with a bishop.</p>
      <div className="captcha-grid">
        {CAPTCHA_POSITION.map((piece, i) => (
          <button
            type="button"
            key={i}
            className={`captcha-cell ${(i + Math.floor(i / 4)) % 2 ? "dark" : "light"}${picked.has(i) ? " picked" : ""}`}
            onClick={() => {
              const next = new Set(picked);
              if (next.has(i)) next.delete(i);
              else next.add(i);
              setPicked(next);
              setStep("captcha");
            }}
          >
            {piece && <img src={pieceImage(piece)} alt="" />}
          </button>
        ))}
      </div>
      {step === "failed" && (
        <p className="auth-error">
          Verification failed. A human would have noticed the third bishop.
        </p>
      )}
      <button
        type="button"
        className="boring-btn auth-submit"
        onClick={() => setStep("failed")}
      >
        Verify
      </button>
      {step === "failed" && (
        <button type="button" className="auth-link" onClick={onClose}>
          Continue as Guest
        </button>
      )}
    </>
  );
}

/** The plain site's account dialogs, neither of which will ever let you in */
export function AuthDialog({
  mode,
  onClose,
}: {
  mode: AuthMode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="auth-backdrop" onClick={onClose}>
      <div
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="auth-close"
          aria-label="Close"
          onClick={onClose}
        >
          &times;
        </button>
        {mode === "login" ? (
          <LogInForm onClose={onClose} />
        ) : (
          <SignUpForm onClose={onClose} />
        )}
      </div>
    </div>
  );
}
