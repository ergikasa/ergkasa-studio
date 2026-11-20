/* global process, console */
/**
 * Character v4 rig prototype: performance measurements (prototype tooling, run on an idle machine).
 *
 * The same six frames of the demo under four configurations, each step adding one optimisation:
 *   A  baseline     — everything rendered every frame at full detail, blur regions as authored
 *   B  + fit        — every blur gets a filter region that fits the element (no visual change: measured)
 *   C  + LOD        — hair and beard at video density (0.55) and no per-lock blur
 *   D  + cache      — the static set composited as one pre-rendered image, the grade applied to pixels
 * Reported per frame: rig (JS: deformation, contours, paint, warp, SVG), raster (resvg parse + render), SVG
 * size, the head rig's own breakdown, memory, and the pixel difference each step introduces.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHeadRig } from "./headrig.mjs";
import { frameSvg, setSvg, simulate } from "./demo.mjs";
import { rasterize, png, fitFilters } from "./raster.mjs";
import { gradePixels } from "./grade.mjs";

const ROOT = "prototypes/character-v4/out/demo";
mkdirSync(ROOT, { recursive: true });
const S = JSON.parse(readFileSync(`${ROOT}/states.json`, "utf8"));
const FRAMES = [0, 95, 200, 330, 450, 600];
const PAD = 48;

function setCache() {
  const t0 = Date.now();
  const set = png(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1480" height="2320" viewBox="-200 -200 1480 2320">${setSvg().replace("<defs>", `<defs><filter id="sb16" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="16"/></filter>`)}</svg>`,
  );
  writeFileSync(`${ROOT}/bench-set.png`, set);
  spawnSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-i",
    `${ROOT}/bench-set.png`,
    "-q:v",
    "2",
    `${ROOT}/bench-set.jpg`,
  ]);
  const jpg = readFileSync(`${ROOT}/bench-set.jpg`);
  return {
    set: `data:image/jpeg;base64,${jpg.toString("base64")}`,
    gradeInPixels: true,
    buildMs: Date.now() - t0,
  };
}

function measure(name, { lod, fit, cache }) {
  const t0 = Date.now();
  const head = createHeadRig({ lod });
  const bindMs = Date.now() - t0;
  const rows = [];
  const heads = [];
  let peak = 0;
  for (const n of FRAMES) {
    let best = null;
    for (let rep = 0; rep < 2; rep++) {
      const a = process.hrtime.bigint();
      let svg = frameSvg(S[n], head, cache ?? {}, PAD);
      if (fit) svg = fitFilters(svg);
      const b = process.hrtime.bigint();
      const r = rasterize(svg);
      const c0 = process.hrtime.bigint();
      if (cache?.gradeInPixels) gradePixels(r.pixels, n, r.width, r.height, PAD);
      const gradeMs = Number(process.hrtime.bigint() - c0) / 1e6;
      const row = {
        n,
        rigMs: Number(b - a) / 1e6,
        rasterMs: r.parseMs + r.renderMs + gradeMs,
        gradeMs,
        svgKB: svg.length / 1024,
      };
      if (!best || row.rigMs + row.rasterMs < best.rigMs + best.rasterMs) best = row;
      if (rep === 1) writeFileSync(`${ROOT}/bench-${name}-${n}.raw`, r.pixels);
      peak = Math.max(peak, process.memoryUsage().rss);
    }
    rows.push(best);
    // the head rig's own breakdown for this frame (deformation, z-buffer, contours, paint, warp)
    heads.push(head.draw({ ...S[n].head, look: [0, 0, 60] }).timing);
  }
  const avg = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
  const havg = {};
  for (const k of Object.keys(heads[0])) havg[k] = heads.reduce((s, h) => s + h[k], 0) / heads.length;
  return {
    name,
    lod,
    fit,
    cache: !!cache,
    bindMs,
    rigMs: avg("rigMs"),
    rasterMs: avg("rasterMs"),
    totalMs: avg("rigMs") + avg("rasterMs"),
    svgKB: avg("svgKB"),
    head: havg,
    peakRssMB: peak / 1048576,
    rows,
  };
}

/** Mean absolute difference (0–255) between two raw RGBA renders of the same frame. */
function diff(a, b) {
  const A = readFileSync(`${ROOT}/bench-${a}.raw`),
    B = readFileSync(`${ROOT}/bench-${b}.raw`);
  let s = 0,
    big = 0;
  for (let i = 0; i < A.length; i += 4) {
    const d = (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])) / 3;
    s += d;
    if (d > 16) big++;
  }
  return { meanAbs: s / (A.length / 4), pixelsOver16: big / (A.length / 4) };
}

const cache = setCache();
const results = [
  measure("A", { lod: 1, fit: false }),
  measure("B", { lod: 1, fit: true }),
  measure("C", { lod: 0.55, fit: true }),
  measure("D", { lod: 0.55, fit: true, cache }),
];
const t0 = process.hrtime.bigint();
const states = simulate();
const simMs = Number(process.hrtime.bigint() - t0) / 1e6;
const report = {
  machine: {
    cpus: (await import("node:os")).cpus().length,
    model: (await import("node:os")).cpus()[0].model,
    memGB: (await import("node:os")).totalmem() / 2 ** 30,
    gpu: "none (resvg renders on the CPU)",
  },
  simulateMsPerFrame: simMs / states.length,
  cacheBuildMs: cache.buildMs,
  configs: results.map(({ rows, ...r }) => r),
  perFrame: Object.fromEntries(results.map((r) => [r.name, r.rows])),
  visualDiff: {
    "A→B fit (frame 200)": diff("A-200", "B-200"),
    "B→C LOD (frame 200)": diff("B-200", "C-200"),
    "C→D cache (frame 200; grade in pixels vs. in SVG)": diff("C-200", "D-200"),
  },
};
writeFileSync(`${ROOT}/bench.json`, JSON.stringify(report, null, 2));
for (const n of FRAMES)
  for (const c of ["A", "B", "C", "D"]) spawnSync("rm", ["-f", `${ROOT}/bench-${c}-${n}.raw`]);
console.info(JSON.stringify({ ...report, perFrame: undefined }, null, 2));
