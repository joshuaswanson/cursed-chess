// Builds the party piece set from the classic pieces: toy-like gradient bodies,
// thicker ink outlines, and gold trim on the dark pieces.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const SRC = "public/pieces";
const OUT = "public/pieces/party";
const INK = "#1b1033";
const GOLD = "#ffd23f";

const BODY = {
  w: [
    ["0%", "#fffdf6"],
    ["55%", "#ffe7c2"],
    ["100%", "#f0b977"],
  ],
  b: [
    ["0%", "#8a62db"],
    ["45%", "#3d1f7c"],
    ["100%", "#170936"],
  ],
};

for (const file of readdirSync(SRC).filter((f) => f.endsWith(".svg"))) {
  const color = file[0];
  let svg = readFileSync(`${SRC}/${file}`, "utf8");

  const stops = BODY[color]
    .map(([offset, c]) => `<stop offset="${offset}" stop-color="${c}"/>`)
    .join("");
  const defs = `<defs><linearGradient id="body" gradientUnits="userSpaceOnUse" x1="0" y1="6" x2="0" y2="42">${stops}</linearGradient></defs>`;

  svg = svg.replace(/stroke-width="1\.5"/g, 'stroke-width="2"');
  svg = svg.replace(/stroke="#000"/g, `stroke="${INK}"`);
  if (color === "w") {
    svg = svg.replace(/fill="#fff"/g, 'fill="url(#body)"');
    svg = svg.replace(/fill="#000"/g, `fill="${INK}"`);
  } else {
    svg = svg.replace(/fill="#000"/g, 'fill="url(#body)"');
    svg = svg.replace(/(fill|stroke)="#ececec"/g, `$1="${GOLD}"`);
    // Shapes without an explicit fill inherit black, so the root carries the body
    svg = svg.replace(/<svg /, '<svg fill="url(#body)" ');
  }
  svg = svg.replace(/(<svg[^>]*>)/, `$1${defs}`);
  writeFileSync(`${OUT}/${file}`, svg);
}
