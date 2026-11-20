/* Character Runtime benchmark (prepared in Phase 2; run on the test character only).
 *
 *   pnpm --filter @erkasa/character bench [characterDir]
 *
 * Measures, frame by frame at 1080×1920 on the pipeline's Skia canvas (@napi-rs/canvas, CPU raster):
 *   skeleton      forward kinematics alone
 *   skinning      morphs + skinning of every part (no face channels moving)
 *   face          evaluate() while only face channels move (morph weights, face parts, eyes)
 *   body          evaluate() while only body channels move
 *   vector        drawing the vector parts and irises only
 *   texture       drawing the texture parts only (at scale 1.9, 0.9 and 0.5: the cost follows the covered pixels)
 *   full          evaluate + draw + read-back of the frame (what a renderer pays per character)
 *   blend         a full frame inside a view blend band (two layers composited)
 *   multi         1, 2, 4, 8 characters in one frame
 *   memory        RSS and heap over 300 full frames (growth per frame)
 * Every case: warm-up frames, then N timed frames over varying poses; mean, median, p95 in ms.
 * Conditions are recorded with the results (CPU, cores, memory, Node, canvas version, load average, resolution).
 *
 * The test character is far simpler than a reference character: these numbers measure the runtime, they do not
 * prove a per-frame cost for real characters (that is Phase 4, on the reference characters).
 */
import { cpus, freemem, loadavg, totalmem, platform, release } from "node:os";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createCanvas } from "@napi-rs/canvas";
import {
  boneMatrices,
  deformPart,
  drawCharacter,
  evaluate,
  loadCharacter,
  morphWeights,
  resolveValues,
  type Evaluated,
  type LoadedCharacter,
} from "../src/runtime/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = process.argv[2] ?? join(HERE, "..", "..", "library", "characters", "chr_test_minimal", "1");
const W = 1080;
const H = 1920;
const WARM = 10;
const N = 90;
const gc = (globalThis as { gc?: () => void }).gc;

const stats = (xs: number[]): { mean: number; median: number; p95: number; min: number; max: number } => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number): number => s[Math.min(s.length - 1, Math.floor(p * s.length))] as number;
  const r = (x: number): number => Math.round(x * 1000) / 1000;
  return {
    mean: r(xs.reduce((a, b) => a + b, 0) / xs.length),
    median: r(q(0.5)),
    p95: r(q(0.95)),
    min: r(s[0] as number),
    max: r(s[s.length - 1] as number),
  };
};

function time(fn: (i: number) => void, label = ""): ReturnType<typeof stats> {
  gc?.();
  for (let i = 0; i < WARM; i++) fn(i);
  const xs: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = performance.now();
    fn(i);
    xs.push(performance.now() - t);
  }
  const r = stats(xs);
  if (label)
    console.info(label, JSON.stringify(r), `rss ${Math.round(process.memoryUsage().rss / 2 ** 20)} MB`);
  return r;
}

const wave = (i: number, a: number, period = 30): number => a * Math.sin((2 * Math.PI * i) / period);
const bodyPose = (i: number): Record<string, number> => ({
  arm_l_upper: 40 + wave(i, 35),
  arm_l_lower: 60 + wave(i, 50, 20),
  arm_r_upper: 20 + wave(i, 15, 40),
  spine_bend: wave(i, 8),
  chest_bend: wave(i, 6, 25),
  shoulder_l_raise: 5 + wave(i, 5),
  breath: 0.5 + wave(i, 0.5, 60),
});
const facePose = (i: number): Record<string, number> => ({
  au12: 0.5 + wave(i, 0.5, 24),
  au01: 0.5 + wave(i, 0.5, 18),
  au04: 0.3 + wave(i, 0.3, 28),
  jaw_open: 0.4 + wave(i, 0.4, 8),
  lid_l: i % 40 < 4 ? 1 : 0,
  lid_r: i % 40 < 4 ? 1 : 0,
  gaze_x: wave(i, 250, 45),
  gaze_y: wave(i, 120, 33),
  head_yaw: 6 + wave(i, 6, 50), // inside the front view (no blend)
});

function onlyKinds(ev: Evaluated, keep: (k: "vector" | "texture" | "iris") => boolean): Evaluated {
  return {
    ...ev,
    layers: ev.layers.map((l) => ({
      ...l,
      items: l.items.filter((it) => keep(it.kind === "iris" ? "iris" : it.part.kind)),
    })),
  };
}

