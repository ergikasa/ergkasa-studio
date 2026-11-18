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
 *
 * Completeness: a render package is fully materialised. The contract has no default values; whoever writes a
 * package (the stager) writes every value, and the engine never fills one in. A field is optional only when its
 * absence means "this does not exist" (no stroke, no panel, no wrapping width, no highlight).
 *
 * Evaluation (identical for every engine)
 *   frames    frame f is shown at t = f / output.fps, f = 0 .. round(duration * fps) - 1
 *   keys      before the first key: the first value; after the last: the last value; between keys k-1 and k:
 *             the value travels with keys[k].ease (`hold` keeps keys[k-1] until keys[k].t). Key times strictly
 *             increase (Validation Gate).
 *   samples   values[i] is the value at exactly start + i / rate. At time t the engine uses values[i] with
 *             i = floor((t - start) * rate + 1e-6), clamped to 0 .. n-1. There is no interpolation in /1: when
 *             rate equals output.fps and start lies on a frame, every frame reads exactly one stored value, so
 *             the motion is reproduced number for number. The stager writes samples at the rate it evaluated the
 *             motion (no lossy resampling); for `bone.*` and `channel.*` the Validation Gate requires
 *             rate = output.fps and start * fps to be an integer.
 *   one track per (scene, target, channel): the Validation Gate rejects two.
 *
 * Draw order: inside a scene, `layers` are drawn first, in array order, then `screen` layers in array order.
 * Inside a layer, nodes are drawn in array order. The stager writes the order; the engine never re-sorts layers.
 *
 * Procedural assets: a node that draws a procedural asset (declared with `parameters` in the manifest) sets its
 * static inputs in `params` and drives its numeric inputs with tracks on the channel `param.<id>`.
 */
import { z } from "zod";
import { NamedEasing, Sha256 } from "./common.js";
import { ContainedUri, ManifestAssetRef, PartName } from "./asset-manifest.js";

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
  scale: z.number().positive(),
  rotation: Num,
  opacity: z.number().min(0).max(1),
  /** Mirror horizontally. */
  flip: z.boolean(),
};

export const AssetNode = z
  .object({
    ...placement,
    kind: z.literal("asset"),
    asset: ManifestAssetRef,
    /** One of the asset's declared states (always written, also when it is the default state). */
    state: PartName,
    /** A declared pivot of the asset to rotate and scale around, or null for the asset's origin. */
    pivot: PartName.nullable(),
    /** Static inputs of a procedural asset, by parameter id. Absent: the asset takes no static inputs. */
    params: z.record(PartName, z.json()).optional(),
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
    align: z.enum(["left", "center", "right"]),
    maxWidth: z.number().positive().optional(),
    lineHeight: z.number().positive(),
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
          radius: z.number().min(0),
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
    blur: z.number().min(0),
    /** Whether lights in the scene affect this layer (sky and screens usually not). */
    lit: z.boolean(),
    nodes: z.array(Node).max(2000),
  })
  .strict();

/**
 * A layer fixed to the frame: coordinates are frame pixels (0..output.width, 0..output.height), the camera does
 * not move it and lights do not affect it. It belongs to its scene, so a transition carries it with the scene
 * (type, scrims, a foreground shoulder).
 */
