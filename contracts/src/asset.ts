import { z } from "zod";
import { AssetId, Theme, Vec2 } from "./common.js";

export const AssetCategory = z.enum([
  "character",
  "background",
  "metaphor",
  "object",
  "icon",
  "audio",
  "effect",
]);

export const AssetKind = z.enum([
  "rigged_character",
  "crowd_figure",
  "layered_background",
  "animated_metaphor",
  "prop",
  "icon",
  "sprite",
  "lottie",
  "particle_preset",
  "audio_music",
  "audio_sfx",
  /** Visual effect drawn over the scene (capabilities.placement: screen = full frame, world = placed like an object). */
  "overlay",
]);

/** Which engine adapter renders the asset. Every kind maps to exactly one adapter. */
export const AdapterName = z.enum(["character", "svg", "sprite", "particle", "motion_graphics", "audio"]);

export const AssetLicense = z
  .object({
    spdx: z.string().min(1),
    source: z.string().min(1),
    url: z.string().url().optional(),
    licenseUrl: z.string().url().optional(),
    /** Only assets cleared for commercial use may enter the library. */
    commercial: z.literal(true),
    attributionRequired: z.boolean(),
  })
  .strict();

const Anchor = z.union([Vec2, z.string().regex(/^bone:[a-z_]+$/)]);

export const BackgroundLayer = z.object({ id: z.string().startsWith("layer_"), depth: z.number() }).strict();

export const AssetMeta = z
  .object({
    schema: z.literal("erkasa.asset/1"),
    assetId: AssetId,
    version: z.number().int().positive(),
    name: z.string().min(1),
    description: z.string().optional(),
    category: AssetCategory,
    subcategory: z.string().optional(),
    /** Editorial grouping of the library (home, everyday, work, relationships, tech, money, health, city, metaphors, backgrounds). */
    collection: z.string().min(1).optional(),
    /** What the asset is for in a story, in English: the planner searches and reads this. */
    storyUse: z.string().min(1).optional(),
    kind: AssetKind,
    adapter: AdapterName,
    style: z.string().min(1),
    files: z.record(z.string(), z.string().min(1)),
    variants: z.record(z.string(), z.string()).optional(),
    viewBox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
    themable: z
      .object({ color: z.literal("currentColor"), default: z.string() })
      .strict()
      .optional(),
    /** Free-form per kind (actions for characters, camera moves for backgrounds...). */
    capabilities: z.record(z.string(), z.unknown()),
    anchors: z.record(z.string(), Anchor).optional(),
    sizing: z.object({ heightRatio: z.number().positive() }).strict().optional(),
    // backgrounds
    layers: z.array(BackgroundLayer).optional(),
    groundY: z.number().nullable().optional(),
    actorZones: z.array(Vec2).optional(),
    safeFrames: z.record(z.string(), z.tuple([z.number(), z.number(), z.number(), z.number()])).optional(),
    mood: z.array(z.string()).optional(),
    /** Wide places: named zones along the background, x as a fraction of its width (0..1). */
    zones: z
      .record(
        z.string().regex(/^[a-z][a-z0-9_]*$/),
        z.object({ x: z.number().min(0).max(1), label: z.string().optional() }).strict(),
      )
      .optional(),
    // metaphors: part id -> how it moves
    parts: z.record(z.string(), z.string()).optional(),
    themes: z.array(Theme),
    tags: z.array(z.string().min(1)).min(1),
    license: AssetLicense,
  })
  .strict()
  .superRefine((a, ctx) => {
    if (a.kind === "layered_background" && !a.layers?.length) {
      ctx.addIssue({
        code: "custom",
        message: "layered_background needs at least one layer",
        path: ["layers"],
      });
    }
    if (a.kind === "rigged_character" && !a.files["rig"]) {
      ctx.addIssue({ code: "custom", message: "rigged_character needs files.rig", path: ["files", "rig"] });
    }
    if (a.kind === "animated_metaphor" && !a.parts) {
      ctx.addIssue({ code: "custom", message: "animated_metaphor needs parts", path: ["parts"] });
    }
  });
export type AssetMeta = z.infer<typeof AssetMeta>;

export const Bone = z
  .object({
    id: z.string().min(1),
    parent: z.string().nullable(),
    pivot: Vec2,
    z: z.number().int(),
    svgGroup: z.string().min(1),
  })
  .strict();

export const Rig = z
  .object({
    schema: z.literal("erkasa.rig/1"),
    assetId: AssetId,
    skeleton: z.string().min(1),
    units: z.literal("px"),
    canvas: Vec2,
    ground: Vec2,
    bones: z.array(Bone).min(1),
    slots: z.record(z.string(), z.array(z.string()).min(1)),
    expressions: z.record(z.string(), z.record(z.string(), z.string())),
    visemes: z.record(z.string(), z.string()),
    limits: z.record(z.string(), Vec2),
  })
  .strict()
  .superRefine((rig, ctx) => {
    const ids = new Set(rig.bones.map((b) => b.id));
    rig.bones.forEach((b, i) => {
      if (b.parent !== null && !ids.has(b.parent)) {
        ctx.addIssue({
          code: "custom",
          message: `unknown parent '${b.parent}'`,
          path: ["bones", i, "parent"],
        });
      }
    });
  });
export type Rig = z.infer<typeof Rig>;
