/**
 * Evaluating a character for one frame: channel values in, geometry out. Pure and deterministic: the same package
 * and the same values always give the same numbers (no clock, no randomness, no state between frames).
 *
 *   1. values     every channel the package consumes: the caller's value, or the control's rest; visemes add
 *                 their action units and jaw (clamped to the control's range); a value outside a range, or a
 *                 channel the package does not consume, is an error (the runtime never corrects a command)
 *   2. skeleton   forward kinematics: each bone turns about its joint by Σ degPerUnit × (value − rest)
 *   3. views      each view group selects the view whose yaw range holds its channel; inside a blend band two
 *                 views are evaluated and cross-faded (up to 4 combinations for head and body)
 *   4. parts      common parts + the selected views' parts + the worn outfit's garments − what the outfit hides;
 *                 each part: morph targets (weights from the drives) then skinning (rigid or linear blend)
 *   5. eyes       the iris turns toward the gaze target, inside the eye opening, clamped to maxAngle
 *   6. sockets    sockets and contacts follow their bones
 */
import { CharacterError } from "./errors.js";
import type { LoadedCharacter, Part } from "./load.js";
import { apply, invert, mul, rotate, translate, type Mat } from "./mat.js";
import { GAZE_CHANNELS } from "./validate.js";

export type Lod = "close" | "medium" | "wide";

export interface CharacterState {
  /** Channel values by erkasa.humanoid/1 id; a channel left out takes its rest value. */
  channels: Readonly<Record<string, number>>;
  /** The outfit worn (an id of the package's wardrobe), or none: the body as drawn. */
  outfit?: string | undefined;
  lod?: Lod | undefined;
}

export interface PartItem {
  kind: "part";
  part: Part;
  /** Deformed vertices, package space, interleaved x, y. */
  points: Float64Array;
  opacity: number;
  z: number;
  order: number;
}

export interface IrisItem {
  kind: "iris";
  eye: LoadedCharacter["manifest"]["eyes"][number];
  /** The part whose deformed outline clips the iris. */
  clip: PartItem;
  center: [number, number];
  rx: number;
  ry: number;
  /** Rotation of the eye's bone, degrees. */
  angle: number;
  highlight: [number, number];
  z: number;
  order: number;
}

export type DrawItem = PartItem | IrisItem;

export interface Layer {
  /** Cross-fade weight; 1 outside blend bands. */
  weight: number;
  /** The view selected in each group. */
  views: Readonly<Record<string, string>>;
  items: readonly DrawItem[];
}

export interface Evaluated {
  values: Readonly<Record<string, number>>;
  layers: readonly Layer[];
  /** Current bone matrices (rest space → package space). */
  bones: ReadonlyMap<string, Mat>;
  sockets: ReadonlyMap<string, [number, number]>;
  contacts: ReadonlyMap<string, [number, number]>;
  lod: Lod;
}

// ------------------------------------------------------------------------------------------------ rest data

interface Rest {
  order: string[];
  restWorld: Map<string, Mat>;
  restLocal: Map<string, Mat>;
  restInverse: Map<string, Mat>;
  /** Part → the view group and view that own it (absent: common to every view). */
  owner: Map<string, { group: string; view: string }>;
  garment: Map<string, string>;
  consumed: Map<string, { range: [number, number]; rest: number }>;
  partIndex: Map<string, number>;
}

const REST = new WeakMap<LoadedCharacter, Rest>();

function rest(c: LoadedCharacter): Rest {
  const cached = REST.get(c);
  if (cached) return cached;
  const m = c.manifest;
  const byId = new Map(m.skeleton.bones.map((b) => [b.id, b]));
  const order: string[] = [];
  const done = new Set<string>();
  const visit = (id: string): void => {
    if (done.has(id)) return;
    const b = byId.get(id);
    if (b?.parent !== undefined) visit(b.parent);
    done.add(id);
    order.push(id);
  };
  for (const b of m.skeleton.bones) visit(b.id);
  const restWorld = new Map<string, Mat>();
  const restLocal = new Map<string, Mat>();
  const restInverse = new Map<string, Mat>();
  for (const id of order) {
    const b = byId.get(id);
    if (!b) continue;
    const w = mul(translate(b.at[0], b.at[1]), rotate(b.angle));
    restWorld.set(id, w);
    restInverse.set(id, invert(w));
    const parent = b.parent !== undefined ? restInverse.get(b.parent) : undefined;
    restLocal.set(id, parent ? mul(parent, w) : w);
  }
  const owner = new Map<string, { group: string; view: string }>();
  for (const [group, g] of Object.entries(m.views))
    for (const v of g?.views ?? []) for (const p of v.parts) owner.set(p, { group, view: v.id });
  const garment = new Map<string, string>();
  for (const o of m.wardrobe) for (const g of o.garments) for (const p of g.parts) garment.set(p, o.id);
  const consumed = new Map<string, { range: [number, number]; rest: number }>();
  for (const ctl of m.controls) consumed.set(ctl.channel, { range: ctl.range, rest: ctl.rest });
  for (const [, g] of Object.entries(m.views)) {
    if (!g || consumed.has(g.yawChannel)) continue;
    const lo = Math.min(...g.views.map((v) => v.yaw[0]));
    const hi = Math.max(...g.views.map((v) => v.yaw[1]));
    consumed.set(g.yawChannel, { range: [lo, hi], rest: Math.min(hi, Math.max(lo, 0)) });
  }
  const gaze = m.face.gaze;
  if (gaze)
    GAZE_CHANNELS.forEach((ch, i) =>
      consumed.set(ch, { range: gaze.range[i] as [number, number], rest: gaze.rest[i] as number }),
    );
  const partIndex = new Map(c.parts.map((p, i) => [p.id, i]));
  const r: Rest = { order, restWorld, restLocal, restInverse, owner, garment, consumed, partIndex };
  REST.set(c, r);
  return r;
}

