/* global process, console */
// Renders the v4 approval pieces to out/ (prototype tooling).
import { writeFileSync, mkdirSync } from "node:fs";
import { png } from "../character-v3/raster.mjs";
import { portraitSvg } from "./portrait.mjs";
import { fullBodySvg } from "./fullbody.mjs";

const OUT = "prototypes/character-v4/out";
mkdirSync(OUT, { recursive: true });
const which = process.argv[2] ?? "portrait";
const t0 = Date.now();
if (which === "portrait") {
  const svg = portraitSvg();
  writeFileSync(`${OUT}/v4-portrait.svg`, svg);
  writeFileSync(`${OUT}/v4-portrait.png`, png(svg));
  console.info(`portrait ${(svg.length / 1024).toFixed(0)} KB svg, ${Date.now() - t0} ms`);
}
if (which === "full") {
  const svg = fullBodySvg();
  writeFileSync(`${OUT}/v4-fullbody.svg`, svg);
  writeFileSync(`${OUT}/v4-fullbody.png`, png(svg));
  console.info(`full body ${(svg.length / 1024).toFixed(0)} KB svg, ${Date.now() - t0} ms`);
}
