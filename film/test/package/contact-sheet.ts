/**
 * K4 (iii): contact sheet of fixtures B, drawn by the package renderer, for the PO's approval. Once approved,
 * golden-fixtures-b.pending.json (written by golden-package.ts --write) becomes golden-fixtures-b.json.
 *
 *   node --expose-gc --import tsx test/package/contact-sheet.ts <out.png>
 */
import { writeFileSync } from "node:fs";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { fontFiles } from "../../src/style.js";
import { fixtureB, renderer } from "./helpers.js";

const SHEETS = [
  { name: "prisoner-cell", frames: [0, 30, 60, 100, 165, 180, 200, 239] },
  { name: "office-clock", frames: [0, 30, 60, 89, 92, 95, 110, 149] },
] as const;
const TW = 270;
const TH = 480;
const PAD = 16;
const LABEL = 30;

for (const f of fontFiles()) GlobalFonts.registerFromPath(f, "Montserrat");
const cols = 8;
const sheet = createCanvas(PAD + cols * (TW + PAD), PAD + SHEETS.length * (TH + LABEL + PAD + 34));
const ctx = sheet.getContext("2d");
ctx.fillStyle = "#14161c";
ctx.fillRect(0, 0, sheet.width, sheet.height);
let y = PAD;
for (const s of SHEETS) {
  const r = renderer(fixtureB(s.name));
  ctx.fillStyle = "#e8e2d6";
  ctx.font = "800 24px Montserrat";
  ctx.fillText(`${s.name} (${r.frames} frames, ${r.fps} fps)`, PAD, y + 24);
  y += 34;
  for (const [c, k] of s.frames.entries()) {
    const px = await r.pixels(k);
    const full = createCanvas(r.width, r.height);
    const fc = full.getContext("2d");
    const img = fc.createImageData(r.width, r.height);
    img.data.set(px);
    fc.putImageData(img, 0, 0);
    const x = PAD + c * (TW + PAD);
    ctx.drawImage(full, x, y, TW, TH);
    ctx.fillStyle = "#b9b3a8";
    ctx.font = "500 18px Montserrat";
    const { t, cur, prev } = r.at(k);
    ctx.fillText(`#${k}  ${t.toFixed(2)} s  ${cur.id}${prev ? ` ← ${prev.kind}` : ""}`, x, y + TH + 22);
  }
  y += TH + LABEL + PAD;
}
const out = process.argv[2] ?? "contact-sheet.png";
writeFileSync(out, await sheet.encode("png"));
console.info(`written ${out}`);