/** The channels this character consumes, with their ranges and rest values. */
export function consumedChannels(
  c: LoadedCharacter,
): ReadonlyMap<string, { range: [number, number]; rest: number }> {
  return rest(c).consumed;
}

// ------------------------------------------------------------------------------------------------ evaluation

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

export function resolveValues(
  c: LoadedCharacter,
  channels: Readonly<Record<string, number>>,
): Record<string, number> {
  const r = rest(c);
  for (const [ch, v] of Object.entries(channels)) {
    const spec = r.consumed.get(ch);
    if (!spec)
      throw new CharacterError("CHANNEL_UNKNOWN", `${c.manifest.id} does not consume channel '${ch}'`);
    if (!Number.isFinite(v)) throw new CharacterError("CHANNEL_VALUE", `${ch} = ${v}`);
    if (v < spec.range[0] - 1e-9 || v > spec.range[1] + 1e-9)
      throw new CharacterError(
        "CHANNEL_RANGE",
        `${ch} = ${v} is outside [${spec.range[0]}, ${spec.range[1]}]`,
      );
  }
  const out: Record<string, number> = {};
  for (const [ch, spec] of r.consumed) out[ch] = channels[ch] ?? spec.rest;
  // visemes: add their action units and jaw, clamped to each control's range
  for (const v of c.manifest.face.visemes) {
    const w = out[`viseme_${v.id}`] ?? 0;
    if (w === 0) continue;
    for (const [au, k] of Object.entries(v.aus)) {
      const spec = r.consumed.get(au);
      if (spec) out[au] = Math.min(spec.range[1], Math.max(spec.range[0], (out[au] ?? 0) + w * (k ?? 0)));
    }
    const jaw = r.consumed.get("jaw_open");
    if (jaw && v.jaw > 0) out["jaw_open"] = Math.min(jaw.range[1], (out["jaw_open"] ?? 0) + w * v.jaw);
  }
  return out;
}

/** Forward kinematics only (exported for measurement). */
export function boneMatrices(c: LoadedCharacter, values: Readonly<Record<string, number>>): Map<string, Mat> {
  const r = rest(c);
  const delta = new Map<string, number>();
  for (const ctl of c.manifest.controls) {
    const v = (values[ctl.channel] ?? ctl.rest) - ctl.rest;
    for (const d of ctl.drives)
      if (d.kind === "bone") delta.set(d.bone, (delta.get(d.bone) ?? 0) + d.degPerUnit * v);
  }
  const byId = new Map(c.manifest.skeleton.bones.map((b) => [b.id, b]));
  const world = new Map<string, Mat>();
  for (const id of r.order) {
    const b = byId.get(id);
    const local = r.restLocal.get(id);
    if (!b || !local) continue;
    const parent = b.parent !== undefined ? world.get(b.parent) : undefined;
    const turned = mul(local, rotate(delta.get(id) ?? 0));
    world.set(id, parent ? mul(parent, turned) : turned);
  }
  return world;
}

/** Morph weights from the channel values (exported for measurement). */
export function morphWeights(
  c: LoadedCharacter,
  values: Readonly<Record<string, number>>,
): Map<string, number> {
  const w = new Map<string, number>();
  for (const ctl of c.manifest.controls) {
    const v = values[ctl.channel] ?? ctl.rest;
    for (const d of ctl.drives)
      if (d.kind === "morph")
        w.set(d.morph, clamp01((w.get(d.morph) ?? 0) + clamp01((v - d.from) / (d.to - d.from))));
  }
  return w;
}

