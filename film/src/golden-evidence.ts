/**
 * Evidence captured from the engine BEFORE E1.4 changed any code, so later changes can be proven not to alter
 * what is drawn. The historical golden (golden.json) is never rewritten; this file sits beside it.
 *
 *   v2 (405 golden frames)   text: the historical SVG fingerprint (checked equal to golden.json)
 *                             norm: fingerprint of the SVG with kinetic-type ids normalised (normaliseKtIds)
 *                             px:   fingerprint of the RGBA pixels resvg draws from that SVG
 *   W0 (46 golden + every 10th frame)   px: fingerprint of the RGBA pixels after compositing, type, captions
 *
 *   node --expose-gc --import tsx src/golden-evidence.ts --capture-v2               (once, on the unchanged engine)
 *   node --expose-gc --import tsx src/golden-evidence.ts --raster-v2 --film <b>          (pixels, one film per process)
 *   node --expose-gc --import tsx src/golden-evidence.ts --capture-w0 --from a --to b   (W0 slices, same)
 *   node --expose-gc --import tsx src/golden-evidence.ts --check                    (complete and consistent)
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { FilmPlan } from "./contract.js";
import { frameAt } from "./compose.js";
import { prepare } from "./film.js";
import { BENCH, loadW0, readGolden } from "./golden.js";
import { normaliseKtIds } from "./golden-ids.js";
import { rasterize } from "./render.js";
import { FPS } from "./style.js";
import { finalFrame } from "./w0/frame.js";
import { Script } from "@erkasa/contracts";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const EVIDENCE = join(ROOT, "film", "golden", "golden-evidence.json");
const SVG_DIR = join(tmpdir(), "erkasa-golden-evidence-svg");
const sha = (data: string | Uint8Array): string =>
  createHash("sha256").update(data).digest("hex").slice(0, 16);

export interface V2Evidence {
  text: string;
  norm: string;
  px: string;
}
export interface Evidence {
  capturedAt: string;
  v2: Record<string, Record<string, V2Evidence>>;
  /** W0: pixel fingerprints by frame index (golden times are T = k/30 with k = 30·T). */
  w0: Record<string, string>;
}

export const W0_FRAMES = (duration: number): number[] => {
  const n = Math.round(duration * FPS);
  const golden = Array.from({ length: Math.ceil(duration) }, (_, s) => s * FPS);
  const tenth = Array.from({ length: Math.ceil(n / 10) }, (_, k) => k * 10);
  return [...new Set([...golden, ...tenth])].filter((k) => k < n).sort((a, b) => a - b);
};

/** The v2 part: 405 golden frames, SVG text, normalised SVG and pixels. */
export function captureV2(films: string[] = BENCH): Evidence["v2"] {
  const golden = readGolden();
  const v2: Evidence["v2"] = {};
  for (const b of films) {
    const plan = FilmPlan.parse(JSON.parse(readFileSync(join(ROOT, `film/plans/${b}.film.json`), "utf8")));
    const s0 = Script.parse(
      JSON.parse(readFileSync(join(ROOT, `benchmark/scripts/${b}.script.json`), "utf8")),
    );
    const { composed } = prepare({ script: s0, plan });
    const g: Record<string, V2Evidence> = {};
    for (const T of Object.keys(golden[`v2/${b}`] ?? {})) {
      const t = Number(T);
      const i = Math.max(
        0,
        composed.shots.findIndex((s) => t >= s.start && t < s.end),
      );
      const s = composed.shots[i];
      if (!s) throw new Error(`${b} @ ${T}: no shot`);
      const svg = frameAt(composed, i, Math.round((t - s.start) * FPS));
      const text = sha(svg);
      if (text !== golden[`v2/${b}`]?.[T])
        throw new Error(`${b} @ ${T}: the engine no longer matches golden.json`);
      // resvg keeps native memory between frames: the pixels are taken in separate processes (rasterV2)
      mkdirSync(join(SVG_DIR, b), { recursive: true });
      writeFileSync(join(SVG_DIR, b, `${T}.svg`), svg);
      g[T] = { text, norm: sha(normaliseKtIds(svg)), px: "" };
    }
    v2[`v2/${b}`] = g;
  }
  return v2;
}

