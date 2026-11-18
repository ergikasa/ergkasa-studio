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

import { schemaProblems, type ParamSchema } from "./json-schema.js";

/**
 * A channel parameter takes any number in `range`, or, with `values`, only those values (and then a keys track
 * may change between two of them only with `hold`). A static parameter takes the values `schema` allows.
 */
export type CapabilityParameter =
  | { kind: "channel"; id: string; range: [number, number]; values?: number[] }
  | { kind: "static"; id: string; schema: ParamSchema };

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
    /** Actor channels (`facing`, `turn`, `root.*`, `channel.*`, `bone.*`) that take only these values. */
    channelValues: Record<string, number[]>;
  };
  font?: { family: string; weight: number };
}

export interface LayerRole {
  /**
   * How a layer gets the role: `node`, a node of `builtin` (with `params`) in it; `actor`, an actor drawn in it.
   */
  assign: "node" | "actor";
  builtin: string;
  params?: Record<string, unknown>;
  /** Exactly one layer with the role in every scene of the projection (`required`), and whether more may exist. */
  required: boolean;
  repeat: boolean;
  /** The builtins (patterns) the engine draws as part of this role; a node anywhere else is refused. */
  members: string[];
  /**
   * Where the engine reads the value from: `own` (this layer), `first` (the first layer of this role, the others
   * must repeat it) or the name of another role (this layer must repeat that role's value).
   */
  blur: string;
  depth: string;
  lit: boolean;
  /** The value the engine uses for a role that reads this one when no layer has this role. */
  absent?: { blur?: number; depth?: number };
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
    /**
     * Parallax: how the camera is projected (w0/camera.ts REF, GAMMA) and the builtin whose layer's depth is the
     * plane the view is measured on (`bounds`). Flat: null (set and editorial views; contracts camera-view.ts).
     */
    parallax: { reference: { cx: number; cy: number; height: number }; gamma: number; plane: string } | null;
  };
  /** Layer values: `zero` / `false` for all layers, or by role (`roles`). */
  layer: { blur: "zero" | "by-role"; lit: "false" | "by-role"; depth: "unused" | "by-role" };
  /** Parallax: the roles of the world's layers; actors and held props are the roles `actors` and `held`. */
  roles: Record<string, LayerRole>;
  /** The node whose channels the engine reads for the roles that repeat them (W0: the sky). */
  stateFrom: { role: string; channels: string[]; statics: Record<string, string> } | null;
  actors: { rim: boolean; shadow: boolean };
}

export interface VideoEncoding {
  encoder: string;
  preset: string;
  crf: number;
  pixelFormat: string;
  /** The FFmpeg filter that adds the film grain, applied per cut (its noise restarts with every cut). */
  grain: string;
  /** `cut`: every cut of the edit is encoded on its own; the cuts are joined without re-encoding. */
  segments: "cut";
}

/** The mix the engine makes from a package's audio clips (E1.5). */
export interface AudioCapability {
  /** Audio asset formats read (WAV: integer PCM 16/24/32-bit or IEEE float 32/64-bit). */
  formats: string[];
  /** Clip roles mixed: how many clips of the role, and where one may start. */
  roles: Record<string, { max: number; start: "whole-ms" | "zero" }>;
  /** Clip fields the engine does not apply, and the only value each may hold (E1.6: only the listed ones). */
  fixed: Partial<Record<"trim" | "fadeIn" | "fadeOut" | "pan", number>>;
  /**
   * `audible` (E1.5): a clip's duration is how long it is heard (contracts audibleDuration); the whole file is mixed.
   * `at-most-audible` (E1.6): a clip plays `duration` seconds of its file from `trim`; the duration is positive and
   * at most what is left of the file after `trim` and of the film after `start`.
   */
  duration: "audible" | "at-most-audible";
  /** Fades (E1.6): the curve of fadeIn and fadeOut; fadeIn + fadeOut never exceed the clip's duration. */
  fades?: { curve: string };
  /**
   * mix.duckMusicDb the engine applies, [min, max] in dB (E1.6). Above 0 it is the maximum depth of mix.ducking
   * (which it then requires): the compressed music is blended so it never drops more than this many dB.
   */
  duckMusicDb: [number, number];
  /** Ducking kinds, the FFmpeg filter that does it and its parameters the package does not set. */
  ducking: { kinds: string[]; filter: string; defaults: Record<string, number | string> };
  loudness: {
    filter: string;
    rangeLu: "required";
    integratedLufs: [number, number];
    truePeakDb: [number, number];
  };
  /** The encoded audio. */
  encode: { codec: string; bitrateKbps: number; sampleRate: number };
  /** The mixdown, step by step. */
  semantics: string[];
}

export type FieldClass = "applied" | "restricted" | "refused" | "validated" | "metadata";