function opacities(c: LoadedCharacter, values: Readonly<Record<string, number>>): Map<string, number> {
  const o = new Map<string, number>();
  for (const ctl of c.manifest.controls) {
    const v = values[ctl.channel] ?? ctl.rest;
    for (const d of ctl.drives)
      if (d.kind === "opacity") o.set(d.part, (o.get(d.part) ?? 1) * clamp01((v - d.from) / (d.to - d.from)));
  }
  return o;
}

/** Morphs, then skinning, for one part. */
export function deformPart(
  c: LoadedCharacter,
  part: Part,
  weights: ReadonlyMap<string, number>,
  bones: ReadonlyMap<string, Mat>,
): Float64Array {
  const r = rest(c);
  const n = part.vertices.length;
  const pts = new Float64Array(n * 2);
  part.vertices.forEach(([x, y], i) => {
    pts[i * 2] = x;
    pts[i * 2 + 1] = y;
  });
  for (const mo of part.morphs) {
    const w = weights.get(mo.id) ?? 0;
    if (w === 0) continue;
    for (const [i, dx, dy] of mo.deltas) {
      pts[i * 2] = (pts[i * 2] as number) + w * dx;
      pts[i * 2 + 1] = (pts[i * 2 + 1] as number) + w * dy;
    }
  }
  const skin = (id: string): Mat => {
    const cur = bones.get(id);
    const inv = r.restInverse.get(id);
    if (!cur || !inv) throw new CharacterError("BONE_UNKNOWN", id);
    return mul(cur, inv);
  };
  const b = part.binding;
  if (b.kind === "rigid") {
    const s = skin(b.bone);
    for (let i = 0; i < n; i++) {
      const [x, y] = apply(s, pts[i * 2] as number, pts[i * 2 + 1] as number);
      pts[i * 2] = x;
      pts[i * 2 + 1] = y;
    }
    return pts;
  }
  const mats = b.bones.map(skin);
  for (let i = 0; i < n; i++) {
    const x = pts[i * 2] as number;
    const y = pts[i * 2 + 1] as number;
    let ox = 0;
    let oy = 0;
    for (const [bi, w] of b.weights[i] ?? []) {
      const s = mats[bi] as Mat;
      ox += w * (s[0] * x + s[2] * y + s[4]);
      oy += w * (s[1] * x + s[3] * y + s[5]);
    }
    pts[i * 2] = ox;
    pts[i * 2 + 1] = oy;
  }
  return pts;
}

interface Choice {
  weight: number;
  views: Record<string, string>;
}

/** The views each group shows at these values: one, or two cross-faded inside a blend band. */
export function chooseViews(c: LoadedCharacter, values: Readonly<Record<string, number>>): Choice[] {
  let choices: Choice[] = [{ weight: 1, views: {} }];
  for (const [group, g] of Object.entries(c.manifest.views)) {
    if (!g) continue;
    const y = values[g.yawChannel] ?? 0;
    const views = [...g.views].sort((a, b) => a.yaw[0] - b.yaw[0]);
    let pick: Array<{ id: string; w: number }> = [];
    for (let i = 0; i < views.length; i++) {
      const v = views[i] as (typeof views)[number];
      const last = i === views.length - 1;
      if (y >= v.yaw[0] && (y < v.yaw[1] || (last && y <= v.yaw[1]))) {
        pick = [{ id: v.id, w: 1 }];
        const next = views[i + 1];
        const prev = views[i - 1];
        if (next && v.blend > 0 && y > v.yaw[1] - v.blend) {
          const t = (y - (v.yaw[1] - v.blend)) / (2 * v.blend);
          pick = [
            { id: v.id, w: 1 - t },
            { id: next.id, w: t },
          ];
        } else if (prev && prev.blend > 0 && y < v.yaw[0] + prev.blend) {
          const t = (y - (v.yaw[0] - prev.blend)) / (2 * prev.blend);
          pick = [
            { id: prev.id, w: 1 - t },
            { id: v.id, w: t },
          ];
        }
        break;
      }
    }
    if (!pick.length) throw new CharacterError("VIEW_NONE", `${group}: no view for ${g.yawChannel} = ${y}`);
    choices = choices.flatMap((ch) =>
      pick
        .filter((p) => p.w > 0)
        .map((p) => ({ weight: ch.weight * p.w, views: { ...ch.views, [group]: p.id } })),
    );
  }
  return choices;
}

