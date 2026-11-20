/**
 * Daniel, human cartoon v1 (concept prototype): the presentation sheets.
 *   node sheets.mjs  →  out/daniel-model-sheet.png, out/daniel-expressions.png, out/daniel-head-turn.png
 */
import { camera, renderPng, svgDoc } from "./lib.mjs";
import { figure, PAL } from "./figure.mjs";
import { drawHead } from "./face.mjs";
import { HPAL } from "./face.mjs";
import { sheet } from "./expressions.mjs";
import { turnStrip } from "./turn.mjs";

const OUT = (f) => new URL(`./out/${f}`, import.meta.url).pathname;
const BG = "#EFEBE4";
const INK = "#2E2621";
const text = (x, y, s, size = 26, weight = 400, fill = INK, anchor = "start") =>
  `<text x="${x}" y="${y}" font-family="Inter" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${s}</text>`;

// ------------------------------------------------------------------------------------------------ model sheet
{
  const W = 2760,
    H = 2420;
  const S = 10,
    floorY = 2250;
  let svg = "";
  svg += text(80, 110, "DANIEL VOS", 64, 700);
  svg += text(
    80,
    165,
    "Human cartoon, concept v1 · 44 · 181 cm · about 7.3 heads · drawn by code from one 3D construction · not approved",
    28,
    400,
    "#6B5F56",
  );
  // head-unit guides
  const unit = 181 / 7.3;
  for (let k = 0; k <= 7; k++) {
    const y = floorY - k * unit * S;
    svg += `<line x1="70" y1="${y}" x2="1560" y2="${y}" stroke="#CBBFB2" stroke-width="2" stroke-dasharray="10 10"/>`;
    svg += text(40, y + 9, String(k), 22, 400, "#9A8C80");
  }
  svg += figure({ yaw: 0, S, cx: 450, floorY });
  svg += figure({ yaw: 35, S, cx: 1180, floorY });
  svg += text(450, floorY + 110, "FRONT", 30, 700, INK, "middle");
  svg += text(1180, floorY + 110, "3/4 (35°)", 30, 700, INK, "middle");
  // head close-ups
  svg += text(1680, 330, "HEAD", 30, 700);
  const hp = { at: [0, 168.6, 0.8], nod: 1 };
  svg += drawHead(camera({ yaw: 0, S: 22, cx: 1900, cy: 680, floor: 168.6 }), {
    pose: hp,
    expr: { browDown: 0.12, press: 0.1 },
  }).svg;
  svg += drawHead(camera({ yaw: 30, S: 22, cx: 2420, cy: 680, floor: 168.6 }), {
    pose: hp,
    expr: { browDown: 0.12, press: 0.1 },
  }).svg;
  // palette
  const sw = [
    ["Skin", PAL.skin, PAL.skinShade],
    ["Hair", HPAL.hair, HPAL.hairShade],
    ["Grey", HPAL.greyHi, HPAL.grey],
    ["Beard", HPAL.beard, HPAL.beardShade],
    ["Eyes", HPAL.iris, HPAL.irisDark],
    ["Jacket", PAL.jacket, PAL.jacketShade],
    ["Shirt", PAL.shirt, PAL.shirtShade],
    ["Trousers", PAL.trousers, PAL.trousersShade],
    ["Shoes", PAL.shoe, PAL.shoeShade],
    ["Line", PAL.line, PAL.jacketLine],
  ];
  svg += text(1680, 1110, "COLOUR (base / shadow)", 30, 700);
  sw.forEach(([name, a, b], k) => {
    const x = 1680 + (k % 5) * 205,
      y = 1150 + Math.floor(k / 5) * 170;
    svg += `<rect x="${x}" y="${y}" width="80" height="90" rx="8" fill="${a}" stroke="${INK}" stroke-width="2"/>`;
    svg += `<rect x="${x + 80}" y="${y}" width="80" height="90" rx="8" fill="${b}" stroke="${INK}" stroke-width="2"/>`;
    svg += text(x, y + 125, name, 22, 400, "#6B5F56");
  });
  // design notes
  const notes = [
    "Light: key from upper left, one cel shadow tone, no gradients.",
    "Line: warm dark brown, tapered; heavier outside, light inside.",
    "Asymmetry: left brow higher, right mouth corner higher, watch on the left wrist.",
    "Identity: dark brown hair with grey at the temples, short full beard, brown eyes.",
    "Outfit: navy unstructured blazer, open white shirt, charcoal trousers, brown shoes.",
  ];
  svg += text(1680, 1560, "DESIGN NOTES", 30, 700);
  notes.forEach((n, k) => (svg += text(1680, 1610 + k * 44, n, 24, 400, "#4E443D")));
  renderPng(svgDoc(W, H, svg, BG), OUT("daniel-model-sheet.png"), W);
}

// ------------------------------------------------------------------------------------------------ expressions
{
  const g = sheet();
  const pad = 170;
  let svg = text(70, 100, "DANIEL VOS · EXPRESSIONS", 56, 700);
  svg += text(
    70,
    145,
    "Concept v1 · 3/4 at 25° · one construction, moved by rig parameters (brows, lids, mouth, jaw, gaze)",
    26,
    400,
    "#6B5F56",
  );
  svg += `<g transform="translate(0,${pad})">${g.svg}</g>`;
  renderPng(svgDoc(g.w, g.h + pad, svg, BG), OUT("daniel-expressions.png"), g.w);
}

// ------------------------------------------------------------------------------------------------ head turn (evidence)
{
  const t = turnStrip({ angles: [0, 15, 30, 45, 60, 75, 90], S: 15, cell: 360 });
  let svg = text(
    40,
    70,
    "Head turn from one construction (0° to 90°): works to about 45°, breaks in profile",
    30,
    700,
  );
  svg += `<g transform="translate(0,90)">${t.svg}</g>`;
  renderPng(svgDoc(t.w, t.h + 90, svg, BG), OUT("daniel-head-turn.png"), t.w);
}
console.log("sheets ok");
