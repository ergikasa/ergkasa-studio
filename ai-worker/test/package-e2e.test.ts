/**
 * E1.5 end to end: the worker renders a film through the Render Package (ERKASA_PIPELINE=package) into a real
 * MP4, offline and deterministic (scripted model, synthetic voice: see synthetic-voice.ts; this is not a test of
 * ElevenLabs). The same runs rendered by the legacy pipeline are the reference.
 *
 *   P1 MP4: ffprobe (H.264 1080×1920 30 fps yuv420p, every frame of the package; AAC 48 kHz stereo)
 *   P2 the run's package, manifest, gate report and audio files
 *   P3 decoded frames, frame by frame, against legacy
 *   P4 decoded PCM against legacy
 *   P5 audio/video synchronisation (stream starts, durations, voice onsets)
 *   P6 determinism: 1 and 2 workers, two runs
 *   P7 an invalid package: refused, no frame, no encoder, no fallback
 *   P8 failure, retry and cancellation
 *
 * E1.6: the package's music here is the synthetic bed, named (musicSource "synthetic"), because legacy mixes that bed
 * and these runs are compared with legacy; the licensed score has its own tests (score.test.ts).
 *
 * The legacy pipeline cuts a voiced video at the end of the last voice clip (its ducking ends with the voice and
 * -shortest ends the video there): the package engine renders the package's full duration (PO decision
 * 2026-11-18). The comparisons below say exactly where the two agree and why they differ.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RenderPackage } from "@erkasa/contracts";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { FILM_FILES } from "../src/film-steps.js";
import { loadScript } from "../src/steps.js";
import {
  PACKAGE_FILES,
  PackageRefused,
  pipelineOf,
  stepFilmPackage,
  stepGate,
  stepPackageRender,
  stepStage,
} from "../src/package-steps.js";
import { classify, handleCommand } from "../src/worker.js";
import { RUN, cmd, copyRun, deps, frameHashes, makeRun, pcm, probe } from "./e2e-fixture.js";
import { LEAD_SEC } from "./synthetic-voice.js";

const sha = (b: Buffer | string): string => createHash("sha256").update(b).digest("hex");
const noop = (): void => undefined;
const F32 = 4;
const CH = 2;
const RATE = 48000;

interface Rendered {
  storage: string;
  dir: string;
  video: string;
  frames: string[];
  pcm: Buffer | undefined;
  metrics: Record<string, number>;
}

async function render(base: string, params: Record<string, unknown>): Promise<Rendered> {
  const storage = copyRun(base);
  const r = await handleCommand(cmd("render.finalize", "render", params), deps(storage), noop);
  if (r.status !== "SUCCEEDED")
    throw new Error(`render ${JSON.stringify(params)}: ${JSON.stringify(r.error)}`);
  const dir = join(storage, RUN);
  const video = join(dir, FILM_FILES.video);
  return { storage, dir, video, frames: frameHashes(video), pcm: pcm(video), metrics: r.metrics };
}

/** The first sample index (interleaved float32) where two PCM buffers differ, or -1. */
function firstDiff(a: Buffer, b: Buffer): number {
  const n = Math.min(a.length, b.length) / F32;
  for (let i = 0; i < n; i++) if (a.readFloatLE(i * F32) !== b.readFloatLE(i * F32)) return i;
  return a.length === b.length ? -1 : n;
}
const seconds = (sampleIndex: number): number => sampleIndex / CH / RATE;

/** The first time after `from` s where the decoded audio rises above `level`. */
function onset(p: Buffer, from: number, level = 0.02): number {
  for (let i = Math.floor(from * RATE) * CH; i < p.length / F32; i++)
    if (Math.abs(p.readFloatLE(i * F32)) > level) return seconds(i);
  return Infinity;
}

