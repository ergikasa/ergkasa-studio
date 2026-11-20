/* chr_daniel@1 animation test: Daniel driven by erkasa.render/1 tracks, drawn by the Character Runtime on the
 * pipeline's Skia canvas, encoded with the pipeline's FFmpeg settings (film/src/package/encoding.ts).
 *
 *   pnpm --filter @erkasa/character exec tsx demo/daniel-demo.ts [out.mp4]
 *
 * 12 s, 1080×1920, 30 fps. A full shot (look, head turn across three views, body turn front → 3/4 → front with a
 * gesture), then a cut to a medium shot (a spoken line on visemes with brow, head and hand accents, a smile, worry).
 * The tracks are what an Engine would write (here by hand); the runtime only executes them. Measurements (time per
 * frame for evaluating and drawing, memory) go next to the video.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { Track, type RenderPackage } from "@erkasa/contracts";
import { segmentArgs } from "../../film/src/package/encoding.js";
import { LIBRARY_ROOT } from "../src/library/index.js";
import { actorFrame, drawCharacter, evaluate, loadCharacter } from "../src/runtime/index.js";

const OUT = process.argv[2] ?? join(import.meta.dirname, "out", "chr-daniel-demo.mp4");
const W = 1080;
const H = 1920;
const FPS = 30;
const DURATION = 12;
const ID = "daniel";

type Ease = "linear" | "hold" | "easeInOut";
type K = [number, number, Ease?];
const keys = (channel: string, ks: K[]): unknown => ({
  kind: "keys",
  target: { kind: "actor", id: ID },
  channel,
  keys: ks.map(([t, v, ease]) => ({ t, v, ease: ease ?? "linear" })),
});
/**
 * A channel from eased keys, written as the stager writes evaluated motion: a dense samples track (erkasa.render/1
 * keys interpolate linearly or hold; eased curves are sampled at the frame rate).
 */
const smooth = (x: number): number => x * x * (3 - 2 * x);
const ch = (name: string, ks: K[]): unknown => ({
  kind: "samples",
  target: { kind: "actor", id: ID },
  channel: `channel.${name}`,
  start: 0,
  rate: FPS,
  values: Array.from({ length: DURATION * FPS }, (_, f) => {
    const t = f / FPS;
    if (t <= (ks[0] as K)[0]) return (ks[0] as K)[1];
    for (let i = 1; i < ks.length; i++) {
      const [ta, va] = ks[i - 1] as K;
      const [tb, vb, e] = ks[i] as K;
      if (t < tb) {
        const u = (t - ta) / (tb - ta);
        const w = e === "hold" ? 0 : e === "linear" ? u : smooth(u);
        return Math.round((va + (vb - va) * w) * 1e4) / 1e4;
      }
    }
    return (ks[ks.length - 1] as K)[1];
  }),
});
const blink = (at: number[]): K[] => [
  [0, 0],
  ...at.flatMap((t): K[] => [
    [t, 0, "linear"],
    [t + 0.05, 1, "linear"],
    [t + 0.11, 1, "linear"],
    [t + 0.2, 0, "linear"],
  ]),
];
/** Visemes: each rises just before its time, holds a little and falls into the next (coarticulation). */
function visemeTracks(seq: Array<[number, string]>, end: number): unknown[] {
  const by = new Map<string, K[]>();
  seq.forEach(([t, v], i) => {
    const next = seq[i + 1]?.[0] ?? end;
    const list = by.get(v) ?? [[0, 0, "linear"]];
    const prev = list[list.length - 1] as K;
    const a = Math.max(t - 0.06, prev[0] + 0.001);
    const b = Math.max(t, a + 0.001);
    const c = Math.max(Math.min(next - 0.02, t + 0.1), b + 0.001);
    const d = c + 0.07;
    list.push([a, 0, "linear"], [b, 1, "linear"], [c, 0.85, "linear"], [d, 0, "linear"]);
    by.set(v, list);
  });
  return [...by].map(([v, ks]) => ch(`viseme_${v}`, ks));
}
const breath = {
  kind: "samples",
  target: { kind: "actor", id: ID },
  channel: "channel.breath",
  start: 0,
  rate: FPS,
  values: Array.from(
    { length: DURATION * FPS },
    (_, f) => Math.round((0.5 - 0.5 * Math.cos((2 * Math.PI * f) / (FPS * 3.8))) * 1e4) / 1e4,
  ),
};

