import { z } from "zod";
import { ArtifactUri, AssetId, LocalId } from "./common.js";

const Timed = { start: z.number().min(0), end: z.number().min(0) };

/** Exact timing of the narration, normalized from the TTS provider (ElevenLabs `with-timestamps`). */
export const VoiceAlignment = z
  .object({
    schema: z.literal("erkasa.alignment/1"),
    sceneId: LocalId,
    audio: ArtifactUri,
    durationSec: z.number().positive(),
    characters: z.array(z.object({ char: z.string().length(1), ...Timed }).strict()),
    words: z.array(z.object({ word: z.string().min(1), ...Timed }).strict()).min(1),
  })
  .strict()
  .superRefine((a, ctx) => {
    a.words.forEach((w, i) => {
      if (w.end < w.start)
        ctx.addIssue({ code: "custom", message: "word ends before it starts", path: ["words", i] });
      if (w.end > a.durationSec + 0.05)
        ctx.addIssue({ code: "custom", message: "word beyond audio end", path: ["words", i] });
    });
  });
export type VoiceAlignment = z.infer<typeof VoiceAlignment>;

/** The full mix, rendered once by FFmpeg after the video chunks. */
export const AudioPlan = z
  .object({
    schema: z.literal("erkasa.audio-plan/1"),
    durationSec: z.number().positive(),
    voice: z
      .array(z.object({ sceneId: LocalId, audio: ArtifactUri, startSec: z.number().min(0) }).strict())
      .min(1),
    music: z
      .object({
        assetId: AssetId,
        gainDb: z.number().min(-40).max(0).default(-18),
        fadeInSec: z.number().min(0).default(1),
        fadeOutSec: z.number().min(0).default(1.5),
        ducking: z
          .object({
            amountDb: z.number().min(-30).max(0).default(-12),
            attackMs: z.number().int().min(0).default(150),
            releaseMs: z.number().int().min(0).default(400),
          })
          .strict(),
      })
      .strict()
      .optional(),
    sfx: z
      .array(
        z
          .object({
            assetId: AssetId,
            atSec: z.number().min(0),
            gainDb: z.number().min(-40).max(6).default(-6),
          })
          .strict(),
      )
      .default([]),
    loudness: z.object({ targetLufs: z.number().default(-14), truePeakDb: z.number().default(-1) }).strict(),
  })
  .strict();
export type AudioPlan = z.infer<typeof AudioPlan>;
