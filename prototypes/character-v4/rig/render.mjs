/* global process, console */
/**
 * Character v4 rig prototype: renderer and benchmark harness. Not production code.
 *
 *   node rig/render.mjs states                    simulate the timeline → out/demo/states.json
 *   node rig/render.mjs test 0,90,210             a few frames → out/demo/frame-NNN.png
 *   node rig/render.mjs worker A B seg.mp4 [mode] frames A..B-1 → an H.264 segment, timings → seg.json
 *   node rig/render.mjs all [workers] [mode]      split, render in parallel, concatenate → out/demo/*.mp4
 *
 * mode: "cache" (static set and grade pre-rendered once, video LOD for hair/beard) or "nocache" (everything
 * re-rendered every frame at full detail).
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { createHeadRig } from "./headrig.mjs";
import * as demo from "./demo.mjs";
import * as walkScene from "./walk.mjs";

// SCENE=walk renders the walk-and-stop test; the default is the performance demo
const SC = process.env.SCENE === "walk" ? walkScene : demo;
const TAG = process.env.SCENE === "walk" ? "walk-" : "";
const { simulate, frameSvg, W, H, FPS } = SC;
const { setSvg, gradeSvg } = demo;
import { rasterize, png, fitFilters } from "./raster.mjs";
import { gradePixels } from "./grade.mjs";

const ROOT = "prototypes/character-v4/out/demo";
mkdirSync(ROOT, { recursive: true });
const PAD = 48;
const [, , cmd, ...args] = process.argv;

function statesOf() {
  const p = `${ROOT}/${TAG}states.json`;
  if (!existsSync(p)) writeFileSync(p, JSON.stringify(simulate()));
  return JSON.parse(readFileSync(p, "utf8"));
}

/**
 * Cache mode: the static set is rendered once and composited as an image (JPEG: it has no alpha), and the grade
 * (vignette, grain) is applied to the pixels after rasterising, as the production compositor does.
 */
function caches(mode) {
  if (mode !== "cache") return {};
  if (TAG) return { gradeInPixels: true, buildMs: 0 };
  const t0 = Date.now();
  const set = png(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1480" height="2320" viewBox="-200 -200 1480 2320">${setSvg().replace("<defs>", `<defs><filter id="sb16" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="16"/></filter>`)}</svg>`,
  );
  const tmp = `${ROOT}/set-cache-${process.pid}`;
  writeFileSync(`${tmp}.png`, set);
  spawnSync("ffmpeg", ["-y", "-loglevel", "error", "-i", `${tmp}.png`, "-q:v", "2", `${tmp}.jpg`]);
  const jpg = readFileSync(`${tmp}.jpg`);
  unlinkSync(`${tmp}.png`);
  unlinkSync(`${tmp}.jpg`);
  return {
    set: `data:image/jpeg;base64,${jpg.toString("base64")}`,
    gradeInPixels: true,
    buildMs: Date.now() - t0,
    setKB: jpg.length / 1024,
  };
}

/** Crop the padded canvas back to the frame (raw RGBA). */
function crop(pixels, cw) {
  const out = Buffer.allocUnsafe(W * H * 4);
  for (let y = 0; y < H; y++)
    pixels.copy(out, y * W * 4, ((y + PAD) * cw + PAD) * 4, ((y + PAD) * cw + PAD + W) * 4);
  return out;
}

if (cmd === "states") {
  const t0 = Date.now();
  const s = simulate();
  writeFileSync(`${ROOT}/${TAG}states.json`, JSON.stringify(s));
  console.info(`states: ${s.length} frames in ${Date.now() - t0} ms`);
}

if (cmd === "test") {
  const S = statesOf();
  const mode = args[1] ?? "cache";
  const head = createHeadRig({ lod: mode === "cache" ? 0.55 : 1 });
  const cache = caches(mode);
  for (const n of args[0].split(",").map(Number)) {
    const t0 = Date.now();
    const svg = fitFilters(frameSvg(S[n], head, cache, PAD));
    const t1 = Date.now();
    const r = rasterize(svg);
    const t2 = Date.now();
    const img = r.img;
    writeFileSync(`${ROOT}/${TAG}frame-${String(n).padStart(3, "0")}.png`, img.asPng());
    console.info(`frame ${n}: rig+svg ${t1 - t0} ms, raster ${t2 - t1} ms, ${(svg.length / 1024) | 0} KB`);
  }
}

