/**
 * Drawing one scene of a verified package at one instant. Every value comes from the package (through the
 * contract's evaluator) or from the manifest; every file asset from the bytes the gate verified. The drawings are
 * the engine's own (v2frame.ts, w0/compositor.ts, sets, props, rig, templates, type), so the package path and the
 * plan path draw through the same code.
 *
 * Engine behaviour the package does not carry (documented in the E1.4 report):
 *   - a builtin vector drawing is drawn in scene coordinates; its inputs are its parameters (node placement is not
 *     applied to builtins, which is how the stager writes them: x = y = 0, scale 1);
 *   - a rig channel without a track takes the rig's standing pose (rig.ts STANDING), glow 0; placement x 0, y 0,
 *     facing 1, turn 1, scale 1;
 *   - a scene with a template node is seen through the editorial camera (zoom about the frame centre), any other
 *     flat scene through the set camera; a parallax scene is W0's place, drawn by the W0 compositor;
 *   - captions fade in over 0.12 s; words not yet spoken at 0.6 opacity, the stroke at 0.9.
 */
import { drawn, phraseAt, transformAttr, wordCurrent, wordReached } from "@erkasa/contracts";
import { safeOpacity } from "@erkasa/engine";
import type { SetId, Template } from "../contract.js";
import { clamp } from "../motion.js";
import { drawProp, type PropKind } from "../props.js";
import { drawPerson, STANDING, type Look, type Pose } from "../rig.js";
import { SETS } from "../sets.js";
import { H, W, kineticType, type TypeLine } from "../style.js";
import { TEMPLATES } from "../templates.js";
import { otsShoulder, scrimRect, type Drawn, type ScrimPlace } from "../v2frame.js";
import { captionSvg, typeW0Svg, type W0View } from "../w0/compositor.js";
import type { PlaceState, WorldParams } from "../w0/world.js";
import { At, type Assets, type AssetNode, type Captions, type Scene, type VectorAsset } from "./scene.js";

/** What a scene draws with: the manifest and the verified bytes of every file asset. */
export interface Library {
  assets: Assets;
  /** Verified bytes by `id@version` or `id@version#state`. */
  bytes(key: string): Buffer;
}

const builtinName = (lib: Library, n: AssetNode): string | undefined => {
  const { source } = lib.assets.source(n);
  return source.kind === "builtin" ? source.name : undefined;
};

type Params = Record<string, unknown>;
const params = (n: AssetNode): Params => (n.params ?? {}) as Params;

// ------------------------------------------------------------------------------------------------ one node

/** The SVG of one node at `at` (nothing when hidden). */
export function nodeSvg(lib: Library, at: At, n: AssetNode): string {
  if (!at.visible(n.id)) return "";
  const src = lib.assets.source(n);
  if (src.source.kind === "file") return fileSvg(lib, at, n, src.asset, src.key);
  const name = src.source.name;
  const p = params(n);
  const ch = (c: string): number => at.n("node", n.id, `param.${c}`);
  let m: RegExpExecArray | null;
  if ((m = /^set\.([a-z]+)\.(back|front)$/.exec(name))) {
    const set = SETS[m[1] as SetId];
    const st = { t: ch("t"), light: ch("light"), door: ch("door") };
    return m[2] === "back" ? set.back(st) : set.front(st);
  }
  if ((m = /^prop\.([a-z]+)\.(resting|held)$/.exec(name))) {
    const x = at.place(n, "x");
    const y = at.place(n, "y");
    return m[2] === "held"
      ? drawProp(m[1] as PropKind, x, y, { facing: ch("facing") as 1 | -1, rot: ch("rot") })
      : drawProp(m[1] as PropKind, x, y, { resting: true });
  }
  if ((m = /^template\.([a-z_]+)$/.exec(name))) {
    const anchors = (p["anchors"] ?? {}) as Record<string, number | null>;
    return TEMPLATES[m[1] as Template]({
      t: ch("t"),
      dur: p["dur"] as number,
      params: p["params"] as Params,
      at: (a) => anchors[a] ?? undefined,
    }).svg;
  }
  if (name === "type.kinetic")
    return kineticType(ch("t"), p["lines"] as TypeLine[], {
      id: `kt-${at.scene.id}-${n.id}`,
      y: p["y"] as number,
      at: p["at"] as number,
      out: p["out"] as number | null,
      dark: p["dark"] as boolean,
    });
  if (name === "type.w0")
    return typeW0Svg(ch("t"), {
      lines: p["lines"] as TypeLine[],
      place: p["place"] as ScrimPlace,
      at: p["at"] as number,
      out: p["out"] as number | null,
      id: `kt-${at.scene.id}-${n.id}`,
    });
  if (name === "overlay.scrim") return scrimRect(p["place"] as ScrimPlace);
  if (name === "overlay.ots") return otsShoulder(ch("t"), p["dur"] as number, p["facing"] as 1 | -1);
  throw new Error(`${at.scene.id}/${n.id}: '${name}' is not drawn in a flat scene`);
}

