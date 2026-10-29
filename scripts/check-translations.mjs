// Lists English text with no French or German wording, and wording whose English is gone.
// Run with `npm run check:i18n`. Exits non-zero if anything is out of step.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const src = join(root, "src");

/** Files whose tables of text reach the screen through `t()` called on a variable */
const TABLES = [
  "src/components/Chessbot/lines.ts",
  "src/components/Chessbot/useChessbot.ts",
  "src/components/DevNote/notes.ts",
  "src/components/Show/ShowCards.tsx",
  "src/components/Show/FinaleEnding.tsx",
  "src/components/Show/CurseIntro.tsx",
  "src/components/Board/SkipBanner.tsx",
  "src/components/Board/Football.tsx",
  "src/components/RallyPanel/RallyPanel.tsx",
  "src/components/BoringSite/BoringPages.tsx",
  "src/components/BoringSite/BoringSite.tsx",
  "src/components/BoringSite/AuthDialog.tsx",
  "src/components/BoringSite/BotWindows.tsx",
  "src/theme/themes.ts",
  "src/plugins/trenches.ts",
];

/** Strings in those files that are not text anyone reads */
const NOT_TEXT = [
  /^[wb][KQRBNP]( [a-h][1-8])+(, [wb][KQRBNP]( [a-h][1-8])+)*$/, // piece placements
  /^[\d.,%#½-]+[KM]?$/, // numbers and scores
  /^#[0-9a-f]{3,8}$/i,
  /^[a-z]+(-[a-z]+)*$/, // ids and class names
  /^[A-Z][a-z]+[A-Z]\w*$/, // channel names
  /^[\w-]+\.(ts|tsx|css|txt|log|exe|dll)$/,
  /^\.\/|^\.\.\//,
  /^--/, // custom properties
  /^\.[a-z]/, // selectors
  /^[MLHVQTCAZ]-?\d/, // svg paths
  /^(url|rgba?|rotate|translate|scale)\(/,
  /^-?[\d.]+(px|s|ms|deg)?( -?[\d.]+(px|s|ms|deg)?)*$/,
  /^userSpaceOnUse$/,
  /^[█▓▒#%@$?01]+$/,
  /^[♚♛♜♝♞♟]+$/,
];
/** Words in the tables that are read on screen, though they look like ids */
const WORDS = new Set([
  "pawn",
  "knight",
  "bishop",
  "rook",
  "queen",
  "king",
  "chess",
  "rules",
  "fairness",
  "administrator",
  "deleted",
  "replaced",
  "chessbot",
]);
/** Strings in the tables that are code, names, or otherwise kept as they are */
const KEPT = new Set([
  "chessbot.exe",
  "cursed_chess.exe",
  "cursed_chess.ts",
  "record.txt",
  "opponents_today.log",
  "> ./cursed_chess --launch",
  "guest (1200)",
  "e4",
  "Stephen",
  "Arthur",
  "Lena",
  "Chessbot",
  "maksymmalko",
  "Joshua Swanson",
  "CURSED",
  "[data-sq]",
  "Escape",
  "en-US",
  " is-last",
  "Moderator",
  "worried_mom_1962",
  "definitely_not_a_ghost",
  "curious_george",
  "Pieces dig in and fight on their own. Send your front line over the top to take the enemy trench.",
  "{n}",
  "I",
]);

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !path.includes("/i18n/") ? [path] : [];
  });
}

/** The value of a quoted string literal, escapes and all */
const unquote = (literal) =>
  literal[0] === "'"
    ? JSON.parse(
        `"${literal.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"')}"`,
      )
    : JSON.parse(literal);

const STRING = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/g;
const CALL = /\bt\(\s*("(?:[^"\\\n]|\\.)*")/g;
const TIP = /\btip="([^"]*)"/g;

const files = sourceFiles(src);
const code = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
const needed = new Map();
const need = (text, where) => {
  if (!needed.has(text)) needed.set(text, where);
};

for (const [file, text] of code) {
  const where = relative(root, file);
  for (const [, literal] of text.matchAll(CALL)) need(unquote(literal), where);
  for (const [, tip] of text.matchAll(TIP)) need(tip, where);
}
for (const table of TABLES) {
  const text = code.get(join(root, table));
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("import") || trimmed.startsWith("//")) continue;
    if (trimmed.startsWith("*") || trimmed.startsWith("/*")) continue;
    for (const [literal] of line.matchAll(STRING)) {
      const value = unquote(literal);
      if (!/[A-Za-z]/.test(value) || KEPT.has(value)) continue;
      if (/className|href|src=|key=|description/.test(line)) continue;
      if (!WORDS.has(value) && NOT_TEXT.some((re) => re.test(value))) continue;
      need(value, table);
    }
  }
}

const dictionaries = {};
for (const language of ["fr", "de"]) {
  const file = readFileSync(join(src, "i18n", `${language}.ts`), "utf8");
  dictionaries[language] = new Set(
    [
      ...file.matchAll(
        /^\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z_$][\w$]*):/gm,
      ),
    ].map(([, key]) => (/^["']/.test(key) ? unquote(key) : key)),
  );
}

let problems = 0;
const report = (heading, lines) => {
  if (lines.length === 0) return;
  problems += lines.length;
  console.log(`\n${heading} (${lines.length})`);
  for (const line of lines) console.log(`  ${line}`);
};

for (const [language, keys] of Object.entries(dictionaries)) {
  report(
    `English with no ${language} wording`,
    [...needed]
      .filter(([text]) => !keys.has(text))
      .map(([text, where]) => `${JSON.stringify(text)}  (${where})`),
  );
  report(
    `${language} wording for English that is no longer in the game`,
    [...keys].filter((key) => !needed.has(key)).map((k) => JSON.stringify(k)),
  );
}

if (problems > 0) process.exit(1);
console.log(
  `All ${needed.size} pieces of text have French and German wording.`,
);