export const ScreenLayer = z
  .object({
    id: RId,
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
    appearance: z.record(PartName, Color),
    /** A soft shadow cast away from the strongest light. */
    shadow: z.boolean(),
    /** A rim of light on the side facing the key light. */
    rim: z.boolean(),
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
    dolly: z.number().min(0).max(1),
    /** Depth-of-field strength: blur in px per 1000 world units away from focus. 0 = everything sharp. */
    aperture: z.number().min(0),
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
      depth: Num,
      radius: z.number().positive(),
      color: Color,
      intensity: z.number().min(0),
      castsShadows: z.boolean(),
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
      intensity: z.number().min(0),
      softness: z.number().min(0),
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
 * `x`, `y`, `scale`, `rotation`, `opacity` and `param.<id>` (inputs of a procedural asset) for nodes; `x`, `y`,
 * `scale`, `rotation`, `opacity` for layers; for actors `root.x`, `root.y`, `root.scale`,
 * `facing` (-1/1), `turn` (0..1, how much of the body faces the camera while turning), `bone.<id>` (degrees) and
 * `channel.<id>` (the rig's own range); for the camera `x`, `y`, `height` (visible world height at depth 0),
 * `focus` (depth in focus), `shake`; for lights `intensity`, `color`, `radius`, `x`, `y`.
 */
export const ChannelName = z.string().regex(/^[a-z][a-zA-Z]*(\.[A-Za-z][A-Za-z0-9_-]*)?$/);

export const RenderKeyframe = z
  .object({
    t: Seconds,
    v: z.union([Num, Color]),
    /** How the value travels from the previous key to this one (ignored on the first key, still written). */
    ease: NamedEasing,
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

/** A dense track: values[i] at start + i / rate, held until the next sample (see "Evaluation" above). */
export const SampledTrack = z
  .object({
    kind: z.literal("samples"),
    target: TrackTarget,
    channel: ChannelName,
    start: Seconds,
    /** Samples per second, an integer (30 for a 30 fps film). */
    rate: z.number().int().min(1).max(240),
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
    offset: z.tuple([Num, Num]),
  })
  .strict();

const Fx = z.enum(["none", "fade", "puff", "pop", "glow", "flash"]);
/**
 * A visible change at an instant: a node switches state, and/or appears or disappears; `fx` is how the change
 * looks for `duration` seconds. An event that changes nothing is rejected.
 */
export const StateEvent = z.union([
  z
    .object({
      t: Seconds,
      node: RId,
      state: PartName,
      visible: z.boolean().optional(),
      fx: Fx,
      duration: z.number().min(0).max(5),
    })
    .strict(),
  z
    .object({ t: Seconds, node: RId, visible: z.boolean(), fx: Fx, duration: z.number().min(0).max(5) })
    .strict(),
]);

export const Scene = z
  .object({
    id: RId,
    /** The world's extent; the camera is kept inside it. */
    bounds: z.object({ x: Num, y: Num, w: z.number().positive(), h: z.number().positive() }).strict(),
    background: Color,
    camera: Camera,
    layers: z.array(Layer).min(1).max(64),
    /** Layers fixed to the frame, drawn after `layers`. Absent: the scene has none. */
    screen: z.array(ScreenLayer).min(1).max(16).optional(),
    actors: z.array(Actor).max(32),
    lights: z.array(Light).max(32),
    tracks: z.array(Track).max(5000),
    contacts: z.array(Contact).max(500),
    events: z.array(StateEvent).max(2000),
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
        duration: z.number().min(0).max(3),
      })
      .strict(),
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
  z.object({ node: RId, offset: z.tuple([Num, Num]) }).strict(),
  z.object({ actor: RId, offset: z.tuple([Num, Num]) }).strict(),
]);

const TextStyle = z
  .object({
    font: ManifestAssetRef,
    size: z.number().positive(),
    color: Color,
    stroke: z.object({ color: Color, width: z.number().positive() }).strict().optional(),
    align: z.enum(["left", "center", "right"]),
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
              color: Color,
              size: z.number().positive(),
            })
            .strict(),
        )
        .min(1)
        .max(8),
      style: TextStyle,
      at: z.union([ScreenAnchor, NodeAnchor]),
      in: Seconds,
      out: Seconds,
      appear: Appear,
      /** A backing panel behind the text. */
      panel: z
        .object({
          color: Color,
          padding: z.number().min(0),
          radius: z.number().min(0),
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
      state: PartName,
      size: z.number().positive(),
      at: z.union([ScreenAnchor, NodeAnchor]),
      in: Seconds,
      out: Seconds,
      appear: Appear,
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
    trim: Seconds,
    /** How long it plays (the stager computes it from the file's length when it plays to the end). */
    duration: z.number().positive(),
    gainDb: z.number().min(-60).max(12),
    fadeIn: Seconds,
    fadeOut: Seconds,
    /** Stereo position, -1 left .. 1 right. */
    pan: z.number().min(-1).max(1),
  })
  .strict();

/**
 * Music lowered under the voice by a compressor keyed by the voice (E1.5): the music's level is reduced while the
 * voice is above `threshold` (linear amplitude, 0..1), by `ratio`, reacting in `attackMs` and recovering in
 * `releaseMs`. Applies only when the mix has both a voice and a music clip.
 */
export const Ducking = z
  .object({
    kind: z.literal("sidechain"),
    threshold: z.number().min(0.000976563).max(1),
    ratio: z.number().min(1).max(20),
    attackMs: z.number().min(0.01).max(2000),
    releaseMs: z.number().min(0.01).max(9000),
  })
  .strict();

export const Mix = z
  .object({
    /** Lower music by this fixed amount while a voice clip plays. */
    duckMusicDb: z.number().min(0).max(30),
    /** Ducking by a compressor keyed by the voice (E1.5; optional, absent in earlier packages). */
    ducking: Ducking.optional(),
    loudness: z
      .object({
        integratedLufs: z.number().min(-40).max(-5),
        truePeakDb: z.number().min(-12).max(0),
        /** Target loudness range in LU (E1.5; optional, absent in earlier packages). */
        rangeLu: z.number().min(1).max(50).optional(),
      })
      .strict(),
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
        uri: ContainedUri,
        sha256: Sha256,
      })
      .strict(),
    scenes: z.array(Scene).min(1).max(200),
    edit: z.array(Cut).min(1).max(2000),
    overlays: z.array(Overlay).max(2000),
    audio: z.array(AudioClip).max(2000),
    mix: Mix,
  })
  .strict();
export type RenderPackage = z.infer<typeof RenderPackage>;
