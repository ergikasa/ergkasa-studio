/**
 * W2 visual evidence (not a test): writes the contact sheets of docs/reports/w2/.
 *
 *   cd film && node --import tsx test/w2-evidence.ts
 *
 *   w2-sequence.png          the acceptance film (D4): walk in, stop, look, take, read, react, put down, turn,
 *                            explain worried; Ben reassures; she breathes again
 *   w2-worry-vs-convince.png the same words (sh05), the same moments: how = worry (top) and how = convince (bottom)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Script } from "@erkasa/contracts";
import { frameAt } from "../src/compose.js";
import { FilmPlan, type Shot } from "../src/contract.js";
import { prepare } from "../src/film.js";
import { png } from "../src/raster.js";
import { ROOT } from "./package/helpers.js";

const OUT = join(ROOT, "docs", "reports", "w2");
mkdirSync(OUT, { recursive: true });
const json = (p: string): unknown => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const script = Script.parse(json("film/acceptance/w2-acting.script.json"));
const plan = (): FilmPlan => FilmPlan.parse(json("film/acceptance/w2-acting.film.json"));
const W = 360,
  H = 640;
const label = (x: number, y: number, t: string): string =>
  `<text x="${x}" y="${y}" font-family="Montserrat" font-weight="500" font-size="22" fill="#14213D" text-anchor="middle">${t}</text>`;
const cell = (svgFrame: string, x: number, y: number): string =>
  `<image href="data:image/png;base64,${png(svgFrame).toString("base64")}" x="${x}" y="${y}" width="${W}" height="${H}"/>`;

// ---- 1. the sequence
const c = prepare({ script, plan: plan() }).composed;
const at = (shot: string, t: number): { i: number; n: number } => ({
  i: c.shots.findIndex((s) => s.shot.id === shot),
  n: Math.round(t * 30),
});
const seq: Array<[string, number, string]> = [
  ["sh01", 0.8, "walks in"],
  ["sh01", 2.2, "stops, sees the letter"],
  ["sh02", 0.55, "takes it"],
  ["sh03", 1.4, "reads, line by line"],
  ["sh03", 3.25, "the news lands"],
  ["sh04", 1.0, "puts it down"],
  ["sh04", 1.7, "turns to Ben"],
  ["sh05", 1.15, "explains, worried"],
  ["sh05", 2.2, "avoids his eyes"],
  ["sh06", 2.05, "Ben reassures"],
  ["sh07", 0.5, "she reacts"],
  ["sh07", 1.2, "breathes again"],
];
let body = "";
seq.forEach(([shot, t, what], k) => {
  const { i, n } = at(shot, t);
  const x = (k % 6) * W,
    y = Math.floor(k / 6) * (H + 50);
  body += cell(frameAt(c, i, n), x, y) + label(x + W / 2, y + H + 32, `${k + 1}. ${what}`);
});
writeFileSync(
  join(OUT, "w2-sequence.png"),
  png(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 6}" height="${2 * (H + 50)}" viewBox="0 0 ${W * 6} ${2 * (H + 50)}"><rect width="100%" height="100%" fill="#F4EBDD"/>${body}</svg>`,
  ),
);

// ---- 2. worry vs convince on the same words
const variant = (how: "worry" | "convince") => {
  const p = plan();
  const sh = p.shots.find((s) => s.id === "sh05") as Shot;
  sh.actions = sh.actions.map((a) => (a.do === "talk" ? { ...a, how } : a));
  return prepare({ script, plan: p }).composed;
};
const times = [0.6, 1.1, 1.6, 2.1, 2.6, 3.1];
let cmp = "";
(["worry", "convince"] as const).forEach((how, row) => {
  const v = variant(how);
  const i = v.shots.findIndex((s) => s.shot.id === "sh05");
  times.forEach((t, k) => (cmp += cell(frameAt(v, i, Math.round(t * 30)), k * W, row * (H + 50) + 50)));
  cmp += label(
    W * 3,
    row * (H + 50) + 34,
    `how: "${how}" (same words, same moments: ${times.join(" / ")} s)`,
  );
});
writeFileSync(
  join(OUT, "w2-worry-vs-convince.png"),
  png(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 6}" height="${2 * (H + 50) + 50}" viewBox="0 0 ${W * 6} ${2 * (H + 50) + 50}"><rect width="100%" height="100%" fill="#F4EBDD"/>${cmp}</svg>`,
  ),
);
console.info(`wrote ${OUT}/w2-sequence.png, w2-worry-vs-convince.png`);
