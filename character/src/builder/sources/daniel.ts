/**
 * Character Builder source: chr_daniel@1, Daniel Vos (human cartoon v1).
 *
 * The artwork is the approved concept's construction (prototypes/daniel-cartoon-v1), drawn in bake mode: for every
 * view, a tagged SVG at rest and at every key state. This source turns it into the package:
 *
 *   head   7 views (head_yaw −45…45 in steps of 15); in each, morph targets for 11 action units, the jaw, both
 *          blinks, and a turn (±7.5°) and a nod (±10°) inside the view; the eyes are runtime irises in the eye
 *          whites; expression lines fade in with the units that make them
 *   body   2 views (body_yaw 0 and 35); a skeleton with the torso, neck and head shared by both views and an arm
 *          chain per view and side (the arm's joints are where that view draws them)
 *
 * Package units are millimetres, origin on the floor between the feet, y down.
 */
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CharacterControl, CharacterPart } from "@erkasa/contracts";
import { exactDeltas, fieldDeltas, sameTopology, type Delta, type Field } from "../keys.js";
import type { PackageSpec } from "../writer.js";
import { parseTaggedSvg, type TaggedPart, type Vec } from "./tagged-svg.js";

// ------------------------------------------------------------------------------------------------ the bake source

interface BakeState {
  svg: string;
  meta: { eyes: Record<string, { center: Vec }>; samples?: Array<[number, number, number]> };
}
interface BakeSources {
  units: "mm";
  head: Array<{ id: string; yaw: number; states: Record<string, BakeState> }>;
  body: Array<{ id: string; yaw: number; svg: string; joints: Record<string, Vec> }>;
  torso: { pelvis: Vec; chest: Vec; neck: Vec; head: Vec };
  palette: Record<"skin" | "skinShadow" | "eyes" | "hair" | "iris" | "irisRing" | "pupil", string>;
  eye: { travel: number; iris: number; pupil: number; highlight: { offset: Vec; radius: number } };
}
interface BakeModule {
  bakeSources: () => BakeSources;
  YAW_SPAN: number;
  PITCH_SPAN: number;
}

const HERE = dirname(fileURLToPath(import.meta.url));
/** The concept construction this source bakes. */
export const DANIEL_SOURCE_DIR = join(HERE, "../../../../prototypes/daniel-cartoon-v1");

/** Key states whose parts may also move with the form (turns, nods, the jaw's drop). */
const FORM_STATES = new Set(["jaw", "yaw_pos", "yaw_neg", "pitch_pos", "pitch_neg"]);
/** Units with key drawings, and the parts each fades in (opacity drives). */
export const DANIEL_AUS = [
  "au01",
  "au02",
  "au04",
  "au05",
  "au06",
  "au07",
  "au10",
  "au12",
  "au15",
  "au23",
  "au24",
] as const;
const FADES: Record<string, { part: string; from: number; to: number }> = {
  au01: { part: "forehead_worry", from: 0.15, to: 0.8 },
  au02: { part: "forehead_raise", from: 0.15, to: 0.8 },
  au04: { part: "frown_lines", from: 0.2, to: 0.8 },
  au06: { part: "crow_feet", from: 0.25, to: 0.85 },
  au12: { part: "smile_lines", from: 0.15, to: 0.65 },
  jaw_open: { part: "mouth_open_line", from: 0.04, to: 0.2 },
};
/** Visemes as unit weights and jaw (au23 stands in for the pucker: the contract has no AU18/AU22). */
const VISEMES: Array<{ id: string; aus: Record<string, number>; jaw: number }> = [
  { id: "sil", aus: { au24: 0.1 }, jaw: 0 },
  { id: "pp", aus: { au24: 1 }, jaw: 0 },
  { id: "ff", aus: { au10: 0.4, au15: 0.2 }, jaw: 0.1 },
  { id: "th", aus: { au10: 0.2 }, jaw: 0.18 },
  { id: "dd", aus: { au12: 0.15 }, jaw: 0.25 },
  { id: "kk", aus: {}, jaw: 0.3 },
  { id: "ch", aus: { au23: 0.5 }, jaw: 0.2 },
  { id: "ss", aus: { au12: 0.35 }, jaw: 0.12 },
  { id: "nn", aus: { au12: 0.1 }, jaw: 0.22 },
  { id: "rr", aus: { au23: 0.4 }, jaw: 0.15 },
  { id: "aa", aus: {}, jaw: 0.75 },
  { id: "e", aus: { au12: 0.4 }, jaw: 0.35 },
  { id: "ih", aus: { au12: 0.3 }, jaw: 0.25 },
  { id: "oh", aus: { au23: 0.6 }, jaw: 0.45 },
  { id: "ou", aus: { au23: 1 }, jaw: 0.2 },
];

