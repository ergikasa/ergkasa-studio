/**
 * E1.5: the stager places the run's audio (stager/src/audio.ts) and stages with the run's real voice timings.
 * The audio files here are synthetic WAVs: what is tested is placement, not sound.
 */
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ajv2020 } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import { audibleDuration, Script, toWholeMs, type RenderPackage } from "@erkasa/contracts";
import { openPackage, prepare } from "@erkasa/film";
import { FilmPlan } from "@erkasa/film";
import {
  serialise,
  stageV2,
  V2_DUCKING,
  V2_LOUDNESS,
  V2_MUSIC_UNDER_VOICE_DB,
  withCameraBounds,
  type AudioFile,
} from "../src/index.js";
import { ROOT } from "../src/manifest.js";

const NAME = "b3-every-yes";
const plan = FilmPlan.parse(JSON.parse(readFileSync(join(ROOT, `film/plans/${NAME}.film.json`), "utf8")));
const script = Script.parse(
  JSON.parse(readFileSync(join(ROOT, `benchmark/scripts/${NAME}.script.json`), "utf8")),
);

function wav(sec: number, rate = 44100, channels = 1): Buffer {
  const frames = Math.round(sec * rate);
  const data = frames * channels * 4;
  const b = Buffer.alloc(44 + data);
  b.write("RIFF", 0, "latin1");
  b.writeUInt32LE(36 + data, 4);
  b.write("WAVEfmt ", 8, "latin1");
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(3, 20);
  b.writeUInt16LE(channels, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * channels * 4, 28);
  b.writeUInt16LE(channels * 4, 32);
  b.writeUInt16LE(32, 34);
  b.write("data", 36, "latin1");
  b.writeUInt32LE(data, 40);
  return b;
}
const file = (uri: string, bytes: Buffer, by: string): AudioFile => ({
  uri,
  bytes,
  provenance: { origin: "generator", by },
  approval: { status: "approved", by: "test" },
});

// a voice clip per scene, as long as the scene's narration estimate, and a bed as long as the film
const { timing } = prepare({ plan, script });
const voice = timing.scenes.map((s) => ({
  sceneId: s.sceneId,
  ...file(`audio/voice-${s.sceneId}.wav`, wav(Math.max(0.5, s.duration - 0.3)), "test voice"),
}));
const filmSec = (p: RenderPackage): number => p.output.duration;

