/**
 * E1.6 subphase 4a: stageScore places what the score's plan says, inside the files and the film, and reports what
 * it had to shorten or leave out. Pure: WAV bytes built here.
 */
import type { AudioPlan } from "@erkasa/contracts";
import { describe, expect, it } from "vitest";
import { ManifestBuilder } from "../src/manifest.js";
import { libraryAssetId, stageScore, type Score, type ScoreFile } from "../src/score.js";

/** A silent 16-bit stereo 48 kHz WAV of `sec` seconds. */
function wav(sec: number): Uint8Array {
  const frames = Math.round(sec * 48000);
  const b = Buffer.alloc(44 + frames * 4);
  b.write("RIFF", 0, "latin1");
  b.writeUInt32LE(36 + frames * 4, 4);
  b.write("WAVEfmt ", 8, "latin1");
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(2, 22);
  b.writeUInt32LE(48000, 24);
  b.writeUInt32LE(48000 * 4, 28);
  b.writeUInt16LE(4, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36, "latin1");
  b.writeUInt32LE(frames * 4, 40);
  return b;
}

const file = (id: string, sec: number): ScoreFile => ({
  uri: `audio/${libraryAssetId(id)}.wav`,
  bytes: wav(sec),
  catalogId: id,
  license: "LicenseRef-Pixabay-Content-License",
  provenance: { origin: "kit", by: `audio catalog ${id}` },
  approval: { status: "approved", by: "audio catalog" },
});

const plan = (over: Partial<AudioPlan> = {}): AudioPlan => ({
  schema: "erkasa.audio-plan/2",
  durationSec: 20,
  voice: [],
  music: [
    {
      assetId: "m_a",
      role: "hook",
      startSec: 0,
      endSec: 10.8,
      offsetSec: 2,
      gainDb: -20,
      fadeInSec: 0.4,
      fadeOutSec: 1.6,
    },
    {
      assetId: "m_b",
      role: "resolve",
      startSec: 9.2004,
      endSec: 20,
      offsetSec: 0,
      gainDb: -18,
      fadeInSec: 1.6,
      fadeOutSec: 2.2,
    },
  ],
  ducking: { amountDb: 7, attackMs: 120, releaseMs: 500 },
  sfx: [
    { assetId: "sfx_x", atSec: 3.1234, gainDb: -10, reason: "s01 text in" },
    { assetId: "sfx_y", atSec: 5, gainDb: -12, offsetSec: 0.5, maxSec: 1, reason: "s02 clock" },
  ],
  loudness: { targetLufs: -14, truePeakDb: -1 },
  ...over,
});

const score = (p: AudioPlan, lengths: Record<string, number> = {}): Score => ({
  plan: p,
  files: Object.fromEntries(
    ["m_a", "m_b", "sfx_x", "sfx_y"].map((id) => [
      id,
      file(id, lengths[id] ?? (id.startsWith("m") ? 60 : 2)),
    ]),
  ),
});

describe("stageScore", () => {
  it("music segments and effects as the plan places them (whole ms, trims, fades, gains), v1's duck at the plan's depth", () => {
    const M = new ManifestBuilder();
    const r = stageScore(M, score(plan()), 20);
    expect(
      r.clips.map((c) => [c.id, c.role, c.asset, c.start, c.trim, c.duration, c.fadeIn, c.fadeOut, c.gainDb]),
    ).toEqual([
      ["music_001", "music", "lib_m_a@1", 0, 2, 10.8, 0.4, 1.6, -20],
      ["music_002", "music", "lib_m_b@1", 9.2, 0, 10.8, 1.6, 2.2, -18],
      ["sfx_001", "sfx", "lib_sfx_x@1", 3.123, 0, 2, 0, 0, -10],
      ["sfx_002", "sfx", "lib_sfx_y@1", 5, 0.5, 1, 0, 0.25, -12],
    ]);
    expect(r.mix).toEqual({
      duckMusicDb: 7,
      ducking: { kind: "sidechain", threshold: 0.015, ratio: 20, attackMs: 120, releaseMs: 500 },
      loudness: { integratedLufs: -14, truePeakDb: -1, rangeLu: 11 },
    });
    const assets = M.build("t").assets;
    expect(assets.map((a) => a.id)).toEqual(["lib_m_a", "lib_m_b", "lib_sfx_x", "lib_sfx_y"]);
    expect(assets[0]).toMatchObject({
      kind: "audio",
      license: "LicenseRef-Pixabay-Content-License",
      durationSec: 60,
    });
    expect(r.notes).toEqual([]);
  });

  it("a segment longer than its file or the film is shortened, with a note; fades stay inside the clip", () => {
    const r = stageScore(new ManifestBuilder(), score(plan(), { m_a: 6 }), 15);
    const [a, b] = r.clips;
    expect(a).toMatchObject({ duration: 4, trim: 2 }); // 6 s file minus the 2 s trim
    expect((a?.fadeIn ?? 0) + (a?.fadeOut ?? 0)).toBeLessThanOrEqual(4);
    expect(b).toMatchObject({ start: 9.2, duration: 5.8 }); // the film ends at 15 s
    expect(r.notes).toEqual([
      "music m_a at 0 s plays 4 s of the 10.8 s segment (the file or the film ends)",
      "music m_b at 9.2 s plays 5.8 s of the 10.8 s segment (the file or the film ends)",
    ]);
  });

  it("an effect after the film's end is left out, with a note", () => {
    const p = plan({ sfx: [{ assetId: "sfx_x", atSec: 30, gainDb: -10, reason: "late" }] });
    const r = stageScore(new ManifestBuilder(), score(p), 20);
    expect(r.clips.filter((c) => c.role === "sfx")).toEqual([]);
    expect(r.notes).toEqual(["sfx sfx_x at 30 s left out: it would play after the film"]);
  });

  it("refuses a plan that names a file it was not given", () => {
    const s = score(plan());
    delete s.files["m_b"];
    expect(() => stageScore(new ManifestBuilder(), s, 20)).toThrow(
      "the score uses 'm_b', which has no file in the package",
    );
  });
});
