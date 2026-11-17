/**
 * erkasa.render/1 — the Render Package: everything the engine needs to draw a film, as numbers and references.
 *
 * It describes WHAT is on screen and WHEN, in world units and seconds: scenes made of layers at a depth, nodes
 * that draw manifest assets, text or plain shapes, actors driven through their rig's channels, a camera, lights,
 * state changes, screen overlays and audio. It contains no story, no intent, no verbs or moods and no names of
 * who produced it beyond an informational `producer`: a package written by a model, a program or a person is
 * executed the same way.
 *
 * Conventions
 *   time      seconds from the start of the film (absolute, also inside scenes)
 *   space     world units; x to the right, y down; depth 0 = the plane people stand on, > 0 further away
 *   angles    degrees, clockwise
 *   colours   #RRGGBB or #RRGGBBAA
 *   assets    `id@version`, resolved in the Asset Manifest named by `assetManifest` (hash-checked)
 *
 * What this schema checks: shapes, types, ranges, required fields, versions. What the Validation Gate checks
 * (it needs the manifest and the engine's capabilities): that every reference exists, keys are in order and
 * inside the film, states and channels are declared, one holder per object at a time, budgets.
 *
 * Versioning: `schema` is a literal. Adding an optional field keeps `/1`; anything else is `/2`. Objects are
 * strict: an engine rejects fields it does not know.
 */
import { z } from "zod";
import { NamedEasing, Sha256 } from "./common.js";
import { ManifestAssetRef, PartName } from "./asset-manifest.js";

export const RENDER_PACKAGE_SCHEMA = "erkasa.render/1";

export const RId = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/);
export const Color = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/, "colour must be #RRGGBB or #RRGGBBAA");
const Seconds = z.number().min(0);
const Num = z.number().finite();

// ------------------------------------------------------------------------------------------------ nodes

const placement = {
  id: RId,
  x: Num,
  y: Num,
  scale: z.number().positive().default(1),
  rotation: Num.default(0),
  opacity: z.number().min(0).max(1).default(1),
  /** Mirror horizontally. */
  flip: z.boolean().default(false),
};

export const AssetNode = z
  .object({
    ...placement,
    kind: z.literal("asset"),
    asset: ManifestAssetRef,
    /** One of the asset's declared states; absent = its default. */
    state: PartName.optional(),
    /** A declared pivot of the asset to rotate and scale around; absent = its origin. */
    pivot: PartName.optional(),
  })
  .strict();

export const TextNode = z
  .object({
    ...placement,
    kind: z.literal("text"),
    text: z.string().min(1).max(500),
    font: ManifestAssetRef,
    size: z.number().positive(),
    color: Color,
    align: z.enum(["left", "center", "right"]).default("left"),
    maxWidth: z.number().positive().optional(),
    lineHeight: z.number().positive().default(1.2),
    stroke: z.object({ color: Color, width: z.number().positive() }).strict().optional(),
  })
  .strict();

const Paint = z.union([
  Color,
  z
    .object({
      kind: z.enum(["linear", "radial"]),
      /** Gradient geometry in the node's local box, 0..1. */
      from: z.tuple([Num, Num]),
      to: z.tuple([Num, Num]),
      stops: z
        .array(z.object({ at: z.number().min(0).max(1), color: Color }).strict())
        .min(2)
        .max(16),
    })
    .strict(),
]);

export const ShapeNode = z
  .object({
    ...placement,
    kind: z.literal("shape"),
    shape: z.discriminatedUnion("type", [
      z
        .object({
          type: z.literal("rect"),
          w: z.number().positive(),
          h: z.number().positive(),
          radius: z.number().min(0).default(0),
        })
        .strict(),
      z.object({ type: z.literal("ellipse"), rx: z.number().positive(), ry: z.number().positive() }).strict(),
      z.object({ type: z.literal("path"), d: z.string().min(1).max(20000) }).strict(),
    ]),
    fill: Paint.optional(),
    stroke: z.object({ color: Color, width: z.number().positive() }).strict().optional(),
  })
  .strict();

export const Node = z.discriminatedUnion("kind", [AssetNode, TextNode, ShapeNode]);
export type Node = z.infer<typeof Node>;

export const Layer = z
  .object({
    id: RId,
    /** Distance behind the actors' plane (world units); negative = in front of it. */
    depth: Num,
    /** Extra blur in pixels regardless of focus (atmosphere); depth-of-field blur comes from the camera. */
    blur: z.number().min(0).default(0),
    /** Whether lights in the scene affect this layer (sky and screens usually not). */
    lit: z.boolean().default(true),
    nodes: z.array(Node).max(2000),
  })
  .strict();

// ------------------------------------------------------------------------------------------------ actors

export const Actor = z
  .object({
    id: RId,
    rig: ManifestAssetRef,
    /** The layer the actor is drawn in; actors are sorted among that layer's nodes by y. */
    layer: RId,
    /** Colours for the rig's slots (coat, hair, skin...). */
    appearance: z.record(PartName, Color).default({}),
    /** A soft shadow cast away from the strongest light. */
    shadow: z.boolean().default(true),
    /** A rim of light on the side facing the key light. */
    rim: z.boolean().default(true),
  })
  .strict();

