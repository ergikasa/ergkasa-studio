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

/** Where a scene sits emotionally, as far as the music is concerned (from the script beats). */
export const MusicRole = z.enum([
  "hook",
  "relate",
  "explain",
  "tension",
  "twist",
  "reflection",
  "turn",
  "resolve",
]);
export type MusicRole = z.infer<typeof MusicRole>;

export const SectionName = z.enum(["intro", "build", "peak", "outro"]);
export type SectionName = z.infer<typeof SectionName>;

/** A part of a music track. `auto` = proposed from the loudness curve; `listened` = confirmed by ear. */
export const MusicSection = z
  .object({ name: SectionName, ...Timed, source: z.enum(["auto", "listened"]) })
  .strict()
  .refine((s) => s.end > s.start, { message: "section ends before it starts" });
export type MusicSection = z.infer<typeof MusicSection>;

export const SfxCategory = z.enum([
  "transition",
  "ui",
  "phone",
  "time",
  "object",
  "body",
  "beat",
  "metaphor",
]);
export type SfxCategory = z.infer<typeof SfxCategory>;

const Tag = z.string().regex(/^[a-z][a-z0-9_]*$/);

/** Measured by `pnpm audio:import` from the downloaded file. */
export const ImportedAudio = z
  .object({
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    durationSec: z.number().positive(),
    /** Integrated loudness (EBU R128). Very short sounds fall back to a peak-based estimate. */
    loudnessLufs: z.number().max(0),
    truePeakDb: z.number().max(6),
    importedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  })
  .strict();

/**
 * One music track or sound effect, with where it came from and under which rights. The audio file
 * itself never goes into Git (the Pixabay license forbids redistributing it on its own); this entry
 * is what we keep to prove origin and rights.
 */
export const AudioCatalogEntry = z
  .object({
    id: AssetId,
    kind: z.enum(["music", "sfx"]),
    title: z.string().min(1).max(160),
    author: z.string().min(1).max(80),
    sourceUrl: z
      .string()
      .regex(/^https:\/\/pixabay\.com\/(music|sound-effects)\/.+/, "sourceUrl must be the Pixabay page"),
    license: z
      .object({
        name: z.literal("Pixabay Content License"),
        url: z.literal("https://pixabay.com/service/license-summary/"),
      })
      .strict(),
    /** Labels on the source page when it was checked. Either one being true keeps the file out of videos. */
    contentIdRegistered: z.boolean(),
    aiGenerated: z.boolean(),
    checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    /** Relative to the audio library folder (ERKASA_AUDIO_DIR, default assets-src/audio). */
    file: z.string().regex(/^(music|sfx)\/[a-z0-9_]+\.(mp3|wav|ogg)$/),
    status: z.enum(["pending", "imported", "rejected"]),
    rejectedReason: z.string().max(300).optional(),
    imported: ImportedAudio.optional(),
    notes: z.string().max(400).optional(),
    // music
    mood: z.string().max(60).optional(),
    character: z.string().max(160).optional(),
    roles: z.array(MusicRole).optional(),
    sections: z.array(MusicSection).optional(),
    // sfx
    category: SfxCategory.optional(),
    /** Compiler / story events this sound may play on, e.g. `action_use_phone`, `beat_twist`. */
    events: z.array(Tag).optional(),
    /** Trim relative to the automatic level, set by listening. */
    gainDb: z.number().min(-24).max(12).default(0),
    maxPerVideo: z.number().int().min(1).max(10).optional(),
  })
  .strict()
  .superRefine((e, ctx) => {
    const issue = (message: string, path: string) => ctx.addIssue({ code: "custom", message, path: [path] });
    if (!e.file.startsWith(`${e.kind}/`)) issue(`a ${e.kind} file must live in ${e.kind}/`, "file");
    if (e.kind === "music" && !e.roles?.length) issue("music needs at least one role", "roles");
    if (e.kind === "sfx" && (!e.category || !e.events?.length))
      issue("sfx needs a category and events", "events");
    if (e.status === "imported" && !e.imported) issue("imported entry without measurements", "imported");
    if (e.status === "rejected" && !e.rejectedReason)
      issue("rejected entry needs a reason", "rejectedReason");
    if (e.status === "imported" && (e.contentIdRegistered || e.aiGenerated))
      issue("Content ID or AI-generated tracks cannot be imported", "status");
    const dur = e.imported?.durationSec;
    e.sections?.forEach((s, i) => {
      if (dur !== undefined && s.end > dur + 0.05)
        ctx.addIssue({ code: "custom", message: "section beyond track end", path: ["sections", i] });
    });
  });
