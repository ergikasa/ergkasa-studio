/**
 * erkasa.character/1 — a Character Package: one character of the Character Library, as data.
 *
 * A package is a folder: `character.json` (this contract) and the files it lists, each with its sha256. Parts
 * (vector outlines and textured meshes) live in `erkasa.character.parts/1` files; painted textures are images.
 * The package says what the character IS (identity, anatomy, artwork, skeleton, how it deforms, which views and
 * outfits exist) and what it CAN DO (the capability manifest). It never says what the character does in a film:
 * that is the Engines' output (channel tracks in an erkasa.render/1 package), executed by the Character Runtime.
 *
 * Conventions
 *   space     package units, which are world units at actor scale 1: x to the right, y down, the origin on the
 *             ground between the feet (or, for a bust, at the declared `origin` bone's rest joint)
 *   angles    degrees, clockwise (as in erkasa.render/1)
 *   colours   #RRGGBB or #RRGGBBAA
 *   left/right the character's own left and right (`_l`, `_r`), not the screen's
 *
 * Immutability: a published package never changes. Its identity in the Library is `id@version` plus the sha256
 * of `character.json`, which contains the sha256 of every other file. A new version may fix or add artwork,
 * views, outfits or controls; it may not change `identity` (the `fingerprint` stays the same). Another identity is
 * another `id`.
 *
 * Versioning: `schema` is a literal. Adding an optional field keeps `/1`; removing a field or changing its meaning
 * is `/2`. Objects are strict. Formats inside the package (`formats`) are versioned the same way.
 *
 * What this schema checks: shapes, types, ranges. What the Character Runtime's validator checks (it needs every
 * file): that references resolve (bones, parts, morphs, files), the skeleton is a tree, weights are normalised,
 * views do not overlap, each capability is backed by data, and every declared channel has a visible effect.
 */
import { z } from "zod";
import { Sha256 } from "./common.js";
import { FacialHair, GarmentKind } from "./wardrobe.js";

export const CHARACTER_SCHEMA = "erkasa.character/1";
export const CHARACTER_PARTS_SCHEMA = "erkasa.character.parts/1";
export const CHARACTER_RIG_FORMAT = "erkasa.rig.layered/1";
export const HUMANOID_PROFILE = "erkasa.humanoid/1";

/** `chr_daniel`, `chr_test_minimal`. */
export const CharacterId = z.string().regex(/^chr_[a-z0-9_]{1,60}$/, "character id must look like chr_name");
/** `chr_daniel@3`: the form a plan or a render package uses with the package's sha256 beside it. */
export const CharacterRef = z
  .string()
  .regex(/^chr_[a-z0-9_]{1,60}@\d+$/, "character ref must look like chr_name@3");

/** A name inside a package: a bone, a part, a morph, a view, an outfit, a channel. */
export const CharacterName = z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/);
const Hex = z.string().regex(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/);
const Num = z.number().finite();
const Pt = z.tuple([Num, Num]);
const Range = z.tuple([Num, Num]);

/**
 * A file of the package, relative to its folder: lowercase segments, no `..`, no hidden names, no leading `/`.
 * Every segment starts with a letter, digit or underscore, so `.` and `..` are impossible. Stricter than the
 * manifest's ContainedUri: a package is self-contained, never `s3://`.
 */
export const CharacterPackagePath = z
  .string()
  .max(256)
  .regex(
    /^[a-z0-9_][a-z0-9_.-]{0,63}(\/[a-z0-9_][a-z0-9_.-]{0,63}){0,4}$/,
    "package path must be a plain relative path",
  );

export const CharacterPackageFile = z
  .object({
    path: CharacterPackagePath,
    sha256: Sha256,
    bytes: z.number().int().min(0),
    media: z.enum(["application/json", "image/png", "image/webp"]),
    role: z.enum(["parts", "texture", "preview", "report"]),
  })
  .strict();

// ------------------------------------------------------------------------------------------------ channels

