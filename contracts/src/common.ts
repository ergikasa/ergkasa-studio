import { z } from "zod";

/** The six content themes of the channel, plus `everyday` for generic scene props. */
export const Theme = z.enum([
  "psychology",
  "money",
  "growth",
  "philosophy",
  "science",
  "decisions",
  "everyday",
]);
export type Theme = z.infer<typeof Theme>;

/** Video formats. 9:16 (TikTok / Shorts / Reels) is the V1 default. */
export const VideoFormat = z.enum(["9:16", "16:9", "1:1"]);
export type VideoFormat = z.infer<typeof VideoFormat>;

/** V1 produces English videos only. New languages are added here, never as free strings. */
export const Language = z.enum(["en"]);
export type Language = z.infer<typeof Language>;

/** `obj_money_bag`, `char_drini_01`, `bg_office_01`... lowercase, prefix + underscore. */
export const AssetId = z.string().regex(/^[a-z]+_[a-z0-9_]+$/, "assetId must look like prefix_name");

/** A versioned asset reference used inside timelines: `char_drini_01@1`. */
export const AssetRef = z
  .string()
  .regex(/^[a-z]+_[a-z0-9_]+@\d+$/, "asset ref must look like assetId@version");

/** Pointer to a stored artifact. Large files never travel inside messages. */
export const ArtifactUri = z
  .string()
  .regex(/^(s3|file):\/\/.+/, "artifact uri must start with s3:// or file://");

export const Sha256 = z.string().regex(/^[a-f0-9]{64}$/);

/** Short identifier for scenes, layers, steps: `s03`, `ana`, `title_1`. */
export const LocalId = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/);

export const Vec2 = z.tuple([z.number(), z.number()]);

/** Normalized coordinate inside the frame: 0 = left/top, 1 = right/bottom. */
export const Unit = z.number().min(-0.5).max(1.5);

export const NamedEasing = z.enum([
  "linear",
  "easeIn",
  "easeOut",
  "easeInOut",
  "easeInCubic",
  "easeOutCubic",
  "easeInOutCubic",
  "easeOutBack",
  "easeInOutBack",
  "hold",
]);

export const Easing = z.union([
  NamedEasing,
  z.object({ cubicBezier: z.tuple([z.number(), z.number(), z.number(), z.number()]) }).strict(),
  z
    .object({
      spring: z
        .object({
          mass: z.number().positive().default(1),
          stiffness: z.number().positive().default(100),
          damping: z.number().positive().default(12),
        })
        .strict(),
    })
    .strict(),
  z.object({ steps: z.number().int().positive() }).strict(),
]);
export type Easing = z.infer<typeof Easing>;
