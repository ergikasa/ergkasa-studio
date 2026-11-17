/**
 * What this engine can stage, as data. A planning layer (any model, any program) reads this instead of the
 * engine's internals, and writes plans that stay inside it; the engine validates every plan against the same
 * contract, so a plan built from this description is one the engine can execute.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Light, Mood, SetId, Template, Verb } from "./contract.js";
import type { PropKind } from "./props.js";
import {
  CAPABILITIES_VERSION as RENDER_CAPABILITIES,
  type BuiltinCapability,
  type CapabilityParameter as BuiltinParameter,
  type ParamSchema,
  type RenderCapabilities,
} from "@erkasa/gate";
import { FIELDS } from "./capabilities-fields.js";
import { CHANNELS, drawPerson, lookFor, STANDING } from "./rig.js";
import { PARAMS } from "./templates.js";
import { z } from "zod";
import { SETS } from "./sets.js";
import { fontFiles, H, W } from "./style.js";
import { GAMMA, REF } from "./w0/camera.js";

export const CAPABILITIES_VERSION = RENDER_CAPABILITIES;

export interface SetCapability {
  id: string;
  marks: Array<{ id: string; kind: string; surface: boolean }>;
  props: Array<{ id: string; kind: string }>;
  /** Named points people can look at or point to. */
  targets: string[];
}

export interface EngineCapabilities {
  version: typeof CAPABILITIES_VERSION;
  sets: SetCapability[];
  verbs: string[];
  moods: string[];
  lights: string[];
  templates: string[];
  /** What this engine can draw from an erkasa.render/1 package (read by the Validation Gate). */
  render: RenderCapabilities;
}

/** The render capabilities contract is the gate's (erkasa.capabilities/2); this engine publishes it. */
export type {
  BuiltinCapability,
  CapabilityParameter as BuiltinParameter,
  RenderCapabilities,
} from "@erkasa/gate";

export function capabilities(): EngineCapabilities {
  return {
    version: CAPABILITIES_VERSION,
    sets: Object.values(SETS).map((s) => ({
      id: s.id,
      marks: Object.entries(s.marks).map(([id, m]) => ({ id, kind: m.kind, surface: Boolean(m.surfaceY) })),
      props: Object.entries(s.props).map(([id, p]) => ({ id, kind: p.kind })),
      targets: Object.keys(s.targets),
    })),
    verbs: [...Verb.options],
    moods: [...Mood.options],
    lights: [...Light.options],
    templates: [...Template.options],
    render: renderCapabilities(),
  };
}

const sha256 = (file: string): string => createHash("sha256").update(readFileSync(file)).digest("hex");
const source = (rel: string): string => sha256(fileURLToPath(new URL(rel, import.meta.url)));

/** Rig bones of the procedural person; the other Pose channels, and glow, are non-bone channels. */
const BONES = ["torso", "head", "arm", "fore", "armF", "foreF", "thigh", "shin", "thighF", "shinF"];
const PROP_KINDS: readonly PropKind[] = ["cup", "paper", "notebook", "phone"];
/**
 * Ranges are declared only where the code defines them: light is one of day 0 .. night 3 (and moves between them
 * with an ease that does not overshoot), facing is -1 or 1, time is not negative. Everything else (door, which
 * overshoots when it swings; rotation; lamp; clock; binders) is not bounded by the drawing code, so its range is
 * the widest finite one.
 */
const MAX = Number.MAX_VALUE;
const ANY: [number, number] = [-MAX, MAX];
const TIME: BuiltinParameter = { kind: "channel", id: "t", range: [0, MAX] };
const LIGHT_LEVEL: BuiltinParameter = { kind: "channel", id: "light", range: [0, 3] };
const W0_STATE: BuiltinParameter[] = [
  TIME,
  LIGHT_LEVEL,
  { kind: "channel", id: "door", range: ANY },
  { kind: "channel", id: "lamp", range: ANY },
  { kind: "channel", id: "clockMin", range: ANY },
  { kind: "channel", id: "binders", range: ANY },
];
const statics = (schemas: Record<string, ParamSchema>): BuiltinParameter[] =>
  Object.entries(schemas).map(([id, schema]) => ({ kind: "static", id, schema }));