/** One canvas for every frame, as a renderer keeps it (a new Skia canvas per frame grows native memory: see `memory`). */
const FRAME = createCanvas(W, H);
function frame(c: LoadedCharacter, n: number, ch: Record<string, number>): number {
  const g = FRAME.getContext("2d");
  g.fillStyle = "#2E3A40";
  g.fillRect(0, 0, W, H);
  const cols = Math.min(n, 4);
  const scale = n === 1 ? 1.9 : 0.9;
  for (let k = 0; k < n; k++) {
    const x = n === 1 ? W / 2 : ((k % cols) + 0.5) * (W / cols);
    const y = n <= 4 ? 1830 : 1830 - Math.floor(k / cols) * 900;
    drawCharacter(c, g, evaluate(c, { channels: ch, outfit: "test_tee" }), { x, y, scale });
  }
  // read-back with canvas.data(): getImageData leaks ~8 MB of native memory per call (see `readBackGrowth30FramesMB`)
  return FRAME.data().length;
}

const c = await loadCharacter(DIR);
const require = createRequire(import.meta.url);
const canvasVersion = (
  JSON.parse(readFileSync(require.resolve("@napi-rs/canvas/package.json"), "utf8")) as { version: string }
).version;
const complexity = {
  parts: c.parts.length,
  vectorParts: c.parts.filter((p) => p.kind === "vector").length,
  textureParts: c.parts.filter((p) => p.kind === "texture").length,
  vertices: c.parts.reduce((s, p) => s + p.vertices.length, 0),
  pathCommands: c.parts.reduce(
    (s, p) => s + (p.kind === "vector" ? p.paths.reduce((t, q) => t + q.cmds.length, 0) : 0),
    0,
  ),
  triangles: c.parts.reduce((s, p) => s + (p.kind === "texture" ? p.triangles.length : 0), 0),
  morphTargets: c.parts.reduce((s, p) => s + p.morphs.length, 0),
  bones: c.manifest.skeleton.bones.length,
  texturePixels: [...c.textures.values()].reduce((s, t) => s + t.width * t.height, 0),
};
const conditions = {
  date: new Date().toISOString(),
  character: `${c.manifest.id}@${c.manifest.version}`,
  characterSha256: c.sha256,
  cpu: cpus()[0]?.model ?? "?",
  cores: cpus().length,
  memoryGB: Math.round((totalmem() / 2 ** 30) * 10) / 10,
  freeMemoryGB: Math.round((freemem() / 2 ** 30) * 10) / 10,
  loadAverageBefore: loadavg().map((x) => Math.round(x * 100) / 100),
  os: `${platform()} ${release()}`,
  node: process.version,
  renderer: `Skia via @napi-rs/canvas ${canvasVersion} (CPU raster), the W0 compositor's library`,
  gpu: "none",
  resolution: `${W}x${H}`,
  placement: "bust, scale 1.9 (about 1500 px tall); multi: scale 0.9",
  process: "one process, one thread, frames timed one by one; --expose-gc, GC before each case",
  warmupFrames: WARM,
  timedFrames: N,
};
console.info(JSON.stringify(conditions, null, 1));