const saved = {
  ffmpeg: process.env["ERKASA_FFMPEG"],
  pipeline: process.env["ERKASA_PIPELINE"],
  workers: process.env["ERKASA_RENDER_WORKERS"],
};
afterEach(() => {
  for (const [k, v] of [
    ["ERKASA_FFMPEG", saved.ffmpeg],
    ["ERKASA_PIPELINE", saved.pipeline],
    ["ERKASA_RENDER_WORKERS", saved.workers],
  ] as const)
    if (v === undefined) Reflect.deleteProperty(process.env, k);
    else process.env[k] = v;
});

let voiced = "";
let silentRun = "";
const R: Record<string, Rendered> = {};

beforeAll(async () => {
  delete process.env["ERKASA_PIPELINE"];
  voiced = await makeRun();
  silentRun = await makeRun({ voice: false });
  // voice + music (ducked), voice only, music only, nothing; legacy and package; package with 1 and 2 workers
  // legacy is the rollback since E1.6 (package is the default): the legacy references name it explicitly
  R["L"] = await render(voiced, { music: true, pipeline: "legacy" });
  process.env["ERKASA_RENDER_WORKERS"] = "1";
  R["P1"] = await render(voiced, { music: true, pipeline: "package", musicSource: "synthetic" });
  process.env["ERKASA_RENDER_WORKERS"] = "2";
  R["P2"] = await render(voiced, { music: true, pipeline: "package", musicSource: "synthetic" });
  R["LV"] = await render(voiced, { music: false, pipeline: "legacy" });
  R["PV"] = await render(voiced, { music: false, pipeline: "package" });
  R["LB"] = await render(silentRun, { music: true, pipeline: "legacy" });
  R["PB"] = await render(silentRun, { music: true, pipeline: "package", musicSource: "synthetic" });
  R["LS"] = await render(silentRun, { music: false, pipeline: "legacy" });
  R["PS"] = await render(silentRun, { music: false, pipeline: "package" });
}, 1_800_000);

const pkgOf = (r: Rendered): RenderPackage =>
  JSON.parse(readFileSync(join(r.dir, PACKAGE_FILES.render), "utf8")) as RenderPackage;
const g = (k: string): Rendered => R[k] as Rendered;

describe("the default is package (E1.6); legacy is the explicit rollback", () => {
  it("pipelineOf: package by default, ERKASA_PIPELINE=legacy selects legacy, anything else is refused", () => {
    expect(pipelineOf()).toBe("package");
    process.env["ERKASA_PIPELINE"] = "legacy";
    expect(pipelineOf()).toBe("legacy");
    expect(pipelineOf("package")).toBe("package");
    delete process.env["ERKASA_PIPELINE"];
    expect(() => pipelineOf("fast")).toThrow(/unknown pipeline 'fast'/);
  });

  it("legacy renders the legacy way and stages no package", () => {
    expect(existsSync(join(g("L").dir, PACKAGE_FILES.root))).toBe(false);
    expect(existsSync(join(g("L").dir, FILM_FILES.work))).toBe(true);
    expect(existsSync(join(g("P1").dir, FILM_FILES.work))).toBe(false);
  });

  it("without a pipeline the worker renders through the package: the same MP4 as pipeline=package", async () => {
    const d = await render(voiced, { music: true, musicSource: "synthetic" });
    expect(existsSync(join(d.dir, PACKAGE_FILES.render))).toBe(true);
    expect(existsSync(join(d.dir, PACKAGE_FILES.gate))).toBe(true);
    expect(sha(readFileSync(d.video))).toBe(sha(readFileSync(g("P2").video)));
  }, 600_000);

  it("ERKASA_PIPELINE=legacy (the rollback, no param) renders the same MP4 as pipeline=legacy", async () => {
    process.env["ERKASA_PIPELINE"] = "legacy";
    const d = await render(voiced, { music: true });
    delete process.env["ERKASA_PIPELINE"];
    expect(existsSync(join(d.dir, PACKAGE_FILES.root))).toBe(false);
    expect(sha(readFileSync(d.video))).toBe(sha(readFileSync(g("L").video)));
  }, 600_000);
});

