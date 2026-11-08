import { z } from "zod";
import { ArtifactUri, AssetRef, Easing, LocalId } from "./common.js";

/**
 * Render Timeline: the fully resolved, frame-exact description the engine renders.
 * Produced only by the compiler; never written by an LLM.
 */

const Frame = z.number().int().min(0);

export const KeyframeValue = z.union([z.number(), z.string(), z.tuple([z.number(), z.number()])]);

export const Keyframe = z
  .object({
    f: Frame,
    v: KeyframeValue,
    ease: Easing.optional(),
    /** Frames of cross-fade when switching discrete values (e.g. action clips). */
    blend: z.number().int().min(0).max(30).optional(),
  })
  .strict();

/** Track name -> keyframes sorted by frame. Tracks: x, y, scale, rotation, opacity, clip, expression, state.<part>... */
export const Tracks = z.record(z.string().regex(/^[a-z][a-zA-Z0-9_.]*$/), z.array(Keyframe).min(1));

export const TimelineNode = z
  .object({
    id: LocalId,
    adapter: z.enum(["character", "svg", "sprite", "particle", "motion_graphics", "text"]),
    asset: AssetRef.optional(),
    props: z.record(z.string(), z.unknown()).default({}),
    z: z.number().int().default(0),
    tracks: Tracks,
    visemes: z.object({ ref: ArtifactUri }).strict().optional(),
  })
  .strict();

export const TimelineScene = z
  .object({
    sceneId: LocalId,
    from: Frame,
    duration: z.number().int().positive(),
    background: z.object({ asset: AssetRef }).strict(),
    nodes: z.array(TimelineNode),
    camera: Tracks.default({}),
    transitionIn: z
      .object({
        type: z.enum(["cut", "fade", "slide", "wipe", "zoom", "whip"]),
        frames: z.number().int().min(0),
        direction: z.string().optional(),
      })
      .strict()
      .default({ type: "cut", frames: 0 }),
  })
  .strict()
  .superRefine((s, ctx) => {
    for (const node of s.nodes) {
      for (const [track, kfs] of Object.entries({ ...node.tracks })) {
        kfs.forEach((k, i) => {
          if (k.f > s.duration) {
            ctx.addIssue({
              code: "custom",
              message: `keyframe beyond scene end in ${node.id}.${track}`,
              path: ["nodes"],
            });
          }
          const prev = kfs[i - 1];
          if (prev && prev.f > k.f) {
            ctx.addIssue({
              code: "custom",
              message: `keyframes not sorted in ${node.id}.${track}`,
              path: ["nodes"],
            });
          }
        });
      }
    }
  });

export const RenderTimeline = z
  .object({
    schema: z.literal("erkasa.timeline/1"),
    fps: z.literal(30),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    /** Seed for every random-looking thing (particles, blinks): same seed, same video. */
    seed: z.number().int().min(0),
    scenes: z.array(TimelineScene).min(1),
    audio: z.object({ ref: ArtifactUri }).strict(),
    captions: z
      .object({ ref: ArtifactUri, style: z.string().regex(/^[a-z_]+$/) })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((t, ctx) => {
    t.scenes.forEach((s, i) => {
      const prev = t.scenes[i - 1];
      if (prev && s.from < prev.from + prev.duration - s.transitionIn.frames) {
        ctx.addIssue({
          code: "custom",
          message: `scene ${s.sceneId} overlaps the previous one`,
          path: ["scenes", i, "from"],
        });
      }
    });
  });
export type RenderTimeline = z.infer<typeof RenderTimeline>;
