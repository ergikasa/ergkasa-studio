import { z } from "zod";
import { AssetId, Easing, Language, LocalId, Unit, VideoFormat } from "./common.js";

/**
 * Scene Plan: the creative intent of a scene, written by the Visual Planner (LLM) or the editor.
 * Times are semantic (a word in the narration, a moment after another action); the compiler
 * turns them into frames. The LLM may only reference asset ids and actions that exist.
 */

/** When something happens. */
export const TimeAnchor = z.union([
  z.object({ word: z.string().min(1), occurrence: z.number().int().positive().default(1) }).strict(),
  z.object({ sec: z.number().min(0) }).strict(),
  /** `layerId.action`, e.g. `drini.walk` = when that action ends. */
  z
    .object({ after: z.string().regex(/^[A-Za-z][\w-]*\.[a-z_]+$/), offsetSec: z.number().default(0) })
    .strict(),
  z.literal("start"),
]);

export const Placement = z
  .object({
    /** `ground` = feet on the background's groundY; `free` = x/y in the frame. */
    anchor: z.enum(["ground", "free"]).default("free"),
    x: Unit,
    y: Unit.optional(),
    scale: z.number().positive().max(10).default(1),
    region: z.enum(["top-safe", "center", "bottom-safe"]).optional(),
  })
  .strict();

export const CharacterAction = z
  .object({
    action: z.string().regex(/^[a-z_]+$/),
    at: TimeAnchor,
    durationSec: z.number().positive().optional(),
    to: z.object({ x: Unit, y: Unit.optional() }).strict().optional(),
    target: LocalId.optional(),
  })
  .strict();

export const EntranceExit = z
  .object({
    effect: z.enum(["none", "fade", "pop", "slide_left", "slide_right", "slide_up", "draw_on", "grow"]),
    at: TimeAnchor,
    durationSec: z.number().positive().max(5).default(0.5),
    ease: Easing.default("easeOutCubic"),
  })
  .strict();

const LayerBase = {
  id: LocalId,
  place: Placement,
  in: EntranceExit.optional(),
  out: EntranceExit.optional(),
  zIndex: z.number().int().optional(),
};

export const ActorLayer = z
  .object({
    ...LayerBase,
    type: z.literal("actor"),
    assetId: AssetId,
    facing: z.enum(["front", "left", "right"]).default("front"),
    expression: z
      .string()
      .regex(/^[a-z_]+$/)
      .default("neutral"),
    actions: z.array(CharacterAction).default([]),
    /** Lip-sync to the scene narration. */
    speaks: z.boolean().default(false),
  })
  .strict();

export const AssetLayer = z
  .object({
    ...LayerBase,
    type: z.enum(["object", "icon", "metaphor"]),
    assetId: AssetId,
    /** Named animations from the asset's capabilities/parts. */
    animations: z
      .array(
        z
          .object({ name: z.string().regex(/^[a-z_]+$/), at: TimeAnchor, part: z.string().optional() })
          .strict(),
      )
      .default([]),
  })
  .strict();

export const TextLayer = z
  .object({
    ...LayerBase,
    type: z.literal("text"),
    content: z.string().min(1).max(120),
    style: z.string().regex(/^[a-z_]+$/),
    highlight: z.array(z.string()).default([]),
  })
  .strict();

export const ChartLayer = z
  .object({
    ...LayerBase,
    type: z.literal("chart"),
    chart: z.enum(["bar", "line", "counter", "compare", "pie", "linear_vs_exponential"]),
    data: z
      .array(z.object({ label: z.string(), value: z.number() }).strict())
      .min(1)
      .max(12),
    unit: z.string().max(8).optional(),
  })
  .strict();

export const SceneLayer = z.discriminatedUnion("type", [ActorLayer, AssetLayer, TextLayer, ChartLayer]);

export const CameraMove = z
  .object({
    move: z.enum(["static", "push_in", "pull_out", "pan_left", "pan_right", "follow", "shake", "punch_in"]),
    at: TimeAnchor.default("start"),
    durationSec: z.number().positive().optional(),
    to: z.number().positive().max(4).optional(),
    target: LocalId.optional(),
    ease: Easing.default("easeInOutCubic"),
  })
  .strict();

export const Transition = z
  .object({
    type: z.enum(["cut", "fade", "slide", "wipe", "zoom", "whip"]),
    direction: z.enum(["left", "right", "up", "down"]).optional(),
    durationSec: z.number().min(0).max(2).default(0.5),
  })
  .strict();

export const ScenePlan = z
  .object({
    schema: z.literal("erkasa.scene-plan/1"),
    sceneId: LocalId,
    engine: z.literal("2d"),
    /** Narration spoken during this scene (English in V1). */
    narration: z.string().min(1).max(600),
    durationPolicy: z
      .object({
        mode: z.enum(["fitNarration", "fixed"]),
        padAfterSec: z.number().min(0).max(3).default(0.4),
        sec: z.number().positive().optional(),
      })
      .strict(),
    background: z.object({ assetId: AssetId, variant: z.string().optional() }).strict(),
    layers: z.array(SceneLayer).max(12),
    effects: z
      .array(
        z
          .object({ preset: z.string().regex(/^[a-z_]+$/), intensity: z.number().min(0).max(1).default(0.5) })
          .strict(),
      )
      .default([]),
    camera: z.array(CameraMove).default([]),
    sfx: z
      .array(
        z
          .object({
            tag: z.string().regex(/^[a-z_]+$/),
            at: TimeAnchor,
            gainDb: z.number().min(-30).max(6).default(0),
          })
          .strict(),
      )
      .default([]),
    transitionOut: Transition.default({ type: "cut", durationSec: 0 }),
  })
  .strict()
  .superRefine((scene, ctx) => {
    const seen = new Set<string>();
    scene.layers.forEach((l, i) => {
      if (seen.has(l.id))
        ctx.addIssue({ code: "custom", message: `duplicate layer id '${l.id}'`, path: ["layers", i, "id"] });
      seen.add(l.id);
    });
    if (scene.durationPolicy.mode === "fixed" && scene.durationPolicy.sec === undefined) {
      ctx.addIssue({ code: "custom", message: "fixed duration needs sec", path: ["durationPolicy", "sec"] });
    }
  });
export type ScenePlan = z.infer<typeof ScenePlan>;

/** The whole video plan: ordered scenes plus global settings. */
export const VideoPlan = z
  .object({
    schema: z.literal("erkasa.video-plan/1"),
    projectId: z.string().min(1),
    language: Language,
    format: VideoFormat.default("9:16"),
    fps: z.literal(30).default(30),
    voiceId: z.string().min(1),
    musicMood: z
      .string()
      .regex(/^[a-z_]+$/)
      .optional(),
    scenes: z.array(ScenePlan).min(1).max(40),
  })
  .strict();
export type VideoPlan = z.infer<typeof VideoPlan>;