describe("P1 the MP4", () => {
  it("H.264 1080×1920 at 30 fps, yuv420p, every frame of the package; AAC 48 kHz stereo", () => {
    const p = probe(g("P1").video);
    const pkg = pkgOf(g("P1"));
    const frames = Math.round(pkg.output.duration * pkg.output.fps);
    const [v, a] = p.streams;
    expect(p.streams.map((s) => s["codec_type"])).toEqual(["video", "audio"]);
    expect(v).toMatchObject({
      codec_name: "h264",
      width: 1080,
      height: 1920,
      r_frame_rate: "30/1",
      pix_fmt: "yuv420p",
    });
    expect(Number(v?.["nb_read_frames"])).toBe(frames);
    expect(g("P1").frames.length).toBe(frames);
    expect(a).toMatchObject({ codec_name: "aac", sample_rate: "48000", channels: 2 });
  });
});

describe("P2 the run's package", () => {
  it("package, manifest, gate report and audio files; the gate passes them again from disk", () => {
    const d = g("P1").dir;
    const files = readdirSync(join(d, PACKAGE_FILES.root)).sort();
    expect(files).toEqual(["audio", "film.assets.json", "film.render.json", "gate.json"]);
    expect(existsSync(join(d, PACKAGE_FILES.render))).toBe(true);
    expect(JSON.parse(readFileSync(join(d, PACKAGE_FILES.gate), "utf8"))).toEqual({
      ok: true,
      errors: [],
      warnings: [],
    });
    const manifest = JSON.parse(readFileSync(join(d, "package/film.assets.json"), "utf8")) as {
      assets: Array<{ kind: string; source: { uri?: string; sha256?: string } }>;
    };
    const audio = manifest.assets.filter((a) => a.kind === "audio");
    expect(audio.length).toBe(3); // the bed and one voice clip per scene
    for (const a of audio)
      expect(sha(readFileSync(join(d, PACKAGE_FILES.root, a.source.uri as string)))).toBe(a.source.sha256);
    expect(stepGate(d)).toEqual({ warnings: 0 });
    const pkg = pkgOf(g("P1"));
    expect(pkg.audio.map((c) => [c.role, c.start])).toEqual([
      ["music", 0],
      ["voice", 0],
      ["voice", pkg.audio[2]?.start],
    ]);
    expect(pkg.mix.ducking).toEqual({
      kind: "sidechain",
      threshold: 0.03,
      ratio: 6,
      attackMs: 80,
      releaseMs: 500,
    });
  });
});

describe("P3 decoded frames, frame by frame", () => {
  it("nothing and music only: every frame identical to legacy", () => {
    expect(g("PS").frames).toEqual(g("LS").frames);
    expect(g("PB").frames).toEqual(g("LB").frames);
    expect(g("PS").frames.length).toBe(Math.round(pkgOf(g("PS")).output.duration * 30));
  });
  it("with a voice: every frame legacy has is identical; legacy stops at the last voice clip, the package goes on", () => {
    for (const [p, l] of [
      ["P1", "L"],
      ["PV", "LV"],
    ] as const) {
      const n = g(l).frames.length;
      expect(n).toBeLessThan(g(p).frames.length);
      expect(g(p).frames.slice(0, n)).toEqual(g(l).frames);
      expect(g(p).frames.length).toBe(Math.round(pkgOf(g(p)).output.duration * 30));
    }
  });
});

