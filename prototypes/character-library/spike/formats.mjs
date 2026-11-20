/* global console */
/**
 * Character Library plan, format spike (measurement only, not production code).
 *
 *   node prototypes/character-library/spike/formats.mjs
 *
 * Questions the package format depends on, answered with the two rasterisers already in the repo (resvg 2.6 from
 * film/src/raster.ts, Skia from @napi-rs/canvas as in film/src/w0/compositor.ts), on this machine:
 *
 *   M1  How much of a v4 character frame is the vector geometry and how much is the runtime blur/texture filters?
 *       The same frame with and without its filter references, in both rasterisers.
 *   M2  Can the existing Skia path draw a raster texture on a deformed triangle mesh (the Spine/Live2D model), and
 *       at what cost per triangle? One pattern-filled triangle per mesh triangle, at three mesh densities; seams
 *       measured against the undeformed texture drawn whole.
 *   M3  Do several characters in one frame cost linearly? The character group drawn 1, 2 and 3 times.
 *   M4  What does skeletal skinning plus morph targets cost in JS per frame, for a dense vector character?
 *
 * Writes out/formats.json and out/mesh-seams.png.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { createHeadRig } from "../../character-v4/rig/headrig.mjs";
import { frameSvg } from "../../character-v4/rig/demo.mjs";
import { rasterize, png, fitFilters } from "../../character-v4/rig/raster.mjs";

const require = createRequire(new URL("../../../film/package.json", import.meta.url));
const { createCanvas, loadImage } = require("@napi-rs/canvas");

const OUT = "prototypes/character-library/spike/out";
mkdirSync(OUT, { recursive: true });
const S = JSON.parse(readFileSync("prototypes/character-v4/out/demo/states.json", "utf8"));
const head = createHeadRig({ lod: 0.55 });
const ms = (a) => Number(process.hrtime.bigint() - a) / 1e6;
const best = (k, fn) => {
  let b = Infinity;
  for (let i = 0; i < k; i++) b = Math.min(b, fn());
  return +b.toFixed(1);
};
const bestA = async (k, fn) => {
  let b = Infinity;
  for (let i = 0; i < k; i++) b = Math.min(b, await fn());
  return +b.toFixed(1);
};
async function skiaMs(svg, w, h) {
  const a = process.hrtime.bigint();
  const img = await loadImage(Buffer.from(svg));
  const c = createCanvas(w, h);
  c.getContext("2d").drawImage(img, 0, 0);
  c.getContext("2d").getImageData(0, 0, 1, 1);
  return ms(a);
}
const resvgMs = (svg) => {
  const r = rasterize(svg);
  return r.parseMs + r.renderMs;
};
const backdrop = (svg) =>
  svg.replace(/<\/defs>/, `</defs><rect x="-48" y="-48" width="1176" height="2016" fill="#34434A"/>`);
const noFilters = (svg) => svg.replace(/\sfilter="url\(#[^"]+\)"/g, "");

const out = { machine: { cpus: 2, gpu: "none" } };

// ---------------------------------------------------------------------------------------------- M1
out.m1 = [];
for (const n of [200, 450]) {
  const svg = backdrop(fitFilters(frameSvg(S[n], head, {}, 48, new Set(["set", "grade"]))));
  const bare = noFilters(svg);
  const r = rasterize(svg);
  const row = {
    frame: n,
    filtersInFrame: (svg.match(/\sfilter="url\(#/g) || []).length,
    resvg: best(2, () => resvgMs(svg)),
    resvgNoFilters: best(2, () => resvgMs(bare)),
    skia: await bestA(2, () => skiaMs(svg, r.width, r.height)),
    skiaNoFilters: await bestA(2, () => skiaMs(bare, r.width, r.height)),
  };
  out.m1.push(row);
  console.info("M1", JSON.stringify(row));
}

// ---------------------------------------------------------------------------------------------- M2
// texture: the character region of frame 200, rendered once (stands in for painted art)
const tex = await loadImage(
  png(backdrop(fitFilters(frameSvg(S[200], head, {}, 0, new Set(["set", "grade"]))))),
);
const TX = 240,
  TY = 260,
  TW = 760,
  TH = 1520; // region of the frame used as the texture
const W = 1080,
  H = 1920;
function meshFrame(cols, rows, t, ctx) {
  // grid over the texture region, deformed by a smooth bend (like a lean and an arm swing)
  const P = [];
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      const u = i / cols,
        v = j / rows;
      const x = TX + u * TW,
        y = TY + v * TH;
      const dx = t * (18 * Math.sin(v * Math.PI) + 10 * Math.sin(u * 6.28 + v * 3));
      const dy = t * 8 * Math.sin(u * Math.PI);
      P.push([x + dx, y + dy, x, y]);
    }
  const pat = ctx.createPattern(tex, "no-repeat");
  let tris = 0;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const a = P[j * (cols + 1) + i],
        b = P[j * (cols + 1) + i + 1],
        c = P[(j + 1) * (cols + 1) + i],
        d = P[(j + 1) * (cols + 1) + i + 1];
      for (const [p, q, r] of [
        [a, b, c],
        [b, d, c],
      ]) {
        // affine map from texture coords (p[2],p[3]...) to screen (p[0],p[1]...)
        const sx1 = q[2] - p[2],
          sy1 = q[3] - p[3],
          sx2 = r[2] - p[2],
          sy2 = r[3] - p[3];
        const dx1 = q[0] - p[0],
          dy1 = q[1] - p[1],
          dx2 = r[0] - p[0],
          dy2 = r[1] - p[1];
        const det = sx1 * sy2 - sx2 * sy1;
        const A = (dx1 * sy2 - dx2 * sy1) / det,
          C = (dx2 * sx1 - dx1 * sx2) / det;
        const B = (dy1 * sy2 - dy2 * sy1) / det,
          D = (dy2 * sx1 - dy1 * sx2) / det;
        const E = p[0] - A * p[2] - C * p[3],
          F = p[1] - B * p[2] - D * p[3];
        pat.setTransform({ a: A, b: B, c: C, d: D, e: E, f: F });
        ctx.fillStyle = pat;
        // grow the triangle by ~0.6 px about its centroid against anti-aliasing cracks
        const cx = (p[0] + q[0] + r[0]) / 3,
          cy = (p[1] + q[1] + r[1]) / 3;
        const g = (pt) => {
          const vx = pt[0] - cx,
            vy = pt[1] - cy,
            l = Math.hypot(vx, vy) || 1;
          return [pt[0] + (vx / l) * 0.6, pt[1] + (vy / l) * 0.6];
        };
        const [p1, q1, r1] = [g(p), g(q), g(r)];
        ctx.beginPath();
        ctx.moveTo(p1[0], p1[1]);
        ctx.lineTo(q1[0], q1[1]);
        ctx.lineTo(r1[0], r1[1]);
        ctx.closePath();
        ctx.fill();
        tris++;
      }
    }
  return tris;
}
out.m2 = [];
const ref = createCanvas(W, H);
ref.getContext("2d").fillStyle = "#34434A";
ref.getContext("2d").fillRect(0, 0, W, H);
ref.getContext("2d").drawImage(tex, TX, TY, TW, TH, TX, TY, TW, TH);
const refPx = ref.getContext("2d").getImageData(TX, TY, TW, TH).data;
for (const [cols, rows] of [
  [16, 32],
  [32, 64],
  [64, 128],
]) {
  let tris = 0;
  const time = best(3, () => {
    const c = createCanvas(W, H);
    const g = c.getContext("2d");
    g.fillStyle = "#34434A";
    g.fillRect(0, 0, W, H);
    const a = process.hrtime.bigint();
    tris = meshFrame(cols, rows, 1, g);
    g.getImageData(0, 0, 1, 1);
    return ms(a);
  });
  // seams: the same mesh undeformed (t = 0) against the texture drawn whole
  const c0 = createCanvas(W, H);
  const g0 = c0.getContext("2d");
  g0.fillStyle = "#34434A";
  g0.fillRect(0, 0, W, H);
  meshFrame(cols, rows, 0, g0);
  const px = g0.getImageData(TX, TY, TW, TH).data;
  let s = 0,
    big = 0;
  for (let i = 0; i < px.length; i += 4) {
    const d =
      (Math.abs(px[i] - refPx[i]) + Math.abs(px[i + 1] - refPx[i + 1]) + Math.abs(px[i + 2] - refPx[i + 2])) /
      3;
    s += d;
    if (d > 8) big++;
  }
  const row = {
    grid: `${cols}x${rows}`,
    triangles: tris,
    ms: time,
    usPerTriangle: +((time * 1000) / tris).toFixed(1),
    seamMeanAbs: +(s / (px.length / 4)).toFixed(3),
    seamPixelsOver8: +(big / (px.length / 4)).toFixed(4),
  };
  out.m2.push(row);
  console.info("M2", JSON.stringify(row));
  if (cols === 32) {
    const c = createCanvas(W, H);
    const g = c.getContext("2d");
    g.fillStyle = "#34434A";
    g.fillRect(0, 0, W, H);
    meshFrame(cols, rows, 1, g);
    writeFileSync(`${OUT}/mesh-deformed-32x64.png`, c.toBuffer("image/png"));
  }
}

// ---------------------------------------------------------------------------------------------- M3
out.m3 = [];
{
  const one = fitFilters(frameSvg(S[200], head, {}, 48, new Set(["set", "grade", "colleague"])));
  const m = one.match(/^(<svg[^>]*>)([\s\S]*?<\/defs>)([\s\S]*)(<\/svg>)\s*$/);
  if (!m) throw new Error("unexpected svg shape");
  const [, open, defs, body, close] = m;
  for (const k of [1, 2, 3]) {
    const copies = Array.from(
      { length: k },
      (_, i) => `<g transform="translate(${(i - (k - 1) / 2) * 330} 0)">${body}</g>`,
    ).join("");
    const svg = backdrop(`${open}${defs}${copies}${close}`);
    const r = rasterize(svg);
    const row = {
      characters: k,
      resvg: best(2, () => resvgMs(svg)),
      skia: await bestA(2, () => skiaMs(svg, r.width, r.height)),
      skiaNoFilters: await bestA(2, () => skiaMs(noFilters(svg), r.width, r.height)),
    };
    out.m3.push(row);
    console.info("M3", JSON.stringify(row));
  }
}

// ---------------------------------------------------------------------------------------------- M4
{
  // a dense vector character: 24 000 control points (v4 hair + beard + face + body after LOD are ~20-30k pairs),
  // each bound to up to 4 of 60 bones, plus 40 morph targets touching 15% of the points each
  const NP = 24000,
    NB = 60,
    NM = 40;
  const rest = new Float32Array(NP * 2).map(() => Math.random() * 1000);
  const bi = new Uint8Array(NP * 4).map(() => (Math.random() * NB) | 0);
  const bw = new Float32Array(NP * 4).map(() => Math.random());
  for (let i = 0; i < NP; i++) {
    const s = bw[i * 4] + bw[i * 4 + 1] + bw[i * 4 + 2] + bw[i * 4 + 3];
    for (let k = 0; k < 4; k++) bw[i * 4 + k] /= s;
  }
  const morphs = Array.from({ length: NM }, () => {
    const idx = Uint32Array.from({ length: NP * 0.15 }, () => (Math.random() * NP) | 0);
    return { idx, d: new Float32Array(idx.length * 2).map(() => Math.random() - 0.5) };
  });
  const mats = new Float32Array(NB * 6);
  const outP = new Float32Array(NP * 2);
  const tmp = new Float32Array(NP * 2);
  const frame = (t) => {
    for (let b = 0; b < NB; b++) {
      const a = Math.sin(t + b) * 0.2;
      mats.set([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), b, -b], b * 6);
    }
    tmp.set(rest);
    for (let m = 0; m < NM; m++) {
      const w = Math.max(0, Math.sin(t * 0.7 + m));
      if (w === 0) continue;
      const { idx, d } = morphs[m];
      for (let k = 0; k < idx.length; k++) {
        tmp[idx[k] * 2] += w * d[k * 2];
        tmp[idx[k] * 2 + 1] += w * d[k * 2 + 1];
      }
    }
    for (let i = 0; i < NP; i++) {
      const x = tmp[i * 2],
        y = tmp[i * 2 + 1];
      let ox = 0,
        oy = 0;
      for (let k = 0; k < 4; k++) {
        const w = bw[i * 4 + k],
          o = bi[i * 4 + k] * 6;
        ox += w * (mats[o] * x + mats[o + 2] * y + mats[o + 4]);
        oy += w * (mats[o + 1] * x + mats[o + 3] * y + mats[o + 5]);
      }
      outP[i * 2] = ox;
      outP[i * 2 + 1] = oy;
    }
  };
  for (let i = 0; i < 20; i++) frame(i);
  const a = process.hrtime.bigint();
  for (let i = 0; i < 100; i++) frame(i * 0.03);
  out.m4 = { points: NP, bones: NB, morphTargets: NM, msPerFrame: +(ms(a) / 100).toFixed(2) };
  console.info("M4", JSON.stringify(out.m4));
}

writeFileSync(`${OUT}/formats.json`, JSON.stringify(out, null, 1));
