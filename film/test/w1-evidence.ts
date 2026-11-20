/**
 * W1 visual evidence (not a test): writes the contact sheets of docs/reports/w1/.
 *
 *   cd film && node --import tsx test/w1-evidence.ts
 *
 *   w1-contextual-wardrobe.png  the wardrobe engine dressing people from who they are and where they are (CA-W1)
 *   w1-coat-walk.png            a winter coat and scarf over a walk: trailing, settling, outside the legs (CA-W4)
 *   w1-b2-before-after.png      B2 before (two cast members, a darker coat) and after (one Alex, two outfits)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Script } from "@erkasa/contracts";
import { FilmPlan, type CastMember } from "../src/contract.js";
import { prepare, storyboard } from "../src/film.js";
import { png } from "../src/raster.js";
import { CLOTH_LAG, STANDING, drawPerson, lookFor, swayOf, type Look } from "../src/rig.js";
import { dressFor, type DressContext } from "../src/wardrobe.js";
import { ROOT } from "./package/helpers.js";

const OUT = join(ROOT, "docs", "reports", "w1");
mkdirSync(OUT, { recursive: true });
const label = (x: number, y: number, t: string, size = 26): string =>
  `<text x="${x}" y="${y}" font-family="Montserrat" font-weight="500" font-size="${size}" fill="#14213D" text-anchor="middle">${t}</text>`;

// ---- 1. contextual wardrobe: one lineup, the same rules
const people: Array<[string, Omit<DressContext, "seed">, Partial<Look>]> = [
  [
    "1920s, business, winter",
    { build: "man", era: "1920s", profession: "business", occasion: "work", weather: "cold" },
    { features: { hair: "slicked", facialHair: "moustache" } },
  ],
  [
    "1920s, business",
    { build: "woman", era: "1920s", profession: "business", occasion: "work", weather: "mild" },
    { features: { hair: "bob", facialHair: "none" } },
  ],
  [
    "today, construction",
    { build: "man", era: "contemporary", profession: "construction", occasion: "work", weather: "mild" },
    { features: { hair: "short", facialHair: "stubble" } },
  ],
  [
    "today, doctor",
    { build: "woman", era: "contemporary", profession: "doctor", occasion: "work", weather: "mild" },
    { features: { hair: "ponytail", facialHair: "none" } },
  ],
  [
    "today, chef",
    { build: "man", era: "contemporary", profession: "chef", occasion: "work", weather: "mild" },
    { features: { hair: "short", facialHair: "beard" } },
  ],
  [
    "today, student, snow",
    { build: "woman", era: "contemporary", profession: "student", occasion: "outdoor", weather: "snow" },
    { features: { hair: "long", facialHair: "none" } },
  ],
  [
    "today, office, rain",
    { build: "man", era: "contemporary", profession: "office", occasion: "work", weather: "rain" },
    { features: { hair: "receding", facialHair: "none" } },
  ],
  [
    "today, executive, formal",
    { build: "woman", era: "contemporary", profession: "executive", occasion: "formal", weather: "mild" },
    { features: { hair: "bun", facialHair: "none" } },
  ],
];
const CELL = 300;
let body = "";
people.forEach(([name, ctx, extra], i) => {
  const d = dressFor({ ...ctx, seed: `lineup${i}` });
  const look = {
    ...lookFor({ build: ctx.build, hair: i === 0 || i === 6 ? "#9A9A9A" : undefined }),
    wardrobe: d.garments,
    ...extra,
  } as Look;
  const x = CELL * i + CELL / 2;
  body += drawPerson(
    { ...STANDING, gx: 0.6 },
    { x: x - 20, y: 520, facing: 1, turn: 1, scale: 0.62 },
    look,
  ).svg;
  body += label(x, 900, name, 22);
});
const W1 = CELL * people.length;
writeFileSync(
  join(OUT, "w1-contextual-wardrobe.png"),
  png(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W1}" height="960" viewBox="0 0 ${W1} 960"><rect width="100%" height="100%" fill="#F4EBDD"/>${body}</svg>`,
  ),
);

// ---- 2. a coat over a walk (B2 W1, sh03, Alex dressed for the cold)
const json = (p: string): unknown => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const plan = FilmPlan.parse(json("film/plans/b2-same-answers.w1.film.json"));
const alex = plan.cast.find((c) => c.id === "alex") as CastMember;
// a long overcoat shows trailing best (a puffer, what the engine picks for a casual winter walk, ends at the hip)
alex.outfits = [
  {
    id: "casual",
    occasion: "outdoor",
    weather: "cold",
    garments: [
      { kind: "sweater", color: "#2A9D8F" },
      { kind: "trousers", color: "#2B2D42" },
      { kind: "overcoat", color: "#6B452B" },
      { kind: "scarf", color: "#E76F51" },
      { kind: "shoes", color: "#1A1A22" },
    ],
  },
  ...(alex.outfits ?? []).slice(1),
];
const script = Script.parse(json("benchmark/scripts/b2-same-answers.script.json"));
const sh03 = prepare({ script, plan }).composed.shots.find((s) => s.shot.id === "sh03");
const actor = sh03?.perf?.actors.get("alex");
const walk = actor?.walks[0];
if (!sh03 || !actor || !walk) throw new Error("no walk in sh03");
const times = [
  walk.t0 + 0.1,
  walk.t0 + 0.55,
  (walk.t0 + walk.t1) / 2,
  walk.t1 - 0.2,
  walk.t1 + 0.15,
  walk.t1 + 0.7,
];
let walkBody = "";
times.forEach((t, i) => {
  const pl = actor.placed(t);
  const sway = swayOf(actor.placed(t - CLOTH_LAG).x, pl.x, pl.facing);
  const g = drawPerson(actor.pose(t), { ...pl, x: 200 + i * 330, y: 560, scale: 0.7 }, actor.look, {
    sway,
  }).svg;
  walkBody += g + label(200 + i * 330, 900, `t ${t.toFixed(2)} s · sway ${sway.toFixed(2)}`, 22);
});
writeFileSync(
  join(OUT, "w1-coat-walk.png"),
  png(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${times.length * 330 + 40}" height="960" viewBox="0 0 ${times.length * 330 + 40} 960"><rect width="100%" height="100%" fill="#F4EBDD"/>${walkBody}</svg>`,
  ),
);

// ---- 3. B2 before / after (stills of sh03, sh06, sh08)
const before = storyboard(
  { script, plan: FilmPlan.parse(json("film/plans/b2-same-answers.film.json")) },
  join(OUT, ".tmp-before"),
);
const after = storyboard(
  { script, plan: FilmPlan.parse(json("film/plans/b2-same-answers.w1.film.json")) },
  join(OUT, ".tmp-after"),
);
const pick = (files: string[], ids: string[]): string[] =>
  ids.map((id) => files.find((f) => f.endsWith(`-${id}.png`)) as string);
const cells = [...pick(before, ["sh03", "sh06", "sh08"]), ...pick(after, ["sh03", "sh06", "sh08"])];
const img = (f: string, x: number, y: number): string =>
  `<image href="data:image/png;base64,${readFileSync(f).toString("base64")}" x="${x}" y="${y}" width="360" height="640"/>`;
let ba =
  label(540, 44, "before: alex and alex_suit (two cast members, a darker coat)", 26) +
  label(540, 744, "after: one Alex, outfits casual -> interview_suit (W1)", 26);
cells.forEach((f, i) => (ba += img(f, (i % 3) * 360, i < 3 ? 64 : 764)));
writeFileSync(
  join(OUT, "w1-b2-before-after.png"),
  png(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1410" viewBox="0 0 1080 1410"><rect width="100%" height="100%" fill="#F4EBDD"/>${ba}</svg>`,
  ),
);
console.info(`wrote ${OUT}/w1-contextual-wardrobe.png, w1-coat-walk.png, w1-b2-before-after.png`);
