import { z } from "zod";
import { Theme } from "./common.js";

/** ElevenLabs voice_settings, per preset. Ranges follow the provider's documented behaviour. */
export const VoiceSettings = z
  .object({
    /** Lower = more expressive, higher = steadier. */
    stability: z.number().min(0).max(1).default(0.5),
    /** How closely the output follows the original voice. */
    similarityBoost: z.number().min(0).max(1).default(0.75),
    /** Style exaggeration; 0 keeps the voice neutral. */
    style: z.number().min(0).max(1).default(0),
    /** 1 = normal pace. */
    speed: z.number().min(0.7).max(1.2).default(1),
    speakerBoost: z.boolean().default(true),
  })
  .strict();
export type VoiceSettings = z.infer<typeof VoiceSettings>;

/** A narrator the user can pick. Provider voice ids are not secrets; API keys never appear here. */
export const VoicePreset = z
  .object({
    /** Studio id, used in plans and on the command line: `mark_natural`. */
    id: z.string().regex(/^[a-z][a-z0-9_]{1,40}$/),
    name: z.string().min(1).max(40),
    provider: z.literal("elevenlabs"),
    providerVoiceId: z.string().regex(/^[A-Za-z0-9]{10,40}$/),
    gender: z.enum(["male", "female", "neutral"]),
    age: z.enum(["young_adult", "adult", "middle_aged", "senior"]).optional(),
    accent: z.string().max(40).optional(),
    description: z.string().min(1).max(200),
    /** Themes this voice suits best (a suggestion for the UI, not a restriction). */
    bestFor: z.array(Theme).default([]),
    settings: VoiceSettings,
  })
  .strict();
export type VoicePreset = z.infer<typeof VoicePreset>;

export const VoiceCatalog = z
  .object({
    schema: z.literal("erkasa.voice-catalog/1"),
    /** Preset used when the user does not choose one. */
    default: z.string().min(1),
    voices: z.array(VoicePreset).min(1),
  })
  .strict()
  .superRefine((c, ctx) => {
    const ids = new Set<string>();
    c.voices.forEach((v, i) => {
      if (ids.has(v.id))
        ctx.addIssue({ code: "custom", message: `duplicate voice id '${v.id}'`, path: ["voices", i, "id"] });
      ids.add(v.id);
    });
    if (!ids.has(c.default))
      ctx.addIssue({
        code: "custom",
        message: `default '${c.default}' is not a voice in the catalog`,
        path: ["default"],
      });
  });
export type VoiceCatalog = z.infer<typeof VoiceCatalog>;