const CUT = 5.4;
const TRACKS = [
  // camera framing (the actor's placement): a full shot, then a medium close-up
  keys("root.x", [[0, W / 2, "hold"]]),
  keys("root.y", [
    [0, 1880, "hold"],
    [CUT, 520 + 1690 * 2.2, "hold"],
  ]),
  keys("root.scale", [
    [0, 0.95, "hold"],
    [CUT, 2.2, "hold"],
  ]),
  breath,
  ch("lid_l", blink([0.7, 2.95, 4.75, 6.4, 8.3, 10.15, 11.6])),
  ch("lid_r", blink([0.7, 2.95, 4.75, 6.4, 8.3, 10.15, 11.6])),
  // full shot: the eyes lead, the head follows across the views (0 → 30), back; the body turns to 3/4 and back
  ch("gaze_x", [
    [0, 0],
    [1.0, 0, "linear"],
    [1.12, 320, "linear"],
    [2.3, 320],
    [2.42, 0, "linear"],
    [9.2, 0],
    [9.3, 0],
    [10.35, 0],
    [10.5, -260, "linear"],
    [11.1, -260],
    [11.3, 0, "linear"],
  ]),
  ch("gaze_y", [
    [0, 0],
    [10.35, 0],
    [10.5, 140, "linear"],
    [11.1, 140],
    [11.3, 0, "linear"],
  ]),
  ch("head_yaw", [
    [0, 0],
    [1.15, 0],
    [1.9, 30],
    [2.2, 30],
    [2.9, 0],
    [3.3, 20],
    [4.2, 20],
    [4.9, 0],
    [10.3, 0],
    [10.7, -15],
    [11.2, -15],
    [11.7, 0],
  ]),
  ch("body_yaw", [
    [0, 0],
    [2.6, 0],
    [3.3, 35],
    [4.2, 35],
    [4.9, 0],
  ]),
  ch("chest_bend", [
    [0, 0],
    [3.3, -3],
    [4.3, -3],
    [4.9, 0],
  ]),
  ch("arm_r_upper", [
    [0, 0],
    [3.0, 0],
    [3.5, 18],
    [4.3, 18],
    [4.9, 0],
  ]),
  ch("arm_r_lower", [
    [0, 0],
    [3.0, 0],
    [3.5, 95],
    [3.8, 80],
    [4.1, 100],
    [4.35, 92],
    [4.9, 0],
  ]),
  ch("wrist_r_bend", [
    [0, 0],
    [3.5, -15],
    [4.1, 10],
    [4.9, 0],
  ]),
  // close-up: a spoken line ("So why do we stay? … Because it matters.") with accents
  ...visemeTracks(
    [
      [5.6, "ss"],
      [5.72, "oh"],
      [6.05, "ou"],
      [6.15, "aa"],
      [6.3, "ih"],
      [6.45, "dd"],
      [6.55, "ou"],
      [6.7, "ou"],
      [6.8, "ih"],
      [6.95, "ss"],
      [7.05, "dd"],
      [7.15, "e"],
      [7.35, "ih"],
      [7.85, "pp"],
      [7.95, "ih"],
      [8.05, "kk"],
      [8.15, "aa"],
      [8.3, "ss"],
      [8.42, "ih"],
      [8.52, "dd"],
      [8.6, "pp"],
      [8.7, "aa"],
      [8.82, "dd"],
      [8.92, "rr"],
      [9.02, "ss"],
    ],
    9.15,
  ),
  ch("au01", [
    [0, 0],
    [6.85, 0],
    [7.0, 0.8],
    [7.45, 0.7],
    [7.7, 0],
    [10.3, 0],
    [10.5, 1],
    [11.1, 1],
    [11.5, 0],
  ]),
  ch("au02", [
    [0, 0],
    [6.85, 0],
    [7.0, 0.9],
    [7.45, 0.8],
    [7.7, 0],
  ]),
  ch("au15", [
    [0, 0],
    [10.3, 0],
    [10.5, 0.55],
    [11.1, 0.55],
    [11.5, 0],
  ]),
  ch("au12", [
    [0, 0],
    [9.2, 0],
    [9.45, 0.9],
    [10.0, 0.85],
    [10.3, 0],
  ]),
  ch("au06", [
    [0, 0],
    [9.25, 0],
    [9.5, 0.8],
    [10.0, 0.75],
    [10.3, 0],
  ]),
  ch("head_pitch", [
    [0, 0],
    [6.85, 0],
    [7.0, 4],
    [7.25, -2],
    [7.5, 0],
    [8.55, 0],
    [8.7, 5],
    [9.0, 0],
    [10.4, 0],
    [10.6, 4],
    [11.2, 4],
    [11.6, 0],
  ]),
  ch("head_roll", [
    [0, 0],
    [5.9, 0],
    [6.3, -4],
    [7.5, 3],
    [9.0, 0],
    [9.5, 3],
    [10.2, 0],
  ]),
  ch("arm_l_upper", [
    [0, 0],
    [7.7, 0],
    [8.1, 12],
    [9.0, 12],
    [9.5, 0],
  ]),
  ch("arm_l_lower", [
    [0, 0],
    [7.7, 0],
    [8.1, 105],
    [8.45, 92],
    [8.75, 108],
    [9.0, 100],
    [9.5, 0],
  ]),
].map((t) => Track.parse(t));
const SCENE = { tracks: TRACKS } as unknown as RenderPackage["scenes"][number];

