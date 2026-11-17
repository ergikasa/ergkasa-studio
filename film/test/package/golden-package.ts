/**
 * K2, K3, K4(iii) and K7 for the package renderer, frame hashes taken in child processes (resvg and the W0
 * compositor keep native memory between frames).
 *
 *   node --expose-gc --import tsx test/package/golden-package.ts --verify   K2 + K3 against golden.json and
 *        golden-evidence.json; K7: a second, separate run must give golden-package.json's hashes exactly
 *   node --expose-gc --import tsx test/package/golden-package.ts --write    records golden-package.json, only after
 *        --verify's K2 and K3 pass (the renderer's own baseline: SVG text and pixels); refused once
 *        golden-fixtures-b.json exists (approved by the PO on 2026-11-17: the baselines are E1.4 evidence)
 *
 * Frames: the 405 v2 golden frames of B1–B5 (renderer frame of each golden time), the 136 W0 evidence frames
 * (46 golden among them) and every frame of fixtures B (prisoner-cell 240, office-clock 150).
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EVIDENCE, readEvidence } from "../../src/golden-evidence.js";
import { normaliseKtIds } from "../../src/golden-ids.js";
import { BENCH, readGolden } from "../../src/golden.js";
import { rasterize } from "../../src/raster.js";
import { FPS } from "../../src/style.js";
import { fixtureB, planPath, renderer, staged, ROOT, type Film } from "./helpers.js";

export const GOLDEN_PACKAGE = join(ROOT, "film", "golden", "golden-package.json");
/** Fixtures B have no earlier baseline: their hashes wait for the PO's approval of the contact sheet (K4 iii). */
export const FIXTURES_B_PENDING = join(ROOT, "film", "golden", "golden-fixtures-b.pending.json");
export const FIXTURES_B = join(ROOT, "film", "golden", "golden-fixtures-b.json");
const B_SETS = ["prisoner-cell", "office-clock"];
const sha = (d: string | Uint8Array): string => createHash("sha256").update(d).digest("hex").slice(0, 16);

export type Set = (typeof SETS)[number];
export const SETS = [...BENCH, "w0-office", "prisoner-cell", "office-clock"] as const;

/** Frame indices hashed for one set (v2: the renderer frame of each golden time). */
export function framesOf(set: Set): Array<{ k: number; key: string }> {
  if ((BENCH as readonly string[]).includes(set)) {
    const plan = planPath(set);
    return Object.keys(readGolden()[`v2/${set}`] ?? {}).map((T) => {
      const t = Number(T);
      const i = Math.max(
        0,
        plan.composed.shots.findIndex((s) => t >= s.start && t < s.end),
      );
      const s = plan.composed.shots[i];
      if (!s) throw new Error(`${set} @ ${T}: no shot`);
      const n = Math.round((t - s.start) * FPS);
      let k = n;
      for (let j = 0; j < i; j++)
        k += Math.max(
          1,
          Math.round((plan.composed.shots[j]?.end ?? 0) * FPS) -
            Math.round((plan.composed.shots[j]?.start ?? 0) * FPS),
        );
      return { k, key: T };
    });
  }
  if (set === "w0-office")
    return Object.keys(readEvidence().w0)
      .map(Number)
      .sort((a, b) => a - b)
      .map((k) => ({ k, key: String(k) }));
  const out = (
    JSON.parse(fixtureB(set as "prisoner-cell" | "office-clock").text) as {
      output: { duration: number; fps: number };
    }
  ).output;
  return Array.from({ length: Math.round(out.duration * out.fps) }, (_, k) => ({ k, key: String(k) }));
}

export type All = Record<string, Record<string, FrameHash>>;

export interface FrameHash {
  k: number;
  /** flat frames: SVG text, and the SVG with kinetic-type ids normalised */
  svg?: string;
  norm?: string;
  px: string;
}

/** Hashes of frames [from, to) of a set, in this process. */
export async function hashSlice(set: Set, from: number, to: number): Promise<Record<string, FrameHash>> {
  const r =
    set === "prisoner-cell" || set === "office-clock"
      ? renderer(fixtureB(set))
      : renderer(staged(set as Film));
  const out: Record<string, FrameHash> = {};
  for (const { k, key } of framesOf(set).slice(from, to)) {
    const svg = r.svg(k);
    out[key] =
      svg !== undefined
        ? { k, svg: sha(svg), norm: sha(normaliseKtIds(svg)), px: sha(rasterize(svg)) }
        : { k, px: sha(await r.pixels(k)) };
    (globalThis as { gc?: () => void }).gc?.();
  }
  return out;
}

const child = (set: Set, from: number, to: number): Record<string, FrameHash> => {
  const out = execFileSync(
    process.execPath,
    [
      "--expose-gc",
      "--import",
      "tsx",
      fileURLToPath(import.meta.url),
      "--slice",
      set,
      String(from),
      String(to),
    ],
    { encoding: "utf8", maxBuffer: 64 << 20, cwd: resolve(ROOT, "film") },
  );
  return JSON.parse(out.trim().split("\n").at(-1) as string) as Record<string, FrameHash>;
};

