/**
 * Storyboard (Phase 6): before the expensive render, the user sees every scene as two frames with its
 * narration, its idea and its length, plus what the full render will take and cost. Stills are cheap
 * (about a tenth of a second each); a whole film is minutes. The user can approve, redo a scene or ask
 * for a change in words, and only then render.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { CompileResult } from "@erkasa/compiler";
import type { RenderTimeline, VideoPlan } from "@erkasa/contracts";
import { loadEngine, renderStill } from "@erkasa/engine-worker";
import type { Catalog } from "./catalog.js";
import { compileRun, writeJson } from "./steps.js";

export interface StoryboardScene {
  sceneId: string;
  narration: string;
  /** The planner's one-sentence idea of the scene, when the plan is directed. */
  idea?: string;
  seconds: number;
  /** Two stills, relative to the run folder: about a third of the way in and near the end. */
  frames: string[];
  /** What the compiler and the review still object to in this scene. */
  warnings: string[];
}

export interface Storyboard {
  schema: "erkasa.storyboard/1";
  scenes: StoryboardScene[];
  totalSec: number;
  estimate: {
    /** Seconds one render worker needs for the whole video (measured speed or a conservative default). */
    renderSec: number;
    workers: number;
  };
}

/** Frames per second of rendering on a typical 1080x1920 scene, measured: 1380 frames in 88 s on a shared 2-core machine = 15.7; 12 leaves a margin. */
export const RENDER_FPS_PER_WORKER = 12;

export function estimateRender(totalSec: number, fps: number, workers: number): number {
  return Math.round((totalSec * fps) / (RENDER_FPS_PER_WORKER * Math.max(1, workers)));
}

/**
 * Stills for the scenes of a plan (all, or only `only`) into `<dir>/storyboard/`, and storyboard.json.
 * Scenes not in `only` keep the entry of the previous storyboard.
 */
export function buildStoryboard(
  dir: string,
  plan: VideoPlan,
  catalog: Catalog,
  opts: { only?: string[]; previous?: Storyboard; workers?: number; compiled?: CompileResult } = {},
): Storyboard {
  const compiled = opts.compiled ?? compileRun(dir, plan, catalog);
  if (!compiled.timeline) throw new Error("the plan does not compile; no storyboard");
  const timeline: RenderTimeline = compiled.timeline;
  const engine = loadEngine(timeline, catalog.roots);
  const out = join(dir, "storyboard");
  mkdirSync(out, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), "erkasa-sb-"));
  const fps = timeline.fps;
  try {
    const scenes: StoryboardScene[] = plan.scenes.map((s, i) => {
      const t = timeline.scenes.find((x) => x.sceneId === s.sceneId);
      const keep = opts.previous?.scenes.find((x) => x.sceneId === s.sceneId);
      if (!t) throw new Error(`scene ${s.sceneId} missing from the timeline`);
      const warnings = compiled.issues
        .filter((x) => x.level === "warning" && x.path.startsWith(`scenes[${i}]`))
        .map((x) => `${x.code}: ${x.message}`);
      const base = {
        sceneId: s.sceneId,
        narration: s.narration,
        ...(s.direction ? { idea: s.direction.idea } : {}),
        seconds: Math.round((t.duration / fps) * 10) / 10,
        warnings,
      };
      if (keep && opts.only && !opts.only.includes(s.sceneId)) return { ...base, frames: keep.frames };
      const frames = [0.33, 0.85].map((at, k) => {
        const png = join(work, `${s.sceneId}-${k}.png`);
        renderStill(engine, Math.min(engine.totalFrames - 1, t.from + Math.round(t.duration * at)), png);
        const jpg = join(out, `${s.sceneId}-${"ab"[k]}.jpg`);
        execFileSync(process.env["ERKASA_FFMPEG"] ?? "ffmpeg", [
          "-y",
          "-hide_banner",
          "-loglevel",
          "error",
          "-i",
          png,
          "-vf",
          "scale=360:-1",
          "-q:v",
          "4",
          jpg,
        ]);
        return relative(dir, jpg);
      });
      return { ...base, frames };
    });
    const totalSec = scenes.reduce((n, s) => n + s.seconds, 0);
    const workers = opts.workers ?? 1;
    const sb: Storyboard = {
      schema: "erkasa.storyboard/1",
      scenes,
      totalSec: Math.round(totalSec * 10) / 10,
      estimate: { renderSec: estimateRender(totalSec, fps, workers), workers },
    };
    writeJson(join(dir, "storyboard.json"), sb);
    return sb;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
