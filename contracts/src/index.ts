import type { z } from "zod";
import { AssetMeta, Rig } from "./asset.js";
import { AudioCatalog, AudioPlan, VoiceAlignment } from "./audio.js";
import { ScenePlan, VideoPlan } from "./scene-plan.js";
import { Script } from "./script.js";
import { VoiceCatalog } from "./voice.js";
import { TaskCommand, TaskProgress, TaskResult } from "./task.js";
import { RenderTimeline } from "./timeline.js";
import { AssetManifest } from "./asset-manifest.js";
import { RenderPackage } from "./render-package.js";

export * from "./common.js";
export * from "./asset.js";
export * from "./scene-plan.js";
export * from "./timeline.js";
export * from "./task.js";
export * from "./audio.js";
export * from "./script.js";
export * from "./voice.js";
export * from "./asset-manifest.js";
export * from "./render-package.js";
export * from "./evaluate.js";

/**
 * Every top-level contract, keyed by the file name of its exported JSON Schema
 * (`json-schema/<name>.schema.json`) and of its fixtures (`fixtures/{valid,invalid}/<name>.*.json`).
 * Java reads the same names.
 */
export const CONTRACTS = {
  asset: AssetMeta,
  rig: Rig,
  "scene-plan": ScenePlan,
  "video-plan": VideoPlan,
  timeline: RenderTimeline,
  "task-command": TaskCommand,
  "task-result": TaskResult,
  "task-progress": TaskProgress,
  alignment: VoiceAlignment,
  "audio-plan": AudioPlan,
  "audio-catalog": AudioCatalog,
  script: Script,
  "voice-catalog": VoiceCatalog,
  "asset-manifest": AssetManifest,
  "render-package": RenderPackage,
} as const satisfies Record<string, z.ZodType>;

export type ContractName = keyof typeof CONTRACTS;