// ------------------------------------------------------------------------------------------------ camera, lights

export const Camera = z
  .object({
    /**
     * flat: every layer moves with the camera (no parallax). parallax: layers move by their depth; `dolly` says
     * how much of a zoom is the camera moving (1) rather than the lens (0).
     */
    projection: z.enum(["flat", "parallax"]),
    /** Distance from the camera to the actors' plane at the reference framing, world units. */
    referenceDistance: z.number().positive(),
    dolly: z.number().min(0).max(1).default(0.5),
    /** Depth-of-field strength: blur in px per 1000 world units away from focus. 0 = everything sharp. */
    aperture: z.number().min(0).default(0),
  })
  .strict();

export const Light = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("ambient"),
      id: RId,
      color: Color,
    })
    .strict(),
  z
    .object({
      kind: z.literal("point"),
      id: RId,
      x: Num,
      y: Num,
      depth: Num.default(0),
      radius: z.number().positive(),
      color: Color,
      intensity: z.number().min(0).default(1),
      castsShadows: z.boolean().default(false),
    })
    .strict(),
  z
    .object({
      kind: z.literal("shaft"),
      id: RId,
      /** A beam from a window or a door: polygon in world units. */
      polygon: z
        .array(z.tuple([Num, Num]))
        .min(3)
        .max(16),
      color: Color,
      intensity: z.number().min(0).default(1),
      softness: z.number().min(0).default(16),
    })
    .strict(),
]);

// ------------------------------------------------------------------------------------------------ animation

/** Which property a track drives. Channel names are checked against the target (rig channels, node fields). */
export const TrackTarget = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("node"), id: RId }).strict(),
  z.object({ kind: z.literal("actor"), id: RId }).strict(),
  z.object({ kind: z.literal("camera") }).strict(),
  z.object({ kind: z.literal("light"), id: RId }).strict(),
  z.object({ kind: z.literal("layer"), id: RId }).strict(),
]);

/**
 * `x`, `y`, `scale`, `rotation`, `opacity` for nodes and layers; for actors `root.x`, `root.y`, `root.scale`,
 * `facing` (-1/1), `turn` (0..1, how much of the body faces the camera while turning), `bone.<id>` (degrees) and
 * `channel.<id>` (the rig's own range); for the camera `x`, `y`, `height` (visible world height at depth 0),
 * `focus` (depth in focus), `shake`; for lights `intensity`, `color`, `radius`, `x`, `y`.
 */
export const ChannelName = z.string().regex(/^[a-z][a-zA-Z]*(\.[A-Za-z][A-Za-z0-9_-]*)?$/);

export const RenderKeyframe = z
  .object({
    t: Seconds,
    v: z.union([Num, Color]),
    /** How the value travels from the previous key to this one. */
    ease: NamedEasing.default("linear"),
  })
  .strict();

export const KeyframeTrack = z
  .object({
    kind: z.literal("keys"),
    target: TrackTarget,
    channel: ChannelName,
    keys: z.array(RenderKeyframe).min(1).max(20000),
  })
  .strict();

/** A dense track: one value per sample from `start`, `rate` samples per second (motion computed upstream). */
export const SampledTrack = z
  .object({
    kind: z.literal("samples"),
    target: TrackTarget,
    channel: ChannelName,
    start: Seconds,
    rate: z.number().positive().max(240),
    values: z.array(Num).min(1).max(200000),
  })
  .strict();

export const Track = z.discriminatedUnion("kind", [KeyframeTrack, SampledTrack]);
export type Track = z.infer<typeof Track>;

/** Who holds what: from `from` to `to` the node follows the socket of the actor's rig. */
export const Contact = z
  .object({
    node: RId,
    actor: RId,
    socket: PartName,
    from: Seconds,
    to: Seconds,
    offset: z.tuple([Num, Num]).default([0, 0]),
  })
  .strict();

/** A visible change at an instant: a node switches state, appears, disappears; `fx` is how the change looks. */
export const StateEvent = z
  .object({
    t: Seconds,
    node: RId,
    state: PartName.optional(),
    visible: z.boolean().optional(),
    fx: z.enum(["none", "fade", "puff", "pop", "glow", "flash"]).default("none"),
    /** How long the fx lasts. */
    duration: z.number().min(0).max(5).default(0.3),
  })
  .strict();

export const Scene = z
  .object({
    id: RId,
    /** The world's extent; the camera is kept inside it. */
    bounds: z.object({ x: Num, y: Num, w: z.number().positive(), h: z.number().positive() }).strict(),
    background: Color.default("#000000"),
    camera: Camera,
    layers: z.array(Layer).min(1).max(64),
    actors: z.array(Actor).max(32).default([]),
    lights: z.array(Light).max(32).default([]),
    tracks: z.array(Track).max(5000).default([]),
    contacts: z.array(Contact).max(500).default([]),
    events: z.array(StateEvent).max(2000).default([]),
  })
  .strict();
export type Scene = z.infer<typeof Scene>;

// ------------------------------------------------------------------------------------------------ edit, overlays, audio