/**
 * erkasa.humanoid/1: the channels Character Acting drives on every character. A package maps the ones it
 * supports to its own deformers (`controls`); a package may add its own channels only with the `x_` prefix.
 * The ids are erkasa.render/1 channel ids: an actor's track is `channel.<id>`.
 */
const SIDES = ["l", "r"] as const;
const FINGERS = ["thumb", "index", "middle", "ring", "little"] as const;
export const VISEMES = [
  "sil",
  "pp",
  "ff",
  "th",
  "dd",
  "kk",
  "ch",
  "ss",
  "nn",
  "rr",
  "aa",
  "e",
  "ih",
  "oh",
  "ou",
] as const;
export const FACS_AUS = [
  "au01", // inner brow raiser
  "au02", // outer brow raiser
  "au04", // brow lowerer
  "au05", // upper lid raiser
  "au06", // cheek raiser
  "au07", // lid tightener
  "au09", // nose wrinkler
  "au10", // upper lip raiser
  "au12", // lip corner puller
  "au14", // dimpler
  "au15", // lip corner depressor
  "au17", // chin raiser
  "au20", // lip stretcher
  "au23", // lip tightener
  "au24", // lip pressor
  "au25", // lips part
  "au26", // jaw drop (the lips' share; the jaw bone is `jaw_open`)
  "au28", // lip suck
] as const;
export const HUMANOID_CHANNELS: readonly string[] = [
  // body
  "body_yaw",
  "pelvis_tilt",
  "pelvis_shift",
  "spine_bend",
  "spine_twist",
  "chest_bend",
  "breath",
  "neck_bend",
  "neck_twist",
  // head and eyes
  "head_yaw",
  "head_pitch",
  "head_roll",
  "gaze_x",
  "gaze_y",
  "gaze_z",
  "lid_l",
  "lid_r",
  "pupil",
  // face
  ...FACS_AUS,
  "jaw_open",
  ...VISEMES.map((v) => `viseme_${v}`),
  // arms and hands
  ...SIDES.flatMap((s) => [
    `shoulder_${s}_raise`,
    `shoulder_${s}_forward`,
    `arm_${s}_upper`,
    `arm_${s}_twist`,
    `arm_${s}_lower`,
    `wrist_${s}_bend`,
    `wrist_${s}_twist`,
    `hand_${s}_curl`,
    `hand_${s}_spread`,
    ...FINGERS.map((f) => `finger_${s}_${f}_curl`),
  ]),
  // legs
  ...SIDES.flatMap((s) => [`leg_${s}_upper`, `leg_${s}_lower`, `ankle_${s}`, `toe_${s}`]),
  // secondary motion inputs (from Environmental FX)
  "hair_wind",
  "cloth_wind",
];
const HUMANOID = new Set(HUMANOID_CHANNELS);
export const isHumanoidChannel = (id: string): boolean => HUMANOID.has(id) || /^x_[a-z0-9_]{1,40}$/.test(id);

/** What a channel moves. Every effect is linear in the channel value between `from` and `to` (clamped there). */
export const CharacterDrive = z.discriminatedUnion("kind", [
  /** Rotates a bone about its joint by `degPerUnit` × value (from the rest pose). */
  z.object({ kind: z.literal("bone"), bone: CharacterName, degPerUnit: Num }).strict(),
  /** Applies a morph target with weight (value - from) / (to - from), clamped to 0..1. */
  z.object({ kind: z.literal("morph"), morph: CharacterName, from: Num, to: Num }).strict(),
  /** Scales a part's opacity the same way (0..1): a mouth's interior that shows only when it opens. */
  z.object({ kind: z.literal("opacity"), part: CharacterName, from: Num, to: Num }).strict(),
]);

export const CharacterControl = z
  .object({
    channel: CharacterName,
    /** The values the channel may take; the runtime refuses others (the Gate checks tracks against it). */
    range: Range,
    /** The value when no track drives the channel. */
    rest: Num,
    drives: z.array(CharacterDrive).min(1).max(64),
  })
  .strict();
export type CharacterControl = z.infer<typeof CharacterControl>;

// ------------------------------------------------------------------------------------------------ skeleton

