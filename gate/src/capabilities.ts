/**
 * What the gate needs to know about the engine, as data. The engine publishes it (film `capabilities().render`);
 * the gate never imports the engine. The shape is checked at runtime before it is trusted.
 *
 * erkasa.capabilities/2 (E1.4): not only lists of names but the combinations the engine draws (projection ×
 * layer × builtin × transition), the values it applies (camera, layers, actors, captions, output), the asset
 * sources it reads, the tracks it needs, and how it treats every field of the package and manifest schemas. A
 * package that passes the gate is one the engine executes as the package says.
 */
export const CAPABILITIES_VERSION = "erkasa.capabilities/2";

export type CapabilityParameter =
  { kind: "channel"; id: string; range: [number, number] } | { kind: "static"; id: string };

/** The placement fields of a node; a builtin applies only those it lists (the others must be the identity). */
export const PLACEMENT = ["x", "y", "scale", "rotation", "opacity", "flip", "pivot"] as const;
export type PlacementField = (typeof PLACEMENT)[number];

export interface BuiltinCapability {
  name: string;
  version: number;
  fingerprint: string;
  status: "supported" | "deprecated" | "removed";
  kind: "vector" | "rig" | "font";
  /** vector builtins: their inputs; every channel parameter needs a track on each node that uses the builtin. */
  parameters?: CapabilityParameter[];
  /** vector builtins: the placement fields the drawing applies. */
  placement?: PlacementField[];
  rig?: {
    format: string;
    bones: string[];
    channels: string[];
    sockets: string[];
    slots: string[];
    /** The value of a bone or channel (or of root.x, root.y, root.scale, facing, turn) that has no track. */
    rest: Record<string, number>;
    /** Height of the rig standing at rest, in world units, as the engine draws it. */
    height: number;
  };
  font?: { family: string; weight: number };
}

export interface LayerRole {
  /** The builtin whose node gives a layer this role, with the static parameters that select it. */
  builtin: string;
  params?: Record<string, unknown>;
  /** Exactly one such layer in every scene of the projection, or at most one. */
  required: boolean;
  /** `own`, or the role whose value this layer must repeat (the engine reads that one). */
  blur: string;
  depth: string;
  lit: boolean;
}

export interface ProjectionRule {
  /** Builtins (`name` or `prefix.*`) a world layer may draw, and whether file assets may be drawn. */
  layers: { builtins: string[]; files: boolean };
  screen: { builtins: string[]; files: boolean };
  camera: {
    /** Channels the camera must have a track for. */
    channels: string[];
    aperture: number[];
    /** `null`: the projection does not use it (its value has no effect, by the contract's definition). */
    referenceDistance: number[] | null;
    dolly: number[] | null;
    /** Scenes with a builtin of this prefix are seen through the editorial camera, centred at `x`. */
    editorial: { builtins: string; x: number } | null;
  };
  /** Layer values: `zero` / `false` for all layers, or by role (`roles`). */
  layer: { blur: "zero" | "by-role"; lit: "false" | "by-role"; depth: "unused" | "by-role" };
  /** Parallax: the roles of the world's layers; actors and held props are the roles `actors` and `held`. */
  roles: Record<string, LayerRole>;
  /** The node whose channels the engine reads for the roles that repeat them (W0: the sky). */
  stateFrom: { role: string; channels: string[]; statics: Record<string, string> } | null;
  actors: { rim: boolean; shadow: boolean };
}

export type FieldClass = "applied" | "restricted" | "refused" | "validated" | "metadata";

export interface RenderCapabilities {
  version: typeof CAPABILITIES_VERSION;
  contract: string;
  output: { sizes: Array<[number, number]>; fps: number[]; audio: boolean };
  projections: Record<string, ProjectionRule>;
  transitions: Array<{ kind: string; from: string; to: string }>;
  lightKinds: string[];
  fx: string[];
  events: { state: boolean; durationWithoutFx: number };
  contacts: boolean;
  nodeKinds: string[];
  overlayKinds: string[];
  captions: {
    anchor: Array<"screen">;
    align: string[];
    maxWidth: boolean;
    /** Published behaviour that has no field: fade in (s), opacity of unspoken words and of the stroke. */
    semantics: { fadeIn: number; unspokenOpacity: number; strokeOpacity: number; overVignette: boolean };
  };
  assets: {
    kinds: string[];
    stateSources: Array<"source" | "element">;
    rigSources: Array<"builtin" | "file">;
    fontSources: Array<"builtin" | "file">;
  };
  rigFormats: string[];
  builtins: BuiltinCapability[];
  /** How the engine treats every leaf field of erkasa.render/1 (`package:`) and erkasa.assets/1 (`manifest:`). */
  fields: Record<string, FieldClass>;
}

const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");
const isNumbers = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === "number");
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const CLASSES: FieldClass[] = ["applied", "restricted", "refused", "validated", "metadata"];