describe("P4 decoded PCM", () => {
  it("nothing: no audio stream in either", () => {
    expect(g("PS").pcm).toBeUndefined();
    expect(g("LS").pcm).toBeUndefined();
    expect(probe(g("PS").video).streams.map((s) => s["codec_type"])).toEqual(["video"]);
  });
  it("music only: identical to legacy, sample for sample", () => {
    expect(sha(g("PB").pcm as Buffer)).toBe(sha(g("LB").pcm as Buffer));
  });
  it("voice only: identical while legacy's stream lasts, but for its last two AAC frames (where legacy's stream ends); then silence", () => {
    const p = g("PV").pcm as Buffer;
    const l = g("LV").pcm as Buffer;
    const d = firstDiff(p, l);
    const legacyEnd = l.length / F32;
    expect(d).toBeGreaterThanOrEqual(legacyEnd - 2 * 1024 * CH);
    for (let i = Math.max(legacyEnd, onsetEnd(p)); i < p.length / F32; i++)
      expect(Math.abs(p.readFloatLE(i * F32))).toBeLessThan(1e-4);
  });
  it("voice and music, ducked: identical until the loudness normaliser's window reaches legacy's cut (3 s before it)", () => {
    const p = g("P1").pcm as Buffer;
    const l = g("L").pcm as Buffer;
    const d = firstDiff(p, l);
    const legacyEndSec = seconds(l.length / F32);
    expect(seconds(d)).toBeGreaterThanOrEqual(legacyEndSec - 3.0);
    expect(seconds(d)).toBeLessThan(legacyEndSec);
  });
});

/** The end of the last loud part of the voice-only mix (for the silence check after it). */
function onsetEnd(p: Buffer): number {
  for (let i = p.length / F32 - 1; i >= 0; i--) if (Math.abs(p.readFloatLE(i * F32)) > 0.02) return i + 1;
  return 0;
}

describe("P5 audio/video synchronisation", () => {
  it("both streams start at 0; the audio ends within one frame of the video", () => {
    for (const k of ["P1", "PV", "PB"]) {
      const s = probe(g(k).video).streams;
      expect(s.map((x) => Number(x["start_time"]))).toEqual([0, 0]);
      expect(Math.abs(Number(s[0]?.["duration"]) - Number(s[1]?.["duration"]))).toBeLessThanOrEqual(1 / 30);
    }
  });
  it("each voice is heard where the package places it (its start + the synthetic lead), within one frame", () => {
    const pkg = pkgOf(g("PV"));
    const voices = pkg.audio.filter((c) => c.role === "voice");
    const p = g("PV").pcm as Buffer;
    for (const v of voices) {
      const want = v.start + LEAD_SEC;
      expect(Math.abs(onset(p, want - 0.15) - want)).toBeLessThan(1 / 30);
    }
  });
});

describe("P6 determinism", () => {
  it("1 and 2 workers: the same MP4, byte for byte; the same package and audio files", () => {
    expect(sha(readFileSync(g("P2").video))).toBe(sha(readFileSync(g("P1").video)));
    for (const f of ["package/film.render.json", "package/film.assets.json", "package/audio/bed.wav"])
      expect(sha(readFileSync(join(g("P2").dir, f)))).toBe(sha(readFileSync(join(g("P1").dir, f))));
  });
});