/** Every hash, each slice in its own process. */
export function hashAll(slice = 40): All {
  const all: All = {};
  for (const set of SETS) {
    const n = framesOf(set).length;
    const got: Record<string, FrameHash> = {};
    for (let from = 0; from < n; from += slice) Object.assign(got, child(set, from, from + slice));
    all[set] = got;
  }
  return all;
}

/** K2 + K3: today's renderer against golden.json and the evidence. Returns the failures. */
export function checkK2K3(all: All): {
  failures: string[];
  idsOnly: string[];
} {
  const golden = readGolden();
  const e = readEvidence();
  const failures: string[] = [];
  const idsOnly: string[] = [];
  for (const film of BENCH)
    for (const [T, want] of Object.entries(golden[`v2/${film}`] ?? {})) {
      const got = all[film]?.[T];
      const ev = e.v2[`v2/${film}`]?.[T];
      if (!got || !ev) failures.push(`${film} @ ${T}: missing`);
      else if (got.svg === want) continue;
      else if (got.norm !== ev.norm)
        failures.push(`${film} @ ${T}: the normalised SVG differs from the evidence`);
      else if (got.px !== ev.px) failures.push(`${film} @ ${T}: the pixels differ from the evidence`);
      else idsOnly.push(`${film} @ ${T}`);
    }
  for (const [T, want] of Object.entries(golden["w0/b1-why-we-stay"] ?? {})) {
    const k = String(Math.round(Number(T) * FPS));
    if (all["w0-office"]?.[k]?.px !== want)
      failures.push(`W0 golden @ ${T}s: the pixels differ from golden.json`);
  }
  for (const [k, px] of Object.entries(e.w0))
    if (all["w0-office"]?.[k]?.px !== px) failures.push(`W0 frame ${k}: the pixels differ from the evidence`);
  return { failures, idsOnly };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--slice");
  if (i >= 0) {
    const [set, from, to] = process.argv.slice(i + 1);
    console.info(JSON.stringify(await hashSlice(set as Set, Number(from), Number(to))));
  } else {
    if (!existsSync(EVIDENCE)) throw new Error("no evidence");
    const all = hashAll();
    const { failures, idsOnly } = checkK2K3(all);
    const counts = SETS.map((s) => `${s} ${Object.keys(all[s] ?? {}).length}`).join(", ");
    console.info(`package renderer: ${counts}`);
    console.info(
      `K2/K3: ${failures.length} failures; ${idsOnly.length} v2 frames differ from golden.json only in kinetic-type ids`,
    );
    for (const f of failures.slice(0, 40)) console.info(`  ${f}`);
    if (failures.length) process.exit(1);
    const pick = (sets: string[]): All => Object.fromEntries(sets.map((x) => [x, all[x] ?? {}]));
    const main = SETS.filter((x) => !B_SETS.includes(x));
    if (process.argv.includes("--write")) {
      // E1.4: the fixtures B baseline was approved by the PO (2026-11-17); from then on both baselines are
      // evidence and are never rewritten by this tool
      if (existsSync(FIXTURES_B)) {
        console.error(`${FIXTURES_B} is approved: the baselines are not rewritten`);
        process.exit(1);
      }
      writeFileSync(GOLDEN_PACKAGE, `${JSON.stringify({ idsOnly, frames: pick(main) }, null, 1)}\n`);
      writeFileSync(FIXTURES_B_PENDING, `${JSON.stringify({ frames: pick(B_SETS) }, null, 1)}\n`);
      console.info(`written ${GOLDEN_PACKAGE} and ${FIXTURES_B_PENDING}`);
    } else if (existsSync(GOLDEN_PACKAGE)) {
      // K7: this run is a separate process from the one that wrote the baseline
      const bFile = existsSync(FIXTURES_B) ? FIXTURES_B : FIXTURES_B_PENDING;
      const base = {
        frames: {
          ...(JSON.parse(readFileSync(GOLDEN_PACKAGE, "utf8")) as { frames: All }).frames,
          ...(existsSync(bFile) ? (JSON.parse(readFileSync(bFile, "utf8")) as { frames: All }).frames : {}),
        },
      };
      const diff: string[] = [];
      for (const s of SETS)
        for (const [key, h] of Object.entries(base.frames[s] ?? {}))
          if (JSON.stringify(all[s]?.[key]) !== JSON.stringify(h)) diff.push(`${s} ${key}`);
      const total = SETS.reduce((n, s) => n + Object.keys(base.frames[s] ?? {}).length, 0);
      console.info(`K7: ${total - diff.length}/${total} frames identical to golden-package.json`);
      for (const d of diff.slice(0, 40)) console.info(`  ${d}`);
      if (diff.length) process.exit(1);
    }
  }
}