export type AudioCatalogEntry = z.infer<typeof AudioCatalogEntry>;

/** Levels of the mix. Tuned by listening, never by eye: change a number, run `pnpm audio:mix`, listen. */
export const MixSettings = z
  .object({
    /** Music bed loudness below the narration, before ducking. */
    musicUnderVoiceDb: z.number().min(6).max(36).default(18),
    /** Extra reduction while someone speaks (sidechain). */
    duckDb: z.number().min(0).max(24).default(7),
    duckAttackMs: z.number().int().min(5).max(1000).default(120),
    duckReleaseMs: z.number().int().min(50).max(3000).default(500),
    /** Sound effects loudness below the narration. */
    sfxUnderVoiceDb: z.number().min(0).max(30).default(12),
    crossfadeSec: z.number().min(0.2).max(4).default(1.6),
    /** Music changes shorter than this are merged into the neighbour: no track hopping. */
    minSegmentSec: z.number().min(3).max(30).default(9),
    /** At most one effect every N seconds on average, and never two closer than minSfxGapSec. */
    sfxEverySec: z.number().min(1).max(20).default(4.5),
    minSfxGapSec: z.number().min(0.3).max(10).default(1.8),
    targetLufs: z.number().min(-30).max(-8).default(-14),
    truePeakDb: z.number().min(-6).max(0).default(-1),
  })
  .strict();
export type MixSettings = z.infer<typeof MixSettings>;

export const AudioCatalog = z
  .object({
    schema: z.literal("erkasa.audio-catalog/1"),
    mix: MixSettings,
    entries: z.array(AudioCatalogEntry),
  })
  .strict()
  .superRefine((c, ctx) => {
    const seen = new Set<string>();
    c.entries.forEach((e, i) => {
      if (seen.has(e.id))
        ctx.addIssue({ code: "custom", message: `duplicate id '${e.id}'`, path: ["entries", i, "id"] });
      seen.add(e.id);
    });
  });
export type AudioCatalog = z.infer<typeof AudioCatalog>;

/**
 * The soundtrack of one video: narration, music segments that follow the story, and sound effects.
 * Written by the sound designer from the compiled timeline; mixed once by FFmpeg.
 */
export const AudioPlan = z
  .object({
    schema: z.literal("erkasa.audio-plan/2"),
    durationSec: z.number().positive(),
    voice: z
      .array(z.object({ sceneId: LocalId, audio: ArtifactUri, startSec: z.number().min(0) }).strict())
      .default([]),
    /** Measured narration loudness; music and effects are placed relative to it. */
    voiceLufs: z.number().max(0).optional(),
    music: z
      .array(
        z
          .object({
            assetId: AssetId,
            role: MusicRole,
            section: SectionName.optional(),
            /** Where the segment sits on the video timeline. */
            startSec: z.number().min(0),
            endSec: z.number().min(0),
            /** Where in the track it starts playing. */
            offsetSec: z.number().min(0),
            gainDb: z.number().min(-60).max(12),
            fadeInSec: z.number().min(0),
            fadeOutSec: z.number().min(0),
          })
          .strict()
          .refine((m) => m.endSec > m.startSec, { message: "music segment ends before it starts" }),
      )
      .default([]),
    ducking: z
      .object({
        amountDb: z.number().min(0).max(30),
        attackMs: z.number().int().min(0),
        releaseMs: z.number().int().min(0),
      })
      .strict(),
    sfx: z
      .array(
        z
          .object({
            assetId: AssetId,
            atSec: z.number().min(0),
            gainDb: z.number().min(-60).max(12),
            /** Start this far into the file (e.g. the last seconds of a riser, so its top lands on the beat). */
            offsetSec: z.number().min(0).optional(),
            /** Play at most this long, with a short fade (long ticking beds). */
            maxSec: z.number().positive().optional(),
            /** Why it plays, e.g. `s03 arti action_use_phone`: the mix must be explainable. */
            reason: z.string().max(120),
          })
          .strict(),
      )
      .default([]),
    loudness: z.object({ targetLufs: z.number(), truePeakDb: z.number() }).strict(),
  })
  .strict();
export type AudioPlan = z.infer<typeof AudioPlan>;