export const CharacterBone = z
  .object({
    id: CharacterName,
    /** Absent: a root. */
    parent: CharacterName.optional(),
    /** The joint, in package space, at rest. */
    at: Pt,
    /** Direction of the bone at rest, degrees clockwise from +x (−90 points up). */
    angle: Num,
    length: z.number().min(0),
  })
  .strict();

export const CharacterSkeleton = z
  .object({
    bones: z.array(CharacterBone).min(1).max(256),
    /** Points that follow a bone: where a hand holds (erkasa.render/1 `contacts`), where an outfit attaches. */
    sockets: z.array(z.object({ id: CharacterName, bone: CharacterName, at: Pt }).strict()).max(32),
    /** Points that touch the world: soles, seat. Character Acting plants them; the runtime only reports them. */
    contacts: z.array(z.object({ id: CharacterName, bone: CharacterName, at: Pt }).strict()).max(32),
  })
  .strict();

// ------------------------------------------------------------------------------------------------ views

export const CharacterView = z
  .object({
    id: CharacterName,
    /** The channel values this view covers: [min, max), the last view of a group includes its max. */
    yaw: Range,
    pitch: Range,
    /** The yaw and pitch the artwork was drawn at. */
    center: z.object({ yaw: Num, pitch: Num }).strict(),
    /** Parts drawn in this view. A part belongs to at most one view of a group; a part in no view is always drawn. */
    parts: z.array(CharacterName).min(1).max(2000),
    /** Degrees on each side of a boundary with the next view over which both are drawn, cross-faded. 0: a cut. */
    blend: z.number().min(0).max(15),
  })
  .strict();
export type CharacterView = z.infer<typeof CharacterView>;

export const CharacterViewGroup = z
  .object({
    /** The channel that selects the view: `head_yaw` for the head, `body_yaw` for the body. */
    yawChannel: CharacterName,
    pitchChannel: CharacterName.optional(),
    views: z.array(CharacterView).min(1).max(24),
  })
  .strict();

// ------------------------------------------------------------------------------------------------ face, eyes, hands

export const CharacterFaceRig = z
  .object({
    /** FACS action units this face implements, each a channel with morph drives in `controls`. */
    aus: z.array(z.enum(FACS_AUS)).max(FACS_AUS.length),
    /** Visemes as weights of action units and of `jaw_open`; empty when the face does not speak. */
    visemes: z
      .array(
        z
          .object({
            id: z.enum(VISEMES),
            aus: z.partialRecord(z.enum(FACS_AUS), z.number().min(0).max(1)),
            jaw: z.number().min(0).max(1),
          })
          .strict(),
      )
      .max(VISEMES.length),
    /** Blink: `lid_l` / `lid_r` drive these morphs (0 open, 1 closed). Absent: the face does not blink. */
    blink: z.object({ l: CharacterName, r: CharacterName }).strict().optional(),
    /**
     * Gaze: `gaze_x`, `gaze_y`, `gaze_z` are the target in head space (package units; x right, y down, z toward the
     * camera; origin between the eyes). `rest` when no track drives them; `range` per axis. Absent: no eye tracking.
     */
    gaze: z
      .object({
        rest: z.tuple([Num, Num, Num]),
        range: z.tuple([Range, Range, Range]),
      })
      .strict()
      .optional(),
  })
  .strict();

/** One eye in one view: an eyeball the runtime turns toward the gaze target. */
export const CharacterEyeInView = z
  .object({
    view: CharacterName,
    /**
     * The vertex of the `clip` part that marks the eye's centre (not used by its paths): it moves with the part's
     * skinning and angle morphs, so the iris stays in the opening in every pose. Blink morphs must not move it.
     */
    centerVertex: z.number().int().min(0),
    /** Radius of the eyeball (package units): how far the iris travels for a given angle. */
    radius: z.number().positive(),
    /** Horizontal squash of the iris in this view (1 front, smaller when the head is turned). */
    squash: z.number().positive().max(1),
    /** The part whose outline clips the iris (the eye white): lids and blink deform it, so the iris follows. */
    clip: CharacterName,
    /** The part drawn over the iris (upper lid line, lashes). */
    over: CharacterName.optional(),
  })
  .strict();

