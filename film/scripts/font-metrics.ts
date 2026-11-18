/**
 * Writes contracts/src/font-metrics.ts: the advance width of every character captions may use, for each Montserrat
 * weight the engine has, measured by Skia (@napi-rs/canvas, the engine's text renderer) from the engine's own
 * font files. Run from film/: `pnpm exec tsx scripts/font-metrics.ts`.
 */
import { writeFileSync } from "node:fs";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { fontFiles } from "../src/style.js";

const WEIGHTS = [300, 500, 800, 900];
const files = fontFiles();
WEIGHTS.forEach((w, i) => GlobalFonts.registerFromPath(files[i] as string, `M${w}`));
const CHARS = [
  ...Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)),
  ..."‘’“”–—…àáâäçèéêëìíîïñòóôöùúûüÀÁÂÄÇÈÉÊËÌÍÎÏÑÒÓÔÖÙÚÛÜ€£",
];
const UNITS = 1000;
const ctx = createCanvas(10, 10).getContext("2d");
const table: Record<string, Record<string, number>> = {};
for (const w of WEIGHTS) {
  ctx.font = `${UNITS}px M${w}`;
  table[w] = Object.fromEntries(CHARS.map((c) => [c, Math.round(ctx.measureText(c).width * 10) / 10]));
}
const out = `/**
 * Montserrat advance widths (units of 1/${UNITS} em) for the weights the engine has, measured by Skia from the
 * engine's font files (film/scripts/font-metrics.ts). Shared by the stager (it breaks captions into lines that
 * fit) and the Validation Gate (it checks that they do), like camera-view: both measure the same way.
 * Generated: do not edit by hand.
 */
export const MONTSERRAT_ADVANCE: Record<number, Record<string, number>> = ${JSON.stringify(table)};
`;
writeFileSync(new URL("../../contracts/src/font-metrics.ts", import.meta.url), out);
console.info(`wrote ${CHARS.length} characters × ${WEIGHTS.length} weights`);
