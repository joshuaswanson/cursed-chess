import { useState } from "react";
import { Color, PieceType } from "../../engine";
import type { Piece } from "../../engine";
import type { SiteTab } from "../../stores/gameStore";
import { pieceImage } from "../../utils/pieceImages";
import "./BoringPages.css";

const FILES = "abcdefgh";

/** Placements like "wQ a8 b8, bK e4", one color and type then its squares */
function parsePosition(position: string): Map<string, Piece> {
  const squares = new Map<string, Piece>();
  for (const group of position.split(",")) {
    const [code, ...where] = group.trim().split(/\s+/);
    const piece: Piece = {
      color: code[0] === "w" ? Color.White : Color.Black,
      type: code[1].toLowerCase() as PieceType,
    };
    for (const sq of where) squares.set(sq, piece);
  }
  return squares;
}

function MiniBoard({ position }: { position: string }) {
  const pieces = parsePosition(position);
  return (
    <div className="mini-board" aria-hidden>
      {Array.from({ length: 64 }, (_, i) => {
        const file = i % 8;
        const rank = 8 - Math.floor(i / 8);
        const piece = pieces.get(`${FILES[file]}${rank}`);
        return (
          <span key={i} className={(file + rank) % 2 ? "light" : "dark"}>
            {piece && <img src={pieceImage(piece)} alt="" />}
          </span>
        );
      })}
    </div>
  );
}

const PUZZLES = [
  {
    title: "Daily Puzzle",
    prompt: "White to move. Find the only move that does not win.",
    position: "wQ a8 b8 c8 d8 f8 g8 h8, wK e1, bK e5",
    rating: 3150,
    solved: "0.4%",
    solution:
      "There is no such move. Every move wins. We are as upset about this as you are.",
  },
  {
    title: "Mate in 0",
    prompt: "Black is already checkmated. Can you spot it?",
    position: "wQ g7, wK f6, bK h8",
    rating: 400,
    solved: "12%",
    solution:
      "It's the queen. She has been there the whole time. Please stop clicking her.",
  },
  {
    title: "Black to Move and Win",
    prompt: "A classic study. Black to move and win.",
    position:
      "wK a1, wQ d1, wR a8 h8, wB c4 f4, wN c3 f3, wP a2 b2 c2 g2 h2, bK h1",
    rating: 2900,
    solved: "0%",
    solution:
      "Black cannot win. Black has a king and a dream, and the dream is not a legal piece.",
  },
  {
    title: "The Horse",
    prompt: "Where can the knight go? Take your time.",
    position: "wN d4",
    rating: 1800,
    solved: "3%",
    solution:
      "It goes in an L. Nobody knows why. The knight has declined to comment.",
  },
];