export function evaluate(c: LoadedCharacter, state: CharacterState): Evaluated {
  const m = c.manifest;
  const r = rest(c);
  if (state.outfit !== undefined && !m.wardrobe.some((o) => o.id === state.outfit))
    throw new CharacterError("OUTFIT_UNKNOWN", `${m.id} has no outfit '${state.outfit}'`);
  const lod: Lod = state.lod ?? "medium";
  if (!m.capabilities.lod.includes(lod))
    throw new CharacterError("LOD_UNSUPPORTED", `${m.id} does not declare ${lod}`);
  const values = resolveValues(c, state.channels);
  const bones = boneMatrices(c, values);
  const weights = morphWeights(c, values);
  const opac = opacities(c, values);
  const outfit = m.wardrobe.find((o) => o.id === state.outfit);
  const hidden = new Set(outfit?.hides ?? []);
  const cache = new Map<string, Float64Array>();
  const points = (p: Part): Float64Array => {
    let pts = cache.get(p.id);
    if (!pts) {
      pts = deformPart(c, p, weights, bones);
      cache.set(p.id, pts);
    }
    return pts;
  };

  const layers: Layer[] = chooseViews(c, values).map((choice) => {
    const items: DrawItem[] = [];
    const byPart = new Map<string, PartItem>();
    for (const p of c.parts) {
      const own = r.owner.get(p.id);
      if (own && choice.views[own.group] !== own.view) continue;
      const g = r.garment.get(p.id);
      if (g !== undefined && g !== state.outfit) continue;
      if (hidden.has(p.id)) continue;
      const item: PartItem = {
        kind: "part",
        part: p,
        points: points(p),
        opacity: p.opacity * (opac.get(p.id) ?? 1),
        z: p.z,
        order: (r.partIndex.get(p.id) ?? 0) * 2,
      };
      byPart.set(p.id, item);
      items.push(item);
    }
    const headView = choice.views["head"] ?? "default";
    const gaze = m.face.gaze;
    const inView = m.eyes.flatMap((e) => {
      const ev = e.views.find((v) => v.view === headView);
      return ev ? [{ e, ev }] : [];
    });
    if (gaze && inView.length) {
      // head-space origin: midway between the eyes as drawn at rest in this view
      const restCenter = (ev: (typeof inView)[number]["ev"]): [number, number] => {
        const v = c.partById.get(ev.clip)?.vertices[ev.centerVertex];
        return v ? [v[0], v[1]] : [0, 0];
      };
      const mid = inView.map(({ ev }) => restCenter(ev)).reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0]);
      mid[0] /= inView.length;
      mid[1] /= inView.length;
      const target = [values["gaze_x"] ?? 0, values["gaze_y"] ?? 0, values["gaze_z"] ?? 1];
      for (const { e, ev } of inView) {
        const clip = byPart.get(ev.clip);
        if (!clip) continue;
        const rc = restCenter(ev);
        const dx = (target[0] as number) - (rc[0] - mid[0]);
        const dy = (target[1] as number) - (rc[1] - mid[1]);
        const dz = Math.max(1e-6, target[2] as number);
        let yaw = Math.atan2(dx, dz);
        let pitch = Math.atan2(dy, Math.hypot(dx, dz));
        const max = (e.maxAngle * Math.PI) / 180;
        const mag = Math.hypot(yaw, pitch);
        if (mag > max) {
          yaw *= max / mag;
          pitch *= max / mag;
        }
        // the eye turns with its bone relative to the rest pose (the skin matrix), not the bone's own direction
        const skin = mul(bones.get(e.bone) as Mat, r.restInverse.get(e.bone) as Mat);
        const angle = (Math.atan2(skin[1], skin[0]) * 180) / Math.PI;
        const lin: Mat = [skin[0], skin[1], skin[2], skin[3], 0, 0];
        const cx = clip.points[ev.centerVertex * 2] as number;
        const cy = clip.points[ev.centerVertex * 2 + 1] as number;
        const [ox, oy] = apply(lin, ev.radius * Math.sin(yaw) * ev.squash, ev.radius * Math.sin(pitch));
        const [hx, hy] = apply(lin, e.highlight.offset[0], e.highlight.offset[1]);
        items.push({
          kind: "iris",
          eye: e,
          clip,
          center: [cx + ox, cy + oy],
          rx: e.iris.radius * ev.squash * Math.cos(yaw),
          ry: e.iris.radius * Math.cos(pitch),
          angle,
          highlight: [cx + hx, cy + hy],
          z: clip.z,
          order: clip.order + 1,
        });
      }
    }
    items.sort((a, b) => a.z - b.z || a.order - b.order);
    return { weight: choice.weight, views: choice.views, items };
  });

  const follow = (
    pts: ReadonlyArray<{ id: string; bone: string; at: [number, number] }>,
  ): Map<string, [number, number]> => {
    const out = new Map<string, [number, number]>();
    for (const s of pts) {
      const cur = bones.get(s.bone);
      const inv = r.restInverse.get(s.bone);
      if (cur && inv) out.set(s.id, apply(mul(cur, inv), s.at[0], s.at[1]));
    }
    return out;
  };
  return {
    values,
    layers,
    bones,
    sockets: follow(m.skeleton.sockets),
    contacts: follow(m.skeleton.contacts),
    lod,
  };
}
