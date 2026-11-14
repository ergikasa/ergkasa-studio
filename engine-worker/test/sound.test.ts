import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AudioCatalog,
  AudioPlan,
  MixSettings,
  type AudioCatalogEntry,
  type RenderTimeline,
} from "@erkasa/contracts";
import { describe, expect, it } from "vitest";
import { loadInput } from "../src/render.js";
import {
  EVENT_FALLBACKS,
  designSoundtrack,
  mergeSpans,
  roleFor,
  stateEvents,
  type SceneStory,
} from "../src/sound/design.js";
import { applyListeningNotes, importLibrary, parseTime, type Measurer } from "../src/sound/importer.js";
import { openLibrary, type AudioLibrary, type LibraryItem } from "../src/sound/library.js";
import { autoSections, measureLoudness } from "../src/sound/measure.js";
import { mixGraph, renderMix } from "../src/sound/mix.js";

const HERE = fileURLToPath(new URL("..", import.meta.url));
const REPO = join(HERE, "..");
const MIX = MixSettings.parse({});
const LICENSE = {
  name: "Pixabay Content License",
  url: "https://pixabay.com/service/license-summary/",
} as const;
const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;

function entry(id: string, kind: "music" | "sfx", extra: Partial<AudioCatalogEntry> = {}): AudioCatalogEntry {
  return {
    id,
    kind,
    title: id,
    author: "Universfield",
    sourceUrl: `https://pixabay.com/${kind === "music" ? "music" : "sound-effects"}/${id}/`,
    license: LICENSE,
    contentIdRegistered: false,
    aiGenerated: false,
    checkedAt: "2026-11-10",
    file: `${kind}/${id}.mp3`,
    status: "pending",
    gainDb: 0,
    ...extra,
  };
}

function item(e: AudioCatalogEntry, durationSec: number, loudnessLufs: number): LibraryItem {
  return {
    ...e,
    status: "imported",
    imported: { sha256: "a".repeat(64), durationSec, loudnessLufs, truePeakDb: -1, importedAt: "2026-11-10" },
    path: `/lib/${e.file}`,
  };
}

/** A small library shaped like the real one (roles and events from audio/catalog.json). */
function fakeLibrary(): AudioLibrary {
  const real = AudioCatalog.parse(JSON.parse(readFileSync(join(REPO, "audio", "catalog.json"), "utf8")));
  return {
    mix: MIX,
    music: real.entries
      .filter((e) => e.kind === "music")
      .map((e, i) => item(e, 100 + i * 7, -17 - (i % 3)))
      .map((m) => ({
        ...m,
        sections: [{ name: "peak" as const, start: 40, end: 60, source: "listened" as const }],
      })),
    sfx: real.entries
      .filter((e) => e.kind === "sfx")
      .map((e) => item(e, e.id.includes("riser") ? 6 : 1.2, -22)),
    skipped: [],
  };
}

function v2(): { timeline: RenderTimeline; story: SceneStory[] } {
  const res = loadInput(join(HERE, "demo", "procrastination-v2.video-plan.json"), join(REPO, "assets"));
  const script = JSON.parse(readFileSync(join(HERE, "demo", "procrastination-v2.script.json"), "utf8")) as {
    scenes: SceneStory[];
  };
  return { timeline: res.timeline as RenderTimeline, story: script.scenes };
}

