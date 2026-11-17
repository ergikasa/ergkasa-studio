/**
 * erkasa.assets/1 — the Asset Manifest.
 *
 * Every visual, rig, font and audio resource a render may use, frozen: where its bytes are, their hash, how it
 * sits in the world (geometry), the states it can be drawn in, where it can be touched (affordances, pivots),
 * and whether it was approved. The engine draws only what a manifest declares; the manifest says nothing about
 * stories, meaning or when anything happens.
 *
 * Versioning: `schema` is a literal. Adding an optional field keeps `/1`; removing or changing the meaning of a
 * field is `/2`. Objects are strict: an engine rejects fields it does not know instead of ignoring them.
 */
import { z } from "zod";
import { Sha256 } from "./common.js";

export const ASSET_MANIFEST_SCHEMA = "erkasa.assets/1";

/** `prop_book`, `set_prison_cell`, `rig_cutout_man`: lowercase, prefix + underscore (same rule as AssetId). */
export const ManifestAssetId = z.string().regex(/^[a-z]+_[a-z0-9_]+$/, "asset id must look like prefix_name");
/** `prop_book@1`: the only way a render package names an asset. */
export const ManifestAssetRef = z
  .string()
  .regex(/^[a-z]+_[a-z0-9_]+@\d+$/, "asset ref must look like id@version");

/** A name inside an asset: a state, a pivot, a bone, an SVG element id. */
export const PartName = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/);

/** Where the bytes are. Files carry their hash; built-in resources are drawn by the engine itself. */
export const FileSource = z
  .object({
    kind: z.literal("file"),
    /** Relative to the package root (`assets/...`) or absolute `file://` / `s3://`. */
    uri: z
      .string()
      .regex(/^(file:\/\/|s3:\/\/)?[A-Za-z0-9_./-]+$/, "uri must be a relative path, file:// or s3://"),
    sha256: Sha256,
  })
  .strict();
/**
 * A resource the engine provides in code (a procedural rig, a bundled font). Allowed so that plans can be executed
 * before every resource exists as a file; each one is visible in the manifest and can be replaced by a file later.
 */
export const BuiltinSource = z
  .object({
    kind: z.literal("builtin"),
    name: z.string().regex(/^[a-z][a-z0-9_.-]{0,63}$/),
  })
  .strict();
export const AssetSource = z.discriminatedUnion("kind", [FileSource, BuiltinSource]);
export type AssetSource = z.infer<typeof AssetSource>;

/** A point in the asset's own coordinates (its viewBox). */
export const AssetPoint = z.tuple([z.number(), z.number()]);

/** How a vector asset sits in the world. */
export const Geometry = z
  .object({
    /** The drawing's own coordinate system: [minX, minY, width, height]. */
    viewBox: z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()]),
    /** Size in world units when drawn at scale 1. */
    size: z.object({ w: z.number().positive(), h: z.number().positive() }).strict(),
    /** The point placed at a node's (x, y): usually where it touches the ground. */
    origin: AssetPoint,
  })
  .strict();

/** One way the asset can be drawn. A state is either another file or an element id inside the main file. */
export const AssetState = z
  .object({
    name: PartName,
    source: AssetSource.optional(),
    /** Element id inside the main SVG to show for this state (others with a state id are hidden). */
    element: PartName.optional(),
  })
  .strict();

/**
 * Physical facts about an object that generic actions use: where a hand holds it, where one sits on it, which
 * states mean "open". These are not behaviours; the engine and the stager decide what to do with them.
 */
export const Affordance = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("grip"), point: AssetPoint }).strict(),
  z.object({ kind: z.literal("seat"), point: AssetPoint }).strict(),
  z.object({ kind: z.literal("surface"), from: AssetPoint, to: AssetPoint }).strict(),
  z.object({ kind: z.literal("stand"), point: AssetPoint }).strict(),
  z
    .object({
      kind: z.literal("openable"),
      closed: PartName,
      open: PartName,
    })
    .strict(),
  z.object({ kind: z.literal("readable"), state: PartName }).strict(),
  z.object({ kind: z.literal("pushable"), point: AssetPoint }).strict(),
]);
export type Affordance = z.infer<typeof Affordance>;

