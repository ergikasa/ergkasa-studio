import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Script, VoicePreset } from "@erkasa/contracts";
import { FilmPlan, makeFilm } from "@erkasa/film";
import { direct, directorExample, type DirectResult } from "@erkasa/planner";
import { optional } from "./env.js";
import type { Llm, Usage } from "./llm.js";
import { alignmentsOf, loadVoiceTrack, writeJson, type Progress } from "./steps.js";

/**
 * The v2 engine's steps (Film Plan): the AI director writes film-plan.json, the film engine renders video.mp4.
 * Which engine a run uses: the task's `engine` param, else ERKASA_ENGINE, else "film". "v1" is the old one.
 */
export const FILM_FILES = {
  plan: "film-plan.json",
  attempts: "film-attempts.json",
  issues: "film-issues.json",
  work: "film",
  video: "video.mp4",
} as const;

export type EngineName = "film" | "v1";

export function engineFor(param?: unknown): EngineName {
  const v = (typeof param === "string" && param) || optional("ERKASA_ENGINE", "film");
  return v === "v1" ? "v1" : "film";
}

function voiceTimings(dir: string): {
  alignments?: ReturnType<typeof alignmentsOf>;
  clipDurations?: Record<string, number>;
  voiceFiles?: Record<string, string>;
} {
  const track = loadVoiceTrack(dir);
  if (!track) return {};
  return {
    alignments: alignmentsOf(dir, track),
    clipDurations: Object.fromEntries(track.scenes.map((s) => [s.sceneId, s.durationSec])),
    voiceFiles: Object.fromEntries(track.scenes.map((s) => [s.sceneId, join(dir, s.audio)])),
  };
}

export interface FilmPlanStepResult extends DirectResult {
  usage: Usage[];
}

/** Directs the script against the run's real word timings (estimated in a silent run). */
export async function stepFilmPlan(
  dir: string,
  script: Script,
  preset: VoicePreset,
  llm: Llm,
): Promise<FilmPlanStepResult> {
  const { alignments, clipDurations } = voiceTimings(dir);
  const example = directorExample(script.title);
  const res = await direct(script, llm, {
    voiceId: preset.id,
    ...(alignments ? { alignments } : {}),
    ...(clipDurations ? { clipDurations } : {}),
    ...(example ? { example } : {}),
  });
  writeJson(join(dir, FILM_FILES.attempts), res.attempts);
  if (res.plan) {
    writeJson(join(dir, FILM_FILES.plan), res.plan);
    writeJson(join(dir, FILM_FILES.issues), res.attempts[res.attempts.length - 1]?.warnings ?? []);
  }
  return res;
}

export function hasFilmPlan(dir: string): boolean {
  return existsSync(join(dir, FILM_FILES.plan));
}

export function loadFilmPlan(dir: string): FilmPlan {
  return FilmPlan.parse(JSON.parse(readFileSync(join(dir, FILM_FILES.plan), "utf8")));
}

/** Renders the run's film plan with its voice clips into video.mp4. */
export async function stepFilmRender(
  dir: string,
  script: Script,
  opts: { music: boolean; progress?: Progress; workers?: number },
): Promise<{ video: string; durationSec: number; warnings: number }> {
  const plan = loadFilmPlan(dir);
  const { alignments, clipDurations, voiceFiles } = voiceTimings(dir);
  const job = {
    plan,
    script,
    ...(alignments ? { alignments } : {}),
    ...(clipDurations ? { clipDurations } : {}),
  };
  const res = await makeFilm(job, {
    dir: join(dir, FILM_FILES.work),
    out: join(dir, FILM_FILES.video),
    workers: opts.workers ?? Number(optional("ERKASA_RENDER_WORKERS", "2")),
    ...(voiceFiles ? { voiceFiles } : {}),
    music: opts.music,
    ...(opts.progress ? { progress: opts.progress } : {}),
  });
  return {
    video: res.file,
    durationSec: res.durationSec,
    warnings: res.issues.filter((i) => i.level === "warning").length,
  };
}
