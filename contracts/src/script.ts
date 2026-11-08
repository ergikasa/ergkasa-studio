import { z } from "zod";
import { LocalId, Theme } from "./common.js";

/**
 * Script: what the narrator says, split into scenes, plus the visual idea for each scene.
 * Written by the Script Writer (LLM) from a topic; read by the Visual Planner and the editor.
 * English only in V1. The narration of each scene is spoken verbatim by the voice worker.
 */
export const ScriptScene = z
  .object({
    sceneId: LocalId,
    /** Spoken text, exactly as the voice will read it. Numbers in words ("two hundred"). */
    narration: z.string().min(1).max(600),
    /** One or two sentences: what the viewer should see (metaphor, character, chart...). */
    visualIdea: z.string().min(1).max(400),
    /** The word or phrase to emphasize on screen, if any. */
    emphasis: z.string().max(60).optional(),
  })
  .strict();
export type ScriptScene = z.infer<typeof ScriptScene>;

export const Script = z
  .object({
    schema: z.literal("erkasa.script/1"),
    title: z.string().min(1).max(100),
    topic: z.string().min(1).max(300),
    theme: Theme,
    language: z.literal("en"),
    /** The first sentence: must stop the scroll within ~2 seconds. Equals the start of scene 1. */
    hook: z.string().min(1).max(200),
    scenes: z.array(ScriptScene).min(2).max(12),
    /** Rough length at ~165 words per minute. */
    estimatedSec: z.number().positive(),
  })
  .strict()
  .superRefine((s, ctx) => {
    const seen = new Set<string>();
    s.scenes.forEach((sc, i) => {
      if (seen.has(sc.sceneId))
        ctx.addIssue({
          code: "custom",
          message: `duplicate sceneId '${sc.sceneId}'`,
          path: ["scenes", i, "sceneId"],
        });
      seen.add(sc.sceneId);
    });
    const first = s.scenes[0];
    if (first && !first.narration.startsWith(s.hook))
      ctx.addIssue({ code: "custom", message: "scene 1 narration must start with the hook", path: ["hook"] });
  });
export type Script = z.infer<typeof Script>;
