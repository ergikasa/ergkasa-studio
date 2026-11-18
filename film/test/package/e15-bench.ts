/**
 * E1.5 evidence (not part of pnpm test; minutes): B1–B5 rendered by the legacy pipeline and by the package
 * pipeline, with the v2 sound bed and no voice (no run with a real voice exists in the repository), compared on
 * the decoded MP4s: every frame (framemd5) and the PCM. Usage: node --import tsx film/test/package/e15-bench.ts [film…]
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Script } from "@erkasa/contracts";
import { serialise, stageV2, withCameraBounds, writeBedV2 } from "@erkasa/stager";
import { FilmPlan } from "../../src/contract.js";
import { makeFilm } from "../../src/film.js";
import { BENCH } from "../../src/golden.js";
import { encodePackage } from "../../src/package/encode.js";
import { ROOT } from "./helpers.js";

const frames = (f: string): string[] =>
  spawnSync("ffmpeg", ["-v", "error", "-i", f, "-map", "0:v", "-f", "framemd5", "-"], {
    encoding: "utf8",
    maxBuffer: 1 << 28,
  })
    .stdout.split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(",").map((x) => x.trim())[5] as string);
const pcm = (f: string): Buffer =>
  spawnSync("ffmpeg", ["-v", "error", "-i", f, "-map", "0:a", "-f", "f32le", "-"], { maxBuffer: 1 << 30 })
    .stdout;
/** The first float32 sample where two PCM streams differ (-1: identical, same length). */
function firstDiff(a: Buffer, b: Buffer): number {
  const n = Math.min(a.length, b.length) / 4;
  for (let i = 0; i < n; i++) if (a.readFloatLE(i * 4) !== b.readFloatLE(i * 4)) return i;
  return a.length === b.length ? -1 : n;
}

const names = process.argv.slice(2).length ? process.argv.slice(2) : BENCH;
let failed = 0;
for (const name of names) {
  const plan = FilmPlan.parse(JSON.parse(readFileSync(join(ROOT, `film/plans/${name}.film.json`), "utf8")));
  const script = Script.parse(
    JSON.parse(readFileSync(join(ROOT, `benchmark/scripts/${name}.script.json`), "utf8")),
  );
  const dir = mkdtempSync(join(tmpdir(), `e15-${name}-`));
  const t0 = Date.now();
  const legacy = join(dir, "legacy.mp4");
  await makeFilm({ plan, script }, { dir: join(dir, "legacy-work"), out: legacy, workers: 4, music: true });
  const t1 = Date.now();
  const root = join(dir, "package");
  mkdirSync(join(root, "audio"), { recursive: true });
  writeBedV2(join(root, "audio/bed.wav"), plan, script);
  const bytes = readFileSync(join(root, "audio/bed.wav"));
  const staged = withCameraBounds(
    stageV2(name, plan, script, {
      audio: {
        voice: [],
        music: {
          uri: "audio/bed.wav",
          bytes,
          provenance: { origin: "generator", by: "film/src/sound.ts writeBed" },
          approval: { status: "approved", by: "e15-bench" },
        },
      },
    }),
  );
  const w = serialise(staged);
  writeFileSync(join(root, staged.pkg.assetManifest.uri), w.manifest);
  const out = join(dir, "package.mp4");
  const r = await encodePackage(
    { package: w.pkg, root },
    { out, workDir: join(dir, "package-work"), workers: 4 },
  );
  const t2 = Date.now();
  if (!r.ok) throw new Error(`${name}: refused ${JSON.stringify(r.errors.slice(0, 3))}`);
  const a = frames(legacy);
  const b = frames(out);
  const same = a.length === b.length && a.every((h, i) => h === b[i]);
  const pa = pcm(legacy);
  const pb = pcm(out);
  const d = firstDiff(pa, pb);
  const sec = (bytes: number): string => (bytes / 4 / 2 / 48000).toFixed(4);
  // PCM: identical, or identical up to where the shorter stream ends (then the lengths, in seconds)
  const pcmSame = d === -1;
  const pcmPrefix = d === Math.min(pa.length, pb.length) / 4;
  if (!same || !(pcmSame || pcmPrefix)) failed++;
  console.info(
    `${name}: frames legacy ${a.length} package ${b.length} identical ${same ? "yes" : `no (first ${a.findIndex((h, i) => h !== b[i])})`}; ` +
      `PCM ${pcmSame ? "identical" : pcmPrefix ? `identical over the shorter stream (legacy ${sec(pa.length)} s, package ${sec(pb.length)} s)` : `DIFFERENT from ${sec(d * 4)} s`}; ` +
      `legacy ${((t1 - t0) / 1000).toFixed(1)} s, package ${((t2 - t1) / 1000).toFixed(1)} s`,
  );
}
console.info(
  failed
    ? `${failed} film(s) differ`
    : "all films: every frame identical; PCM identical, or identical over the shorter stream as each line says",
);
process.exit(failed ? 1 : 0);