describe("E1.5 stager: audio", () => {
  const silent = stageV2(NAME, plan, script);

  it("without audio, the package is exactly as before (silent, the old mix)", () => {
    expect(serialise(stageV2(NAME, plan, script, {}))).toEqual(serialise(silent));
    expect(silent.pkg.audio).toEqual([]);
    expect(silent.pkg.mix).toEqual({ duckMusicDb: 0, loudness: { integratedLufs: -14, truePeakDb: -1.5 } });
  });

  const bed = file("audio/bed.wav", wav(filmSec(silent.pkg) + 0.02, 48000, 2), "film/src/sound.ts writeBed");
  const full = stageV2(NAME, plan, script, { audio: { voice, music: bed } });

  it("voice and bed: the bed first, at 0, at the v2 gain under a voice; each voice at its scene's start in whole ms", () => {
    const [m, ...vs] = full.pkg.audio;
    expect(m).toMatchObject({
      id: "music",
      role: "music",
      start: 0,
      gainDb: V2_MUSIC_UNDER_VOICE_DB,
      trim: 0,
      fadeIn: 0,
      fadeOut: 0,
      pan: 0,
    });
    expect(m?.duration).toBe(audibleDuration(0, filmSec(silent.pkg) + 0.02, filmSec(full.pkg)));
    expect(m?.duration).toBe(filmSec(full.pkg)); // the bed is longer: heard to the end
    expect(vs.map((c) => c.start)).toEqual(timing.scenes.map((s) => toWholeMs(s.start)));
    vs.forEach((c, k) => {
      expect(c).toMatchObject({
        role: "voice",
        gainDb: 0,
        asset: `voice_${String(k + 1).padStart(3, "0")}@1`,
      });
      const sec = Math.round(Math.max(0.5, (timing.scenes[k]?.duration ?? 0) - 0.3) * 44100) / 44100;
      expect(c.duration).toBe(audibleDuration(c.start, sec, filmSec(full.pkg)));
    });
    expect(full.pkg.mix).toEqual({
      duckMusicDb: 0,
      ducking: { ...V2_DUCKING },
      loudness: { ...V2_LOUDNESS },
    });
  });

  it("the audio assets are the WAVs, hashed, with the duration and rate their headers give", () => {
    const a = full.manifest.assets.filter((x) => x.kind === "audio");
    expect(a.length).toBe(voice.length + 1);
    const bedAsset = a.find((x) => x.id === "music_bed");
    expect(bedAsset).toMatchObject({
      format: "wav",
      sampleRate: 48000,
      source: {
        kind: "file",
        uri: "audio/bed.wav",
        sha256: createHash("sha256").update(bed.bytes).digest("hex"),
      },
    });
  });

  it("the frames do not change: scenes, edit and duration are those of the silent package", () => {
    expect(full.pkg.scenes).toEqual(silent.pkg.scenes);
    expect(full.pkg.edit).toEqual(silent.pkg.edit);
    expect(full.pkg.output).toEqual(silent.pkg.output);
  });

  it("bed only: no gain, no ducking; voice only: no ducking", () => {
    const b = stageV2(NAME, plan, script, { audio: { voice: [], music: bed } });
    expect(b.pkg.audio.map((c) => [c.role, c.gainDb])).toEqual([["music", 0]]);
    expect(b.pkg.mix).toEqual({ duckMusicDb: 0, loudness: { ...V2_LOUDNESS } });
    const v = stageV2(NAME, plan, script, { audio: { voice } });
    expect(v.pkg.audio.every((c) => c.role === "voice")).toBe(true);
    expect(v.pkg.mix.ducking).toBeUndefined();
  });

  it("is valid against the JSON Schemas, and the gate passes it with its files", () => {
    const w = serialise(withCameraBounds(full));
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats.default(ajv);
    const ok = ajv.compile(
      JSON.parse(
        readFileSync(join(ROOT, "contracts/json-schema/render-package.schema.json"), "utf8"),
      ) as object,
    );
    expect(ok(JSON.parse(w.pkg)), JSON.stringify(ok.errors?.slice(0, 3))).toBe(true);
    const root = mkdtempSync(join(tmpdir(), "stager-audio-"));
    mkdirSync(join(root, "audio"));
    for (const f of [...voice, bed]) writeFileSync(join(root, f.uri), f.bytes);
    writeFileSync(join(root, full.pkg.assetManifest.uri), w.manifest);
    // the engine's own entry: the gate with the engine's capabilities
    const r = openPackage({ package: w.pkg, root });
    expect(r.ok ? [] : r.errors).toEqual([]);
  });
});

describe("E1.5 stager: the run's voice timings", () => {
  it("stages with the alignments and clip lengths it is given, as the v2 engine prepares them", () => {
    const clipDurations = Object.fromEntries(timing.scenes.map((s) => [s.sceneId, s.duration + 0.4]));
    const staged = stageV2(NAME, plan, script, { voice: { clipDurations } });
    const legacy = prepare({ plan, script, clipDurations });
    const frames = legacy.composed.shots.reduce(
      (n, s) => n + Math.max(1, Math.round(s.end * 30) - Math.round(s.start * 30)),
      0,
    );
    expect(staged.pkg.output.duration).toBe(frames / 30);
    expect(staged.pkg.output.duration).not.toBe(stageV2(NAME, plan, script).pkg.output.duration);
  });
});
