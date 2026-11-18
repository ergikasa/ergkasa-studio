/**
 * A stand-in for the licensed audio library in tests (the Pixabay files are not in the repository nor in CI:
 * ADR 0010). It keeps the real catalog's entries (ids, roles, sections, mix settings, licences, sources) and
 * replaces each file with a generated tone of the recorded length, re-hashed. It proves the plumbing (catalog →
 * designer → package → engine), not how the real music sounds: that is the PO's listening test.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { AudioCatalog } from "@erkasa/contracts";
import { repoRoot } from "../src/env.js";

const DIR = join(tmpdir(), "erkasa-test-audio-library-v1");

/** Builds the library once per machine (cached in the temp folder); returns the catalog and the files' folder. */
export function testLibrary(): { catalog: string; dir: string } {
  const catalogFile = join(DIR, "catalog.json");
  if (existsSync(catalogFile)) return { catalog: catalogFile, dir: join(DIR, "files") };
  // built aside and renamed into place: test files running in parallel never see half a library
  const build = `${DIR}.build-${process.pid}-${Math.random().toString(36).slice(2)}`;
  const real = AudioCatalog.parse(
    JSON.parse(readFileSync(join(repoRoot(), "audio", "catalog.json"), "utf8")),
  );
  const entries = real.entries.map((e, k) => {
    if (!e.imported) return e;
    const file = join(build, "files", e.file);
    mkdirSync(dirname(file), { recursive: true });
    // music: a soft chord per track; effects: a short tone; every file different
    const hz = e.kind === "music" ? 110 + k * 7 : 600 + k * 11;
    const sec = Math.max(0.2, e.imported.durationSec);
    const r = spawnSync("ffmpeg", [
      ...["-y", "-loglevel", "error", "-f", "lavfi"],
      ...["-i", `sine=frequency=${hz}:sample_rate=44100:duration=${sec}`],
      ...["-af", "volume=0.25", "-ac", "2", "-c:a", "libmp3lame", "-b:a", "128k", file],
    ]);
    if (r.status !== 0) throw new Error(`test library: ${r.stderr.toString()}`);
    const sha256 = createHash("sha256").update(readFileSync(file)).digest("hex");
    return { ...e, title: `TEST TONE for ${e.id}`, imported: { ...e.imported, sha256 } };
  });
  writeFileSync(join(build, "catalog.json"), `${JSON.stringify({ ...real, entries }, null, 2)}\n`);
  try {
    renameSync(build, DIR);
  } catch {
    rmSync(build, { recursive: true, force: true }); // another test file finished first: use its library
  }
  return { catalog: catalogFile, dir: join(DIR, "files") };
}

/** Points the worker at the test library (ERKASA_AUDIO_CATALOG, ERKASA_AUDIO_DIR); returns a restore function. */
export function useTestLibrary(): () => void {
  const saved = { c: process.env["ERKASA_AUDIO_CATALOG"], d: process.env["ERKASA_AUDIO_DIR"] };
  const lib = testLibrary();
  process.env["ERKASA_AUDIO_CATALOG"] = lib.catalog;
  process.env["ERKASA_AUDIO_DIR"] = lib.dir;
  return () => {
    for (const [k, v] of [
      ["ERKASA_AUDIO_CATALOG", saved.c],
      ["ERKASA_AUDIO_DIR", saved.d],
    ] as const)
      if (v === undefined) Reflect.deleteProperty(process.env, k);
      else process.env[k] = v;
  };
}
