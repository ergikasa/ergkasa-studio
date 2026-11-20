/* global process, console */
/**
 * Character v4 audit, measured on the implementation as it stands (not on its description):
 *   1. landmark census and how every drawn point is anchored (named landmark / derived 3D / picture space),
 *   2. what is vector, what is raster,
 *   3. the rotation experiment: the current v4 head rendered at other yaws and pitches,
 *   4. the render cost of every layer.
 * Writes out/audit/*.png and out/audit/audit.json.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { landmarks } from "../model.mjs";
import { makeHead, svgHead } from "../head.mjs";
import { svgHair, svgBeard, HAIRSTYLE, BEARD } from "../hair.mjs";
import { headLayers, bustSvg, backdrop } from "../portrait.mjs";
import { rasterize, png } from "./raster.mjs";

const OUT = "prototypes/character-v4/out/audit";
mkdirSync(OUT, { recursive: true });
const report = {};

// ---- 1. landmark census
const L = landmarks();
const names = Object.keys(L);
report.landmarks = {
  named: names.length,
  midline: names.filter((k) => !k.includes(".")).length,
  perSide: names.filter((k) => k.startsWith("n.")).length,
  mirrored: true,
  asymmetric: ["browPeak", "browTail", "cheilion", "lidUpPeak"],
};

// ---- anchoring census: wrap the projector and count what every drawn point comes from
const H = makeHead({});
const count = { landmark: 0, derived3d: 0, picture: 0 };
const P0 = H.P;
H.P = (v) => {
  if (typeof v === "string") count.landmark++;
  else if (Array.isArray(v) && v.length === 2) count.picture++;
  else count.derived3d++;
  return P0(v);
};
H.pts = (list) => list.map((v) => H.P(v));
const smoothOf = H.path;
H.path = (list, closed = true, k) => {
  H.pts(list);
  return smoothOf(list, closed, k);
};
const h = svgHead(H, { look: [0.14, 0.06] });
const faceCount = { ...count };
// shapes built straight from picture-space arrays, never through the projector
const direct = {
  skinOutline: 40,
  neck: 11,
  hairOutline: HAIRSTYLE.outline.length,
  hairReach: HAIRSTYLE.reach.length,
  hairline: HAIRSTYLE.hairline.length,
  hairPart: HAIRSTYLE.part.length,
  hairGuides: HAIRSTYLE.top.concat(HAIRSTYLE.back).reduce((a, g) => a + g.length - 1, 0),
  hairSheen: HAIRSTYLE.sheen.length,
  beardZone: BEARD.zone.length,
};
report.anchoring = {
  headShapesThroughProjector: faceCount,
  pictureSpaceOnlyControlPoints: direct,
  generatedStrokes:
    "hair locks/strands, beard tufts/hairs, brows, lashes, iris fibres: generated in picture space from the above",
};

// ---- 2. vector / raster inventory of the portrait SVG
const tags = (svg, re) => (svg.match(re) || []).length;
const hair = svgHair();
const beard = svgBeard(makeHead({}), { lips: h.lips });
const groups = {
  neck: h.neck,
  face: h.face,
  features: h.features,
  beard: beard.svg,
  hair: hair.svg,
  ear: h.ear,
};
report.inventory = {};
for (const [k, s] of Object.entries(groups))
  report.inventory[k] = {
    bytes: s.length,
    paths: tags(s, /<path\b/g),
    filtered: tags(s, /filter="url/g),
    images: tags(s, /<image\b/g),
    turbulence: tags(s, /feTurbulence/g),
  };

// ---- 3. rotation experiment: the current head at other views
const views = [
  ["yaw 0", { yaw: 0 }],
  ["yaw 22 (authored)", { yaw: 22 }],
  ["yaw 40", { yaw: 40 }],
  ["pitch +15 (chin down)", { pitch: 15 }],
];
const tiles = [];
for (const [label, v] of views) {
  const Lh = headLayers(v);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2000" viewBox="0 0 1600 2000"><defs>${Lh.defs}</defs><rect width="1600" height="2000" fill="#2C383D"/>${Lh.neck}${Lh.head}</svg>`;
  tiles.push({ label, b64: png(svg).toString("base64") });
}
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="2400" height="760" viewBox="0 0 2400 760"><rect width="2400" height="760" fill="#0E1215"/>${tiles
  .map(
    (t, i) =>
      `<svg x="${i * 600}" y="60" width="600" height="700" viewBox="520 280 820 960" preserveAspectRatio="xMidYMid slice"><image href="data:image/png;base64,${t.b64}" width="1600" height="2000"/></svg><text x="${i * 600 + 24}" y="42" font-family="Montserrat" font-weight="800" font-size="26" fill="#E8E2D8">${t.label}</text>`,
  )
  .join("")}</svg>`;
writeFileSync(`${OUT}/v4-rotation-experiment.png`, png(sheet));

// ---- 4. per-layer render cost (portrait, 1600 x 2000, resvg, the production opacity guard)
const head = headLayers();
const bust = bustSvg();
const bg = backdrop();
const defs = `${bg.defs}${head.defs}${bust.defs}`;
const wrap = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2000" viewBox="0 0 1600 2000"><defs>${defs}</defs>${body}</svg>`;
const hd = headLayers();
const parts = {
  background: bg.svg,
  neck: hd.neck,
  wardrobe: bust.svg,
  face: h.face,
  features: h.features,
  beard: beard.svg,
  hair: hair.svg,
  ear: h.ear,
};
const time = (svg, n = 2) => {
  let best = Infinity;
  for (let i = 0; i < n; i++) {
    const r = rasterize(svg);
    best = Math.min(best, r.parseMs + r.renderMs);
  }
  return Math.round(best);
};
report.layerCostMs = { empty: time(wrap("")) };
for (const [k, s] of Object.entries(parts)) report.layerCostMs[k] = time(wrap(s));
report.layerCostMs.full = time(wrap(`${bg.svg}${hd.neck}${bust.svg}${hd.head}`));
writeFileSync(`${OUT}/audit.json`, JSON.stringify(report, null, 2));
console.info(JSON.stringify(report, null, 2));
void process;
