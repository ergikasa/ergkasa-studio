/**
 * E1.5: the film render through the Render Package, behind ERKASA_PIPELINE (`legacy` stays the default).
 *
 *   stage  → <run>/package/film.render.json, film.assets.json, audio/*.wav   (the stager, from the run's film plan,
 *            script and voice: real word timings, the voice as WAV, the v2 sound bed)
 *   gate   → <run>/package/gate.json                                         (the Validation Gate's report)
 *   render → <run>/video.mp4                                                 (the engine, from the package alone)
 *
 * A refused package fails the step (PackageRefused, not retryable) with the gate's findings: no frame is drawn,
 * no encoder starts, and nothing falls back to the legacy renderer. Cancellation (AbortSignal) stops every
 * process it started and leaves no video.mp4.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { validate, type Finding } from "@erkasa/gate";
import { encodePackage, renderCapabilities } from "@erkasa/film";
import {
  libraryAssetId,
  serialise,
  stageV2,
  withCameraBounds,
  writeBedV2,
  type AudioFile,
  type Score,
} from "@erkasa/stager";
import type { Script } from "@erkasa/contracts";
import { optional } from "./env.js";
import { FILM_FILES, loadFilmPlan, voiceTimings } from "./film-steps.js";
import type { Progress } from "./steps.js";
import { designScore, scoreFile } from "./score.js";

export const PIPELINES = ["legacy", "package"] as const;
export type Pipeline = (typeof PIPELINES)[number];

/**
 * The film render pipeline: the explicit choice, else ERKASA_PIPELINE, else `package` (the default since E1.6;
 * `legacy` stays selectable as the rollback until the final E1.6 acceptance).
 */
export function pipelineOf(explicit?: string): Pipeline {
  const v = explicit ?? optional("ERKASA_PIPELINE", "package");
  if (!(PIPELINES as readonly string[]).includes(v))
    throw new Error(`unknown pipeline '${v}': use ${PIPELINES.join(" or ")}`);
  return v as Pipeline;
}

export const PACKAGE_FILES = {
  root: "package",
  render: "package/film.render.json",
  gate: "package/gate.json",
  audio: "package/audio",
  work: "film-package-work",
} as const;

/** The package was refused by the Validation Gate (a fault of the package: another attempt gives the same). */
export class PackageRefused extends Error {
  constructor(readonly findings: Finding[]) {
    super(
      `the render package was refused: ${findings
        .slice(0, 5)
        .map((f) => `${f.code} ${f.file}:${f.path}`)
        .join("; ")}${findings.length > 5 ? ` (+${findings.length - 5})` : ""}`,
    );
  }
}

const ffmpeg = (): string => process.env["ERKASA_FFMPEG"] ?? "ffmpeg";

