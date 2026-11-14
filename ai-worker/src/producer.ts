/**
 * What the producer does with a run folder after the plan exists (Phase 6): look at the storyboard, redo a
 * scene (again, or in words), render. Every function works on the files of the run, so the Studio, the
 * worker and the command line all do the same thing.
 */
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Script, type VideoPlan, type VoicePreset } from "@erkasa/contracts";
import { Catalog } from "./catalog.js";
import { repoRoot } from "./env.js";
import type { Llm, Usage } from "./llm.js";
import { redoScene, type RedoResult } from "./scene-tools.js";
import { buildStoryboard, type Storyboard } from "./storyboard.js";
import {
  RUN_FILES,
  alignmentsOf,
  loadPlan,
  loadVoiceTrack,
  stepRender,
  writeJson,
  type Progress,
  type RenderStepResult,
} from "./steps.js";
import { loadVoiceCatalog, narratorLine, resolvePreset } from "./voice-catalog.js";

/** The run's own world (when it has one) in front of the library. */
export function runCatalog(dir: string): Catalog {
  const library = join(repoRoot(), "assets");
  const world = join(dir, RUN_FILES.worldDir);
  return existsSync(join(world, "manifest.json")) ? new Catalog([world, library]) : new Catalog(library);
}

/** The script the plan was made from: with the world's cast when there is one. */
function runScript(dir: string): Script {
  const f = [join(dir, "script.world.json"), join(dir, RUN_FILES.script)].find(existsSync);
  if (!f) throw new Error(`no script in ${dir}`);
  return Script.parse(JSON.parse(readFileSync(f, "utf8")));
}

export function storyboardOf(dir: string): Storyboard | undefined {
  const f = join(dir, "storyboard.json");
  return existsSync(f) ? (JSON.parse(readFileSync(f, "utf8")) as Storyboard) : undefined;
}

/** (Re)builds the stills of the storyboard, all scenes or only some. */
export function showStoryboard(dir: string, opts: { only?: string[]; workers?: number } = {}): Storyboard {
  const previous = storyboardOf(dir);
  return buildStoryboard(dir, loadPlan(dir), runCatalog(dir), {
    ...(opts.only && previous ? { only: opts.only, previous } : {}),
    ...(opts.workers ? { workers: opts.workers } : {}),
  });
}

export interface RedoReport {
  sceneId: string;
  clean: boolean;
  issues: RedoResult["issues"];
  usage: Usage[];
  storyboard: Storyboard;
}

/**
 * Redoes one scene. The previous plan is kept as `video-plan.prev.json` (one step back); the new plan is
 * written only if the scene compiled, and only that scene's stills are redrawn.
 */
export async function redoRunScene(
  llm: Llm,
  dir: string,
  sceneId: string,
  opts: { request?: string; host?: string; voice?: string; workers?: number } = {},
): Promise<RedoReport> {
  const plan = loadPlan(dir);
  const script = runScript(dir);
  const catalog = runCatalog(dir);
  const voices = loadVoiceCatalog();
  const wanted = opts.voice ?? plan.voiceId;
  // a plan may carry a voice id the catalog no longer has: the narrator line is optional context, not a reason to stop
  const preset: VoicePreset | undefined = voices.voices.some((v) => v.id === wanted)
    ? resolvePreset(voices, wanted)
    : undefined;
  const alignments = alignmentsOf(dir, loadVoiceTrack(dir));
  const res = await redoScene(llm, script, plan, catalog, {
    sceneId,
    ...(opts.request ? { request: opts.request } : {}),
    projectId: plan.projectId,
    voiceId: plan.voiceId,
    ...(preset ? { narrator: narratorLine(preset) } : {}),
    ...(opts.host ? { host: opts.host } : {}),
    ...(alignments ? { alignments } : {}),
  });
  const changed = res.compiled !== undefined;
  if (changed) {
    copyFileSync(join(dir, RUN_FILES.plan), join(dir, "video-plan.prev.json"));
    writeJson(join(dir, RUN_FILES.plan), res.plan);
  }
  const storyboard = changed
    ? buildStoryboard(dir, res.plan, catalog, {
        only: [sceneId],
        ...(storyboardOf(dir) ? { previous: storyboardOf(dir) as Storyboard } : {}),
        ...(opts.workers ? { workers: opts.workers } : {}),
        ...(res.compiled ? { compiled: res.compiled } : {}),
      })
    : showStoryboard(dir);
  return { sceneId, clean: res.clean, issues: res.issues, usage: res.usage, storyboard };
}

/** One step back after a redo the producer did not like. */
export function undoRedo(dir: string): boolean {
  const prev = join(dir, "video-plan.prev.json");
  if (!existsSync(prev)) return false;
  copyFileSync(prev, join(dir, RUN_FILES.plan));
  return true;
}

/** Renders the approved plan of a run (the run's world and voice included). */
export async function renderRun(
  dir: string,
  opts: { name?: string; music?: boolean; workers?: number; progress?: Progress } = {},
): Promise<RenderStepResult> {
  return stepRender(dir, loadPlan(dir), {
    catalog: runCatalog(dir),
    music: opts.music ?? true,
    ...(opts.name ? { videoName: opts.name } : {}),
    ...(opts.workers ? { workers: opts.workers } : {}),
    ...(opts.progress ? { progress: opts.progress } : {}),
  });
}

export type { VideoPlan };