function PuzzlesPage() {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  return (
    <div className="boring-page">
      <div className="page-head">
        <h1>Puzzles</h1>
        <p>
          Puzzle Rush personal best: <b>0</b> (you have not tried). Current
          streak: <b>0 days</b>. Global rank: <b>#4,812,330</b>.
        </p>
      </div>
      <div className="puzzle-grid">
        {PUZZLES.map((puzzle, i) => (
          <article key={puzzle.title} className="boring-card puzzle-card">
            <MiniBoard position={puzzle.position} />
            <div className="puzzle-body">
              <h2>{puzzle.title}</h2>
              <p>{puzzle.prompt}</p>
              <p className="muted">
                Rating {puzzle.rating} &middot; Solved by {puzzle.solved}
              </p>
              {revealed.has(i) ? (
                <p className="reveal">{puzzle.solution}</p>
              ) : (
                <button
                  type="button"
                  className="boring-btn"
                  onClick={() => setRevealed(new Set(revealed).add(i))}
                >
                  Show solution
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const LESSONS = [
  {
    title: "How the Horse Moves",
    blurb: "A frank look at a piece nobody fully understands.",
    progress: 0,
    reply: "Lesson loading. Estimated time remaining: 14 years.",
  },
  {
    title: "Castling: Your King's Little Home",
    blurb: "Tuck him in. Read him a story. Hope for the best.",
    progress: 65,
    reply: "Your king is already asleep. Please do not wake him.",
  },
  {
    title: "En Passant",
    blurb: "Yes, it is real. No, we will not explain it.",
    progress: 100,
    reply:
      "You have already completed this lesson. You still do not get it. That is normal.",
  },
  {
    title: "Openings: The Sicilian, the Italian, and Greg From Accounting",
    blurb: "Three openings, two of which are recognized by FIDE.",
    progress: 20,
    reply: "Greg is on vacation. This lesson will resume when Greg returns.",
  },
  {
    title: "Endgames: Bishop and Knight Mate",
    blurb: "Spend 50 moves doing it, then find out it was a draw.",
    progress: 3,
    reply: "Please set aside an afternoon. Possibly two.",
  },
  {
    title: "Advanced: Staring Intensely",
    blurb: "Used by grandmasters to make the other player nervous.",
    progress: 90,
    reply:
      "Please look at your screen without blinking until the lesson starts.",
  },
];

function LearnPage() {
  const [started, setStarted] = useState<Set<number>>(new Set());
  return (
    <div className="boring-page">
      <div className="page-head">
        <h1>Learn</h1>
        <p>
          Structured lessons for every level, from beginner to slightly less
          beginner.
        </p>
      </div>
      <div className="lesson-list">
        {LESSONS.map((lesson, i) => (
          <article key={lesson.title} className="boring-card lesson-card">
            <div className="lesson-text">
              <h2>{lesson.title}</h2>
              <p className="muted">{lesson.blurb}</p>
              <div
                className="lesson-progress"
                aria-label={`${lesson.progress}% complete`}
              >
                <span style={{ width: `${lesson.progress}%` }} />
              </div>
              {started.has(i) && <p className="reveal">{lesson.reply}</p>}
            </div>
            <button
              type="button"
              className="boring-btn"
              onClick={() => setStarted(new Set(started).add(i))}
            >
              {lesson.progress === 100
                ? "Review"
                : lesson.progress > 0
                  ? "Continue"
                  : "Start"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

const STREAMS = [
  {
    title: "GM vs. Roomba, Round 3",
    channel: "ChessWithAppliances",
    viewers: "48.2K",
    position: "wK g1, wR f1, wP f2 g2 h2, bK g8, bQ d4, bP f7 g7 h7",
  },
  {
    title: "Speedrun: Losing to Scholar's Mate (any%)",
    channel: "FastestLoserAlive",
    viewers: "9.1K",
    position: "wQ f7, wB c4, wK e1, bK e8, bN c6 f6",
  },
  {
    title: "Two GMs Agree to a Draw on Move 1, Then Sit in Silence",
    channel: "SlowChessTV",
    viewers: "2.1M",
    position:
      "wR a1 h1, wN b1 g1, wB c1 f1, wQ d1, wK e1, wP a2 b2 c2 d2 f2 g2 h2 e4, bR a8 h8, bN b8 g8, bB c8 f8, bQ d8, bK e8, bP a7 b7 c7 d7 e7 f7 g7 h7",
  },
  {
    title:
      "Pigeon Knocks Over Pieces, Struts Around, Claims Victory (14 hrs, uncut)",
    channel: "BirdBrainChess",
    viewers: "312K",
    position: "wK b3, wN e6, bK g2, bR c5, bP a4",
  },
  {
    title: "ASMR: Pressing the Chess Clock for Six Hours",
    channel: "TickTockTV",
    viewers: "74K",
    position: "wK e1, bK e8",
  },
  {
    title: "Live Analysis: Is the Bishop Just a Diagonal Rook?",
    channel: "BigBrainTakes",
    viewers: "18",
    position: "wB c1 f1, wR a1 h1, bK e8",
  },
];

function WatchPage() {
  const [opened, setOpened] = useState<number | null>(null);
  return (
    <div className="boring-page">
      <div className="page-head">
        <h1>Watch</h1>
        <p>Top live streams right now.</p>
      </div>
      <div className="stream-grid">
        {STREAMS.map((stream, i) => (
          <button
            type="button"
            key={stream.title}
            className="boring-card stream-card"
            onClick={() => setOpened(i)}
          >
            <div className="stream-thumb">
              <MiniBoard position={stream.position} />
              <span className="live-badge">LIVE</span>
              <span className="viewer-count">{stream.viewers} watching</span>
              {opened === i && (
                <span className="stream-error">
                  This stream is not available in your region (Earth).
                </span>
              )}
            </div>
            <h2>{stream.title}</h2>
            <p className="muted">{stream.channel}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

const THREADS = [
  {
    title: "Is it legal to move the board while your opponent blinks?",
    author: "SneakyPete88",
    replies: 412,
    views: "38K",
    body: "Asking for a friend. The friend is me. I have done it 40 times and nobody has noticed.",
  },
  {
    title: "My bishop only moves on light squares. Should I see a doctor?",
    author: "worried_mom_1962",
    replies: 96,
    views: "11K",
    body: "The other bishop is fine. This one just refuses. He has been like this since he was born.",
  },
  {
    title: "Lost 1,400 rating points this week. AMA",
    author: "FormerlyGood",
    replies: 1203,
    views: "220K",
    body: "Started at 1,500. You can do the math. Please do not do the math.",
  },
  {
    title: "PSA: The king is not a good attacking piece",
    author: "Moderator",
    replies: 3,
    views: "1.2M",
    pinned: true,
    body: "We keep having to post this.",
  },
  {
    title: "Does anyone else hear the pieces whispering after midnight?",
    author: "definitely_not_a_ghost",
    replies: 0,
    views: "66,666",
    body: "They mostly say the same thing. Something about the rules changing. Probably nothing.",
  },
  {
    title: "What happens after the third move? [LOCKED]",
    author: "curious_george",
    replies: 0,
    views: "1",
    locked: true,
    body: "Thread locked by a moderator. Please do not ask about the 45 seconds.",
  },
];

function CommunityPage() {
  const [opened, setOpened] = useState<Set<number>>(new Set());
  return (
    <div className="boring-page">
      <div className="page-head">
        <h1>Community</h1>
        <p>
          Members online: <b>3</b> (one of them is you). Featured club:{" "}
          <b>Normal Chess Enjoyers</b> (2 members, both normal).
        </p>
      </div>
      <div className="boring-card thread-table" role="table">
        <div className="thread-row thread-head" role="row">
          <span role="columnheader">Topic</span>
          <span role="columnheader">Replies</span>
          <span role="columnheader">Views</span>
        </div>
        {THREADS.map((thread, i) => (
          <div key={thread.title} className="thread-entry">
            <button
              type="button"
              className="thread-row"
              role="row"
              aria-expanded={opened.has(i)}
              onClick={() => {
                const next = new Set(opened);
                if (next.has(i)) next.delete(i);
                else next.add(i);
                setOpened(next);
              }}
            >
              <span className="thread-title" role="cell">
                {thread.pinned && <span className="tag">Pinned</span>}
                {thread.locked && (
                  <span className="tag tag-locked">Locked</span>
                )}
                {thread.title}
                <span className="muted thread-author">by {thread.author}</span>
              </span>
              <span role="cell">{thread.replies.toLocaleString()}</span>
              <span role="cell">{thread.views}</span>
            </button>
            {opened.has(i) && <p className="thread-body">{thread.body}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

const TERMS = [
  "By reading this sentence you agree to these terms. By not reading it you also agree to these terms.",
  "Totally Normal Chess is a normal chess website. Any suggestion otherwise is a violation of these terms.",
  "We are not responsible for the movement of the knight. Nobody is.",
  "The rules of chess are fixed and will not change. We reserve the right to change them at any time, including every 45 seconds.",
  "You agree not to ask what happens after the third move.",
  "Pieces you capture remain the property of Totally Normal Chess and may be returned to the board without notice.",
  "Users may not tickle, bribe, or emotionally manipulate the computer opponent. It has feelings, and they are mostly about you.",
  "All disputes will be settled by a single game against a Roomba. The Roomba moves first.",
  "These terms are governed by the laws of a country we will name later.",
];

function TermsPage() {
  return (
    <div className="boring-page">
      <div className="page-head">
        <h1>Terms of Service</h1>
        <p>Last updated: tomorrow.</p>
      </div>
      <article className="boring-card legal-card">
        <ol className="legal-list">
          {TERMS.map((term) => (
            <li key={term}>{term}</li>
          ))}
        </ol>
      </article>
    </div>
  );
}

const PRIVACY = [
  {
    title: "What we collect",
    body: "Your moves, your mouse movements, how long you stare at the board, and the small sigh you make before resigning.",
  },
  {
    title: "Who we share it with",
    body: "The pieces. They talk to each other, and we cannot stop them.",
  },
  {
    title: "Cookies",
    body: "We use one cookie. It is oatmeal raisin. We are sorry.",
  },
  {
    title: "Data retention",
    body: "We keep your data forever, plus 45 seconds.",
  },
  {
    title: "Your rights",
    body: "You may request that we delete your data. Your request will be reviewed by the king, who has not left his square in years.",
  },
  {
    title: "Children",
    body: "This site is not intended for children under 13, or for adults who castle queenside on purpose.",
  },
];

function PrivacyPage() {
  return (
    <div className="boring-page">
      <div className="page-head">
        <h1>Privacy Policy</h1>
        <p>
          We take your privacy as seriously as we take anything, which is not
          very.
        </p>
      </div>
      <article className="boring-card legal-card">
        {PRIVACY.map((section) => (
          <section key={section.title} className="legal-section">
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </section>
        ))}
      </article>
    </div>
  );
}

const FAQ = [
  {
    q: "How do I move a piece?",
    a: "Click it, then click where you want it to go. If that does not work, click it harder.",
  },
  {
    q: "Why did my rating drop?",
    a: "Gravity.",
  },
  {
    q: "Can I undo a move?",
    a: "No. Live with what you have done.",
  },
  {
    q: "Is this site haunted?",
    a: "No. Please stop asking. The pieces do not like it.",
  },
  {
    q: "Why does the computer always win?",
    a: "It is Level 1. It is trying its best. You should try yours.",
  },
  {
    q: "Can I talk to a human?",
    a: "Our support team is a single pawn named Gary. He moves one square per business day and cannot go backwards.",
  },
];

function HelpPage() {
  const [opened, setOpened] = useState<Set<number>>(new Set());
  const [ticket, setTicket] = useState(false);
  return (
    <div className="boring-page">
      <div className="page-head">
        <h1>Help Center</h1>
        <p>
          Answers to the questions people ask most, and to some nobody asked.
        </p>
      </div>
      <div className="boring-card faq-list">
        {FAQ.map((item, i) => (
          <div key={item.q} className="faq-item">
            <button
              type="button"
              className="faq-question"
              aria-expanded={opened.has(i)}
              onClick={() => {
                const next = new Set(opened);
                if (next.has(i)) next.delete(i);
                else next.add(i);
                setOpened(next);
              }}
            >
              <span>{item.q}</span>
              <span className="muted">{opened.has(i) ? "−" : "+"}</span>
            </button>
            {opened.has(i) && <p className="faq-answer">{item.a}</p>}
          </div>
        ))}
      </div>
      <div className="boring-card help-contact">
        <div>
          <h2>Still stuck?</h2>
          <p className="muted">Open a ticket and Gary will get to it.</p>
        </div>
        {ticket ? (
          <p className="reveal">
            Ticket #00000001 created. Gary is on his way. Estimated arrival: 6
            business days.
          </p>
        ) : (
          <button
            type="button"
            className="boring-btn"
            onClick={() => setTicket(true)}
          >
            Open a ticket
          </button>
        )}
      </div>
    </div>
  );
}

/** The fake content behind each link in the plain site's header and footer */
export function BoringPage({ tab }: { tab: Exclude<SiteTab, "Play"> }) {
  switch (tab) {
    case "Puzzles":
      return <PuzzlesPage />;
    case "Learn":
      return <LearnPage />;
    case "Watch":
      return <WatchPage />;
    case "Community":
      return <CommunityPage />;
    case "Terms":
      return <TermsPage />;
    case "Privacy":
      return <PrivacyPage />;
    case "Help":
      return <HelpPage />;
  }
}