export interface BakeReport {
  parts: number;
  vertices: number;
  morphs: number;
  deltas: number;
  /** Key states a part could not follow point for point and followed with the form instead. */
  formFallbacks: string[];
  /** Key states a part has no target for (it did not change, or it could not be followed). */
  skipped: string[];
  inputsSha256: string;
  seconds: number;
}

// ------------------------------------------------------------------------------------------------ helpers

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const r1 = (v: number): number => Math.round(v * 10) / 10;
const r3 = (v: number): number => Math.round(v * 1000) / 1000;
const angleTo = (a: Vec, b: Vec): number => r3((Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI);
const dist = (a: Vec, b: Vec): number => Math.hypot(b[0] - a[0], b[1] - a[1]);

function vectorPart(p: TaggedPart, z: number, binding: CharacterPart["binding"]): CharacterPart {
  return {
    kind: "vector",
    id: p.id,
    z,
    opacity: 1,
    vertices: p.vertices,
    binding,
    morphs: [],
    paths: p.paths.map((pa) => ({
      cmds: pa.cmds,
      ...(pa.fill ? { fill: { kind: "solid" as const, color: pa.fill } } : {}),
      ...(pa.stroke
        ? { stroke: { paint: { kind: "solid" as const, color: pa.stroke.color }, width: pa.stroke.width } }
        : {}),
    })),
  };
}

/** Weights summing to exactly 1, three decimals, zeros dropped. */
function weights(ws: number[]): Array<[number, number]> {
  const sum = ws.reduce((a, b) => a + b, 0) || 1;
  const n = ws.map((w) => Math.round((w / sum) * 1000) / 1000);
  const out: Array<[number, number]> = [];
  n.forEach((w, i) => {
    if (w > 0) out.push([i, w]);
  });
  if (!out.length) return [[0, 1]];
  // the largest takes the rounding remainder
  let big = 0;
  out.forEach((e, i) => {
    if (e[1] > (out[big] as [number, number])[1]) big = i;
  });
  const rest = out.reduce((a, e, i) => (i === big ? a : a + e[1]), 0);
  (out[big] as [number, number])[1] = Math.round((1 - rest) * 1000) / 1000;
  return out;
}

/** Position along a two-segment chain (a → b → c) of the point nearest to p. */
function alongChain(p: Vec, a: Vec, b: Vec, c: Vec): number {
  const seg = (q: Vec, u: Vec, v: Vec): [number, number] => {
    const dx = v[0] - u[0];
    const dy = v[1] - u[1];
    const l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((q[0] - u[0]) * dx + (q[1] - u[1]) * dy) / l2));
    return [t, Math.hypot(q[0] - (u[0] + t * dx), q[1] - (u[1] + t * dy))];
  };
  const [t1, d1] = seg(p, a, b);
  const [t2, d2] = seg(p, b, c);
  const l1 = dist(a, b);
  return d1 <= d2 ? t1 * l1 : l1 + t2 * dist(b, c);
}

// ------------------------------------------------------------------------------------------------ the spec

