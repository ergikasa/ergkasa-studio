/* Phase 2 demonstration: the test character driven by erkasa.render/1 tracks, drawn by the Character Runtime on
 * the pipeline's Skia canvas, encoded with the pipeline's FFmpeg settings (film/src/package/encoding.ts).
 *
 *   pnpm --filter @erkasa/character demo [out.mp4]
 *
 * The tracks are what an Engine would write (here by hand): the runtime only executes them.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import { Track, type RenderPackage } from "@erkasa/contracts";
import { segmentArgs } from "../../film/src/package/encoding.js";
import { actorFrame, drawCharacter, evaluate, loadCharacter } from "../src/runtime/index.js";
import { resolveRef, readCatalog, immutableRef } from "../src/library/index.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] ?? join(HERE, "out", "chr-test-minimal-demo.mp4");
const W = 1080;
const H = 1920;
const FPS = 30;
const DURATION = 7;

type K = [number, number, ("linear" | "hold")?];
const keys = (channel: string, ks: K[]): unknown => ({
  kind: "keys",
  target: { kind: "actor", id: "test" },
  channel,
  keys: ks.map(([t, v, ease]) => ({ t, v, ease: ease ?? "linear" })),
});
const blink = (at: number[]): K[] => [
  [0, 0],
  ...at.flatMap((t): K[] => [
    [t, 0],
    [t + 0.05, 1],
    [t + 0.12, 1],
    [t + 0.2, 0],
  ]),
];
/** A breath cycle sampled at the frame rate (a dense track, as the stager writes for evaluated motion). */
const breath = {
  kind: "samples",
  target: { kind: "actor", id: "test" },
  channel: "channel.breath",
  start: 0,
  rate: FPS,
  values: Array.from(
    { length: DURATION * FPS },
    (_, f) => Math.round((0.5 - 0.5 * Math.cos((2 * Math.PI * f) / (FPS * 3.6))) * 1e4) / 1e4,
  ),
};

const TRACKS = [
  keys("root.x", [[0, W / 2, "hold"]]),
  keys("root.y", [[0, 1830, "hold"]]),
  keys("root.scale", [[0, 1.9, "hold"]]),
  breath,
  // the eyes lead, the head follows across the view boundary (front → q3 at 15°), then returns
  keys("channel.gaze_x", [
    [0, 0],
    [1.0, 0],
    [1.12, 260],
    [2.6, 260],
    [4.6, 260],
    [4.72, -160],
    [5.6, -160],
    [5.7, 0],
  ]),
  keys("channel.gaze_y", [
    [0, 0],
    [4.6, 0],
    [4.72, 120],
    [5.6, 120],
    [5.7, 0],
  ]),
  keys("channel.head_yaw", [
    [0, 0],
    [1.2, 0],
    [2.1, 30],
    [4.4, 30],
    [5.3, 0],
  ]),
  keys("channel.head_pitch", [
    [0, 0],
    [4.6, 0],
    [5.0, 8],
    [5.8, 8],
    [6.3, 0],
  ]),
  keys("channel.head_roll", [
    [0, 0],
    [3.2, 0],
    [3.6, -9],
    [4.4, -9],
    [4.9, 0],
  ]),
  keys("channel.neck_bend", [
    [0, 0],
    [1.2, 0],
    [2.1, 4],
    [4.4, 4],
    [5.3, 0],
  ]),
  // expressions: smile with raised brows, talking jaw, then a frown
  keys("channel.au12", [
    [0, 0],
    [2.2, 0],
    [2.6, 1],
    [4.2, 1],
    [4.6, 0],
  ]),
  keys("channel.au01", [
    [0, 0],
    [2.2, 0],
    [2.5, 0.8],
    [3.4, 0.8],
    [3.7, 0],
  ]),
  keys("channel.au02", [
    [0, 0],
    [2.2, 0],
    [2.5, 0.6],
    [3.4, 0.6],
    [3.7, 0],
  ]),
  keys("channel.au04", [
    [0, 0],
    [4.8, 0],
    [5.2, 1],
    [6.2, 1],
    [6.6, 0],
  ]),
  keys("channel.au05", [
    [0, 0],
    [1.0, 0],
    [1.1, 0.7],
    [1.6, 0.7],
    [1.9, 0],
  ]),
  keys("channel.jaw_open", [
    [0, 0],
    [2.7, 0],
    [2.85, 0.7],
    [3.0, 0.2],
    [3.15, 0.8],
    [3.3, 0.1],
    [3.45, 0.6],
    [3.6, 0],
  ]),
  keys("channel.lid_l", blink([0.6, 2.95, 5.4])),
  keys("channel.lid_r", blink([0.6, 2.95, 5.4])),
  // body: a wave with the left arm (skinned elbow), a lean, then rest
  keys("channel.arm_l_upper", [
    [0, 0],
    [3.2, 0],
    [3.7, 75],
    [4.6, 75],
    [5.2, 0],
  ]),
  keys("channel.arm_l_lower", [
    [0, 0],
    [3.3, 0],
    [3.8, 95],
    [4.0, 70],
    [4.2, 100],
    [4.4, 70],
    [4.6, 95],
    [5.2, 0],
  ]),
  keys("channel.shoulder_l_raise", [
    [0, 0],
    [3.2, 0],
    [3.7, 12],
    [4.6, 12],
    [5.2, 0],
  ]),
  keys("channel.arm_r_upper", [
    [0, 0],
    [3.4, 0],
    [3.9, 12],
    [5.0, 12],
    [5.4, 0],
  ]),
  keys("channel.spine_bend", [
    [0, 0],
    [3.2, 0],
    [3.8, -6],
    [4.8, -6],
    [5.4, 0],
  ]),
  keys("channel.chest_bend", [
    [0, 0],
    [3.2, 0],
    [3.8, -4],
    [4.8, -4],
    [5.4, 0],
  ]),
].map((t) => Track.parse(t));
const SCENE = { tracks: TRACKS } as unknown as RenderPackage["scenes"][number];