function backdrop(g: SKRSContext2D): void {
  const wall = g.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, "#D9D2C5");
  wall.addColorStop(1, "#B9B1A3");
  g.fillStyle = wall;
  g.fillRect(0, 0, W, H);
}

const c = await loadCharacter(join(LIBRARY_ROOT, "characters", "chr_daniel", "1"));
mkdirSync(dirname(OUT), { recursive: true });
const ff = spawn("ffmpeg", segmentArgs(W, H, FPS, OUT), { stdio: ["pipe", "inherit", "inherit"] });
const done = new Promise<number>((res) => ff.on("close", (code) => res(code ?? 1)));
const frames = DURATION * FPS;
const SHEET_AT = [0.5, 1.9, 3.05, 3.6, 4.3, 6.15, 7.2, 8.75, 9.8, 10.8];
const sheet: Array<{ t: number; png: Buffer }> = [];
const evalMs: number[] = [];
const drawMs: number[] = [];
const layers: number[] = [];
const canvas = createCanvas(W, H);
const g = canvas.getContext("2d");
const rss0 = process.memoryUsage().rss;
const rss: number[] = [];
const t0 = performance.now();
for (let f = 0; f < frames; f++) {
  const t = f / FPS;
  backdrop(g);
  const a = actorFrame(c, SCENE, ID, t);
  const e0 = performance.now();
  const ev = evaluate(c, { channels: a.channels });
  const e1 = performance.now();
  drawCharacter(c, g, ev, a.root);
  const e2 = performance.now();
  evalMs.push(e1 - e0);
  drawMs.push(e2 - e1);
  layers.push(ev.layers.length);
  if (f % 60 === 59) rss.push(Math.round(process.memoryUsage().rss / 1e6));
  const rgba = Buffer.from(canvas.data());
  if (!ff.stdin.write(rgba)) await new Promise((r) => ff.stdin.once("drain", r));
  if (SHEET_AT.some((s) => Math.round(s * FPS) === f)) sheet.push({ t, png: canvas.toBuffer("image/png") });
}
ff.stdin.end();
const code = await done;
const ms = performance.now() - t0;
const pct = (xs: number[], p: number): number => {
  const s = xs.slice().sort((a, b) => a - b);
  return Math.round((s[Math.min(s.length - 1, Math.floor(p * s.length))] as number) * 10) / 10;
};
const stats = {
  frames,
  size: `${W}x${H}`,
  fps: FPS,
  wallSeconds: Math.round(ms / 100) / 10,
  msPerFrameInclEncoding: Math.round((ms / frames) * 10) / 10,
  evaluateMs: { p50: pct(evalMs, 0.5), p95: pct(evalMs, 0.95), max: pct(evalMs, 1) },
  drawMs: { p50: pct(drawMs, 0.5), p95: pct(drawMs, 0.95), max: pct(drawMs, 1) },
  drawMsFullShot: { p50: pct(drawMs.slice(0, CUT * FPS), 0.5), p95: pct(drawMs.slice(0, CUT * FPS), 0.95) },
  drawMsCloseUp: { p50: pct(drawMs.slice(CUT * FPS), 0.5), p95: pct(drawMs.slice(CUT * FPS), 0.95) },
  drawMsCrossFade: {
    p50: pct(
      drawMs.filter((_, i) => (layers[i] as number) > 1),
      0.5,
    ),
    max: pct(
      drawMs.filter((_, i) => (layers[i] as number) > 1),
      1,
    ),
  },
  crossFadeFrames: layers.filter((l) => l > 1).length,
  rssGrowthMB: Math.round(((process.memoryUsage().rss - rss0) / 1e6) * 10) / 10,
  rssEvery2sMB: rss,
  ffmpegExit: code,
};
writeFileSync(OUT.replace(/\.mp4$/, "-stats.json"), `${JSON.stringify(stats, null, 2)}\n`);
console.info(JSON.stringify(stats));

// contact sheet: the frames above, scaled down, with their time
const TW = 270;
const TH = 480;
const cs = createCanvas(TW * 5, (TH + 30) * 2);
const cg = cs.getContext("2d");
cg.fillStyle = "#111";
cg.fillRect(0, 0, cs.width, cs.height);
for (const [i, s] of sheet.entries()) {
  const img = await loadImage(s.png);
  const x = (i % 5) * TW;
  const y = Math.floor(i / 5) * (TH + 30);
  cg.drawImage(img, x, y + 30, TW, TH);
  cg.fillStyle = "#EEE";
  cg.font = "18px sans-serif";
  cg.fillText(`t = ${s.t.toFixed(2)} s`, x + 8, y + 22);
}
writeFileSync(OUT.replace(/\.mp4$/, "-contact.png"), cs.toBuffer("image/png"));
process.exitCode = code;
