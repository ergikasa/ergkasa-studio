/* global console */
/**
 * Character v4 rig prototype: the same v4 frames through the two SVG rasterisers that already exist in the repo
 * (prototype tooling, not production code).
 *
 *   resvg 2.6          film/src/raster.ts, film/src/compose.ts (production path today)
 *   Skia (napi-rs)     film/src/w0/compositor.ts (the W0 composer: "5x faster than resvg here, same picture")
 *
 * Same SVG for both: config D of bench.mjs (LOD 0.55, fitted filters) without the cached set image and the grade,
 * which a compositor draws as pixels either way (Skia's SVG renderer does not draw the set's data-URI image: a
 * first run with it gave a black background and a mean difference of 23/255). A flat backdrop stands in for the
 * set, so both pictures are complete. Reports the time of each, and how far Skia's picture is from resvg's (per
 * pixel and 8x8-averaged), with face crops side by side for inspection.
 * Writes out/demo/skia-check.json and out/evidence/skia-vs-resvg.png.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { createHeadRig } from "./headrig.mjs";
import { frameSvg } from "./demo.mjs";
import { rasterize, png, fitFilters } from "./raster.mjs";

const require = createRequire(new URL("../../../film/package.json", import.meta.url));
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const ROOT = "prototypes/character-v4/out";
mkdirSync(`${ROOT}/evidence`, { recursive: true });
const S = JSON.parse(readFileSync(`${ROOT}/demo/states.json`, "utf8"));
const FRAMES = [0, 95, 200, 330, 450, 600];
const head = createHeadRig({ lod: 0.55 });

async function skia(svg, w, h) {
  const a = process.hrtime.bigint();
  const img = await loadImage(Buffer.from(svg));
  const b = process.hrtime.bigint();
  const c = createCanvas(w, h);
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  const pixels = Buffer.from(g.getImageData(0, 0, w, h).data.buffer);
  const e = process.hrtime.bigint();
  return { pixels, parseMs: Number(b - a) / 1e6, renderMs: Number(e - b) / 1e6, canvas: c };
}

function cmp(A, B, W, H, k) {
  const w = Math.floor(W / k),
    h = Math.floor(H / k);
  let s = 0,
    big = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let d = 0;
      for (let c = 0; c < 3; c++) {
        let a = 0,
          b = 0;
        for (let j = 0; j < k; j++)
          for (let i = 0; i < k; i++) {
            const p = ((y * k + j) * W + x * k + i) * 4 + c;
            a += A[p];
            b += B[p];
          }
        d += Math.abs(a - b) / (k * k);
      }
      d /= 3;
      s += d;
      if (d > 8) big++;
    }
  return { meanAbs: +(s / (w * h)).toFixed(3), cellsOver8: +(big / (w * h)).toFixed(4) };
}

const rows = [];
const crops = [];
for (const n of FRAMES) {
  const svg = fitFilters(frameSvg(S[n], head, {}, 48, new Set(["set", "grade"]))).replace(
    /<\/defs>/,
    `</defs><rect x="-48" y="-48" width="1176" height="2016" fill="#34434A"/>`,
  );
  let r = null,
    k = null;
  for (let rep = 0; rep < 2; rep++) {
    const rr = rasterize(svg);
    if (!r || rr.parseMs + rr.renderMs < r.parseMs + r.renderMs) r = rr;
    const kk = await skia(svg, rr.width, rr.height);
    if (!k || kk.parseMs + kk.renderMs < k.parseMs + k.renderMs) k = kk;
  }
  const row = {
    n,
    resvgMs: +(r.parseMs + r.renderMs).toFixed(0),
    skiaMs: +(k.parseMs + k.renderMs).toFixed(0),
    speedup: +((r.parseMs + r.renderMs) / (k.parseMs + k.renderMs)).toFixed(2),
    diffPerPixel: cmp(r.pixels, k.pixels, r.width, r.height, 1),
    diff8x8: cmp(r.pixels, k.pixels, r.width, r.height, 8),
  };
  rows.push(row);
  console.info(JSON.stringify(row));
  if (n === 200 || n === 450) {
    // face crop, resvg left, Skia right
    const box = [330, 300, 520, 620];
    const pr = png(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${r.width}" height="${r.height}"><image href="data:image/png;base64,${Buffer.from(r.img.asPng()).toString("base64")}" width="${r.width}" height="${r.height}"/></svg>`,
    );
    const pk = k.canvas.toBuffer("image/png");
    crops.push({
      n,
      box,
      resvg: pr.toString("base64"),
      skia: pk.toString("base64"),
      w: r.width,
      h: r.height,
    });
  }
}
const avg = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
const out = {
  frames: rows,
  mean: { resvgMs: avg("resvgMs"), skiaMs: avg("skiaMs"), speedup: avg("resvgMs") / avg("skiaMs") },
};
writeFileSync(`${ROOT}/demo/skia-check.json`, JSON.stringify(out, null, 1));
console.info(JSON.stringify(out.mean));

const T = 520;
const tiles = crops.flatMap((c, j) =>
  ["resvg", "skia"].map(
    (kind, i) =>
      `<svg x="${(j * 2 + i) * T}" y="40" width="${T}" height="${T * 1.2}" viewBox="${c.box[0]} ${c.box[1]} ${c.box[2]} ${c.box[3]}"><image href="data:image/png;base64,${c[kind]}" width="${c.w}" height="${c.h}"/></svg><text x="${(j * 2 + i) * T + 12}" y="28" font-size="20" font-weight="500" fill="#EEE">frame ${c.n}: ${kind === "resvg" ? "resvg (production today)" : "Skia (W0 composer)"}</text>`,
  ),
);
writeFileSync(
  `${ROOT}/evidence/skia-vs-resvg.png`,
  png(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${4 * T}" height="${T * 1.2 + 50}"><rect width="100%" height="100%" fill="#111"/>${tiles.join("")}</svg>`,
  ),
);