export const CharacterEye = z
  .object({
    id: z.enum(["l", "r"]),
    bone: CharacterName,
    iris: z.object({ radius: z.number().positive(), color: Hex, ring: Hex }).strict(),
    pupil: z.object({ radius: z.number().positive(), color: Hex }).strict(),
    /** Specular highlight, fixed to the eye (does not follow the gaze). */
    highlight: z.object({ offset: Pt, radius: z.number().positive(), color: Hex }).strict(),
    /** The largest angle the eye turns from straight ahead, degrees. */
    maxAngle: z.number().positive().max(60),
    views: z.array(CharacterEyeInView).min(1).max(24),
  })
  .strict();
export type CharacterEye = z.infer<typeof CharacterEye>;

export const CharacterHand = z
  .object({
    side: z.enum(["l", "r"]),
    wrist: CharacterName,
    /** Finger bones, base to tip; at most 3 per finger. */
    fingers: z
      .array(z.object({ id: z.enum(FINGERS), bones: z.array(CharacterName).min(1).max(3) }).strict())
      .max(5),
    /** The socket objects are held at (erkasa.render/1 `contacts`). */
    socket: CharacterName,
  })
  .strict();

// ------------------------------------------------------------------------------------------------ wardrobe

export const CharacterOutfit = z
  .object({
    id: CharacterName,
    label: z.string().min(1).max(80),
    /** casual, business, formal, historical, uniform, an era, a profession: what Character Acting (W1) chooses by. */
    tags: z.array(z.string().regex(/^[a-z0-9_]{1,32}$/)).max(16),
    /** Garments of the W1 vocabulary, each drawn by the listed parts (which deform with the same skeleton). */
    garments: z
      .array(z.object({ kind: GarmentKind, parts: z.array(CharacterName).min(1).max(64) }).strict())
      .min(1)
      .max(16),
    /** Body parts not drawn while the outfit is worn (what the clothes cover). */
    hides: z.array(CharacterName).max(256),
  })
  .strict();
export type CharacterOutfit = z.infer<typeof CharacterOutfit>;

// ------------------------------------------------------------------------------------------------ capabilities

/**
 * What the character can do: exactly what Character Acting may ask of it. A capability is declared only when
 * the package has the data for it AND it has been exercised: the runtime's self-check proves every channel,
 * view, unit, viseme and outfit below; acting abilities (locomotion, interactions) need an `evidence` entry that
 * names a passing report among the package's files.
 */
export const CharacterLocomotion = z.enum(["walk", "stop", "turn", "run", "sit", "stand", "bend"]);
export const CharacterInteraction = z.enum(["reach", "grasp", "hold", "lift", "release", "point", "touch"]);
export const CharacterLod = z.enum(["close", "medium", "wide"]);

export const CharacterCapabilities = z
  .object({
    channels: z.array(CharacterName).min(1).max(512),
    views: z.record(CharacterName, z.array(CharacterName).min(1).max(24)),
    face: z
      .object({
        aus: z.array(z.enum(FACS_AUS)).max(FACS_AUS.length),
        visemes: z.array(z.enum(VISEMES)).max(VISEMES.length),
        blink: z.boolean(),
        gaze: z.boolean(),
        jaw: z.boolean(),
      })
      .strict(),
    hands: z.object({ fingers: z.boolean() }).strict(),
    locomotion: z.array(CharacterLocomotion).max(16),
    interactions: z.array(CharacterInteraction).max(16),
    wardrobe: z.array(CharacterName).max(64),
    lod: z.array(CharacterLod).min(1).max(3),
    evidence: z
      .array(
        z
          .object({
            capability: z.string().regex(/^(locomotion|interactions)\.[a-z]+$/),
            report: CharacterPackagePath,
            result: z.literal("pass"),
          })
          .strict(),
      )
      .max(64),
  })
  .strict();
export type CharacterCapabilities = z.infer<typeof CharacterCapabilities>;