function backdrop(g: SKRSContext2D): void {
  const wall = g.createLinearGradient(0, 0, 0, H);
  wall.addColorStop(0, "#3A4A52");
  wall.addColorStop(1, "#24303A");
  g.fillStyle = wall;
  g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(255,255,255,0.04)";
  g.fillRect(0, 1840, W, 80);
}

const e = readCatalog().characters.find((x) => x.id === "chr_test_minimal" && x.version === 1);
if (!e) throw new Error("chr_test_minimal@1 is not published");
const { dir } = resolveRef(immutableRef(e));
const c = await loadCharacter(dir);
mkdirSync(dirname(OUT), { recursive: true });
const ff = spawn("ffmpeg", segmentArgs(W, H, FPS, OUT), { stdio: ["pipe", "inherit", "inherit"] });
const done = new Promise<number>((res) => ff.on("close", (code) => res(code ?? 1)));
const frames = DURATION * FPS;
const sheet: Array<{ t: number; png: Buffer }> = [];
const SHEET_AT = [0.3, 1.1, 1.6, 2.4, 2.9, 3.85, 4.3, 5.2, 5.45, 6.0];
const t0 = performance.now();
for (let f = 0; f < frames; f++) {
  const t = f / FPS;
  const canvas = createCanvas(W, H);
  const g = canvas.getContext("2d");
  backdrop(g);
  const a = actorFrame(c, SCENE, "test", t);
  drawCharacter(c, g, evaluate(c, { channels: a.channels, outfit: "test_tee" }), a.root);
  // canvas.data(): the frame's RGBA without getImageData's native-memory leak (Phase 2 finding)
  const rgba = Buffer.from(canvas.data());
  if (!ff.stdin.write(rgba)) await new Promise((r) => ff.stdin.once("drain", r));
  if (SHEET_AT.some((s) => Math.abs(s - t) < 0.5 / FPS)) sheet.push({ t, png: canvas.toBuffer("image/png") });
}
ff.stdin.end();
const code = await done;
const ms = performance.now() - t0;
console.info(
  `${frames} frames in ${(ms / 1000).toFixed(1)} s (${(ms / frames).toFixed(1)} ms per frame incl. encoding) → ${OUT} (ffmpeg ${code})`,
);

// contact sheet: the frames above, scaled down, with their time
const TW = 270;
const TH = 480;
const cs = createCanvas(TW * 5, (TH + 30) * 2);
const cg = cs.getContext("2d");
cg.fillStyle = "#111";
cg.fillRect(0, 0, cs.width, cs.height);
const { loadImage } = await import("@napi-rs/canvas");
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