describe("P7 an invalid package", () => {
  function spyFfmpeg(): { bin: string; log: string } {
    const dir = mkdtempSync(join(tmpdir(), "ffspy-"));
    const log = join(dir, "calls");
    const bin = join(dir, "ffmpeg");
    writeFileSync(bin, `#!/bin/sh\necho "$*" >> "${log}"\nexec ffmpeg "$@"\n`);
    chmodSync(bin, 0o755);
    return { bin, log };
  }

  it("is refused by the gate step and by the engine: zero frames, the encoder never starts, no video, no fallback", async () => {
    const storage = copyRun(voiced);
    const dir = join(storage, RUN);
    await stepStage(dir, loadScript(dir), { music: true, musicSource: "synthetic" });
    const file = join(dir, PACKAGE_FILES.render);
    const pkg = JSON.parse(readFileSync(file, "utf8")) as RenderPackage;
    const node = pkg.scenes
      .flatMap((s) => [...s.layers, ...(s.screen ?? [])].flatMap((l) => l.nodes))
      .find((n) => n.kind === "asset" && n.params && "y" in n.params && "lines" in n.params);
    if (node?.kind !== "asset" || !node.params) throw new Error("no kinetic type");
    node.params["y"] = "top";
    writeFileSync(file, JSON.stringify(pkg));
    expect(() => stepGate(dir)).toThrow(PackageRefused);
    const report = JSON.parse(readFileSync(join(dir, PACKAGE_FILES.gate), "utf8")) as {
      ok: boolean;
      errors: Array<{ code: string; path: string }>;
    };
    expect(report.ok).toBe(false);
    expect(report.errors.map((e) => e.code)).toContain("VALUE_UNSUPPORTED");
    expect(report.errors.some((e) => /\/params\/y$/.test(e.path))).toBe(true);
    const spy = spyFfmpeg();
    process.env["ERKASA_FFMPEG"] = spy.bin;
    const r = stepPackageRender(dir, { workers: 2 });
    await expect(r).rejects.toBeInstanceOf(PackageRefused);
    expect(existsSync(spy.log)).toBe(false);
    expect(existsSync(join(dir, FILM_FILES.video))).toBe(false);
    expect(existsSync(join(dir, PACKAGE_FILES.work))).toBe(false);
    expect(existsSync(join(dir, FILM_FILES.work))).toBe(false); // the legacy renderer never ran
    expect(classify(new PackageRefused(report.errors as never))).toMatchObject({
      code: "PACKAGE_REFUSED",
      retryable: false,
    });
  }, 600_000);
});

describe("P8 failure, retry and cancellation", () => {
  it("a failing FFmpeg fails the task (retryable), leaves no video and does not fall back; the retry renders the same MP4", async () => {
    const storage = copyRun(voiced);
    const dir = join(storage, RUN);
    process.env["ERKASA_FFMPEG"] = "/bin/false";
    const first = await handleCommand(
      cmd("render.finalize", "render", { music: true, pipeline: "package", musicSource: "synthetic" }),
      deps(storage),
      noop,
    );
    expect(first.status).toBe("FAILED");
    expect(first.error).toMatchObject({ code: "WORKER_ERROR", retryable: true });
    expect(existsSync(join(dir, FILM_FILES.video))).toBe(false);
    expect(existsSync(join(dir, FILM_FILES.work))).toBe(false);
    delete process.env["ERKASA_FFMPEG"];
    if (saved.ffmpeg) process.env["ERKASA_FFMPEG"] = saved.ffmpeg;
    process.env["ERKASA_RENDER_WORKERS"] = "2";
    const second = await handleCommand(
      cmd("render.finalize", "render", { music: true, pipeline: "package", musicSource: "synthetic" }, 2),
      deps(storage),
      noop,
    );
    expect(second.status).toBe("SUCCEEDED");
    expect(sha(readFileSync(join(dir, FILM_FILES.video)))).toBe(sha(readFileSync(g("P1").video)));
  }, 600_000);

  it("cancellation stops the render: no video, no partial file, no process left; the failure is CANCELLED", async () => {
    const storage = copyRun(voiced);
    const dir = join(storage, RUN);
    const ac = new AbortController();
    const p = stepFilmPackage(dir, loadScript(dir), {
      music: true,
      musicSource: "synthetic",
      workers: 2,
      signal: ac.signal,
      progress: (pct) => {
        if (pct >= 10) ac.abort(new DOMException("stopped in a test", "AbortError"));
      },
    });
    const e = await p.then(
      () => undefined,
      (x: unknown) => x,
    );
    expect(e).toMatchObject({ name: "AbortError" });
    expect(classify(e)).toMatchObject({ code: "CANCELLED", retryable: false });
    expect(existsSync(join(dir, FILM_FILES.video))).toBe(false);
    expect(existsSync(join(dir, "video.part.mp4"))).toBe(false);
    const live = spawnSync("pgrep", ["-af", join(dir, PACKAGE_FILES.work)], {
      encoding: "utf8",
    }).stdout.trim();
    expect(live).toBe("");
  }, 600_000);
});
