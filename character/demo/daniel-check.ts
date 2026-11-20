/* chr_daniel@1 against the approved concept: the same poses drawn by the Character Runtime (Skia, from the package)
 * and by the concept construction (resvg, from the code), side by side, with a pixel difference per case.
 *
 *   pnpm --filter @erkasa/character exec tsx demo/daniel-check.ts [outDir]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import { LIBRARY_ROOT } from "../src/library/index.js";
import { DANIEL_SOURCE_DIR } from "../src/builder/sources/daniel.js";
import { drawCharacter, evaluate, loadCharacter } from "../src/runtime/index.js";

const OUT = process.argv[2] ?? join(import.meta.dirname, "out", "daniel-check");
mkdirSync(OUT, { recursive: true });
const BG = "#EFEBE4";
type Png = Uint8Array;
interface Concept {
  conceptPng(o: object): Png;
}
const concept = (await import(pathToFileURL(join(DANIEL_SOURCE_DIR, "bake.mjs")).href)) as Concept;
const c = await loadCharacter(join(LIBRARY_ROOT, "characters", "chr_daniel", "1"));

interface Frame {
  width: number;
  height: number;
  x: number;
  y: number;
  k: number;
}
function runtime(f: Frame, channels: Record<string, number>): Png {
  const cv = createCanvas(f.width, f.height);
  const g: SKRSContext2D = cv.getContext("2d");
  g.fillStyle = BG;
  g.fillRect(0, 0, f.width, f.height);
  drawCharacter(c, g, evaluate(c, { channels }), { x: f.x, y: f.y, scale: f.k });
  return cv.toBuffer("image/png");
}

/** Mean absolute difference (0..255) and the share of clearly different pixels, inside the drawn area. */
async function compare(a: Png, b: Png): Promise<{ mean: number; differ: number }> {
  const ia = await loadImage(a);
  const ib = await loadImage(b);
  const w = ia.width;
  const h = ia.height;
  const read = (img: typeof ia): Uint8ClampedArray => {
    const cv = createCanvas(w, h);
    cv.getContext("2d").drawImage(img, 0, 0);
    return new Uint8ClampedArray(cv.data());
  };
  const pa = read(ia);
  const pb = read(ib);
  const bg = [0xef, 0xeb, 0xe4];
  let n = 0;
  let sum = 0;
  let big = 0;
  for (let i = 0; i < pa.length; i += 4) {
    const isBg = (p: Uint8ClampedArray): boolean =>
      Math.abs((p[i] as number) - (bg[0] as number)) +
        Math.abs((p[i + 1] as number) - (bg[1] as number)) +
        Math.abs((p[i + 2] as number) - (bg[2] as number)) <
      6;
    if (isBg(pa) && isBg(pb)) continue;
    const d =
      (Math.abs((pa[i] as number) - (pb[i] as number)) +
        Math.abs((pa[i + 1] as number) - (pb[i + 1] as number)) +
        Math.abs((pa[i + 2] as number) - (pb[i + 2] as number))) /
      3;
    n++;
    sum += d;
    if (d > 40) big++;
  }
  return { mean: n ? sum / n : 0, differ: n ? big / n : 0 };
}

async function sheet(
  name: string,
  cells: Array<{ label: string; top: Png; bottom: Png }>,
  cell: [number, number],
  scale = 1,
): Promise<void> {
  const [cw, ch] = [Math.round(cell[0] * scale), Math.round(cell[1] * scale)];
  const cols = cells.length;
  const cv = createCanvas(cw * cols, ch * 2 + 70);
  const g = cv.getContext("2d");
  g.fillStyle = "#FFFFFF";
  g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = "#222";
  g.font = "bold 20px sans-serif";
  for (const [i, e] of cells.entries()) {
    g.drawImage(await loadImage(e.top), i * cw, 40, cw, ch);
    g.drawImage(await loadImage(e.bottom), i * cw, 40 + ch, cw, ch);
    g.fillText(e.label, i * cw + 10, 28);
  }
  g.font = "16px sans-serif";
  g.fillText(
    "top: chr_daniel@1 through the Character Runtime · bottom: the concept construction",
    10,
    ch * 2 + 62,
  );
  writeFileSync(join(OUT, `${name}.png`), cv.toBuffer("image/png"));
}

const results: Array<{ case: string; mean: number; differ: number }> = [];
async function pair(label: string, f: Frame, channels: Record<string, number>, conceptOpts: object) {
  const top = runtime(f, channels);
  // resvg panics on drawings that fall far outside the canvas: draw the whole figure, then crop
  const whole = await loadImage(
    concept.conceptPng({ ...f, height: Math.max(f.height, Math.ceil(f.y + 80)), ...conceptOpts }),
  );
  const crop = createCanvas(f.width, f.height);
  crop.getContext("2d").drawImage(whole, 0, 0);
  const bottom = crop.toBuffer("image/png");
  const r = await compare(top, bottom);
  results.push({ case: label, mean: Math.round(r.mean * 10) / 10, differ: Math.round(r.differ * 1000) / 10 });
  return { label, top, bottom };
}