const results: Record<string, unknown> = {};
const timed = (label: string, fn: (i: number) => void): ReturnType<typeof stats> => time(fn, label);
const restWeights = new Map<string, number>();
results["skeleton"] = timed("skeleton", (i) => void boneMatrices(c, resolveValues(c, bodyPose(i))));
results["skinning"] = timed("skinning", (i) => {
  const bones = boneMatrices(c, resolveValues(c, bodyPose(i)));
  for (const p of c.parts) deformPart(c, p, restWeights, bones);
});
results["morphWeights"] = timed("morphWeights", (i) => void morphWeights(c, resolveValues(c, facePose(i))));
results["face"] = timed("face", (i) => void evaluate(c, { channels: facePose(i), outfit: "test_tee" }));
results["body"] = timed("body", (i) => void evaluate(c, { channels: bodyPose(i), outfit: "test_tee" }));
const drawOnly = (keep: (k: "vector" | "texture" | "iris") => boolean, scale = 1.9) => {
  const g = FRAME.getContext("2d");
  return (i: number): void => {
    g.fillStyle = "#2E3A40";
    g.fillRect(0, 0, W, H);
    drawCharacter(
      c,
      g,
      onlyKinds(evaluate(c, { channels: { ...bodyPose(i), ...facePose(i) }, outfit: "test_tee" }), keep),
      { x: W / 2, y: 1830, scale },
    );
    FRAME.data();
  };
};
results["evaluateOnly"] = timed(
  "evaluateOnly",
  (i) => void evaluate(c, { channels: { ...bodyPose(i), ...facePose(i) }, outfit: "test_tee" }),
);
results["vector+evaluate"] = timed(
  "vector+evaluate",
  drawOnly((k) => k !== "texture"),
);
results["texture+evaluate"] = timed(
  "texture+evaluate",
  drawOnly((k) => k === "texture"),
);
// the texture's cost follows the pixels it covers: the same mesh drawn smaller
results["texture+evaluate@0.9"] = timed(
  "texture+evaluate@0.9",
  drawOnly((k) => k === "texture", 0.9),
);
results["texture+evaluate@0.5"] = timed(
  "texture+evaluate@0.5",
  drawOnly((k) => k === "texture", 0.5),
);
results["full"] = timed("full", (i) => void frame(c, 1, { ...bodyPose(i), ...facePose(i) }));
results["emptyFrame"] = timed("emptyFrame", () => {
  const g = FRAME.getContext("2d");
  g.fillStyle = "#2E3A40";
  g.fillRect(0, 0, W, H);
  FRAME.data();
});
results["blend"] = timed(
  "blend",
  (i) => void frame(c, 1, { ...bodyPose(i), ...facePose(i), head_yaw: 14 + (i % 3) }),
);
const multi: Record<string, unknown> = {};
for (const n of [1, 2, 4, 8])
  multi[String(n)] = time((i) => void frame(c, n, { ...bodyPose(i), ...facePose(i) }), `multi ${n}`);
results["multi"] = multi;

gc?.();
const rss0 = process.memoryUsage().rss;
const heap0 = process.memoryUsage().heapUsed;
const samples: number[] = [];
for (let i = 0; i < 300; i++) {
  frame(c, 1, { ...bodyPose(i), ...facePose(i) });
  if (i % 50 === 49) samples.push(Math.round(process.memoryUsage().rss / 2 ** 20));
}
gc?.();
results["memory"] = {
  rssStartMB: Math.round(rss0 / 2 ** 20),
  rssEveryFiftyFramesMB: samples,
  rssEndMB: Math.round(process.memoryUsage().rss / 2 ** 20),
  heapStartMB: Math.round(heap0 / 2 ** 20),
  heapEndMB: Math.round(process.memoryUsage().heapUsed / 2 ** 20),
};
// findings behind the read-back and the canvas pool, 30 frames each (bounded: the leak would kill the process)
const growth = (fn: () => void): number => {
  gc?.();
  const r0 = process.memoryUsage().rss;
  for (let i = 0; i < 30; i++) fn();
  gc?.();
  return Math.round((process.memoryUsage().rss - r0) / 2 ** 20);
};
results["readBackGrowth30FramesMB"] = {
  getImageData: growth(() => {
    const g = FRAME.getContext("2d");
    g.fillRect(0, 0, W, H);
    g.getImageData(0, 0, W, H);
  }),
  canvasData: growth(() => {
    FRAME.getContext("2d").fillRect(0, 0, W, H);
    FRAME.data();
  }),
  freshCanvasPerFrameWithData: growth(() => {
    const cv = createCanvas(W, H);
    cv.getContext("2d").fillRect(0, 0, W, H);
    cv.data();
  }),
};
console.info("readBackGrowth30FramesMB", JSON.stringify(results["readBackGrowth30FramesMB"]));

const out = {
  conditions: { ...conditions, loadAverageAfter: loadavg().map((x) => Math.round(x * 100) / 100) },
  complexity,
  results,
};
mkdirSync(join(HERE, "out"), { recursive: true });
const file = join(HERE, "out", `bench-${c.manifest.id}-${c.manifest.version}.json`);
writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
console.info(JSON.stringify({ complexity, results }, null, 1));
console.info(`wrote ${file}`);
