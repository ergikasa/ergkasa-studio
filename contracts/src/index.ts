import type { z } from "zod";
import { AssetMeta, Rig } from "./asset.js";
import { AudioPlan, VoiceAlignment } from "./audio.js";
import { ScenePlan, VideoPlan } from "./scene-plan.js";
import { Script } from "./script.js";
import { VoiceCatalog } from "./voice.js";
import { TaskCommand, TaskResult } from "./task.js";
import { RenderTimeline } from "./timeline.js";

export * from "./common.js";
export * from "./asset.js";
export * from "./scene-plan.js";
export * from "./timeline.js";
export * from "./task.js";
export * from "./audio.js";
export * from "./script.js";
export * from "./voice.js";

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
  alignment: VoiceAlignment,
  "audio-plan": AudioPlan,
  script: Script,
  "voice-catalog": VoiceCatalog,
} as const satisfies Record<string, z.ZodType>;

export type ContractName = keyof typeof CONTRACTS;