// ------------------------------------------------------------------------------------------------ the package

export const CharacterIdentity = z
  .object({
    build: z.enum(["man", "woman", "neutral"]),
    /** Absent: the character has no stated age (a technical test). */
    ageYears: z.number().int().min(1).max(120).optional(),
    /** Standing height, package units (or the bust's height for a bust). */
    height: z.number().positive(),
    /** Head heights in the standing height. */
    heads: z.number().positive().max(10),
    palette: z
      .object({
        skin: Hex,
        skinShadow: Hex,
        eyes: Hex,
        /** Absent: no hair. */
        hair: Hex.optional(),
      })
      .strict(),
    hairStyle: z.string().regex(/^[a-z0-9_]{1,32}$/),
    facialHair: FacialHair,
    /** Distinguishing marks that must survive every view and outfit (a mole, an asymmetric brow). */
    marks: z.array(z.string().regex(/^[a-z0-9_]{1,40}$/)).max(16),
  })
  .strict();
export type CharacterIdentity = z.infer<typeof CharacterIdentity>;

export const CharacterPackage = z
  .object({
    schema: z.literal(CHARACTER_SCHEMA),
    id: CharacterId,
    version: z.number().int().min(1),
    name: z.string().min(1).max(60),
    /** reference: a character for films; technical_test: proves the system, never cast in a film. */
    purpose: z.enum(["reference", "technical_test"]),
    identity: CharacterIdentity,
    /** sha256 of the canonical JSON of `identity` (sorted keys): the same for every version of this character. */
    fingerprint: Sha256,
    formats: z
      .object({ rig: z.literal(CHARACTER_RIG_FORMAT), channels: z.literal(HUMANOID_PROFILE) })
      .strict(),
    compatibility: z
      .object({
        /** The lowest Character Runtime revision that draws this package. */
        minRuntime: z.number().int().min(1),
        /** The version this one replaces, with the same fingerprint. Absent: the first version. */
        previousVersion: z.number().int().min(1).optional(),
      })
      .strict(),
    /** The bone whose rest joint is the package origin (`root` for a full body). */
    origin: CharacterName,
    skeleton: CharacterSkeleton,
    controls: z.array(CharacterControl).max(512),
    /** View groups: the head's views and the body's. Absent: the group has one implicit view (nothing to select). */
    views: z.object({ head: CharacterViewGroup.optional(), body: CharacterViewGroup.optional() }).strict(),
    face: CharacterFaceRig,
    eyes: z.array(CharacterEye).max(2),
    hands: z.array(CharacterHand).max(2),
    wardrobe: z.array(CharacterOutfit).max(64),
    capabilities: CharacterCapabilities,
    /** Every file of the package except character.json. Parts files are read in this order. */
    files: z.array(CharacterPackageFile).min(1).max(4096),
    provenance: z
      .object({
        origin: z.enum(["builder", "artist", "import"]),
        tool: z.string().min(1).max(128),
        /** sha256 of the builder's inputs (parameters, source artwork): rebuilding them gives the same files. */
        inputsSha256: Sha256.optional(),
      })
      .strict(),
    license: z.string().min(1).max(200),
    approval: z
      .object({
        status: z.enum(["approved", "pending", "rejected"]),
        by: z.string().min(1).max(128).optional(),
        at: z.string().datetime({ offset: true }).optional(),
        note: z.string().max(500).optional(),
      })
      .strict(),
  })
  .strict();
export type CharacterPackage = z.infer<typeof CharacterPackage>;

// ------------------------------------------------------------------------------------------------ parts files

/**
 * How a part follows the skeleton. `rigid`: every vertex moves with one bone. `skin`: linear blend skinning,
 * up to 4 [bone index into `bones`, weight] pairs per vertex, weights summing to 1.
 */
export const CharacterBinding = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("rigid"), bone: CharacterName }).strict(),
  z
    .object({
      kind: z.literal("skin"),
      bones: z.array(CharacterName).min(1).max(64),
      weights: z.array(
        z
          .array(z.tuple([z.number().int().min(0), z.number().min(0).max(1)]))
          .min(1)
          .max(4),
      ),
    })
    .strict(),
]);