const dataUris = new WeakMap<Buffer, string>();
/**
 * A file asset: the verified bytes inline (no path is opened), its origin at the node, then the placement.
 * The engine's resvg guard (safeOpacity, the one rasterize applies to every frame) is applied to the asset's text
 * too: resvg 2.6 panics on an element with opacity that lies outside the drawing (prison cell: rects past its
 * viewBox), and a data URI hides the asset from the frame-level guard. The guard moves `opacity` of a shape to
 * its fill and stroke opacity; the bytes the gate verified are not changed.
 */
function fileSvg(lib: Library, at: At, n: AssetNode, asset: VectorAsset, key: string): string {
  const bytes = lib.bytes(key);
  let uri = dataUris.get(bytes);
  if (!uri) {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    uri = `data:image/svg+xml;base64,${Buffer.from(safeOpacity(text)).toString("base64")}`;
    dataUris.set(bytes, uri);
  }
  const g = asset.geometry;
  const sx = g.size.w / g.viewBox[2];
  const sy = g.size.h / g.viewBox[3];
  const local = (p: [number, number]): [number, number] => [
    (p[0] - g.origin[0]) * sx,
    (p[1] - g.origin[1]) * sy,
  ];
  const [ix, iy] = local([g.viewBox[0], g.viewBox[1]]);
  const pv = n.pivot ? asset.pivots.find((q) => q.id === n.pivot)?.at : undefined;
  if (n.pivot && !pv) throw new Error(`${n.id}: ${n.asset} has no pivot ${n.pivot}`);
  const [px, py] = pv ? local(pv) : [0, 0];
  const s = at.place(n, "scale");
  const r = at.place(n, "rotation");
  const o = at.place(n, "opacity");
  const tf =
    `translate(${at.place(n, "x")} ${at.place(n, "y")}) translate(${px} ${py}) rotate(${r}) ` +
    `scale(${n.flip ? -s : s} ${s}) translate(${-px} ${-py})`;
  return `<g transform="${tf}"${o < 1 ? ` opacity="${o}"` : ""}><image href="${uri}" x="${ix}" y="${iy}" width="${g.size.w}" height="${g.size.h}" preserveAspectRatio="none"/></g>`;
}

// ------------------------------------------------------------------------------------------------ people

/** A cutout person from its rig, appearance and channels. */
export function actorSvg(lib: Library, at: At, a: Scene["actors"][number]): string {
  const rig = lib.assets.get(a.rig);
  if (rig.kind !== "rig" || rig.source.kind !== "builtin")
    throw new Error(`${a.id}: ${a.rig} is not a builtin rig`);
  const build = rig.source.name === "rig.cutout.woman" ? "woman" : "man";
  const pose = { ...STANDING } as Pose;
  const set = pose as unknown as Record<string, number>;
  for (const b of rig.bones) set[b.id] = at.n("actor", a.id, `bone.${b.id}`, set[b.id] ?? 0);
  for (const { id: c } of rig.channels)
    if (c !== "glow") set[c] = at.n("actor", a.id, `channel.${c}`, set[c] ?? 0);
  const look = { build, ...(a.appearance as Omit<Look, "build">) } as Look;
  const placed = {
    x: at.n("actor", a.id, "root.x", 0),
    y: at.n("actor", a.id, "root.y", 0),
    facing: at.n("actor", a.id, "facing", 1) as 1 | -1,
    turn: at.n("actor", a.id, "turn", 1),
    scale: at.n("actor", a.id, "root.scale", 1),
  };
  const glow = rig.channels.some((c) => c.id === "glow") ? at.n("actor", a.id, "channel.glow", 0) : 0;
  return drawPerson(pose, placed, look, { glow, id: a.id }).svg;
}

// ------------------------------------------------------------------------------------------------ flat scenes

const isAsset = (n: Scene["layers"][number]["nodes"][number]): n is AssetNode => n.kind === "asset";

/** A flat scene: the world through its camera, then the screen layers. */
export function flatScene(lib: Library, scene: Scene, t: number): Drawn {
  const at = new At(scene, t);
  let world = "";
  let editorial = false;
  for (const l of scene.layers) {
    for (const n of l.nodes.filter(isAsset)) {
      if (builtinName(lib, n)?.startsWith("template.")) editorial = true;
      world += nodeSvg(lib, at, n);
    }
    for (const a of scene.actors) if (a.layer === l.id) world += actorSvg(lib, at, a);
  }
  const x = at.n("camera", undefined, "x");
  const y = at.n("camera", undefined, "y");
  const h = at.n("camera", undefined, "height");
  // the view transform from the arithmetic the gate and the stager check bounds with (contracts camera-view.ts);
  // the same text v2frame.ts setView / editorialView write
  const view = drawn({ kind: editorial ? "editorial" : "set" }, x, y, h, W, H);
  let body = `<g transform="${transformAttr(view)}">${world}</g>`;
  for (const l of scene.screen ?? []) for (const n of l.nodes.filter(isAsset)) body += nodeSvg(lib, at, n);
  return { body, bg: scene.background };
}

