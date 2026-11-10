import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AudioPlan } from "@erkasa/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { parseMixSet, parseVariants } from "../src/audio-tools.js";
import { Catalog } from "../src/catalog.js";
import { repoRoot } from "../src/env.js";
import { compileRun, loadPlan, stepSoundtrack } from "../src/steps.js";

const catalog = new Catalog(join(repoRoot(), "assets"));
const DEMO = join(repoRoot(), "engine-worker", "demo");

function demoRun(): string {
  const dir = mkdtempSync(join(tmpdir(), "erkasa-run-"));
  copyFileSync(join(DEMO, "procrastination-v2.video-plan.json"), join(dir, "video-plan.json"));
  copyFileSync(join(DEMO, "procrastination-v2.script.json"), join(dir, "script.json"));
  return dir;
}

const saved = process.env["ERKASA_AUDIO_CATALOG"];
afterEach(() => {
  if (saved === undefined) delete process.env["ERKASA_AUDIO_CATALOG"];
  else process.env["ERKASA_AUDIO_CATALOG"] = saved;
});

describe("soundtrack step", () => {
  it("says why there is no designed soundtrack while nothing is imported", () => {
    const dir = demoRun();
    const compiled = compileRun(dir, loadPlan(dir), catalog);
    if (!compiled.timeline) throw new Error("demo plan must compile");
    const res = stepSoundtrack(dir, { ...compiled, timeline: compiled.timeline });
    expect("missing" in res && res.missing).toMatch(/audio library empty/);
  });

  it("designs from an imported library and writes audio-plan.json with its notes", () => {
    const dir = demoRun();
    const lib = mkdtempSync(join(tmpdir(), "erkasa-lib-"));
    const cat = JSON.parse(readFileSync(join(repoRoot(), "audio", "catalog.json"), "utf8")) as {
      entries: Array<Record<string, unknown>>;
    };
    // mark two entries imported, pointing at files that exist (contents are irrelevant to the design)
    const imported = {
      sha256: "e".repeat(64),
      durationSec: 120,
      loudnessLufs: -18,
      truePeakDb: -1,
      importedAt: "2026-11-10",
    };
    for (const e of cat.entries.filter((x) => x["id"] === "m_explain_calm" || x["id"] === "sfx_pop_clean")) {
      e["status"] = "imported";
      e["imported"] = imported;
    }
    const file = join(lib, "catalog.json");
    writeFileSync(file, JSON.stringify(cat));
    process.env["ERKASA_AUDIO_CATALOG"] = file;
    process.env["ERKASA_AUDIO_DIR"] = lib;
    mkdirSync(join(lib, "music"));
    mkdirSync(join(lib, "sfx"));
    writeFileSync(join(lib, "music", "m_explain_calm.mp3"), "x");
    writeFileSync(join(lib, "sfx", "sfx_pop_clean.mp3"), "x");
    try {
      const compiled = compileRun(dir, loadPlan(dir), catalog);
      if (!compiled.timeline) throw new Error("demo plan must compile");
      const res = stepSoundtrack(dir, { ...compiled, timeline: compiled.timeline });
      if ("missing" in res) throw new Error(res.missing);
      const plan = AudioPlan.parse(JSON.parse(readFileSync(join(dir, "audio-plan.json"), "utf8")));
      expect(plan.music.length).toBeGreaterThan(0);
      expect(plan.music.every((m) => m.assetId === "m_explain_calm")).toBe(true);
      expect(readFileSync(join(dir, "audio-notes.txt"), "utf8")).toMatch(/music /);
      expect(res.resolve("m_explain_calm")).toBe(join(lib, "music", "m_explain_calm.mp3"));
      expect(() => res.resolve("m_unknown")).toThrow(/not in the library/);
    } finally {
      delete process.env["ERKASA_AUDIO_DIR"];
    }
  });
});

describe("mix settings from the command line", () => {
  it("parses settings and variants, and refuses unknown keys", () => {
    expect(parseMixSet("musicUnderVoiceDb=16, duckDb=9")).toEqual({ musicUnderVoiceDb: 16, duckDb: 9 });
    expect(parseVariants("duckDb=5,9").map((v) => v.label)).toEqual(["duckDb-5", "duckDb-9"]);
    expect(() => parseMixSet("volume=3")).toThrow(/bad mix setting/);
    expect(() => parseMixSet("duckDb=loud")).toThrow(/bad mix setting/);
  });
});
