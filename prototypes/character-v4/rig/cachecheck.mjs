/* global console */
/**
 * Character v4 rig prototype: does the cache step change the picture? (prototype tooling)
 * Renders demo frame 200 four ways and compares them: the static set as SVG vs. as the cached JPEG (no grade on
 * either), and the grade as SVG layers vs. applied to pixels. Per-pixel and 8x8-averaged differences (the
 * average removes the grain's random pattern, leaving systematic differences). Writes out/demo/cache-check.json.
 * Run after bench.mjs (it reuses bench-set.jpg).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHeadRig } from "./headrig.mjs";
import { frameSvg } from "./demo.mjs";
import { rasterize, fitFilters } from "./raster.mjs";
import { gradePixels } from "./grade.mjs";
const S = JSON.parse(readFileSync("prototypes/character-v4/out/demo/states.json", "utf8"));
const jpg = readFileSync("prototypes/character-v4/out/demo/bench-set.jpg");
const head = createHeadRig({ lod: 0.55 });
const n = 200;
const pix = (cache, skip) => {
  const r = rasterize(fitFilters(frameSvg(S[n], head, cache, 48, skip)));
  if (cache.gradeInPixels) gradePixels(r.pixels, n, r.width, r.height, 48);
  return r;
};
const C = pix({});
const D = pix({ set: `data:image/jpeg;base64,${jpg.toString("base64")}`, gradeInPixels: true });
// same comparison without any grade on either side: isolates the cached set image from the grade
const C0 = pix({}, new Set(["grade"]));
const D0 = pix({ set: `data:image/jpeg;base64,${jpg.toString("base64")}` }, new Set(["grade"]));
function cmp(A, B, k) {
  const W = A.width,
    H = A.height,
    w = Math.floor(W / k),
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
            a += A.pixels[p];
            b += B.pixels[p];
          }
        d += Math.abs(a - b) / (k * k);
      }
      d /= 3;
      s += d;
      if (d > 8) big++;
    }
  return { meanAbs: +(s / (w * h)).toFixed(3), cellsOver8: +(big / (w * h)).toFixed(4) };
}
const out = {
  "C vs D, per pixel": cmp(C, D, 1),
  "C vs D, 8x8 average (grain averaged out)": cmp(C, D, 8),
  "no grade: SVG set vs cached JPEG set, per pixel": cmp(C0, D0, 1),
  "no grade, 8x8": cmp(C0, D0, 8),
};
let sd = 0,
  cnt = 0,
  sv = 0;
const W = C.width;
for (let y = 48; y < C.height - 48; y++)
  for (let x = 48; x < W - 48; x++) {
    const p = (y * W + x) * 4;
    sd += C.pixels[p] - D.pixels[p];
    cnt++;
    // grain-only lift of the SVG grade vs the ungraded frame, in the vignette-free centre
    if (Math.hypot(x - 48 - 600, y - 48 - 860) < 600) sv += C.pixels[p] - C0.pixels[p];
  }
let n0 = 0;
for (let y = 48; y < C.height - 48; y++)
  for (let x = 48; x < W - 48; x++) if (Math.hypot(x - 48 - 600, y - 48 - 860) < 600) n0++;
let pd = 0;
for (let y = 48; y < C.height - 48; y++)
  for (let x = 48; x < W - 48; x++)
    if (Math.hypot(x - 48 - 600, y - 48 - 860) < 600) {
      const p = (y * W + x) * 4;
      pd += D.pixels[p] - D0.pixels[p];
    }
Object.assign(out, { signedMeanCminusD: sd / cnt, svgGrainLiftCentre: sv / n0, pixGrainLiftCentre: pd / n0 });
writeFileSync("prototypes/character-v4/out/demo/cache-check.json", JSON.stringify(out, null, 1));
console.info(JSON.stringify(out, null, 1));
