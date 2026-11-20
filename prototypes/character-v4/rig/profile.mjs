/* global console */
// Where a frame's time goes: render the same frame with one layer at a time (prototype tooling).
import { readFileSync } from "node:fs";
import { createHeadRig } from "./headrig.mjs";
import { frameSvg } from "./demo.mjs";
import { rasterize, fitFilters } from "./raster.mjs";

const S = JSON.parse(readFileSync("prototypes/character-v4/out/demo/states.json", "utf8"));
const n = +(process.argv[2] ?? 95);
const lod = +(process.argv[3] ?? 0.55);
const head = createHeadRig({ lod });
const svg = frameSvg(S[n], head, {}, 48);
const best = (s, k = 2) => {
  let b = Infinity;
  for (let i = 0; i < k; i++) {
    const r = rasterize(s);
    b = Math.min(b, r.parseMs + r.renderMs);
  }
  return Math.round(b);
};
const only = (keep) =>
  new Set(["set", "body", "head", "colleague", "grade"].filter((k) => !keep.includes(k)));
const FIT = process.argv[4] === "fit";
const time = (skip) =>
  best(FIT ? fitFilters(frameSvg(S[n], head, {}, 48, skip)) : frameSvg(S[n], head, {}, 48, skip));
const res = {
  full: time(new Set()),
  empty: time(only([])),
  set: time(only(["set"])),
  head: time(only(["head"])),
  bodyNoHead: time(new Set(["set", "head", "colleague", "grade"])),
  colleague: time(only(["colleague"])),
  grade: time(only(["grade"])),
};
console.info(JSON.stringify({ frame: n, lod, fit: FIT, svgKB: (svg.length / 1024) | 0, ...res }));
