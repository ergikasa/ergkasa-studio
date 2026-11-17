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
import { CHANNELS } from "./rig.js";
import { SETS } from "./sets.js";
import { fontFiles } from "./style.js";

export const CAPABILITIES_VERSION = "erkasa.capabilities/1";

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

/** An input of a builtin drawing: a number animated through `param.<id>`, or a fixed value in the node's params. */
export type BuiltinParameter =
  { kind: "channel"; id: string; range: [number, number] } | { kind: "static"; id: string };

/**
 * A drawing the engine implements in code. `fingerprint` is the sha256 of the file that implements it (the same
 * semantics as the fingerprints the stager writes into manifests); when the code changes, the fingerprint changes,
 * so a manifest pinned to an older implementation no longer matches.
 */
export interface BuiltinCapability {
  name: string;
  version: number;
  fingerprint: string;
  status: "supported" | "deprecated" | "removed";
  kind: "vector" | "rig" | "font";
  /** vector builtins: their inputs (none for a static drawing). */
  parameters?: BuiltinParameter[];
  /** rig builtins: what a manifest may declare and a package may drive. */
  rig?: { format: string; bones: string[]; channels: string[]; sockets: string[]; slots: string[] };
  /** font builtins. */
  font?: { family: string; weight: number };
}

export interface RenderCapabilities {
  contract: "erkasa.render/1";
  projections: string[];
  lightKinds: string[];
  fx: string[];
  transitions: string[];
  nodeKinds: string[];
  overlayKinds: string[];
  rigFormats: string[];
  builtins: BuiltinCapability[];
}

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
const statics = (...ids: string[]): BuiltinParameter[] => ids.map((id) => ({ kind: "static", id }));

/**
 * The drawings the current engine implements in code and the package features it draws. These are declarations
 * of existing code, not new behaviour: the engine does not read packages until E1.4. Lights, fx other than
 * `none`, non-asset nodes and overlays other than captions are not drawn from packages yet, so they are not listed.
 */
export function renderCapabilities(): RenderCapabilities {
  const vector = (name: string, file: string, parameters: BuiltinParameter[]): BuiltinCapability => ({
    name,
    version: 1,
    fingerprint: source(file),
    status: "supported",
    kind: "vector",
    parameters,
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
  return {
    contract: "erkasa.render/1",
    projections: ["flat", "parallax"],
    lightKinds: [],
    fx: ["none"],
    transitions: ["cut", "dissolve", "whip"],
    nodeKinds: ["asset"],
    overlayKinds: ["captions"],
    rigFormats: ["erkasa.rig.cutout/1"],
    builtins: [
      rig("man"),
      rig("woman"),
      ...SetId.options.flatMap((id) =>
        ["back", "front"].map((part) => vector(`set.${id}.${part}`, "./sets.ts", setParams)),
      ),
      ...PROP_KINDS.flatMap((k) =>
        ["resting", "held"].map((st) =>
          vector(`prop.${k}.${st}`, "./props.ts", [
            { kind: "channel", id: "facing", range: [-1, 1] },
            { kind: "channel", id: "rot", range: ANY },
          ]),
        ),
      ),
      ...Template.options.map((t) =>
        vector(`template.${t}`, "./templates.ts", [...statics("params", "anchors", "dur"), TIME]),
      ),
      vector("type.kinetic", "./style.ts", [...statics("lines", "y", "at", "out", "dark"), TIME]),
      vector("overlay.scrim", "./compose.ts", statics("place")),
      vector("overlay.ots", "./compose.ts", [...statics("facing", "dur"), TIME]),
      vector("w0.sky", "./w0/world.ts", W0_STATE),
      vector("w0.city", "./w0/world.ts", [...statics("seed", "near"), ...W0_STATE]),
      vector("w0.wall", "./w0/world.ts", [...statics("world"), ...W0_STATE]),
      vector("w0.mid", "./w0/world.ts", [...statics("world"), ...W0_STATE]),
      vector("w0.near", "./w0/world.ts", W0_STATE),
      vector("type.w0", "./w0/composer.ts", [...statics("lines", "place", "at", "out"), TIME]),
      ...fonts,
    ],
  };
}