// ---- the values the static parameters take (what the drawing code reads; style.ts TypeLine, w0/world.ts
// WorldParams, templates.ts PARAMS, v2frame.ts places)
const NUM: ParamSchema = { type: "number" };
const NUM_OR_NULL: ParamSchema = { type: ["number", "null"] };
const DUR: ParamSchema = { type: "number", exclusiveMinimum: 0 };
/** Facing: the drawing mirrors by the sign only (left −1, right 1); no other value is a direction. */
const FACING: ParamSchema = { type: "number", enum: [-1, 1] };
const ANCHORS: ParamSchema = { type: "object", additionalProperties: NUM_OR_NULL };
const PLACE: ParamSchema = { type: "string", enum: ["top", "center", "bottom"] };
const LINES: ParamSchema = {
  type: "array",
  minItems: 1,
  items: {
    type: "object",
    properties: {
      t: { type: "string" },
      weight: { type: "string", enum: ["light", "bold"] },
      accent: { type: "boolean" },
      size: { type: "number", exclusiveMinimum: 0 },
    },
    required: ["t"],
    additionalProperties: false,
  },
};
const W0_PALETTE = [
  "coral",
  "cream",
  "floor",
  "ink",
  "ochre",
  "slate",
  "teal",
  "wall",
  "wallLow",
  "wood",
  "woodDark",
];
const WORLD: ParamSchema = {
  type: "object",
  properties: {
    seed: { type: "number" },
    years: { type: "array", items: { type: "number" } },
    palette: {
      type: "object",
      properties: Object.fromEntries(
        W0_PALETTE.map((k) => [k, { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" }]),
      ),
      required: W0_PALETTE,
      additionalProperties: false,
    },
  },
  required: ["seed", "years", "palette"],
  additionalProperties: false,
};
/** A template's own inputs (templates.ts PARAMS), with no input the template does not read. */
const templateParams = (t: (typeof Template.options)[number]): ParamSchema => {
  const strict = (n: unknown): unknown => {
    if (Array.isArray(n)) return n.map(strict);
    if (!n || typeof n !== "object") return n;
    const o = Object.fromEntries(
      Object.entries(n)
        .filter(([k]) => k !== "$schema")
        .map(([k, v]) => [k, strict(v)]),
    );
    if (
      o["type"] === "object" &&
      (o["additionalProperties"] === undefined ||
        (typeof o["additionalProperties"] === "object" &&
          !Object.keys(o["additionalProperties"] as object).length))
    )
      o["additionalProperties"] = false;
    return o;
  };
  return strict(z.toJSONSchema(PARAMS[t])) as ParamSchema;
};

/**
 * The drawings the current engine implements in code and the package features it draws. These are declarations
 * of existing code, not new behaviour: the engine does not read packages until E1.4. Lights, fx other than
 * `none`, non-asset nodes and overlays other than captions are not drawn from packages yet, so they are not listed.
 */
const rigHeight = (build: "man" | "woman"): number => {
  const d = drawPerson(STANDING, { x: 0, y: 0, facing: 1, turn: 1, scale: 1 }, lookFor({ build }));
  return d.feet - d.top;
};

/**
 * W0's place: the roles of its layers, as package/draw.ts w0Scene and w0/compositor.ts draw them.
 *   - a layer has the role of its defining node (`assign: node`) or of the actor drawn in it (`assign: actor`);
 *   - `members`: what the compositor draws as part of the role, wherever the node is; so it must be in that layer;
 *   - `blur`/`depth`: the compositor reads one value per role: the role's own layer, the first layer of a role
 *     that repeats (`first`: the people share the first actor layer's blur), or another role's (held props are
 *     drawn with the people, on the furniture's plane; the city with the sky's blur).
 */
const role = (
  r: Omit<RenderCapabilities["projections"][string]["roles"][string], "assign" | "repeat" | "members"> &
    Partial<
      Pick<RenderCapabilities["projections"][string]["roles"][string], "assign" | "repeat" | "members">
    >,
): RenderCapabilities["projections"][string]["roles"][string] => ({
  assign: "node",
  repeat: false,
  members: r.builtin ? [r.builtin] : [],
  ...r,
});
const W0_ROLES: RenderCapabilities["projections"][string]["roles"] = {
  sky: role({ builtin: "w0.sky", required: true, blur: "own", depth: "own", lit: false }),
  city: role({
    builtin: "w0.city",
    params: { near: false },
    required: true,
    blur: "sky",
    depth: "own",
    lit: false,
  }),
  city_near: role({
    builtin: "w0.city",
    params: { near: true },
    required: true,
    blur: "sky",
    depth: "own",
    lit: false,
  }),
  wall: role({ builtin: "w0.wall", required: true, blur: "own", depth: "own", lit: true }),
  // props at rest are drawn on the furniture's plane (w0Scene: resting, wherever the node is)
  mid: role({
    builtin: "w0.mid",
    members: ["w0.mid", "prop.*.resting"],
    required: true,
    blur: "own",
    depth: "own",
    lit: true,
  }),
  near: role({ builtin: "w0.near", required: false, blur: "own", depth: "own", lit: true }),
  // people: one per layer, as many layers as actors; drawn on the furniture's plane with the first one's blur
  actors: role({
    assign: "actor",
    builtin: "",
    members: [],
    repeat: true,
    required: false,
    blur: "first",
    depth: "mid",
    lit: true,
    // with no person, the held props are drawn unblurred (w0Scene: people blur 0)
    absent: { blur: 0 },
  }),
  // props in a hand: drawn with the people (their blur, the furniture's plane)
  held: role({
    builtin: "prop.*.held",
    repeat: true,
    required: false,
    blur: "actors",
    depth: "mid",
    lit: true,
  }),
};

export function renderCapabilities(): RenderCapabilities {
  // placement: the node fields the drawing applies; props are drawn where the node is (x, y), every other
  // builtin draws in scene (or screen) coordinates from its parameters
  const vector = (
    name: string,
    file: string,
    parameters: BuiltinParameter[],
    placement: BuiltinCapability["placement"] = [],
  ): BuiltinCapability => ({
    name,
    version: 1,
    fingerprint: source(file),
    status: "supported",
    kind: "vector",
    parameters,
    placement,
  });
  const rig = (build: "man" | "woman"): BuiltinCapability => ({
    name: `rig.cutout.${build}`,
    version: 1,
    fingerprint: source("./rig.ts"),
    status: "supported",
    kind: "rig",
    rig: {
      format: "erkasa.rig.cutout/1",
      bones: BONES,
      channels: [...CHANNELS.filter((c) => !BONES.includes(c)), "glow"],
      sockets: ["hand", "handF"],
      slots: ["coat", "coatDark", "pants", "skin", "skinShade", "hair"],
      // a bone or channel without a track: the standing pose (package/draw.ts actorSvg); glow off; placement at
      // the origin, facing right, unturned, unscaled
      channelValues: { facing: [-1, 1] },
      rest: {
        ...(STANDING as unknown as Record<string, number>),
        glow: 0,
        "root.x": 0,
        "root.y": 0,
        "root.scale": 1,
        facing: 1,
        turn: 1,
      },
      // feet to top of the head standing at rest, as drawPerson draws it (the stager's manifest measure)
      height: rigHeight(build),
    },
  });
  const weights = [300, 500, 800, 900];
  const fonts = fontFiles().map((file, i): BuiltinCapability => ({
    name: `font.montserrat-${weights[i]}`,
    version: 1,
    fingerprint: sha256(file),
    status: "supported",
    kind: "font",
    font: { family: "Montserrat", weight: weights[i] as number },
  }));
  const setParams: BuiltinParameter[] = [LIGHT_LEVEL, TIME, { kind: "channel", id: "door", range: ANY }];
  const W0_STATE_IDS = W0_STATE.map((p) => p.id);
  return {
    version: RENDER_CAPABILITIES,
    contract: "erkasa.render/1",
    // package/render.ts and v2frame.ts draw 1080 × 1920 (style.ts W, H); the frames are silent
    output: { sizes: [[W, H]], fps: [30], audio: false },
    projections: {
      flat: {
        layers: { builtins: ["set.*", "prop.*", "template.*"], files: true },
        screen: { builtins: ["type.kinetic", "overlay.scrim", "overlay.ots"], files: false },
        camera: {
          channels: ["x", "y", "height"],
          aperture: [0],
          referenceDistance: null,
          dolly: null,
          editorial: { builtins: "template.", x: W / 2 },
          parallax: null,
        },
        layer: { blur: "zero", lit: "false", depth: "unused" },
        roles: {},
        stateFrom: null,
        actors: { rim: false, shadow: false },
      },
      parallax: {
        layers: { builtins: ["w0.*", "prop.*"], files: false },
        screen: { builtins: ["type.w0"], files: false },
        camera: {
          channels: ["x", "y", "height"],
          aperture: [0],
          referenceDistance: [REF.height],
          dolly: [GAMMA],
          editorial: null,
          // bounds are measured on the actors' plane: the depth of the furniture's layer (w0Scene depth.mid)
          parallax: { reference: { ...REF }, gamma: GAMMA, plane: "w0.mid" },
        },
        layer: { blur: "by-role", lit: "by-role", depth: "by-role" },
        roles: W0_ROLES,
        // the compositor reads the place's state from the sky node, and the world from the wall node
        stateFrom: { role: "sky", channels: W0_STATE_IDS, statics: { world: "wall" } },
        actors: { rim: true, shadow: true },
      },
    },
    transitions: [
      ...["flat", "parallax"].flatMap((from) =>
        ["flat", "parallax"].map((to) => ({ kind: "cut", from, to })),
      ),
      { kind: "dissolve", from: "flat", to: "flat" },
      { kind: "dissolve", from: "parallax", to: "parallax" },
      { kind: "whip", from: "flat", to: "flat" },
    ],
    lightKinds: [],
    fx: ["none"],
    events: { state: false, durationWithoutFx: 0 },
    contacts: false,
    nodeKinds: ["asset"],
    overlayKinds: ["captions"],
    // package/draw.ts captionsSvg and w0/compositor.ts captionSvg
    captions: {
      anchor: ["screen"],
      align: ["center"],
      maxWidth: false,
      semantics: { fadeIn: 0.12, unspokenOpacity: 0.6, strokeOpacity: 0.9, overVignette: true },
    },
    assets: {
      kinds: ["vector", "rig", "font"],
      stateSources: ["source"],
      rigSources: ["builtin"],
      fontSources: ["builtin"],
    },
    rigFormats: ["erkasa.rig.cutout/1"],
    builtins: [
      rig("man"),
      rig("woman"),
      ...SetId.options.flatMap((id) =>
        ["back", "front"].map((part) => vector(`set.${id}.${part}`, "./sets.ts", setParams)),
      ),
      // a prop at rest is drawn upright where it stands; one in a hand is turned with the hand (facing, rot)
      ...PROP_KINDS.flatMap((k) => [
        vector(`prop.${k}.resting`, "./props.ts", [], ["x", "y"]),
        vector(
          `prop.${k}.held`,
          "./props.ts",
          [
            { kind: "channel", id: "facing", range: [-1, 1], values: [-1, 1] },
            { kind: "channel", id: "rot", range: ANY },
          ],
          ["x", "y"],
        ),
      ]),
      ...Template.options.map((t) =>
        vector(`template.${t}`, "./templates.ts", [
          ...statics({ params: templateParams(t), anchors: ANCHORS, dur: DUR }),
          TIME,
        ]),
      ),
      vector("type.kinetic", "./style.ts", [
        ...statics({ lines: LINES, y: NUM, at: NUM, out: NUM_OR_NULL, dark: { type: "boolean" } }),
        TIME,
      ]),
      vector("overlay.scrim", "./v2frame.ts", statics({ place: PLACE })),
      vector("overlay.ots", "./v2frame.ts", [...statics({ facing: FACING, dur: DUR }), TIME]),
      vector("w0.sky", "./w0/world.ts", W0_STATE),
      vector("w0.city", "./w0/world.ts", [...statics({ seed: NUM, near: { type: "boolean" } }), ...W0_STATE]),
      vector("w0.wall", "./w0/world.ts", [...statics({ world: WORLD }), ...W0_STATE]),
      vector("w0.mid", "./w0/world.ts", [...statics({ world: WORLD }), ...W0_STATE]),
      vector("w0.near", "./w0/world.ts", W0_STATE),
      vector("type.w0", "./w0/compositor.ts", [
        ...statics({ lines: LINES, place: PLACE, at: NUM, out: NUM_OR_NULL }),
        TIME,
      ]),
      ...fonts,
    ],
    fields: FIELDS,
  };
}