// full body, front and three-quarter
const body: Frame = { width: 640, height: 1120, x: 320, y: 1085, k: 0.57 };
await sheet(
  "body",
  [
    await pair("front (rest)", body, {}, { yaw: 0 }),
    await pair("body 35°, head 30°", body, { body_yaw: 35, head_yaw: 30 }, { yaw: 35, headYaw: 30 }),
    await pair("body 35°, head 35°", body, { body_yaw: 35, head_yaw: 35 }, { yaw: 35, headYaw: 35 }),
  ],
  [body.width, body.height],
  0.6,
);

// the head: expressions (front) — the package's units against the concept's parameters they were keyed from
const head: Frame = { width: 520, height: 600, x: 260, y: 300 + 1690 * 2.6, k: 2.6 };
const EXPR: Array<[string, Record<string, number>, object]> = [
  ["rest", {}, {}],
  ["au12+au06 smile", { au12: 1, au06: 1 }, { smile: 1, squint: 0.8 }],
  ["au01+au15 worry", { au01: 1, au15: 0.6 }, { browInner: 1, frown: 0.6 }],
  ["surprise", { au01: 1, au02: 1, au05: 1, jaw_open: 0.5 }, { browInner: 1, browUp: 1, lidUp: 1, jaw: 0.5 }],
  ["anger", { au04: 1, au07: 1, au24: 0.6 }, { browDown: 1, squint: 0.5, lidDown: 0.35, press: 0.6 }],
  ["viseme aa", { viseme_aa: 1 }, { jaw: 0.75 }],
  ["viseme oh", { viseme_oh: 1 }, { pucker: 0.6, jaw: 0.45 }],
  ["blink", { lid_l: 1, lid_r: 1 }, { L: { blink: 1 }, R: { blink: 1 } }],
];
const exprCells = [];
for (const [label, ch, expr] of EXPR) exprCells.push(await pair(label, head, ch, { yaw: 0, expr }));
await sheet("expressions", exprCells, [head.width, head.height], 0.55);

// the head turning: every 7.5° (on a view, in a view, at a view boundary)
const turnCells = [];
for (const y of [-45, -30, -22.5, -15, -7.5, 0, 7.5, 15, 22.5, 30, 37.5, 45])
  turnCells.push(await pair(`head_yaw ${y}`, head, { head_yaw: y }, { yaw: 0, headYaw: y }));
await sheet("head-turn", turnCells, [head.width, head.height], 0.45);
// nods
const nodCells = [];
for (const p of [-10, -5, 0, 5, 10])
  nodCells.push(await pair(`head_pitch ${p}`, head, { head_pitch: p }, { yaw: 0, nod: p }));
await sheet("head-pitch", nodCells, [head.width, head.height], 0.55);

// poses the concept never drew (runtime only): gestures on the arm chains, in both body views
const POSES: Array<[string, Record<string, number>]> = [
  [
    "explaining (front)",
    { arm_l_upper: 25, arm_l_lower: 95, wrist_l_bend: -20, arm_r_upper: 10, arm_r_lower: 60 },
  ],
  ["open hand (front)", { arm_r_upper: 12, arm_r_lower: 105, wrist_r_bend: 10, head_roll: 4, au12: 0.5 }],
  ["3/4, looking at camera", { body_yaw: 35, head_yaw: 0, arm_r_upper: 15, arm_r_lower: 80, spine_bend: 3 }],
  ["3/4, hand to chest", { body_yaw: 35, head_yaw: -30, head_pitch: 5, arm_r_lower: 110, wrist_r_bend: -25 }],
];
{
  const pw = 420;
  const cv = createCanvas(pw * POSES.length, 1140);
  const g = cv.getContext("2d");
  g.fillStyle = BG;
  g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = "#222";
  g.font = "bold 20px sans-serif";
  POSES.forEach(([label, ch], i) => {
    drawCharacter(c, g, evaluate(c, { channels: ch }), { x: pw * i + pw / 2, y: 1110, scale: 0.56 });
    g.fillText(label, pw * i + 12, 30);
  });
  writeFileSync(join(OUT, "poses.png"), cv.toBuffer("image/png"));
}

writeFileSync(join(OUT, "compare.json"), `${JSON.stringify(results, null, 2)}\n`);
for (const r of results)
  console.info(`${r.case.padEnd(24)} mean |Δ| ${r.mean}  clearly different ${r.differ}%`);