export interface RenderCapabilities {
  version: typeof CAPABILITIES_VERSION;
  contract: string;
  output: {
    sizes: Array<[number, number]>;
    fps: number[];
    audio: boolean;
    /** How the frames are encoded (E1.5): encoder settings, film grain, one stream per cut joined unchanged. */
    video: VideoEncoding;
  };
  /** What the engine mixes and how (E1.5); null for an engine that renders silent video. */
  audio: AudioCapability | null;
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
  const v = isObj(o) ? (o.video as unknown) : undefined;
  if (
    !isObj(v) ||
    !["encoder", "preset", "pixelFormat", "grain"].every((k) => typeof v[k] === "string") ||
    typeof v.crf !== "number" ||
    v.segments !== "cut"
  )
    out.push("output.video is not { encoder, preset, crf, pixelFormat, grain, segments }");
  const au = r.audio as unknown;
  if (isObj(o) && o.audio === true) {
    if (!isObj(au)) out.push("audio is missing for an engine that mixes audio");
    else {
      const roles = au.roles as unknown;
      const fixed = au.fixed as unknown;
      const ducking = au.ducking as unknown;
      const loud = au.loudness as unknown;
      const enc = au.encode as unknown;
      if (!isStrings(au.formats)) out.push("audio.formats is not a list");
      if (
        !isObj(roles) ||
        !Object.values(roles).every(
          (x) => isObj(x) && typeof x.max === "number" && (x.start === "whole-ms" || x.start === "zero"),
        )
      )
        out.push("audio.roles is not a map of { max, start }");
      if (
        !isObj(fixed) ||
        !Object.entries(fixed).every(
          ([k, v]) => ["trim", "fadeIn", "fadeOut", "pan"].includes(k) && typeof v === "number",
        )
      )
        out.push("audio.fixed is not a map of trim, fadeIn, fadeOut, pan to their only value");
      if (au.duration !== "audible" && au.duration !== "at-most-audible")
        out.push("audio.duration is not 'audible' or 'at-most-audible'");
      if (
        isObj(fixed) &&
        au.duration === "audible" &&
        !["trim", "fadeIn", "fadeOut"].every((k) => typeof fixed[k] === "number")
      )
        out.push("audio.duration 'audible' needs trim, fadeIn and fadeOut fixed");
      const fades = au.fades as unknown;
      if (fades !== undefined && !(isObj(fades) && typeof fades.curve === "string"))
        out.push("audio.fades is not { curve }");
      const dm = au.duckMusicDb as unknown;
      if (!(isNumbers(dm) && dm.length === 2 && (dm[0] as number) <= (dm[1] as number)))
        out.push("audio.duckMusicDb is not a range [min, max]");
      if (
        !isObj(ducking) ||
        !isStrings(ducking.kinds) ||
        typeof ducking.filter !== "string" ||
        !isObj(ducking.defaults)
      )
        out.push("audio.ducking is not { kinds, filter, defaults }");
      if (
        !isObj(loud) ||
        typeof loud.filter !== "string" ||
        loud.rangeLu !== "required" ||
        !(isNumbers(loud.integratedLufs) && loud.integratedLufs.length === 2) ||
        !(isNumbers(loud.truePeakDb) && loud.truePeakDb.length === 2)
      )
        out.push("audio.loudness is not { filter, rangeLu, integratedLufs, truePeakDb }");
      if (
        !isObj(enc) ||
        typeof enc.codec !== "string" ||
        typeof enc.bitrateKbps !== "number" ||
        typeof enc.sampleRate !== "number"
      )
        out.push("audio.encode is not { codec, bitrateKbps, sampleRate }");
      if (!isStrings(au.semantics)) out.push("audio.semantics is not a list of steps");
    }
  } else if (au !== null) out.push("audio must be null for an engine that renders silent video");
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
        const px = cam.parallax as unknown;
        if (
          px !== null &&
          !(
            isObj(px) &&
            isObj(px.reference) &&
            isNumbers([px.reference.cx, px.reference.cy, px.reference.height]) &&
            typeof px.gamma === "number" &&
            typeof px.plane === "string"
          )
        )
          out.push(`${at}.camera.parallax is not { reference, gamma, plane } or null`);
      }
      if (!isObj(p.layer)) out.push(`${at}.layer is missing`);
      if (!isObj(p.roles)) out.push(`${at}.roles is not a map`);
      else
        for (const [role, x] of Object.entries(p.roles)) {
          const ok =
            isObj(x) &&
            typeof x.builtin === "string" &&
            (x.assign === "node" || x.assign === "actor") &&
            typeof x.required === "boolean" &&
            typeof x.repeat === "boolean" &&
            isStrings(x.members) &&
            typeof x.lit === "boolean";
          if (!ok) out.push(`${at}.roles.${role} is not a role`);
          else
            for (const k of ["blur", "depth"] as const)
              if (x[k] !== "own" && x[k] !== "first" && !(x[k] in p.roles))
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
    for (const p of b.parameters ?? []) {
      if (p.kind === "static") out.push(...schemaProblems(p.schema, `${b.name}.${p.id}`));
      if (p.kind === "channel" && p.values !== undefined && !isNumbers(p.values))
        out.push(`${b.name}.${p.id}: values is not a list of numbers`);
    }
    if (b.kind === "rig" && b.rig && !isObj(b.rig.channelValues))
      out.push(`${b.name}: a rig without its channelValues`);
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
