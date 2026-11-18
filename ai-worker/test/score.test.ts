/**
 * E1.6 subphase 4a end to end: a v2 film rendered through the package with its score designed from the audio
 * catalog (here the test library: the real catalog's entries over generated tones, see test-library.ts).
 *
 *   positive: music segments and effects from the catalog in the package, with licence and source; the gate
 *             passes; the MP4 has the package's duration and an audio stream; the same run renders the same bytes
 *   negative: no usable library, or every music file changed after import → AUDIO_LIBRARY_MISSING, no video, no
 *             synthetic bed; a changed file is left out of the score; an unknown music source is refused
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AudioPlan, AssetManifest, RenderPackage } from "@erkasa/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FILM_FILES } from "../src/film-steps.js";
import { PACKAGE_FILES, musicSourceOf } from "../src/package-steps.js";
import { SCORE_FILES } from "../src/score.js";
import { handleCommand } from "../src/worker.js";
import { RUN, cmd, copyRun, deps, makeRun, probe } from "./e2e-fixture.js";
import { testLibrary, useTestLibrary } from "./test-library.js";

const noop = (): void => undefined;
const sha = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");
let restore: () => void = noop;
let voiced = "";

beforeAll(async () => {
  restore = useTestLibrary();
  voiced = await makeRun();
}, 600_000);
afterAll(() => restore());

async function renderLibrary(base: string): Promise<{ dir: string; status: string; error?: unknown }> {
  const storage = copyRun(base);
  const r = await handleCommand(cmd("render.finalize", "render", { music: true }), deps(storage), noop);
  return { dir: join(storage, RUN), status: r.status, error: r.error };
}

describe("a film scored from the catalog", () => {
  let dir = "";
  let pkg: RenderPackage;
  let manifest: AssetManifest;
  beforeAll(async () => {
    const r = await renderLibrary(voiced);
    expect(r.status, JSON.stringify(r.error)).toBe("SUCCEEDED");
    dir = r.dir;
    pkg = RenderPackage.parse(JSON.parse(readFileSync(join(dir, PACKAGE_FILES.render), "utf8")));
    manifest = AssetManifest.parse(
      JSON.parse(readFileSync(join(dir, PACKAGE_FILES.root, pkg.assetManifest.uri), "utf8")),
    );
  }, 600_000);

  it("the package holds the designed score: music segments and effects from catalog files, no synthetic bed", () => {
    const plan = AudioPlan.parse(JSON.parse(readFileSync(join(dir, SCORE_FILES.plan), "utf8")));
    const music = pkg.audio.filter((c) => c.role === "music");
    const sfx = pkg.audio.filter((c) => c.role === "sfx");
    expect(music.length).toBeGreaterThanOrEqual(1);
    expect(music.length).toBe(plan.music.length);
    expect(sfx.length).toBe(plan.sfx.length);
    expect(manifest.assets.some((a) => a.id === "music_bed")).toBe(false);
    // each music clip is its plan segment: file from the catalog entry, trim = offset, start in whole ms, fades
    music.forEach((c, k) => {
      const m = plan.music[k] as AudioPlan["music"][number];
      expect(c.asset).toBe(`lib_${m.assetId}@1`);
      expect(c.start).toBe(Math.round(m.startSec * 1000) / 1000);
      expect(c.trim).toBeCloseTo(m.offsetSec, 3);
      expect(c.gainDb).toBe(m.gainDb);
      expect(c.fadeIn + c.fadeOut).toBeLessThanOrEqual(c.duration + 1e-6);
    });
    // the mix: v1's duck, limited to the plan's depth; the plan's loudness
    expect(pkg.mix.duckMusicDb).toBe(plan.ducking.amountDb);
    expect(pkg.mix.ducking).toMatchObject({ threshold: 0.015, ratio: 20, attackMs: plan.ducking.attackMs });
    expect(pkg.mix.loudness).toMatchObject({ integratedLufs: plan.loudness.targetLufs, rangeLu: 11 });
    expect(readFileSync(join(dir, SCORE_FILES.notes), "utf8")).toMatch(/^music /m);
  });

  it("every catalog file in the manifest carries its licence and names its catalog entry and source", () => {
    const lib = manifest.assets.filter((a) => a.id.startsWith("lib_"));
    expect(lib.length).toBeGreaterThanOrEqual(1);
    for (const a of lib) {
      expect(a.kind).toBe("audio");
      expect(a.license).toBe("LicenseRef-Pixabay-Content-License");
      expect(a.provenance).toMatchObject({ origin: "kit", by: `audio catalog ${a.id.slice(4)}` });
      expect(a.approval.note).toMatch(/^Pixabay Content License, checked .*: https:\/\/pixabay\.com\//);
    }
  });

  it("the gate passed; the MP4 has the package's duration and an AAC stream", () => {
    const gate = JSON.parse(readFileSync(join(dir, PACKAGE_FILES.gate), "utf8")) as { ok: boolean };
    expect(gate.ok).toBe(true);
    const p = probe(join(dir, FILM_FILES.video));
    expect(p.streams.find((s) => s["codec_type"] === "audio")?.["codec_name"]).toBe("aac");
    expect(Math.abs(Number(p.format.duration) - pkg.output.duration)).toBeLessThan(0.05);
  });

  it("the same run renders the same score and the same MP4, byte for byte", async () => {
    const again = await renderLibrary(voiced);
    expect(again.status).toBe("SUCCEEDED");
    for (const f of [PACKAGE_FILES.render, SCORE_FILES.plan, FILM_FILES.video])
      expect(sha(readFileSync(join(again.dir, f))), f).toBe(sha(readFileSync(join(dir, f))));
  }, 600_000);
});

describe("no placeholder for commercial output", () => {
  const withLibrary = async (
    prepare: (dir: string, catalog: string) => void,
  ): Promise<{
    status: string;
    error: { code?: string; retryable?: boolean } | undefined;
    dir: string;
  }> => {
    const lib = testLibrary();
    const copy = mkdtempSync(join(tmpdir(), "erkasa-lib-copy-"));
    cpSync(lib.dir, join(copy, "files"), { recursive: true });
    cpSync(lib.catalog, join(copy, "catalog.json"));
    prepare(join(copy, "files"), join(copy, "catalog.json"));
    const saved = [process.env["ERKASA_AUDIO_CATALOG"], process.env["ERKASA_AUDIO_DIR"]];
    process.env["ERKASA_AUDIO_CATALOG"] = join(copy, "catalog.json");
    process.env["ERKASA_AUDIO_DIR"] = join(copy, "files");
    try {
      const r = await renderLibrary(voiced);
      return { status: r.status, error: r.error as { code?: string; retryable?: boolean }, dir: r.dir };
    } finally {
      process.env["ERKASA_AUDIO_CATALOG"] = saved[0];
      process.env["ERKASA_AUDIO_DIR"] = saved[1];
    }
  };
  const musicFiles = (catalog: string): string[] =>
    (JSON.parse(readFileSync(catalog, "utf8")) as { entries: Array<{ kind: string; file: string }> }).entries
      .filter((e) => e.kind === "music")
      .map((e) => e.file);

  it("an empty library folder: AUDIO_LIBRARY_MISSING, not retryable, no video, no package", async () => {
    const r = await withLibrary((dir) => {
      process.env["ERKASA_AUDIO_DIR"] = dir;
      spawnSync("rm", ["-rf", dir]);
    });
    expect(r.status).toBe("FAILED");
    expect(r.error).toMatchObject({ code: "AUDIO_LIBRARY_MISSING", retryable: false });
    expect(existsSync(join(r.dir, FILM_FILES.video))).toBe(false);
    expect(existsSync(join(r.dir, PACKAGE_FILES.render))).toBe(false);
  }, 600_000);

  it("every music file changed after import (sha256): AUDIO_LIBRARY_MISSING, never the synthetic bed", async () => {
    const r = await withLibrary((dir, catalog) => {
      for (const f of musicFiles(catalog)) writeFileSync(join(dir, f), "not the imported file");
    });
    expect(r.status).toBe("FAILED");
    expect(r.error).toMatchObject({ code: "AUDIO_LIBRARY_MISSING", retryable: false });
    expect(existsSync(join(r.dir, FILM_FILES.video))).toBe(false);
  }, 600_000);

  it("one changed music file is left out of the score (and said so in the notes)", async () => {
    let changed = "";
    const r = await withLibrary((dir, catalog) => {
      const plan = AudioPlan.parse(
        JSON.parse(readFileSync(join(voicedScoreDir(), SCORE_FILES.plan), "utf8")),
      );
      changed = (plan.music[0] as AudioPlan["music"][number]).assetId;
      const entry = (
        JSON.parse(readFileSync(catalog, "utf8")) as { entries: Array<{ id: string; file: string }> }
      ).entries.find((e) => e.id === changed);
      writeFileSync(join(dir, entry?.file ?? ""), "changed");
    });
    expect(r.status).toBe("SUCCEEDED");
    const plan = AudioPlan.parse(JSON.parse(readFileSync(join(r.dir, SCORE_FILES.plan), "utf8")));
    expect(plan.music.map((m) => m.assetId)).not.toContain(changed);
    expect(readFileSync(join(r.dir, SCORE_FILES.notes), "utf8")).toContain(
      `left out ${changed}: file changed`,
    );
  }, 600_000);

  it("an unknown music source is refused; synthetic is only ever chosen by name", () => {
    expect(musicSourceOf(undefined)).toBe("library");
    expect(musicSourceOf("synthetic")).toBe("synthetic");
    expect(() => musicSourceOf("placeholder")).toThrow(/unknown music source 'placeholder'/);
  });
});

/** The first scored render's folder (a fresh one, rendered once for the left-out test). */
let scored = "";
function voicedScoreDir(): string {
  if (!scored) throw new Error("render first");
  return scored;
}
beforeAll(async () => {
  const r = await renderLibrary(voiced);
  scored = r.dir;
}, 600_000);