/** A morph target: sparse displacements [vertex, dx, dy] at full weight, in package space before skinning. */
export const CharacterMorph = z
  .object({
    id: CharacterName,
    deltas: z
      .array(z.tuple([z.number().int().min(0), Num, Num]))
      .min(1)
      .max(200000),
  })
  .strict();

/** Path commands over the part's vertices (indices). Curves are cubic or quadratic Béziers. */
export const CharacterPathCmd = z.union([
  z.tuple([z.literal("M"), z.number().int().min(0)]),
  z.tuple([z.literal("L"), z.number().int().min(0)]),
  z.tuple([z.literal("Q"), z.number().int().min(0), z.number().int().min(0)]),
  z.tuple([z.literal("C"), z.number().int().min(0), z.number().int().min(0), z.number().int().min(0)]),
  z.tuple([z.literal("Z")]),
]);

/** A fill or stroke paint. Gradient end points are vertices, so a gradient deforms with its part. */
export const CharacterPaint = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("solid"), color: Hex }).strict(),
  z
    .object({
      kind: z.literal("linear"),
      from: z.number().int().min(0),
      to: z.number().int().min(0),
      stops: z
        .array(z.tuple([z.number().min(0).max(1), Hex]))
        .min(2)
        .max(16),
    })
    .strict(),
  z
    .object({
      kind: z.literal("radial"),
      center: z.number().int().min(0),
      /** A vertex at the gradient's outer radius. */
      edge: z.number().int().min(0),
      stops: z
        .array(z.tuple([z.number().min(0).max(1), Hex]))
        .min(2)
        .max(16),
    })
    .strict(),
]);
export type CharacterPaint = z.infer<typeof CharacterPaint>;

const partCommon = {
  id: CharacterName,
  /** Draw order: lower first. Ties keep file order. */
  z: Num,
  opacity: z.number().min(0).max(1),
  vertices: z.array(Pt).min(1).max(200000),
  binding: CharacterBinding,
  morphs: z.array(CharacterMorph).max(256),
};

export const CharacterVectorPart = z
  .object({
    ...partCommon,
    kind: z.literal("vector"),
    paths: z
      .array(
        z
          .object({
            cmds: z.array(CharacterPathCmd).min(2).max(100000),
            fill: CharacterPaint.optional(),
            stroke: z.object({ paint: CharacterPaint, width: z.number().positive() }).strict().optional(),
          })
          .strict(),
      )
      .min(1)
      .max(512),
  })
  .strict();
export type CharacterVectorPart = z.infer<typeof CharacterVectorPart>;

/**
 * A painted texture on a triangle mesh: `uv` are pixel positions in the image, one per vertex; the image is drawn
 * through the deformed triangles. Painted shading belongs here, never in runtime blur filters.
 */
export const CharacterTexturePart = z
  .object({
    ...partCommon,
    kind: z.literal("texture"),
    /** The image (a package file with role `texture`), per level of detail; `medium` is required. */
    images: z
      .object({
        close: CharacterPackagePath.optional(),
        medium: CharacterPackagePath,
        wide: CharacterPackagePath.optional(),
      })
      .strict(),
    /** UV at the `medium` image's pixel size; other levels are the same picture at another size. */
    uv: z.array(Pt).min(3).max(200000),
    triangles: z
      .array(z.tuple([z.number().int().min(0), z.number().int().min(0), z.number().int().min(0)]))
      .min(1)
      .max(400000),
  })
  .strict();
export type CharacterTexturePart = z.infer<typeof CharacterTexturePart>;

export const CharacterPart = z.discriminatedUnion("kind", [CharacterVectorPart, CharacterTexturePart]);
export type CharacterPart = z.infer<typeof CharacterPart>;

export const CharacterParts = z
  .object({
    schema: z.literal(CHARACTER_PARTS_SCHEMA),
    parts: z.array(CharacterPart).min(1).max(2000),
  })
  .strict();
export type CharacterParts = z.infer<typeof CharacterParts>;
