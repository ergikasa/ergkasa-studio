/**
 * Golden renders: fingerprints of what the engine draws today, so a refactor can prove it changed nothing.
 *
 *   v2 films (B1–B5): the SVG of every frame every 0.5 s (the rasteriser is deterministic, so the same SVG is
 *   the same picture); W0: the RGBA pixels of a frame every 1 s, after compositing, type and captions.
 *
 *   pnpm --filter @erkasa/film golden            compare with film/golden/golden.json (exit 1 on any change)
 *   pnpm --filter @erkasa/film golden --write    record a new baseline (only for an approved visual change)
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { GlobalFonts } from "@napi-rs/canvas";
import { Script } from "@erkasa/contracts";
import { frameAt } from "./compose.js";
import { FilmPlan } from "./contract.js";
import { prepare } from "./film.js";
import { FPS, fontFiles } from "./style.js";
import { parsePlan, prepare as prepareW0, type Prepared } from "./w0/composer.js";
import { finalFrame } from "./w0/frame.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const FILE = join(ROOT, "film", "golden", "golden.json");
export const BENCH = [
  "b1-why-we-stay",
  "b2-same-answers",
  "b3-every-yes",
  "b4-one-percent",
  "b5-planning-fallacy",
];

export type Golden = Record<string, Record<string, string>>;

const sha = (data: string | Uint8Array): string =>
  createHash("sha256").update(data).digest("hex").slice(0, 16);
const script = (name: string): Script =>
  Script.parse(JSON.parse(readFileSync(join(ROOT, `benchmark/scripts/${name}.script.json`), "utf8")));

/** Fingerprints of the v2 films (SVG per frame, every `step` seconds). */
export function v2Golden(step = 0.5, films = BENCH): Golden {
  const out: Golden = {};
  for (const b of films) {
    const plan = FilmPlan.parse(JSON.parse(readFileSync(join(ROOT, `film/plans/${b}.film.json`), "utf8")));
    const { composed } = prepare({ script: script(b), plan });
    const g: Record<string, string> = {};
    for (let T = 0; T < composed.duration; T += step) {
      const i = Math.max(
        0,
        composed.shots.findIndex((s) => T >= s.start && T < s.end),
      );
      const s = composed.shots[i];
      if (!s) continue;
      g[T.toFixed(2)] = sha(frameAt(composed, i, Math.round((T - s.start) * FPS)));
    }
    out[`v2/${b}`] = g;
  }
  return out;
}

let fonts = false;
export function loadW0(): Prepared {
  if (!fonts) for (const f of fontFiles()) GlobalFonts.registerFromPath(f, "Montserrat");
  fonts = true;
  const plan = parsePlan(JSON.parse(readFileSync(join(ROOT, "film/w0/plan.json"), "utf8")));
  return prepareW0(plan, script("b1-why-we-stay"));
}

/** Fingerprints of the W0 film (pixels after compositing, every `step` seconds, or at the given times). */
export async function w0Golden(step = 1, times?: number[]): Promise<Golden> {
  const P = loadW0();
  const g: Record<string, string> = {};
  const ts = times ?? Array.from({ length: Math.ceil(P.duration / step) }, (_, k) => k * step);
  for (const T of ts) {
    const i = Math.max(
      0,
      P.shots.findIndex((s) => T >= s.start && T < s.end),
    );
    const s = P.shots[i];
    if (!s) continue;
    g[T.toFixed(2)] = sha(await finalFrame(P, i, T - s.start));
    (globalThis as { gc?: () => void }).gc?.();
  }
  return { "w0/b1-why-we-stay": g };
}

export function readGolden(): Golden {
  return JSON.parse(readFileSync(FILE, "utf8")) as Golden;
}

/** Every fingerprint that differs from the baseline (film, time, expected, got). */
export function diffGolden(want: Golden, got: Golden): string[] {
  const out: string[] = [];
  for (const [film, frames] of Object.entries(got))
    for (const [t, h] of Object.entries(frames)) {
      const w = want[film]?.[t];
      if (w !== h) out.push(`${film} @ ${t}s: expected ${w ?? "(none)"}, got ${h}`);
    }
  for (const [film, frames] of Object.entries(want))
    for (const t of Object.keys(frames)) if (!got[film]?.[t]) out.push(`${film} @ ${t}s: missing`);
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const got = { ...v2Golden(), ...(await w0Golden()) };
  const frames = Object.values(got).reduce((n, g) => n + Object.keys(g).length, 0);
  if (process.argv.includes("--write")) {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, `${JSON.stringify(got, null, 1)}\n`);
    console.info(`golden: ${frames} frames written to ${FILE}`);
  } else {
    if (!existsSync(FILE)) throw new Error(`no baseline at ${FILE}; run with --write`);
    const d = diffGolden(readGolden(), got);
    console.info(`golden: ${frames} frames compared, ${d.length} differ`);
    for (const x of d.slice(0, 30)) console.info(`  ${x}`);
    if (d.length) process.exit(1);
  }
}