if (cmd === "worker") {
  const [a, b, seg, mode = "cache"] = args;
  const S = statesOf();
  const t0 = Date.now();
  const head = createHeadRig({ lod: mode === "cache" ? 0.55 : 1 });
  const cache = caches(mode);
  const setupMs = Date.now() - t0;
  const ff = spawn(
    "ffmpeg",
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgba",
      "-s",
      `${W}x${H}`,
      "-r",
      `${FPS}`,
      "-i",
      "-",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      seg,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const rows = [];
  let peak = 0;
  for (let n = +a; n < +b; n++) {
    const t1 = process.hrtime.bigint();
    const svg = frameSvg(S[n], head, cache, PAD);
    const t2 = process.hrtime.bigint();
    const r = rasterize(fitFilters(svg));
    const t3 = process.hrtime.bigint();
    const frame = crop(r.pixels, W + 2 * PAD);
    if (cache.gradeInPixels) gradePixels(frame, n, W, H);
    const ok = ff.stdin.write(frame);
    if (!ok) await new Promise((res) => ff.stdin.once("drain", res));
    const t4 = process.hrtime.bigint();
    const mem = process.memoryUsage();
    peak = Math.max(peak, mem.rss);
    rows.push({
      n,
      rigMs: Number(t2 - t1) / 1e6,
      parseMs: r.parseMs,
      rasterMs: r.renderMs,
      encodeMs: Number(t4 - t3) / 1e6,
      svgKB: svg.length / 1024,
      rssMB: mem.rss / 1048576,
    });
  }
  ff.stdin.end();
  await new Promise((res) => ff.on("close", res));
  const cpu = process.cpuUsage();
  writeFileSync(
    seg.replace(/\.mp4$/, ".json"),
    JSON.stringify({
      a: +a,
      b: +b,
      mode,
      setupMs,
      cacheBuildMs: cache.buildMs ?? 0,
      wallMs: Date.now() - t0,
      cpuUserMs: cpu.user / 1000,
      cpuSysMs: cpu.system / 1000,
      peakRssMB: peak / 1048576,
      rows,
    }),
  );
}

if (cmd === "all") {
  const workers = +(args[0] ?? 2);
  const mode = args[1] ?? "cache";
  const S = statesOf();
  const N = +(args[2] ?? S.length);
  const t0 = Date.now();
  const per = Math.ceil(N / workers);
  const segs = [];
  const procs = [];
  for (let w = 0; w < workers; w++) {
    const a = w * per,
      b = Math.min(N, a + per);
    if (a >= b) break;
    const seg = `${ROOT}/${TAG}seg-${mode}-${w}.mp4`;
    segs.push(seg);
    procs.push(
      new Promise((res, rej) => {
        const p = spawn(
          process.execPath,
          [
            "--max-old-space-size=3000",
            "prototypes/character-v4/rig/render.mjs",
            "worker",
            `${a}`,
            `${b}`,
            seg,
            mode,
          ],
          { stdio: "inherit" },
        );
        p.on("close", (c) => (c === 0 ? res() : rej(new Error(`worker ${w} exited ${c}`))));
      }),
    );
  }
  await Promise.all(procs);
  const list = `${ROOT}/${TAG}segments-${mode}.txt`;
  writeFileSync(list, segs.map((s) => `file '${s.split("/").pop()}'`).join("\n"));
  const outFile = `${ROOT}/${TAG ? "v4-walk" : "v4-performance"}-${mode}.mp4`;
  spawnSync(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", outFile],
    { stdio: "inherit" },
  );
  const wall = Date.now() - t0;
  const parts = segs.map((s) => JSON.parse(readFileSync(s.replace(/\.mp4$/, ".json"), "utf8")));
  const rows = parts.flatMap((p) => p.rows);
  const avg = (k) => rows.reduce((a, r) => a + r[k], 0) / rows.length;
  const pct = (k, q) => {
    const v = rows.map((r) => r[k]).sort((x, y) => x - y);
    return v[Math.min(v.length - 1, Math.floor(q * v.length))];
  };
  const summary = {
    mode,
    workers,
    frames: rows.length,
    wallSeconds: wall / 1000,
    throughputFps: rows.length / (wall / 1000),
    perFrameMs: {
      rig: avg("rigMs"),
      parse: avg("parseMs"),
      raster: avg("rasterMs"),
      encode: avg("encodeMs"),
      total: avg("rigMs") + avg("parseMs") + avg("rasterMs") + avg("encodeMs"),
      p95raster: pct("rasterMs", 0.95),
    },
    svgKB: avg("svgKB"),
    peakRssMB: Math.max(...parts.map((p) => p.peakRssMB)),
    cpuSeconds: parts.reduce((a, p) => a + (p.cpuUserMs + p.cpuSysMs) / 1000, 0),
    setupMs: Math.max(...parts.map((p) => p.setupMs)),
    cacheBuildMs: Math.max(...parts.map((p) => p.cacheBuildMs)),
  };
  writeFileSync(`${ROOT}/${TAG}summary-${mode}.json`, JSON.stringify(summary, null, 2));
  for (const s of segs) {
    if (existsSync(s)) unlinkSync(s);
  }
  console.info(JSON.stringify(summary, null, 2));
}