export async function danielSpec(): Promise<{ spec: PackageSpec; report: BakeReport }> {
  const t0 = performance.now();
  const mod = (await import(pathToFileURL(join(DANIEL_SOURCE_DIR, "bake.mjs")).href)) as BakeModule;
  const src = mod.bakeSources();
  const hash = createHash("sha256");
  const report: BakeReport = {
    parts: 0,
    vertices: 0,
    morphs: 0,
    deltas: 0,
    formFallbacks: [],
    skipped: [],
    inputsSha256: "",
    seconds: 0,
  };

  // ---------------------------------------------------------------- skeleton
  const T = src.torso;
  type Bone = { id: string; parent?: string; at: Vec; angle: number; length: number };
  const bones: Bone[] = [
    { id: "root", at: [0, 0], angle: -90, length: 0 },
    { id: "pelvis", parent: "root", at: T.pelvis, angle: -90, length: r1(T.pelvis[1] - T.chest[1]) },
    { id: "chest", parent: "pelvis", at: T.chest, angle: -90, length: r1(T.chest[1] - T.neck[1]) },
    { id: "neck", parent: "chest", at: T.neck, angle: -90, length: r1(T.neck[1] - T.head[1]) },
    { id: "head", parent: "neck", at: [r1(T.head[0]), r1(T.head[1])], angle: -90, length: 250 },
  ];
  const sides = [
    { s: "l", S: "L", up: -1, low: 1 },
    { s: "r", S: "R", up: 1, low: -1 },
  ] as const;
  for (const v of src.body)
    for (const { s, S } of sides) {
      const j = v.joints;
      const sh = j[`shoulder${S}`] as Vec;
      const el = j[`elbow${S}`] as Vec;
      const wr = j[`wrist${S}`] as Vec;
      const tip = j[`handTip${S}`] as Vec;
      const R = (p: Vec): Vec => [r1(p[0]), r1(p[1])];
      bones.push(
        {
          id: `arm_${s}_upper_${v.id}`,
          parent: "chest",
          at: R(sh),
          angle: angleTo(sh, el),
          length: r1(dist(sh, el)),
        },
        {
          id: `arm_${s}_lower_${v.id}`,
          parent: `arm_${s}_upper_${v.id}`,
          at: R(el),
          angle: angleTo(el, wr),
          length: r1(dist(el, wr)),
        },
        {
          id: `hand_${s}_${v.id}`,
          parent: `arm_${s}_lower_${v.id}`,
          at: R(wr),
          angle: angleTo(wr, tip),
          length: r1(dist(wr, tip)),
        },
      );
    }

  // ---------------------------------------------------------------- body views
  const bodyFiles: Array<{ path: string; parts: CharacterPart[] }> = [];
  const bodyViews: Array<{ id: string; yaw: number; parts: string[] }> = [];
  const breathMorph = (vs: readonly Vec[]): Delta[] =>
    vs.flatMap((p, i): Delta[] => {
      const b = smoothstep(1050, 1350, -p[1]);
      if (b < 0.01) return [];
      return [[i, Math.round(p[0] * 0.012 * b * 100) / 100, Math.round(-3.5 * b * 100) / 100]];
    });
  for (const v of src.body) {
    hash.update(v.svg);
    const tagged = parseTaggedSvg(v.svg);
    // what is drawn after the jacket's sleeves is in front of the head (the near hands)
    const ids = tagged.map((p) => p.id.replace(`_${v.id}`, ""));
    let front = ids.indexOf("jacket") + 1;
    while (ids[front]?.startsWith("sleeve_")) front++;
    const parts: CharacterPart[] = tagged.map((p, i) => {
      const bind = p.bind;
      let binding: CharacterPart["binding"];
      let breath = false;
      if (bind === "root" || bind === "neck") binding = { kind: "rigid", bone: bind };
      else if (bind === "torso") {
        binding = {
          kind: "skin",
          bones: ["pelvis", "chest"],
          weights: p.vertices.map((q) => {
            const w = smoothstep(1080, 1180, -q[1]);
            return weights([1 - w, w]);
          }),
        };
        breath = true;
      } else if (/^arm_[lr]$/.test(bind)) {
        const s = bind.slice(-1);
        const S = s.toUpperCase();
        const j = v.joints;
        const sh = j[`shoulder${S}`] as Vec;
        const el = j[`elbow${S}`] as Vec;
        const wr = j[`wrist${S}`] as Vec;
        const l1 = dist(sh, el);
        binding = {
          kind: "skin",
          bones: ["chest", `arm_${s}_upper_${v.id}`, `arm_${s}_lower_${v.id}`],
          weights: p.vertices.map((q) => {
            const a = alongChain(q, sh, el, wr);
            const lower = smoothstep(l1 - 40, l1 + 40, a);
            const chest = 1 - smoothstep(0, 70, a);
            return weights([chest, Math.max(0, 1 - lower - chest), lower]);
          }),
        };
        breath = true;
      } else if (/^forearm_[lr]$/.test(bind))
        binding = { kind: "rigid", bone: `arm_${bind.slice(-1)}_lower_${v.id}` };
      else if (/^hand_[lr]$/.test(bind)) binding = { kind: "rigid", bone: `hand_${bind.slice(-1)}_${v.id}` };
      else throw new Error(`daniel: unknown binding '${bind}' on ${p.id}`);
      const z = i < front ? 100 + i : 300 + i;
      const part = vectorPart(p, z, binding);
      if (breath) {
        const d = breathMorph(p.vertices);
        if (d.length) part.morphs.push({ id: "breath", deltas: d });
      }
      return part;
    });
    bodyFiles.push({ path: `parts/body_${v.id}.json`, parts });
    bodyViews.push({ id: v.id, yaw: v.yaw, parts: parts.map((p) => p.id) });
  }

  // ---------------------------------------------------------------- head views
  const headFiles: Array<{ path: string; parts: CharacterPart[] }> = [];
  const headViews: Array<{ id: string; yaw: number; parts: string[] }> = [];
  const eyeViews: Record<"l" | "r", Array<{ view: string; centerVertex: number; squash: number }>> = {
    l: [],
    r: [],
  };
  const fieldOf = (rest: BakeState, key: BakeState): Field => {
    const a = rest.meta.samples ?? [];
    const b = key.meta.samples ?? [];
    if (a.length !== b.length) throw new Error("daniel: form samples differ in count between states");
    return {
      from: a.map((p) => [p[0], p[1]] as Vec),
      to: b.map((p) => [p[0], p[1]] as Vec),
      seen: a.map((p) => p[2] === 1),
    };
  };
  const morphId = (view: string, state: string): string =>
    state.startsWith("yaw_") || state.startsWith("pitch_") ? `${view}_${state}` : state;
  for (const v of src.head) {
    const rest = v.states["rest"] as BakeState;
    for (const st of Object.values(v.states)) hash.update(st.svg);
    const restParts = parseTaggedSvg(rest.svg);
    const keys = Object.entries(v.states)
      .filter(([k]) => k !== "rest")
      .map(([k, st]) => ({
        state: k,
        morph: morphId(v.id, k),
        parts: new Map(parseTaggedSvg(st.svg).map((p) => [p.id, p])),
        field: FORM_STATES.has(k) ? fieldOf(rest, st) : undefined,
        meta: st.meta,
      }));
    const parts: CharacterPart[] = restParts.map((p, i) => {
      const part = vectorPart(p, 200 + i, { kind: "rigid", bone: "head" });
      const eye = /^eye_white_([lr])_/.exec(p.id)?.[1] as "l" | "r" | undefined;
      // the eye's centre (where the iris sits looking straight ahead): a vertex no path uses
      let center = -1;
      if (eye) {
        const c = rest.meta.eyes[eye]?.center;
        if (!c) throw new Error(`daniel: no eye centre for ${p.id}`);
        center = part.vertices.length;
        part.vertices = [...part.vertices, [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100]];
        eyeViews[eye].push({
          view: v.id,
          centerVertex: center,
          squash: r3(Math.max(0.35, Math.cos((v.yaw * Math.PI) / 180))),
        });
      }
      for (const k of keys) {
        const q = k.parts.get(p.id);
        let d: Delta[];
        if (p.morph === "field" && k.field) d = fieldDeltas(p.vertices, k.field);
        else if (q && sameTopology(p, q)) d = exactDeltas(p.vertices, q.vertices);
        else if (k.field) {
          d = fieldDeltas(p.vertices, k.field);
          report.formFallbacks.push(`${p.id}:${k.state}`);
        } else {
          report.skipped.push(`${p.id}:${k.state}`);
          continue;
        }
        if (eye && center >= 0) {
          const a = rest.meta.eyes[eye]?.center as Vec;
          const b = k.meta.eyes[eye]?.center ?? a;
          const dx = Math.round((b[0] - a[0]) * 100) / 100;
          const dy = Math.round((b[1] - a[1]) * 100) / 100;
          if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) d.push([center, dx, dy]);
        }
        if (d.length) part.morphs.push({ id: k.morph, deltas: d });
      }
      return part;
    });
    headFiles.push({ path: `parts/head_${v.id}.json`, parts });
    headViews.push({ id: v.id, yaw: v.yaw, parts: parts.map((p) => p.id) });
  }

  // ---------------------------------------------------------------- controls
  const allParts = [...bodyFiles, ...headFiles].flatMap((f) => f.parts);
  const morphIds = new Set(allParts.flatMap((p) => p.morphs.map((m) => m.id)));
  const partIds = new Set(allParts.map((p) => p.id));
  const morph = (m: string, from: number, to: number) => ({ kind: "morph" as const, morph: m, from, to });
  const boneDrive = (bone: string, degPerUnit: number) => ({ kind: "bone" as const, bone, degPerUnit });
  const fades = (channel: string) => {
    const f = FADES[channel];
    if (!f) return [];
    return headViews
      .map((v) => `${f.part}_${v.id}`)
      .filter((id) => partIds.has(id))
      .map((part) => ({ kind: "opacity" as const, part, from: f.from, to: f.to }));
  };
  const Y = mod.YAW_SPAN;
  const P = mod.PITCH_SPAN;
  const hv = headViews.slice().sort((a, b) => a.yaw - b.yaw);
  const lo = (hv[0]?.yaw ?? 0) - Y;
  const hi = (hv[hv.length - 1]?.yaw ?? 0) + Y;
  const controls: CharacterControl[] = [
    { channel: "spine_bend", range: [-5, 5], rest: 0, drives: [boneDrive("pelvis", 1)] },
    { channel: "chest_bend", range: [-8, 8], rest: 0, drives: [boneDrive("chest", 1)] },
    { channel: "breath", range: [0, 1], rest: 0, drives: [morph("breath", 0, 1)] },
    { channel: "neck_bend", range: [-10, 10], rest: 0, drives: [boneDrive("neck", 1)] },
    { channel: "head_roll", range: [-15, 15], rest: 0, drives: [boneDrive("head", 1)] },
    {
      channel: "head_yaw",
      range: [lo, hi],
      rest: 0,
      drives: hv.flatMap((v) =>
        [morph(`${v.id}_yaw_pos`, v.yaw, v.yaw + Y), morph(`${v.id}_yaw_neg`, v.yaw, v.yaw - Y)].filter((d) =>
          morphIds.has(d.morph),
        ),
      ),
    },
    {
      channel: "head_pitch",
      range: [-P, P],
      rest: 0,
      drives: hv.flatMap((v) =>
        [morph(`${v.id}_pitch_pos`, 0, P), morph(`${v.id}_pitch_neg`, 0, -P)].filter((d) =>
          morphIds.has(d.morph),
        ),
      ),
    },
    ...sides.flatMap(({ s, up, low }): CharacterControl[] => [
      {
        channel: `arm_${s}_upper`,
        range: [-15, 80],
        rest: 0,
        drives: src.body.map((v) => boneDrive(`arm_${s}_upper_${v.id}`, up)),
      },
      {
        channel: `arm_${s}_lower`,
        range: [0, 120],
        rest: 0,
        drives: src.body.map((v) => boneDrive(`arm_${s}_lower_${v.id}`, low)),
      },
      {
        channel: `wrist_${s}_bend`,
        range: [-30, 30],
        rest: 0,
        drives: src.body.map((v) => boneDrive(`hand_${s}_${v.id}`, low)),
      },
    ]),
    ...DANIEL_AUS.map((au) => ({
      channel: au,
      range: [0, 1] as [number, number],
      rest: 0,
      drives: [morph(au, 0, 1), ...fades(au)],
    })),
    { channel: "jaw_open", range: [0, 1], rest: 0, drives: [morph("jaw", 0, 1), ...fades("jaw_open")] },
    { channel: "lid_l", range: [0, 1], rest: 0, drives: [morph("blink_l", 0, 1)] },
    { channel: "lid_r", range: [0, 1], rest: 0, drives: [morph("blink_r", 0, 1)] },
  ];
  for (const c of controls)
    if (!c.drives.length)
      throw new Error(`daniel: control ${c.channel} drives nothing (no key drawing changed)`);

  // ---------------------------------------------------------------- views, eyes, face
  const sortedBody = bodyViews.slice().sort((a, b) => a.yaw - b.yaw);
  const bodyRange = (i: number): [number, number] => {
    const v = sortedBody[i] as (typeof sortedBody)[number];
    const prev = sortedBody[i - 1];
    const next = sortedBody[i + 1];
    return [prev ? (prev.yaw + v.yaw) / 2 : v.yaw - 17.5, next ? (next.yaw + v.yaw) / 2 : v.yaw + 10];
  };
  const pal = src.palette;
  const eye = (id: "l" | "r") => ({
    id,
    bone: "head",
    iris: { radius: r3(src.eye.iris), color: pal.iris, ring: pal.irisRing },
    pupil: { radius: r3(src.eye.pupil), color: pal.pupil },
    highlight: { offset: src.eye.highlight.offset, radius: r3(src.eye.highlight.radius), color: "#FFFFFFE6" },
    maxAngle: 25,
    views: eyeViews[id].map((e) => ({
      view: e.view,
      centerVertex: e.centerVertex,
      radius: r3(src.eye.travel),
      squash: e.squash,
      clip: `eye_white_${id}_${e.view}`,
      over: `eye_over_${id}_${e.view}`,
    })),
  });

  // identity: standing height from the drawing (crown of the hair), head height from the front head view
  const front = headFiles.find((f) => f.path.endsWith("_h0.json"))?.parts ?? [];
  const ys = (ids: RegExp) => front.filter((p) => ids.test(p.id)).flatMap((p) => p.vertices.map((q) => q[1]));
  const crown = Math.min(...ys(/^hair_/));
  const chin = Math.max(...ys(/^head_/));
  const height = Math.round(-crown);
  const heads = Math.round((height / (chin - crown)) * 100) / 100;

  const channels = [
    "body_yaw",
    ...controls.map((c) => c.channel),
    "gaze_x",
    "gaze_y",
    "gaze_z",
    ...VISEMES.map((v) => `viseme_${v.id}`),
  ];
  const parts = [...bodyFiles, ...headFiles];
  report.parts = allParts.length;
  report.vertices = allParts.reduce((a, p) => a + p.vertices.length, 0);
  report.morphs = allParts.reduce((a, p) => a + p.morphs.length, 0);
  report.deltas = allParts.reduce((a, p) => a + p.morphs.reduce((b, m) => b + m.deltas.length, 0), 0);
  report.inputsSha256 = hash.digest("hex");
  report.seconds = Math.round((performance.now() - t0) / 100) / 10;

  const spec: PackageSpec = {
    manifest: {
      schema: "erkasa.character/1",
      id: "chr_daniel",
      version: 1,
      name: "Daniel Vos",
      purpose: "reference",
      identity: {
        build: "man",
        ageYears: 44,
        height,
        heads,
        palette: { skin: pal.skin, skinShadow: pal.skinShadow, eyes: pal.eyes, hair: pal.hair },
        hairStyle: "short_side_part",
        facialHair: "beard",
        marks: ["grey_at_temples", "part_on_his_right"],
      },
      formats: { rig: "erkasa.rig.layered/1", channels: "erkasa.humanoid/1" },
      compatibility: { minRuntime: 2 },
      origin: "root",
      skeleton: { bones, sockets: [], contacts: [] },
      controls,
      views: {
        head: {
          yawChannel: "head_yaw",
          pitchChannel: "head_pitch",
          views: hv.map((v, i) => ({
            id: v.id,
            yaw: [i === 0 ? lo : v.yaw - Y, i === hv.length - 1 ? hi : v.yaw + Y] as [number, number],
            pitch: [-P, P] as [number, number],
            center: { yaw: v.yaw, pitch: 0 },
            parts: v.parts,
            // degrees each side of a boundary: views 15° apart cross-fade over 4°
            blend: 2,
          })),
        },
        body: {
          yawChannel: "body_yaw",
          views: sortedBody.map((v, i) => ({
            id: v.id,
            yaw: bodyRange(i),
            pitch: [0, 0] as [number, number],
            center: { yaw: v.yaw, pitch: 0 },
            parts: v.parts,
            // views 35° apart differ too much to dissolve: a short cross-fade (1–2 frames at a normal turn)
            blend: 1.5,
          })),
        },
      },
      face: {
        aus: [...DANIEL_AUS],
        visemes: VISEMES.map((v) => ({
          id: v.id,
          aus: v.aus,
          jaw: v.jaw,
        })) as PackageSpec["manifest"]["face"]["visemes"],
        blink: { l: "blink_l", r: "blink_r" },
        gaze: {
          rest: [0, 0, 600],
          range: [
            [-600, 600],
            [-400, 400],
            [100, 4000],
          ],
        },
      },
      eyes: [eye("l"), eye("r")],
      hands: [],
      wardrobe: [],
      capabilities: {
        channels,
        views: { head: hv.map((v) => v.id), body: sortedBody.map((v) => v.id) },
        face: {
          aus: [...DANIEL_AUS],
          visemes: VISEMES.map((v) => v.id) as PackageSpec["manifest"]["capabilities"]["face"]["visemes"],
          blink: true,
          gaze: true,
          jaw: true,
        },
        hands: { fingers: false },
        locomotion: [],
        interactions: [],
        wardrobe: [],
        lod: ["close", "medium", "wide"],
        evidence: [],
      },
      provenance: {
        origin: "builder",
        tool: "character-builder/daniel-cartoon-v1@1",
        inputsSha256: report.inputsSha256,
      },
      license: "LicenseRef-Erkasa-Original",
      approval: {
        status: "pending",
        note: "Built from the concept v1 the PO approved for packaging (prototypes/daniel-cartoon-v1); awaiting the PO's review. Not published.",
      },
    },
    parts,
    textures: [],
  };
  return { spec, report };
}