/** Pixels of one film's captured SVGs (one process per film keeps resvg's memory bounded). */
export function rasterV2(e: Evidence, film: string): void {
  const g = e.v2[`v2/${film}`];
  if (!g) throw new Error(`${film}: capture the SVGs first`);
  for (const T of Object.keys(g)) {
    const svg = readFileSync(join(SVG_DIR, film, `${T}.svg`), "utf8");
    if (sha(svg) !== g[T]?.text) throw new Error(`${film} @ ${T}: captured SVG changed`);
    (g[T] as V2Evidence).px = sha(rasterize(svg));
  }
}

/** A slice of the W0 part (the W0 compositor holds memory per frame, so it is captured in separate processes). */
export async function captureW0(from: number, to: number): Promise<Record<string, string>> {
  const P = loadW0();
  const w0: Record<string, string> = {};
  for (const k of W0_FRAMES(P.duration).slice(from, to)) {
    const T = k / FPS;
    const i = Math.max(
      0,
      P.shots.findIndex((s) => T >= s.start && T < s.end),
    );
    const s = P.shots[i];
    if (!s) continue;
    w0[String(k)] = sha(await finalFrame(P, i, T - s.start));
    (globalThis as { gc?: () => void }).gc?.();
  }
  return w0;
}

/** Checks a complete capture against golden.json (the W0 golden frames must be today's pixels). */
export function checkAgainstGolden(e: Evidence): void {
  const golden = readGolden();
  for (const [T, h] of Object.entries(golden["w0/b1-why-we-stay"] ?? {}))
    if (e.w0[String(Math.round(Number(T) * FPS))] !== h)
      throw new Error(`W0 @ ${T}: the engine no longer matches golden.json`);
  for (const [film, frames] of Object.entries(golden))
    if (film.startsWith("v2/"))
      for (const [T, h] of Object.entries(frames))
        if (e.v2[film]?.[T]?.text !== h || !e.v2[film]?.[T]?.px)
          throw new Error(`${film} @ ${T}: missing or different`);
}

export const readEvidence = (): Evidence => JSON.parse(readFileSync(EVIDENCE, "utf8")) as Evidence;

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k: string): string | undefined => {
    const i = process.argv.indexOf(k);
    return i < 0 ? undefined : process.argv[i + 1];
  };
  const load = (): Evidence =>
    existsSync(EVIDENCE)
      ? readEvidence()
      : { capturedAt: process.env["EVIDENCE_COMMIT"] ?? "unknown", v2: {}, w0: {} };
  if (process.argv.includes("--capture-v2")) {
    const e = load();
    Object.assign(e.v2, captureV2(arg("--film") ? [arg("--film") as string] : BENCH));
    writeFileSync(EVIDENCE, `${JSON.stringify(e, null, 1)}\n`);
    console.info(`evidence: ${Object.values(e.v2).reduce((a, g) => a + Object.keys(g).length, 0)} v2 frames`);
  } else if (process.argv.includes("--raster-v2")) {
    const e = load();
    rasterV2(e, arg("--film") as string);
    writeFileSync(EVIDENCE, `${JSON.stringify(e, null, 1)}\n`);
    console.info(`evidence: pixels of ${arg("--film")}`);
  } else if (process.argv.includes("--capture-w0")) {
    const e = load();
    Object.assign(e.w0, await captureW0(Number(arg("--from")), Number(arg("--to"))));
    writeFileSync(EVIDENCE, `${JSON.stringify(e, null, 1)}\n`);
    console.info(`evidence: ${Object.keys(e.w0).length} W0 frames so far`);
  } else if (process.argv.includes("--check")) {
    const e = readEvidence();
    checkAgainstGolden(e);
    console.info(`evidence: consistent with golden.json (${Object.keys(e.w0).length} W0 frames)`);
  }
}