export const Pivot = z.object({ id: PartName, at: AssetPoint }).strict();

/** Kit, Style Gate result. Filled by the asset responsible; the engine only reads `kit`. */
export const AssetStyle = z
  .object({
    kit: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
    gate: z
      .object({
        reportId: z.string().min(1).max(128),
        passed: z.boolean(),
        /** 0..1, how close to the kit; absent when the gate gives only pass/fail. */
        score: z.number().min(0).max(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const Provenance = z
  .object({
    origin: z.enum(["kit", "generator", "ai", "builtin"]),
    /** Generator or model that made it. */
    by: z.string().max(128).optional(),
    promptSha256: Sha256.optional(),
    costUsd: z.number().min(0).optional(),
  })
  .strict();

export const Approval = z
  .object({
    status: z.enum(["approved", "pending", "rejected"]),
    by: z.string().min(1).max(128).optional(),
    /** ISO 8601. */
    at: z.string().datetime({ offset: true }).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

const common = {
  id: ManifestAssetId,
  version: z.number().int().min(1),
  source: AssetSource,
  style: AssetStyle,
  provenance: Provenance,
  approval: Approval,
  license: z.string().max(200).optional(),
};

export const VectorAsset = z
  .object({
    ...common,
    kind: z.literal("vector"),
    format: z.literal("svg"),
    geometry: Geometry,
    /** Declared states; a node may only be drawn in one of these. Absent: one state, the main file. */
    states: z.array(AssetState).min(1).max(32).optional(),
    defaultState: PartName.optional(),
    affordances: z.array(Affordance).max(16).optional(),
    pivots: z.array(Pivot).max(16).optional(),
  })
  .strict();

/** A skeleton the engine animates through named channels. */
export const RigAsset = z
  .object({
    ...common,
    kind: z.literal("rig"),
    /** `erkasa.rig.cutout/1` (parts + bones) or a built-in procedural rig. */
    format: z.string().regex(/^erkasa\.rig\.[a-z-]+\/\d+$/),
    /** Height of the rig standing, in world units. */
    height: z.number().positive(),
    bones: z
      .array(
        z
          .object({
            id: PartName,
            parent: PartName.optional(),
            /** Degrees from the rest pose this bone may turn. */
            range: z.tuple([z.number(), z.number()]).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(64),
    /** Non-bone channels (face, eyes, breath), each a number in the given range. */
    channels: z
      .array(z.object({ id: PartName, range: z.tuple([z.number(), z.number()]) }).strict())
      .max(64)
      .default([]),
    /** Points a prop can be attached to (hands). */
    sockets: z
      .array(z.object({ id: PartName, bone: PartName }).strict())
      .max(16)
      .default([]),
    /** Colour slots that an actor's appearance may set (coat, hair, skin). */
    slots: z.array(PartName).max(16).default([]),
  })
  .strict();

export const FontAsset = z
  .object({
    ...common,
    kind: z.literal("font"),
    format: z.enum(["ttf", "otf", "woff2"]),
    family: z.string().min(1).max(64),
    weight: z.number().int().min(100).max(900),
  })
  .strict();

export const AudioAsset = z
  .object({
    ...common,
    kind: z.literal("audio"),
    format: z.enum(["wav", "mp3", "ogg", "flac"]),
    durationSec: z.number().positive(),
    sampleRate: z.number().int().positive().optional(),
  })
  .strict();

export const ManifestAsset = z.discriminatedUnion("kind", [VectorAsset, RigAsset, FontAsset, AudioAsset]);
export type ManifestAsset = z.infer<typeof ManifestAsset>;

export const AssetManifest = z
  .object({
    schema: z.literal(ASSET_MANIFEST_SCHEMA),
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/),
    assets: z.array(ManifestAsset).min(1).max(5000),
  })
  .strict();
export type AssetManifest = z.infer<typeof AssetManifest>;
