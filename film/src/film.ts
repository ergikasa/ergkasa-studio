/**
 * One call from a script and a film plan to an MP4: lay out the timing, compose the shots, check them, design
 * the sound, render the shots in parallel and join them.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { TimedWord } from "@erkasa/compiler";
import { Script } from "@erkasa/contracts";
import { compose, frameAt, type Composed } from "./compose.js";
import { FilmPlan } from "./contract.js";
import type { Issue } from "./perform.js";
import { checkFilm } from "./qa.js";
import { png, renderFilm, renderShot } from "./render.js";
import { sfxFor, writeBed } from "./sound.js";
import { layoutTiming, type Timing } from "./timing.js";

export interface FilmJob {
  plan: FilmPlan;
  script: Script;
  alignments?: Record<string, TimedWord[]>;
  clipDurations?: Record<string, number>;
}

export function prepare(job: FilmJob): { timing: Timing; composed: Composed; issues: Issue[] } {
  const timing = layoutTiming(job.script, job.alignments, job.clipDurations);
  const composed = compose(job.plan, timing);
  return { timing, composed, issues: [...composed.issues, ...checkFilm(job.plan, composed, job.script)] };
}

export interface MakeFilmOptions {
  dir: string;
  out?: string;
  workers?: number;
  /** Narration clips by scene id (absolute paths). */
  voiceFiles?: Record<string, string>;
  music?: boolean;
  progress?: (pct: number, message: string) => void;
}

export async function makeFilm(
  job: FilmJob,
  opts: MakeFilmOptions,
): Promise<{ file: string; durationSec: number; issues: Issue[] }> {
  mkdirSync(opts.dir, { recursive: true });
  const { timing, composed, issues } = prepare(job);
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length)
    throw new Error(
      `film plan has errors:\n${errors.map((e) => `- ${e.code} ${e.path}: ${e.message}`).join("\n")}`,
    );
  const jobFile = join(opts.dir, "film-job.json");
  writeFileSync(jobFile, JSON.stringify(job));
  let bed: string | undefined;
  if (opts.music !== false) {
    bed = join(opts.dir, "bed.wav");
    writeBed(bed, job.script, timing, sfxFor(composed), composed.duration);
  }
  const voice = Object.entries(opts.voiceFiles ?? {}).flatMap(([sceneId, file]) => {
    const sc = timing.scenes.find((s) => s.sceneId === sceneId);
    return sc ? [{ file, startSec: sc.start }] : [];
  });
  const out = opts.out ?? join(opts.dir, "video.mp4");
  let last = -1;
  const res = await renderFilm(composed, {
    dir: opts.dir,
    out,
    ...(bed ? { bed } : {}),
    voice,
    workers: opts.workers ?? 1,
    renderInChild: (i, file) => renderInChild(jobFile, i, file),
    progress: (d, total) => {
      const pct = Math.floor((d / total) * 20) * 5;
      if (pct !== last) {
        last = pct;
        opts.progress?.(pct, `render ${d}/${total} frames`);
      }
    },
  });
  void res;
  return { file: out, durationSec: composed.duration, issues };
}

/** Storyboard stills: the busiest moment of every shot, as PNG files. */
export function storyboard(job: FilmJob, dir: string): string[] {
  mkdirSync(dir, { recursive: true });
  const { composed } = prepare(job);
  return composed.shots.map((s, i) => {
    const t = s.events.filter((e) => e < s.dur).sort((a, b) => b - a)[0] ?? s.dur * 0.6;
    const at = Math.min(s.dur - 0.05, Math.max(0.6 * s.dur, t + 0.8));
    const file = join(dir, `${String(i + 1).padStart(2, "0")}-${s.shot.id}.png`);
    writeFileSync(file, png(frameAt(composed, i, Math.round(at * 30))));
    return file;
  });
}

const CHILD = fileURLToPath(new URL("./shot-child.ts", import.meta.url));
/** The child runs TypeScript whatever started the parent (tsx, vitest, node --import): load tsx explicitly. */
const TSX = createRequire(import.meta.url).resolve("tsx/esm");

function renderInChild(jobFile: string, i: number, out: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, ["--import", pathToFileURL(TSX).href, CHILD, jobFile, String(i), out], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let err = "";
    p.stderr.on("data", (d: Buffer) => (err = (err + d.toString()).slice(-3000)));
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`shot ${i} failed: ${err}`))));
  });
}

/** Used by the shot child process. */
export async function renderShotFromJob(jobFile: string, i: number, out: string): Promise<void> {
  const raw = JSON.parse(readFileSync(jobFile, "utf8")) as FilmJob;
  const job: FilmJob = { ...raw, plan: FilmPlan.parse(raw.plan), script: Script.parse(raw.script) };
  const { composed } = prepare(job);
  await renderShot(composed, i, out);
}