/** Which scene is on screen when; consecutive entries meet without gaps. */
export const Cut = z
  .object({
    scene: RId,
    start: Seconds,
    end: Seconds,
    /** How this entry replaces the previous one. */
    enter: z
      .object({
        kind: z.enum(["cut", "dissolve", "dip_to_black", "whip"]),
        duration: z.number().min(0).max(3).default(0),
      })
      .strict()
      .default({ kind: "cut", duration: 0 }),
  })
  .strict();

const ScreenAnchor = z
  .object({
    /** Screen position, 0..1 of the frame. */
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  })
  .strict();
/** Follows a node or an actor on screen; offset in px. */
const NodeAnchor = z.union([
  z.object({ node: RId, offset: z.tuple([Num, Num]).default([0, 0]) }).strict(),
  z.object({ actor: RId, offset: z.tuple([Num, Num]).default([0, 0]) }).strict(),
]);

const TextStyle = z
  .object({
    font: ManifestAssetRef,
    size: z.number().positive(),
    color: Color,
    stroke: z.object({ color: Color, width: z.number().positive() }).strict().optional(),
    align: z.enum(["left", "center", "right"]).default("center"),
    maxWidth: z.number().positive().optional(),
  })
  .strict();

const Appear = z.enum(["none", "fade", "rise", "pop"]);

export const Overlay = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("text"),
      id: RId,
      lines: z
        .array(
          z
            .object({
              text: z.string().min(1).max(200),
              color: Color.optional(),
              size: z.number().positive().optional(),
            })
            .strict(),
        )
        .min(1)
        .max(8),
      style: TextStyle,
      at: z.union([ScreenAnchor, NodeAnchor]),
      in: Seconds,
      out: Seconds,
      appear: Appear.default("fade"),
      /** A backing panel behind the text. */
      panel: z
        .object({
          color: Color,
          padding: z.number().min(0).default(16),
          radius: z.number().min(0).default(0),
        })
        .strict()
        .optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("captions"),
      id: RId,
      style: TextStyle,
      at: ScreenAnchor,
      /** The word being spoken is drawn in this colour. */
      highlight: Color.optional(),
      phrases: z
        .array(
          z
            .object({
              in: Seconds,
              out: Seconds,
              words: z
                .array(z.object({ text: z.string().min(1).max(64), t: Seconds, end: Seconds }).strict())
                .min(1)
                .max(16),
            })
            .strict(),
        )
        .max(2000),
    })
    .strict(),
  z
    .object({
      kind: z.literal("icon"),
      id: RId,
      asset: ManifestAssetRef,
      state: PartName.optional(),
      size: z.number().positive(),
      at: z.union([ScreenAnchor, NodeAnchor]),
      in: Seconds,
      out: Seconds,
      appear: Appear.default("pop"),
    })
    .strict(),
]);

export const AudioClip = z
  .object({
    id: RId,
    asset: ManifestAssetRef,
    role: z.enum(["voice", "music", "sfx", "ambience"]),
    start: Seconds,
    /** Skip this much of the file. */
    trim: Seconds.default(0),
    /** Stop after this long (absent: to the end of the file). */
    duration: z.number().positive().optional(),
    gainDb: z.number().min(-60).max(12).default(0),
    fadeIn: Seconds.default(0),
    fadeOut: Seconds.default(0),
    /** Stereo position, -1 left .. 1 right. */
    pan: z.number().min(-1).max(1).default(0),
  })
  .strict();

export const Mix = z
  .object({
    /** Lower music by this much while a voice clip plays. */
    duckMusicDb: z.number().min(0).max(30).default(0),
    loudness: z
      .object({ integratedLufs: z.number().min(-40).max(-5), truePeakDb: z.number().min(-12).max(0) })
      .strict()
      .default({ integratedLufs: -14, truePeakDb: -1 }),
  })
  .strict();

// ------------------------------------------------------------------------------------------------ the package

export const RenderPackage = z
  .object({
    schema: z.literal(RENDER_PACKAGE_SCHEMA),
    id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/),
    /** Informational only: the engine never changes behaviour on it. */
    producer: z.object({ name: z.string().min(1).max(64), version: z.string().min(1).max(64) }).strict(),
    output: z
      .object({
        width: z.number().int().min(16).max(7680),
        height: z.number().int().min(16).max(7680),
        fps: z.number().int().min(1).max(120),
        duration: z.number().positive().max(3600),
      })
      .strict(),
    /** The frozen manifest every asset reference resolves in, checked by hash. */
    assetManifest: z
      .object({
        uri: z.string().regex(/^(file:\/\/|s3:\/\/)?[A-Za-z0-9_./-]+$/),
        sha256: Sha256,
      })
      .strict(),
    scenes: z.array(Scene).min(1).max(200),
    edit: z.array(Cut).min(1).max(2000),
    overlays: z.array(Overlay).max(2000).default([]),
    audio: z.array(AudioClip).max(2000).default([]),
    mix: Mix.default({ duckMusicDb: 0, loudness: { integratedLufs: -14, truePeakDb: -1 } }),
  })
  .strict();
export type RenderPackage = z.infer<typeof RenderPackage>;