/** Problems with the capabilities document itself (a gate that trusts a broken description would pass anything). */
export function capabilityProblems(c: unknown): string[] {
  const out: string[] = [];
  const r = c as Partial<RenderCapabilities> | null;
  if (!r || typeof r !== "object") return ["capabilities are not an object"];
  if (r.version !== CAPABILITIES_VERSION) out.push(`version is not ${CAPABILITIES_VERSION}`);
  if (typeof r.contract !== "string") out.push("contract is missing");
  for (const k of ["lightKinds", "fx", "nodeKinds", "overlayKinds", "rigFormats"] as const)
    if (!isStrings(r[k])) out.push(`${k} is not a list of names`);
  const o = r.output;
  if (!isObj(o) || !Array.isArray(o.sizes) || !o.sizes.every((s) => isNumbers(s) && s.length === 2))
    out.push("output.sizes is not a list of [width, height]");
  if (!isObj(o) || !isNumbers(o.fps)) out.push("output.fps is not a list of numbers");
  if (!isObj(o) || typeof o.audio !== "boolean") out.push("output.audio is not a boolean");
  if (!isObj(r.projections) || !Object.keys(r.projections).length)
    out.push("projections is not a map of rules");
  else
    for (const [name, p] of Object.entries(r.projections)) {
      const at = `projections.${name}`;
      if (!isObj(p)) {
        out.push(`${at} is not a rule`);
        continue;
      }
      for (const k of ["layers", "screen"] as const)
        if (!isObj(p[k]) || !isStrings(p[k].builtins) || typeof p[k].files !== "boolean")
          out.push(`${at}.${k} is not { builtins, files }`);
      const cam = p.camera as ProjectionRule["camera"] | undefined;
      if (!isObj(cam) || !isStrings(cam.channels) || !isNumbers(cam.aperture))
        out.push(`${at}.camera is not { channels, aperture, … }`);
      else {
        if (cam.referenceDistance !== null && !isNumbers(cam.referenceDistance))
          out.push(`${at}.camera.referenceDistance is not a list or null`);
        if (cam.dolly !== null && !isNumbers(cam.dolly)) out.push(`${at}.camera.dolly is not a list or null`);
      }
      if (!isObj(p.layer)) out.push(`${at}.layer is missing`);
      if (!isObj(p.roles)) out.push(`${at}.roles is not a map`);
      else
        for (const [role, x] of Object.entries(p.roles)) {
          const ok = isObj(x) && typeof x.builtin === "string" && typeof x.required === "boolean";
          if (!ok) out.push(`${at}.roles.${role} is not a role`);
          else
            for (const k of ["blur", "depth"] as const)
              if (x[k] !== "own" && !(x[k] in p.roles))
                out.push(`${at}.roles.${role}.${k} names a role that does not exist ('${x[k]}')`);
        }
      if (!isObj(p.actors) || typeof p.actors.rim !== "boolean" || typeof p.actors.shadow !== "boolean")
        out.push(`${at}.actors is not { rim, shadow }`);
    }
  if (
    !Array.isArray(r.transitions) ||
    !r.transitions.every(
      (t) => isObj(t) && (["kind", "from", "to"] as const).every((k) => typeof t[k] === "string"),
    )
  )
    out.push("transitions is not a list of { kind, from, to }");
  else if (isObj(r.projections))
    for (const t of r.transitions)
      for (const p of [t.from, t.to])
        if (!(p in r.projections))
          out.push(`transition ${t.kind} ${t.from}->${t.to}: unknown projection '${p}'`);
  if (!isObj(r.events) || typeof r.events.state !== "boolean") out.push("events is not { state, … }");
  if (typeof r.contacts !== "boolean") out.push("contacts is not a boolean");
  if (!isObj(r.captions) || !isStrings(r.captions.align) || typeof r.captions.maxWidth !== "boolean")
    out.push("captions is not { anchor, align, maxWidth, semantics }");
  if (
    !isObj(r.assets) ||
    !["kinds", "stateSources", "rigSources", "fontSources"].every((k) => isStrings(r.assets?.[k as "kinds"]))
  )
    out.push("assets is not { kinds, stateSources, rigSources, fontSources }");
  if (!isObj(r.fields) || !Object.keys(r.fields).length) out.push("fields is not a map");
  else
    for (const [f, k] of Object.entries(r.fields)) {
      if (!/^(package|manifest):\//.test(f)) out.push(`fields: '${f}' is not package:/… or manifest:/…`);
      if (!CLASSES.includes(k)) out.push(`fields: '${f}' has an unknown class '${String(k)}'`);
    }
  if (!Array.isArray(r.builtins)) return [...out, "builtins is not a list"];
  const names = new Set<string>();
  r.builtins.forEach((b, i) => {
    if (!b || typeof b.name !== "string") return out.push(`builtins[${i}] has no name`);
    if (names.has(b.name)) out.push(`builtins[${i}] '${b.name}' is listed twice`);
    names.add(b.name);
    if (!Number.isInteger(b.version) || b.version < 1)
      out.push(`${b.name}: version is not a positive integer`);
    if (typeof b.fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(b.fingerprint))
      out.push(`${b.name}: fingerprint is not a sha256`);
    if (!["supported", "deprecated", "removed"].includes(b.status)) out.push(`${b.name}: unknown status`);
    if (!["vector", "rig", "font"].includes(b.kind)) out.push(`${b.name}: unknown kind`);
    if (b.kind === "vector" && !(isStrings(b.placement) && b.placement.every((f) => PLACEMENT.includes(f))))
      out.push(`${b.name}: placement is not a list of placement fields`);
    if (b.kind === "rig" && !b.rig) out.push(`${b.name}: a rig builtin without its rig description`);
    if (
      b.kind === "rig" &&
      b.rig &&
      (!isObj(b.rig.rest) || !(typeof b.rig.height === "number" && b.rig.height > 0))
    )
      out.push(`${b.name}: a rig without its rest pose or height`);
    return undefined;
  });
  return out;
}