describe("audio catalog", () => {
  it("lists every file of the H1 download list with its origin and rights", () => {
    const cat = AudioCatalog.parse(JSON.parse(readFileSync(join(REPO, "audio", "catalog.json"), "utf8")));
    expect(cat.entries.filter((e) => e.kind === "music")).toHaveLength(11);
    expect(cat.entries.filter((e) => e.kind === "sfx")).toHaveLength(30);
    for (const e of cat.entries) {
      expect(e.contentIdRegistered || e.aiGenerated).toBe(false);
      expect(e.sourceUrl).toMatch(/^https:\/\/pixabay\.com\//);
    }
  });

  it("only offers imported files that exist and match their hash", () => {
    const dir = mkdtempSync(join(tmpdir(), "erkasa-lib-"));
    mkdirSync(join(dir, "music"));
    writeFileSync(join(dir, "music", "m_a.mp3"), "x");
    const imported = {
      sha256: "b".repeat(64),
      durationSec: 90,
      loudnessLufs: -18,
      truePeakDb: -1,
      importedAt: "2026-11-10",
    };
    const cat = AudioCatalog.parse({
      schema: "erkasa.audio-catalog/1",
      mix: {},
      entries: [
        entry("m_a", "music", { roles: ["hook"], status: "imported", imported }),
        entry("m_b", "music", { roles: ["hook"], status: "imported", imported }),
        entry("m_c", "music", { roles: ["hook"] }),
      ],
    });
    const lib = openLibrary(cat, { dir });
    expect(lib.music.map((m) => m.id)).toEqual(["m_a"]);
    expect(lib.skipped.map((s) => s.id)).toEqual(["m_b", "m_c"]);
    const strict = openLibrary(cat, { dir, verify: () => "c".repeat(64) });
    expect(strict.music).toHaveLength(0);
    expect(strict.skipped[0]?.reason).toMatch(/sha256/);
  });
});

describe("import", () => {
  const measurer: Measurer = {
    sha256: () => "d".repeat(64),
    duration: () => 96.4,
    loudness: () => ({
      integrated: -17.2,
      truePeakDb: -1.1,
      curve: Array.from({ length: 964 }, (_, i) => ({
        t: i / 10,
        lufs: i < 150 ? -30 : i < 450 ? -20 : i < 650 ? -14 : -28,
      })),
    }),
  };

  it("measures files, proposes sections, keeps listened ones and rejects flagged sources", () => {
    const dir = mkdtempSync(join(tmpdir(), "erkasa-imp-"));
    mkdirSync(join(dir, "music"));
    for (const id of ["m_a", "m_flag"]) writeFileSync(join(dir, "music", `${id}.mp3`), "x");
    const cat = AudioCatalog.parse({
      schema: "erkasa.audio-catalog/1",
      mix: {},
      entries: [
        entry("m_a", "music", {
          roles: ["turn"],
          sections: [{ name: "intro", start: 0, end: 9, source: "listened" }],
        }),
        entry("m_flag", "music", { roles: ["turn"], aiGenerated: true }),
        entry("m_missing", "music", { roles: ["turn"] }),
      ],
    });
    const res = importLibrary(cat, dir, { measurer, today: "2026-11-10" });
    expect(res.lines.map((l) => l.result)).toEqual(["imported", "rejected", "missing"]);
    const a = res.catalog.entries[0];
    expect(a?.status).toBe("imported");
    expect(a?.imported?.loudnessLufs).toBe(-17.2);
    expect(a?.sections?.find((s) => s.name === "intro")).toEqual({
      name: "intro",
      start: 0,
      end: 9,
      source: "listened",
    });
    const peak = a?.sections?.find((s) => s.name === "peak");
    expect(peak?.source).toBe("auto");
    expect(peak?.start).toBeGreaterThan(40);
    expect(peak?.start).toBeLessThan(50);
    expect(res.catalog.entries[1]?.status).toBe("rejected");
    expect(() => AudioCatalog.parse(res.catalog)).not.toThrow();
  });

  it("applies listening notes: sections, gain, rejection and readable errors", () => {
    const imported = {
      sha256: "d".repeat(64),
      durationSec: 97,
      loudnessLufs: -17,
      truePeakDb: -1,
      importedAt: "2026-11-10",
    };
    const cat = AudioCatalog.parse({
      schema: "erkasa.audio-catalog/1",
      mix: {},
      entries: [
        entry("m_turn_strings", "music", {
          roles: ["turn"],
          status: "imported",
          imported,
          sections: [{ name: "peak", start: 30, end: 50, source: "auto" }],
        }),
        entry("sfx_pop_clean", "sfx", {
          category: "ui",
          events: ["text_in"],
          status: "imported",
          imported: { ...imported, durationSec: 1 },
        }),
        entry("sfx_heart_tense", "sfx", {
          category: "body",
          events: ["tension_peak"],
          status: "imported",
          imported: { ...imported, durationSec: 5 },
        }),
      ],
    });
    const notes = [
      "# my notes",
      'm_turn_strings | intro 0:00–0:12 | build 0:12-0:40 | peak 0:40-1:05 | outro 1:05-1:37 | "strings enter at 0:12"',
      "sfx_pop_clean | gain -3",
      'sfx_heart_tense | reject "too dramatic"',
      "m_nope | gain 2",
      "sfx_pop_clean | peak 0:01-0:02",
    ].join("\n");
    const res = applyListeningNotes(cat, notes);
    const m = res.catalog.entries[0];
    expect(m?.sections?.map((s) => `${s.name}:${s.start}-${s.end}:${s.source}`)).toEqual([
      "intro:0-12:listened",
      "build:12-40:listened",
      "peak:40-65:listened",
      "outro:65-97:listened",
    ]);
    expect(m?.notes).toBe("strings enter at 0:12");
    expect(res.catalog.entries[1]?.gainDb).toBe(-3);
    expect(res.catalog.entries[2]?.status).toBe("rejected");
    expect(res.catalog.entries[2]?.rejectedReason).toBe("by ear: too dramatic");
    expect(res.errors).toHaveLength(2);
    expect(res.applied).toBe(3);
    expect(() => AudioCatalog.parse(res.catalog)).not.toThrow();
    expect(parseTime("1:05.5")).toBe(65.5);
    expect(parseTime("abc")).toBeUndefined();
  });

  it("finds the loud part of a track", () => {
    const curve = Array.from({ length: 1200 }, (_, i) => ({
      t: i / 10,
      lufs: i < 200 ? -32 : i < 700 ? -22 : i < 950 ? -15 : -30,
    }));
    const s = autoSections(curve, 120);
    expect(s.map((x) => x.name)).toEqual(["intro", "build", "peak", "outro"]);
    const peak = s.find((x) => x.name === "peak");
    expect(peak?.start).toBeGreaterThanOrEqual(68);
    expect(peak?.start).toBeLessThanOrEqual(73);
  });
});

describe("sound designer", () => {
  it("maps beats to music roles, with sad relate scenes as reflection", () => {
    expect(roleFor({ sceneId: "a", beat: "relate", emotion: "guilty" }, 1, 5)).toBe("reflection");
    expect(roleFor({ sceneId: "a", beat: "relate", emotion: "curious" }, 1, 5)).toBe("relate");
    // editorial beats map onto the music roles
    expect(roleFor({ sceneId: "a", beat: "situation" }, 3, 6)).toBe("tension");
    expect(roleFor({ sceneId: "a", beat: "analysis" }, 4, 6)).toBe("twist");
    expect(roleFor({ sceneId: "a", beat: "conclusion" }, 5, 6)).toBe("resolve");
    expect(roleFor({ sceneId: "a", beat: "problem", emotion: "lonely" }, 1, 6)).toBe("reflection");
    expect(roleFor(undefined, 0, 5)).toBe("hook");
    expect(roleFor(undefined, 4, 5)).toBe("resolve");
  });

  it("merges short music changes so the track never hops", () => {
    const spans = [
      { role: "hook" as const, start: 0, end: 5, scenes: ["s1"] },
      { role: "relate" as const, start: 5, end: 12, scenes: ["s2"] },
      { role: "tension" as const, start: 12, end: 26, scenes: ["s3"] },
      { role: "twist" as const, start: 26, end: 31, scenes: ["s4"] },
      { role: "turn" as const, start: 31, end: 45, scenes: ["s5"] },
    ];
    const out = mergeSpans(spans, MIX);
    for (const s of out)
      expect(s.end - s.start).toBeGreaterThanOrEqual(
        s.role === "twist" || s.role === "turn" ? 5 : MIX.minSegmentSec,
      );
    expect(out.some((s) => s.role === "twist")).toBe(true); // the twist keeps its own music
    expect(out.flatMap((s) => s.scenes)).toEqual(["s1", "s2", "s3", "s4", "s5"]);
  });

  it("scores the v2 story: arc-following music, a breath before the twist, the ending on the last frame", () => {
    const { timeline, story } = v2();
    const voice = timeline.scenes.map((s) => ({
      sceneId: s.sceneId,
      audio: `file://r/voice/${s.sceneId}.mp3`,
      startSec: s.from / 30,
    }));
    const input = { timeline, story, voice, voiceLufs: -18, library: fakeLibrary(), seed: 7 };
    const { plan, notes } = designSoundtrack(input);
    expect(AudioPlan.safeParse(plan).success).toBe(true);
    const music = plan.music;
    expect(music.length).toBeGreaterThanOrEqual(3);
    expect(music.length).toBeLessThanOrEqual(Math.ceil(plan.durationSec / 15) + 1);
    for (let i = 1; i < music.length; i++) expect(music[i]?.assetId).not.toBe(music[i - 1]?.assetId);
    const twistScene = timeline.scenes.find(
      (s) => story.find((x) => x.sceneId === s.sceneId)?.beat === "twist",
    );
    const twist = music.find((m) => m.role === "twist");
    if (twist && twistScene) {
      expect(twist.startSec).toBeGreaterThan(twistScene.from / 30); // silence lands first
      const before = music[music.indexOf(twist) - 1];
      expect(before?.endSec).toBeLessThanOrEqual(twistScene.from / 30);
    }
    const last = music[music.length - 1];
    expect(last?.endSec).toBeCloseTo(plan.durationSec, 2);
    expect(last?.section).toBe("outro");
    // music sits well under the voice: gain = voice - 18 - track loudness (+ role offset)
    for (const m of music) expect(m.gainDb).toBeLessThan(2);

    const sfx = plan.sfx;
    expect(sfx.length).toBeGreaterThan(3);
    expect(sfx.length).toBeLessThanOrEqual(Math.floor(plan.durationSec / MIX.sfxEverySec));
    for (const s of sfx) expect(s.reason.length).toBeGreaterThan(0);
    expect(sfx.filter((s) => s.assetId === "sfx_boom_soft").length).toBeLessThanOrEqual(1);
    expect(sfx.some((s) => s.assetId === "sfx_notif_main" || s.assetId === "sfx_notif_chime")).toBe(true);
    expect(notes.some((n) => n.startsWith("music "))).toBe(true);
    // deterministic
    expect(designSoundtrack(input).plan).toEqual(plan);
  });

  it("keeps effects apart and within budget", () => {
    const { timeline, story } = v2();
    const lib = fakeLibrary();
    const { plan } = designSoundtrack({ timeline, story, voice: [], library: lib });
    const pairs = new Set(["sfx_riser_soft", "sfx_boom_soft", "sfx_riser_dreamy", "sfx_insight_piano"]);
    const times = plan.sfx.filter((s) => !pairs.has(s.assetId)).map((s) => s.atSec);
    for (let i = 1; i < times.length; i++)
      expect((times[i] ?? 0) - (times[i - 1] ?? 0)).toBeGreaterThanOrEqual(MIX.minSfxGapSec - 1e-6);
  });

  it("writes no music when the library is empty", () => {
    const { timeline, story } = v2();
    const { plan, notes } = designSoundtrack({
      timeline,
      story,
      voice: [],
      library: { mix: MIX, music: [], sfx: [], skipped: [] },
    });
    expect(plan.music).toEqual([]);
    expect(plan.sfx).toEqual([]);
    expect(notes.join(" ")).toMatch(/music library empty/);
  });
});

describe("sounds for objects and travelling", () => {
  const kf = (f: number, v: number): { f: number; v: number } => ({ f, v });
  it("hears a screen value change, a lock opening, a group lighting up and a coin flip", () => {
    const events = stateEvents(
      "s01",
      "p",
      {
        "part.v0.opacity": [kf(0, 1), kf(60, 1), kf(69, 0)],
        "part.v1.opacity": [kf(0, 0), kf(60, 0), kf(69, 1)],
        "part.lock_open.opacity": [kf(0, 0), kf(90, 0), kf(96, 1)],
        "part.c1.opacity": [kf(0, 0), kf(120, 0), kf(134, 1)],
        "part.coin.scaleY": [kf(30, 1), kf(40, -1), kf(50, 1)],
      },
      (f) => f / 30,
    );
    expect(events.map((e) => [e.event, e.atSec])).toEqual([
      ["state_change", 2],
      ["lock_unlock", 3],
      ["group_light", 4],
      ["coin_flip", 1],
    ]);
  });

  it("does not count the opening state (frame 0) as a change", () => {
    expect(stateEvents("s01", "p", { "part.v1.opacity": [kf(0, 1)] }, (f) => f)).toEqual([]);
  });

  it("every new event has a fallback to an effect the library already has", () => {
    const real = AudioCatalog.parse(JSON.parse(readFileSync(join(REPO, "audio", "catalog.json"), "utf8")));
    const have = new Set(real.entries.flatMap((e) => e.events ?? []));
    for (const [event, fallbacks] of Object.entries(EVENT_FALLBACKS))
      expect(
        have.has(event) || fallbacks.some((f) => have.has(f) || f in EVENT_FALLBACKS),
        `${event} has no sound to fall back on`,
      ).toBe(true);
  });
});

describe("mixer", () => {
  const plan = AudioPlan.parse(
    JSON.parse(readFileSync(join(REPO, "contracts", "fixtures", "valid", "audio-plan.basic.json"), "utf8")),
  );

  it("builds one graph: voice on top, trimmed and ducked music, placed effects, loudness-normalized", () => {
    const g = mixGraph(plan, (r) => `/f/${r.replace("file://", "")}`, 1);
    expect(g.inputs.filter((x) => x === "-i")).toHaveLength(5);
    expect(g.inputs).toContain("/f/m_tension_ambient");
    expect(g.filter).toContain("atrim=start=21.300:duration=6.600");
    expect(g.filter).toContain("adelay=delays=5800:all=1[m1]");
    expect(g.filter).toContain("mix=0.553"); // 7 dB duck depth
    expect(g.filter).toContain("adelay=delays=900:all=1[x0]");
    expect(g.filter).not.toContain("loudnorm"); // mastered in a second pass
    expect(g.out).toBe("[a]");
  });

  it.skipIf(!hasFfmpeg)("renders a real mix at the target loudness, music lower than the voice", async () => {
    const dir = mkdtempSync(join(tmpdir(), "erkasa-mix-"));
    const tone = (file: string, args: string): void => {
      execFileSync("ffmpeg", [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-f",
        "lavfi",
        "-i",
        args,
        join(dir, file),
      ]);
    };
    // test signals only: a "voice" (noise bursts), a "music" bed and a click
    tone("voice.wav", "anoisesrc=d=8:c=pink:a=0.3,volume='if(lt(mod(t,2),1.2),1,0)':eval=frame");
    tone("music.wav", "sine=f=220:d=20");
    tone("click.wav", "sine=f=1800:d=0.15");
    const p = AudioPlan.parse({
      schema: "erkasa.audio-plan/2",
      durationSec: 8,
      voice: [{ sceneId: "s01", audio: "file://r/voice.wav", startSec: 0 }],
      voiceLufs: measureLoudness(join(dir, "voice.wav")).integrated,
      music: [
        {
          assetId: "m_bed",
          role: "explain",
          startSec: 0,
          endSec: 8,
          offsetSec: 2,
          gainDb: -12,
          fadeInSec: 0.4,
          fadeOutSec: 1,
        },
      ],
      ducking: { amountDb: 7, attackMs: 120, releaseMs: 500 },
      sfx: [{ assetId: "sfx_click", atSec: 3, gainDb: -6, reason: "test" }],
      loudness: { targetLufs: -14, truePeakDb: -1 },
    });
    const files: Record<string, string> = {
      "file://r/voice.wav": "voice.wav",
      m_bed: "music.wav",
      sfx_click: "click.wav",
    };
    const out = join(dir, "mix.wav");
    await renderMix(p, (r) => join(dir, files[r] ?? r), out);
    const l = measureLoudness(out);
    expect(Math.abs(l.integrated - -14)).toBeLessThan(1.5);
    expect(l.truePeakDb).toBeLessThanOrEqual(-0.5);
  });
});
