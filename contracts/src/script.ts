import { z } from "zod";
import { AssetId, LocalId, Theme } from "./common.js";

/**
 * Where a scene sits in the video's argument.
 * Editorial structure (Erkasa standard): hook -> problem -> concept -> situation -> analysis -> conclusion.
 * The older story arc (relate, tension, explain, twist, turn, resolve) stays valid for existing scripts.
 */
export const StoryBeat = z.enum([
  "hook",
  "problem",
  "concept",
  "situation",
  "analysis",
  "conclusion",
  "relate",
  "tension",
  "explain",
  "twist",
  "turn",
  "resolve",
]);
export type StoryBeat = z.infer<typeof StoryBeat>;

/** The editorial structure, in order. */
export const EDITORIAL_BEATS = ["hook", "problem", "concept", "situation", "analysis", "conclusion"] as const;

/** How the video opens. Varies from video to video so the channel never sounds like a formula. */
export const OpeningType = z.enum(["paradox", "question", "situation", "contrast", "fact"]);
export type OpeningType = z.infer<typeof OpeningType>;

/**
 * The narrative identity of a video: how the concrete situation is told inside the fixed structure.
 * - two_paths: two people (or two choices) side by side, the difference explains the concept
 * - case_file: one real, verifiable case taken apart, then brought back to everyday life
 * - myth_vs_mechanism: what people believe, then what actually happens
 * - one_moment: one ordinary moment slowed down, decision by decision
 * - thought_experiment: the viewer is put in a made-up choice and watches their own reasoning
 * - rewind: start from the consequence, go back to the small decision that caused it
 * - everyday_object: an ordinary object (a receipt, a phone, a chair) carries the idea
 */
export const NarrativeShape = z.enum([
  "two_paths",
  "case_file",
  "myth_vs_mechanism",
  "one_moment",
  "thought_experiment",
  "rewind",
  "everyday_object",
]);
export type NarrativeShape = z.infer<typeof NarrativeShape>;

/**
 * A factual claim the narration makes (study, historical event, statistic, quote, definition), with what it
 * proves in the argument. Nothing here is checked automatically: `to_verify` claims go to the editor before
 * the video is published; `hypothetical` marks a made-up example presented as such.
 */
export const ScriptClaim = z
  .object({
    text: z.string().min(1).max(300),
    kind: z.enum(["study", "history", "statistic", "quote", "definition"]),
    status: z.enum(["to_verify", "widely_known", "hypothetical"]),
    /** Why the claim is in the video: what it shows in the argument. */
    role: z.string().min(1).max(200),
    source: z.string().max(200).optional(),
  })
  .strict();
export type ScriptClaim = z.infer<typeof ScriptClaim>;

/** What the viewer leaves with: a principle, a question to ask themselves, or a concrete tool. */
export const Takeaway = z
  .object({
    kind: z.enum(["principle", "question", "tool"]),
    text: z.string().min(1).max(240),
  })
  .strict();
export type Takeaway = z.infer<typeof Takeaway>;

/** A character of the story, played by one studio character for the whole video. */
export const CastMember = z
  .object({
    role: z.enum(["protagonist", "supporting"]),
    characterId: AssetId,
    /** Who they are in this story, e.g. "a student with a report due tomorrow". */
    description: z.string().min(1).max(200),
  })
  .strict();
export type CastMember = z.infer<typeof CastMember>;

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
    beat: StoryBeat.optional(),
    /** Where the scene happens in the story world, e.g. "bedroom, late at night". */
    setting: z.string().max(120).optional(),
    /** What the protagonist does, e.g. "scrolls the phone instead of opening the laptop". */
    action: z.string().max(200).optional(),
    /** What the protagonist feels, e.g. "guilty", "relieved". */
    emotion: z.string().max(40).optional(),
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
    /** The same characters play the whole video; the protagonist is the viewer's stand-in. */
    cast: z.array(CastMember).max(3).optional(),
    /** What the viewer will understand by the end, one sentence. */
    promise: z.string().min(1).max(200).optional(),
    opening: OpeningType.optional(),
    shape: NarrativeShape.optional(),
    takeaway: Takeaway.optional(),
    claims: z.array(ScriptClaim).max(10).optional(),
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