// ------------------------------------------------------------------------------------------------ W0 scenes

const W0_STATE = ["t", "light", "door", "lamp", "clockMin", "binders"] as const;

/** A parallax scene as the W0 compositor's input: W0's place, its people and props. */
export function w0Scene(lib: Library, scene: Scene, t: number): W0View {
  const at = new At(scene, t);
  const role = new Map<string, { layer: Scene["layers"][number]; node: AssetNode }>();
  let held = "";
  let resting = "";
  for (const l of scene.layers)
    for (const n of l.nodes.filter(isAsset)) {
      const name = builtinName(lib, n) ?? "";
      if (/^w0\.(sky|wall|mid|near)$/.test(name)) role.set(name.slice(3), { layer: l, node: n });
      else if (name === "w0.city") role.set(params(n)["near"] ? "cityNear" : "city", { layer: l, node: n });
      else if (/^prop\.[a-z]+\.held$/.test(name)) held += nodeSvg(lib, at, n);
      else if (/^prop\.[a-z]+\.resting$/.test(name)) resting += nodeSvg(lib, at, n);
      else throw new Error(`${scene.id}/${n.id}: '${name || n.asset}' is not drawn in a parallax scene`);
    }
  const need = (r: string): { layer: Scene["layers"][number]; node: AssetNode } => {
    const x = role.get(r);
    if (!x) throw new Error(`${scene.id}: a parallax scene needs W0's ${r} layer`);
    return x;
  };
  const sky = need("sky");
  const st = Object.fromEntries(
    W0_STATE.map((k) => [k, at.n("node", sky.node.id, `param.${k}`)]),
  ) as unknown as PlaceState;
  const people = scene.layers
    .flatMap((l) => scene.actors.filter((a) => a.layer === l.id))
    .map((a) => actorSvg(lib, at, a))
    .join("");
  const actorLayer = scene.layers.find((l) => scene.actors.some((a) => a.layer === l.id));
  const near = role.get("near");
  return {
    T: st.t,
    cam: {
      cx: at.n("camera", undefined, "x"),
      cy: at.n("camera", undefined, "y"),
      height: at.n("camera", undefined, "height"),
    },
    st,
    world: params(need("wall").node)["world"] as WorldParams,
    city: {
      seed: params(need("city").node)["seed"] as number,
      nearSeed: params(need("cityNear").node)["seed"] as number,
    },
    depth: {
      sky: sky.layer.depth,
      city: need("city").layer.depth,
      cityNear: need("cityNear").layer.depth,
      wall: need("wall").layer.depth,
      mid: need("mid").layer.depth,
      near: near?.layer.depth ?? 0,
    },
    blur: {
      far: sky.layer.blur,
      wall: need("wall").layer.blur,
      mid: need("mid").layer.blur,
      people: actorLayer?.blur ?? 0,
      near: near?.layer.blur ?? 0,
    },
    near: !!near && at.visible(near.node.id),
    people,
    held,
    resting,
  };
}

/** The screen layers of a scene (W0: drawn over the composited frame). */
export function screenSvg(lib: Library, scene: Scene, t: number): string {
  const at = new At(scene, t);
  let o = "";
  for (const l of scene.screen ?? []) for (const n of l.nodes.filter(isAsset)) o += nodeSvg(lib, at, n);
  return o;
}

// ------------------------------------------------------------------------------------------------ captions

/** The captions being spoken at `t`, styled by their overlay (font, size, colours, stroke, position). */
export function captionsSvg(lib: Library, overlays: Captions[], t: number): string {
  let o = "";
  for (const ov of overlays) {
    const ph = phraseAt(ov, t);
    if (!ph) continue;
    const font = lib.assets.get(ov.style.font);
    if (font.kind !== "font") throw new Error(`${ov.id}: ${ov.style.font} is not a font`);
    o += captionSvg(
      {
        x: ov.at.x * W,
        y: ov.at.y * H,
        family: font.family,
        weight: font.weight,
        size: ov.style.size,
        color: ov.style.color,
        highlight: ov.highlight ?? ov.style.color,
        ...(ov.style.stroke ? { stroke: ov.style.stroke } : {}),
      },
      ph.words.map((w) => ({ text: w.text, reached: wordReached(w, t), current: wordCurrent(w, t) })),
      clamp((t - ph.in) / 0.12),
    );
  }
  return o;
}
