/* global console */
// The direction board: portrait, full body, detail crops, palette (prototype tooling).
import { readFileSync, writeFileSync } from "node:fs";
import { png } from "../character-v3/raster.mjs";

const OUT = "prototypes/character-v4/out";
const b64 = (p) => readFileSync(p).toString("base64");
const portrait = b64(`${OUT}/v4-portrait.png`);
const full = b64(`${OUT}/v4-fullbody.png`);

const img = (data, x, y, w, h, crop) => {
  // crop: [sx, sy, sw, sh] of the source, shown in the box via a nested svg viewBox
  if (!crop)
    return `<image href="data:image/png;base64,${data}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
  const [sx, sy, sw, sh, W, H] = crop;
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="xMidYMid slice"><image href="data:image/png;base64,${data}" x="0" y="0" width="${W}" height="${H}"/></svg>`;
};
const text = (x, y, s, size, weight = 500, fill = "#E8E2D8", anchor = "start", ls = 0) =>
  `<text x="${x}" y="${y}" font-family="Montserrat" font-weight="${weight}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}">${s}</text>`;

const PALETTE = [
  ["Skin lit", "#E2AA88"],
  ["Skin highlight", "#F5D2B6"],
  ["Terminator", "#B85A44"],
  ["Skin shadow", "#A8644E"],
  ["Occlusion", "#6A3428"],
  ["Iris", "#94703D"],
  ["Hair", "#1E1714"],
  ["Beard lit", "#5E4A3C"],
  ["Rim light", "#BCD5EE"],
  ["Jacket", "#25314A"],
  ["Knit", "#CDBFA8"],
  ["Trousers", "#3A3C42"],
  ["Boots", "#6E4329"],
  ["Backdrop", "#2C383D"],
];

const W = 2400,
  H = 1660;
const parts = [];
parts.push(`<rect width="${W}" height="${H}" fill="#0E1215"/>`);
parts.push(text(60, 78, "ERKASA  ·  CHARACTER v4", 40, 800, "#F2ECE2", "start", 3));
parts.push(
  text(
    60,
    116,
    "Stylized Human Realism — premium 2D cinematic. Direction for approval: an original character, not a production asset.",
    22,
    500,
    "#9AA6AA",
  ),
);
parts.push(text(W - 60, 78, "Daniel Vos, 44 · reporter archetype", 24, 500, "#C9BFB2", "end"));
parts.push(text(W - 60, 112, "proto-character-v4 · not production", 18, 500, "#6C787C", "end"));
// portrait and full body
parts.push(`<rect x="58" y="148" width="1108" height="1385" fill="none" stroke="#2A3236" stroke-width="2"/>`);
parts.push(img(portrait, 60, 150, 1104, 1380));
parts.push(
  `<rect x="1198" y="148" width="719" height="1385" fill="none" stroke="#2A3236" stroke-width="2"/>`,
);
parts.push(img(full, 1200, 150, 715, 1380));
parts.push(
  text(
    60,
    1566,
    "PORTRAIT  ·  3/4, short key light with a Rembrandt triangle, cool rim",
    18,
    500,
    "#8D989C",
    "start",
    1,
  ),
);
parts.push(text(1200, 1566, "FULL BODY  ·  7.3 heads, contrapposto", 18, 500, "#8D989C", "start", 1));
// detail crops
const cx = 1960,
  cw = 380;
parts.push(text(cx, 176, "EYES", 18, 800, "#C9BFB2", "start", 2));
parts.push(img(portrait, cx, 190, cw, 170, [622, 752, 380, 170, 1600, 2000]));
parts.push(text(cx, 386, "sclera · iris fibres · pupil · lids · lash line", 15, 500, "#8D989C"));
parts.push(text(cx, 430, "HAND", 18, 800, "#C9BFB2", "start", 2));
parts.push(img(full, cx, 444, 180, 250, [880, 1360, 260, 360, 1400, 2700]));
parts.push(text(cx + 196, 470, "knuckles, three", 15, 500, "#8D989C"));
parts.push(text(cx + 196, 492, "joints per finger,", 15, 500, "#8D989C"));
parts.push(text(cx + 196, 514, "thumb opposed,", 15, 500, "#8D989C"));
parts.push(text(cx + 196, 536, "relaxed curl", 15, 500, "#8D989C"));
parts.push(text(cx, 736, "BEARD · HAIR", 18, 800, "#C9BFB2", "start", 2));
parts.push(img(portrait, cx, 750, cw, 200, [660, 960, 380, 200, 1600, 2000]));
parts.push(text(cx, 976, "volume first, then tufts and single hairs", 15, 500, "#8D989C"));
// palette
parts.push(text(cx, 1024, "PALETTE", 18, 800, "#C9BFB2", "start", 2));
PALETTE.forEach(([name, hex], i) => {
  const col = i % 2,
    row = Math.floor(i / 2);
  const x = cx + col * 192,
    y = 1042 + row * 58;
  parts.push(
    `<rect x="${x}" y="${y}" width="44" height="44" rx="4" fill="${hex}" stroke="#2A3236" stroke-width="1.5"/>`,
  );
  parts.push(text(x + 54, y + 20, name, 15, 500, "#C9BFB2"));
  parts.push(text(x + 54, y + 40, hex, 13, 500, "#6C787C"));
});
parts.push(text(cx, 1566, "Reference photos informed anatomy only.", 15, 500, "#6C787C"));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
writeFileSync(`${OUT}/v4-direction-board.png`, png(svg));
console.info("board ok");