function run(args: string[], signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpeg(), args, { stdio: ["ignore", "ignore", "pipe"] });
    const kill = (): void => {
      p.kill("SIGKILL");
    };
    signal?.addEventListener("abort", kill, { once: true });
    let err = "";
    p.stderr.on("data", (d: Buffer) => (err = (err + d.toString()).slice(-2000)));
    p.on("error", reject);
    p.on("close", (code) => {
      signal?.removeEventListener("abort", kill);
      if (signal?.aborted) reject(signal.reason ?? new Error("aborted"));
      else if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${err.trim()}`));
    });
  });
}

export interface StageResult {
  packageFile: string;
  root: string;
  sha256: string;
  clips: number;
}

/**
 * Where the music comes from (E1.6): `library`, the score designed from the licensed catalog (the default, the
 * only one for commercial output); `synthetic`, the E1.5 v2 bed, for tests and comparisons with legacy only.
 */
export const MUSIC_SOURCES = ["library", "synthetic"] as const;
export type MusicSource = (typeof MUSIC_SOURCES)[number];

export function musicSourceOf(v: unknown): MusicSource {
  if (v === undefined) return "library";
  if (typeof v === "string" && (MUSIC_SOURCES as readonly string[]).includes(v)) return v as MusicSource;
  throw new Error(`unknown music source '${String(v)}': use ${MUSIC_SOURCES.join(" or ")}`);
}

/**
 * Stages the run's film into <run>/package. The voice MP3s become 32-bit float WAVs (the decoded samples, which
 * the v2 engine mixed from the MP3s as they are). The music: the score designed from the licensed catalog
 * (E1.6, its files as 16-bit 48 kHz stereo WAVs), or, for tests only, the v2 engine's synthetic bed.
 */
export async function stepStage(
  dir: string,
  script: Script,
  opts: { music: boolean; signal?: AbortSignal; synthetic?: boolean; musicSource?: MusicSource },
): Promise<StageResult> {
  const plan = loadFilmPlan(dir);
  const { alignments, clipDurations, voiceFiles } = voiceTimings(dir);
  const root = join(dir, PACKAGE_FILES.root);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(join(dir, PACKAGE_FILES.audio), { recursive: true });
  const voice: Array<{ sceneId: string } & AudioFile> = [];
  for (const [sceneId, mp3] of Object.entries(voiceFiles ?? {})) {
    const uri = `audio/voice-${sceneId}.wav`;
    await run(["-y", "-loglevel", "error", "-i", mp3, "-c:a", "pcm_f32le", join(root, uri)], opts.signal);
    voice.push({
      sceneId,
      uri,
      bytes: readFileSync(join(root, uri)),
      provenance: opts.synthetic
        ? { origin: "generator", by: "synthetic test voice" }
        : { origin: "ai", by: "ElevenLabs" },
      approval: { status: "approved", by: "ai-worker", note: "the voice recorded for this run" },
    });
  }
  let music: AudioFile | undefined;
  let score: Score | undefined;
  const source = opts.musicSource ?? "library";
  if (opts.music && source === "library") {
    const d = designScore(dir, basename(dir), plan, script, {
      ...(alignments ? { alignments } : {}),
      ...(clipDurations ? { clipDurations } : {}),
      ...(voiceFiles ? { voiceFiles } : {}),
    });
    const files: Score["files"] = {};
    for (const [id, entry] of d.used) {
      const uri = `audio/${libraryAssetId(id)}.wav`;
      await run(
        [
          "-y",
          "-loglevel",
          "error",
          "-i",
          entry.path,
          "-ac",
          "2",
          "-ar",
          "48000",
          "-c:a",
          "pcm_s16le",
          join(root, uri),
        ],
        opts.signal,
      );
      files[id] = scoreFile(entry, uri, readFileSync(join(root, uri)));
    }
    score = { plan: d.plan, files };
  } else if (opts.music) {
    const uri = "audio/bed.wav";
    writeBedV2(join(root, uri), plan, script, {
      ...(alignments ? { alignments } : {}),
      ...(clipDurations ? { clipDurations } : {}),
    });
    music = {
      uri,
      bytes: readFileSync(join(root, uri)),
      provenance: { origin: "generator", by: "film/src/sound.ts writeBed" },
      approval: { status: "approved", by: "ai-worker", note: "the v2 sound bed for this run" },
    };
  }
  opts.signal?.throwIfAborted();
  const staged = withCameraBounds(
    stageV2("film", plan, script, {
      voice: { ...(alignments ? { alignments } : {}), ...(clipDurations ? { clipDurations } : {}) },
      audio: { voice, ...(music ? { music } : {}), ...(score ? { score } : {}) },
    }),
  );
  const w = serialise(staged);
  writeFileSync(join(root, staged.pkg.assetManifest.uri), w.manifest);
  const packageFile = join(dir, PACKAGE_FILES.render);
  writeFileSync(packageFile, w.pkg);
  return {
    packageFile,
    root,
    sha256: createHash("sha256").update(w.pkg).digest("hex"),
    clips: staged.pkg.audio.length,
  };
}

/** Runs the Validation Gate on the run's package and writes its report; throws PackageRefused when refused. */
export function stepGate(dir: string): { warnings: number } {
  const r = validate({
    package: readFileSync(join(dir, PACKAGE_FILES.render)),
    root: join(dir, PACKAGE_FILES.root),
    capabilities: renderCapabilities(),
  });
  writeFileSync(
    join(dir, PACKAGE_FILES.gate),
    JSON.stringify({ ok: r.ok, errors: r.errors, warnings: r.warnings }, null, 2) + "\n",
  );
  if (!r.ok) throw new PackageRefused(r.errors);
  return { warnings: r.warnings.length };
}

/** Encodes the run's package into video.mp4 (the engine validates it again, from the bytes on disk). */
export async function stepPackageRender(
  dir: string,
  opts: { workers?: number; signal?: AbortSignal; progress?: Progress },
): Promise<{ video: string; durationSec: number; frames: number }> {
  const text = readFileSync(join(dir, PACKAGE_FILES.render));
  const out = join(dir, FILM_FILES.video);
  rmSync(out, { force: true });
  let last = -1;
  const res = await encodePackage(
    { package: text, root: join(dir, PACKAGE_FILES.root) },
    {
      out,
      workDir: join(dir, PACKAGE_FILES.work),
      workers: opts.workers ?? Number(optional("ERKASA_RENDER_WORKERS", "2")),
      ...(opts.signal ? { signal: opts.signal } : {}),
      progress: (d, total) => {
        const pct = Math.floor((d / total) * 20) * 5;
        if (pct !== last) {
          last = pct;
          opts.progress?.(pct, `render ${d}/${total} frames`);
        }
      },
    },
  );
  if (!res.ok) throw new PackageRefused(res.errors);
  const pkg = JSON.parse(text.toString("utf8")) as { output: { duration: number } };
  return { video: out, durationSec: pkg.output.duration, frames: res.frames };
}

/** Stage, gate, render: the film through the Render Package. */
export async function stepFilmPackage(
  dir: string,
  script: Script,
  opts: {
    music: boolean;
    workers?: number;
    signal?: AbortSignal;
    progress?: Progress;
    synthetic?: boolean;
    musicSource?: MusicSource;
  },
): Promise<{
  video: string;
  durationSec: number;
  frames: number;
  packageSha256: string;
  clips: number;
  warnings: number;
}> {
  opts.progress?.(0, "staging the render package");
  const staged = await stepStage(dir, script, opts);
  opts.progress?.(0, "validating the render package");
  const g = stepGate(dir);
  const r = await stepPackageRender(dir, opts);
  return { ...r, packageSha256: staged.sha256, clips: staged.clips, warnings: g.warnings };
}

/** Whether the run has a staged package (for re-encoding it alone). */
export const hasPackage = (dir: string): boolean => existsSync(join(dir, PACKAGE_FILES.render));
