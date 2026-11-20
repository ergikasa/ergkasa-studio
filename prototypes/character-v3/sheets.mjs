/* global console */
/**
 * Character v3 prototype: the design sheets for review.
 *   node prototypes/character-v3/sheets.mjs   (from the repository root)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { character, hand, HAND_POSES } from "./body.mjs";
import { head, EXPRESSIONS, SKIN } from "./head.mjs";
import { png } from "./raster.mjs";

const OUT = "prototypes/character-v3/out";
let n = 0;
/** One instance with its own ids (several characters in one sheet). */
const scoped = (svg, defs = "") => {
  const p = `i${n++}-`;
  return `<g><defs>${defs.replaceAll('id="', `id="${p}`)}</defs>${svg.replaceAll('id="', `id="${p}`).replaceAll("url(#", `url(#${p}`)}</g>`;
};
const label = (x, y, t, size = 26, w = 500) =>
  `<text x="${x}" y="${y}" font-family="Montserrat" font-weight="${w}" font-size="${size}" text-anchor="middle" fill="#14213D">${t}</text>`;
const page = (w, h, body, bg = "#EFE6D6") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="${bg}"/>${body}</svg>`;
const headAt = (controls, x, y, s = 1) => {
  const h = head(controls);
  return `<g transform="translate(${x} ${y}) scale(${s})">${scoped(h.svg, h.defs)}</g>`;
};

// ---- 1. model sheet: full figure with head units, medium shot, close-up
{
  const full = character({ arm: 5, fore: 8, armF: 2, foreF: 10 }, { gx: 0.3 }, {}, { legs: true });
  let guides = "";
  // head units: crown at -340 (world), 280 per head
  for (let k = 0; k <= 8; k++) {
    const y = 120 + (-340 + k * 280 - -340) * 0.62;
    guides += `<line x1="40" x2="520" y1="${y}" y2="${y}" stroke="#B9A88C" stroke-width="2" stroke-dasharray="6 8"/>${label(30, y + 8, String(k), 20)}`;
  }
  const med = character(
    { arm: 22, fore: 100, wrist: -18, handN: "explain" },
    { smile: 0.4, cheek: 0.3, gx: 0.4 },
    {},
    {},
  );
  const body =
    label(700, 64, "Erkasa Character v3: prototype model sheet", 40, 800) +
    guides +
    `<g transform="translate(300 330) scale(0.62)">${scoped(full.svg, full.defs)}</g>` +
    label(280, 1600, "7.5 heads, 3/4 view", 24) +
    `<g transform="translate(860 760) scale(0.95)">${scoped(med.svg, med.defs)}</g>` +
    label(860, 1600, "medium shot, gesture", 24) +
    headAt({ gx: 0.5 }, 1330, 420, 1.35) +
    label(1330, 680, "close-up", 24);
  writeFileSync(`${OUT}/v3-model-sheet.png`, png(page(1560, 1660, body)));
}

// ---- 2. expressions
{
  const names = [
    "neutral",
    "joy",
    "sadness",
    "worry",
    "fear",
    "anger",
    "surprise",
    "convince",
    "reassure",
    "thinking",
  ];
  let body = label(
    800,
    60,
    "Expressions: action units (brows, lids, cheeks, lips, jaw), not head tilt",
    34,
    800,
  );
  names.forEach((nm, i) => {
    const x = 170 + (i % 5) * 315,
      y = 300 + Math.floor(i / 5) * 420;
    body += headAt(EXPRESSIONS[nm], x, y, 1.05) + label(x, y + 190, nm, 28);
  });
  writeFileSync(`${OUT}/v3-expressions.png`, png(page(1600, 1100, body)));
}

// ---- 3. eyes: anatomy, gaze directions, blink, emotional eyes
{
  let body = label(
    800,
    60,
    "Eyes: sclera, iris, pupil, lids, crease; the gaze moves without the head",
    30,
    800,
  );
  // a large detail of the eyes, framed
  body += `<clipPath id="detail"><rect x="40" y="110" width="520" height="380" rx="12"/></clipPath><g clip-path="url(#detail)"><rect x="40" y="110" width="520" height="380" fill="#E4D6BF"/><g transform="translate(250 330) scale(2.6)">${scoped(head({ gx: 0.2 }).svg, head({}).defs)}</g></g>`;
  body += label(300, 530, "detail", 22);
  // gaze grid
  const g = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [0, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];
  g.forEach(([gx, gy], i) => {
    const x = 700 + (i % 3) * 200,
      y = 230 + Math.floor(i / 3) * 190;
    body += headAt({ gx, gy }, x, y, 0.62);
  });
  body += label(900, 820, "gaze: 9 directions, the head still", 24);
  // blink sequence
  [0, 0.35, 0.7, 1, 0.5, 0].forEach((lid, i) => {
    body += headAt({ lidUp: lid, gx: 0.3 }, 130 + i * 230, 1020, 0.7);
  });
  body += label(700, 1150, "blink: 2 frames closing, 4 opening", 24);
  [
    ["fear", { wide: 0.9, browIn: 0.9, browOut: 0.5, pupil: 0.6 }],
    ["anger", { lidUp: 0.28, squint: 0.35, knit: 1, browIn: -0.95 }],
    ["sadness", { lidUp: 0.35, browIn: 0.95, browOut: -0.45, gy: 0.45 }],
    ["joy", { squint: 0.5, cheek: 0.8, smile: 0.9 }],
  ].forEach(([nm, c], i) => {
    body +=
      headAt(c, 1260 + (i % 2) * 230, 300 + Math.floor(i / 2) * 330, 0.75) +
      label(1260 + (i % 2) * 230, 440 + Math.floor(i / 2) * 330, nm, 22);
  });
  body += label(1375, 820, "emotional eyes: opening, lid tension, pupil", 22);
  writeFileSync(`${OUT}/v3-eyes.png`, png(page(1600, 1220, body)));
}

// ---- 4. hands
{
  const skin = { base: SKIN.base, shade: SKIN.shade, deep: SKIN.deep, light: SKIN.light };
  let body = label(
    700,
    60,
    "Hands: palm, thumb and four fingers, each a bone chain that curls joint by joint",
    30,
    800,
  );
  Object.keys(HAND_POSES).forEach((k, i) => {
    body +=
      `<g transform="translate(${130 + i * 230} 130) scale(1.9)">${hand(HAND_POSES[k], 0, skin)}</g>` +
      label(150 + i * 230, 520, k, 26);
  });
  writeFileSync(`${OUT}/v3-hands.png`, png(page(1420, 560, body)));
}

// ---- 5. before / after
{
  const before = readFileSync("docs/reports/w2v/face-before.png").toString("base64");
  const map = [
    ["neutral", {}],
    ["sad", EXPRESSIONS.sadness],
    ["anxious / worry", EXPRESSIONS.worry],
    ["happy / joy", EXPRESSIONS.joy],
    ["determined / convince", EXPRESSIONS.convince],
  ];
  let body =
    label(1050, 56, "Before: rig v1/v2 (primitives)", 34, 800) +
    `<image href="data:image/png;base64,${before}" x="0" y="80" width="2100" height="600"/>`;
  body += label(1050, 760, "After: Character v3 prototype (authored shapes + action units)", 34, 800);
  map.forEach(
    ([nm, c], i) => (body += headAt(c, 230 + i * 420, 1000, 1.25) + label(230 + i * 420, 1250, nm, 30)),
  );
  writeFileSync(`${OUT}/v3-before-after.png`, png(page(2100, 1300, body)));
}
console.info("sheets written");
