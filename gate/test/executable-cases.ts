/**
 * E1.4 G16 (capabilities v2): packages the gate must refuse because the engine would not draw them as written.
 * The 16 packages of the audit (film/test/package/gate-audit.ts, R1–R16, as they were) and one-fault packages for
 * every rule (scope §D.1). Each lists the exact findings; K5 renders each and requires 0 frames.
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion -- cases over known package shapes */
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  builtinOf,
  cameraViews,
  enclose,
  sceneLens,
  type AssetManifest,
  type RenderPackage,
} from "@erkasa/contracts";
import { caps, film, sha } from "./helpers.js";

type Pkg = RenderPackage;
type Scene = Pkg["scenes"][number];
type Node = Scene["layers"][number]["nodes"][number];
type Track = Scene["tracks"][number];
export interface Start {
  pkg: Pkg;
  manifest: AssetManifest;
  root: string;
}
export interface ExecCase {
  name: string;
  /** the package the fault is put into (default: the B3 base of broken.ts) */
  start?: () => Start;
  mutate: (c: { pkg: Pkg; manifest: AssetManifest; root: string }) => void;
  expect: string[];
}

// ------------------------------------------------------------------------------------------------ starts

export const w0 = (): Start => ({ ...film("w0-office"), root: mkdtempSync(join(tmpdir(), "gate-w0-")) });

/** A flat scene (office-clock's first) and a W0 scene (W0's first) in one package, in `order`, cut together. */
export function mixed(order: "flat-parallax" | "parallax-flat"): Start {
  const oc = film("b3-every-yes");
  const pw = film("w0-office");
  const flat = { ...structuredClone(oc.pkg.scenes[0]!), id: "flat_scene" };
  const par = { ...structuredClone(pw.pkg.scenes[0]!), id: "w0_scene" };
  const cutOf = (p: Pkg, id: string) => p.edit.find((c) => c.scene === id)!;
  const fc = cutOf(oc.pkg, oc.pkg.scenes[0]!.id);
  const pc = cutOf(pw.pkg, pw.pkg.scenes[0]!.id);
  const first =
    order === "flat-parallax" ? { s: flat, len: fc.end - fc.start } : { s: par, len: pc.end - pc.start };
  const second =
    order === "flat-parallax" ? { s: par, len: pc.end - pc.start } : { s: flat, len: fc.end - fc.start };
  const assets = new Map<string, AssetManifest["assets"][number]>();
  for (const a of [...oc.manifest.assets, ...pw.manifest.assets]) assets.set(`${a.id}@${a.version}`, a);
  const used = new Set(
    [flat, par].flatMap((s) => [
      ...s.layers.flatMap((l) => l.nodes.map((n) => (n as { asset: string }).asset)),
      ...(s.screen ?? []).flatMap((l) => l.nodes.map((n) => (n as { asset: string }).asset)),
      ...s.actors.map((a) => a.rig),
    ]),
  );
  const end = first.len + second.len;
  const pkg: Pkg = {
    ...structuredClone(oc.pkg),
    id: `mixed-${order}`,
    output: { ...oc.pkg.output, duration: end },
    scenes: [first.s, second.s],
    edit: [
      { scene: first.s.id, start: 0, end: first.len, enter: { kind: "cut", duration: 0 } },
      { scene: second.s.id, start: first.len, end, enter: { kind: "dissolve", duration: 0.45 } },
    ],
    overlays: [],
    audio: [],
  };
  const manifest: AssetManifest = {
    ...oc.manifest,
    assets: [...assets.entries()].filter(([r]) => used.has(r)).map(([, a]) => a),
  };
  return { pkg, manifest, root: mkdtempSync(join(tmpdir(), "gate-mixed-")) };
}

// ------------------------------------------------------------------------------------------------ helpers

const layersOf = (s: Scene) => [...s.layers, ...(s.screen ?? [])];
const nodeIn = (s: Scene, id: string): Node =>
  layersOf(s)
    .flatMap((l) => l.nodes)
    .find((n) => n.id === id)!;
const sceneWith = (p: Pkg, id: string): Scene =>
  p.scenes.find((s) => layersOf(s).some((l) => l.nodes.some((n) => n.id === id)))!;
const si = (p: Pkg, s: Scene): number => p.scenes.indexOf(s);
const track = (s: Scene, kind: string, id: string | undefined, ch: string): Track =>
  s.tracks.find(
    (t) => t.channel === ch && t.target.kind === kind && ("id" in t.target ? t.target.id : undefined) === id,
  )!;
/** Re-encloses every scene's bounds (a case that moves the camera keeps bounds out of its fault). */
const rebound = (p: Pkg, m: AssetManifest): void => {
  for (const s of p.scenes) s.bounds = enclose(s.bounds, viewsOf(p, m, s));
};
const asset = (m: AssetManifest, id: string) => m.assets.find((a) => a.id === id)!;
const builtinName = (m: AssetManifest, n: Node): string => {
  const a = m.assets.find((x) => `${x.id}@${x.version}` === (n as { asset: string }).asset)!;
  const st =
    a.kind === "vector" ? a.states.find((x) => x.name === (n as { state: string }).state) : undefined;
  const src = st && "source" in st ? st.source : a.source;
  return src.kind === "builtin" ? src.name : "file";
};
const findNode = (p: Pkg, m: AssetManifest, pred: (name: string) => boolean): { s: Scene; n: Node } => {
  for (const s of p.scenes)
    for (const l of layersOf(s))
      for (const n of l.nodes) if (n.kind === "asset" && pred(builtinName(m, n))) return { s, n };
  throw new Error("no such node");
};

/** Every view the scene's camera takes, as the engine draws it (the engine's capabilities decide the lens). */
export function viewsOf(p: Pkg, m: AssetManifest, s: Scene): NonNullable<ReturnType<typeof cameraViews>> {
  const rule = caps().projections[s.camera.projection]?.camera;
  const lens = rule ? sceneLens(s, builtinOf(m), rule) : undefined;
  return (lens ? cameraViews(s, p.output.width, p.output.height, lens) : undefined) ?? [];
}

/** Bounds exactly around every view of the scene (the near sides at the views' extremes). */
export const tight = (p: Pkg, m: AssetManifest, s: Scene): void => {
  const views = viewsOf(p, m, s);
  const x = Math.min(...views.map((v) => v.x0));
  const y = Math.min(...views.map((v) => v.y0));
  s.bounds = enclose({ x, y, w: Number.MIN_VALUE, h: Number.MIN_VALUE }, views);
};
const nextUp = (v: number): number => {
  const b = new Float64Array([v]);
  const i = new BigInt64Array(b.buffer);
  i[0] = (i[0] as bigint) + (v >= 0 ? 1n : -1n);
  return b[0] as number;
};
/** A flat set scene, an editorial (template) scene and a parallax scene, for the bounds boundary cases. */
export const boundsScene = {
  set: (p: Pkg, m: AssetManifest): Scene => findNode(p, m, (b) => b.startsWith("set.")).s,
  editorial: (p: Pkg, m: AssetManifest): Scene => findNode(p, m, (b) => b.startsWith("template.")).s,
  parallax: (p: Pkg): Scene => p.scenes[0]!,
};

// ------------------------------------------------------------------------------------------------ cases

export const EXEC_CASES: ExecCase[] = [
  // ---- the audit, R1–R16 (as gate-audit.ts built them)
  {
    name: "R1 audit: element state of the asset's main file",
    mutate: (c) => {
      (asset(c.manifest, "prop_chairfile") as { states: unknown[] }).states = [
        { name: "default", element: "seat" },
      ];
    },
    expect: ["CAPABILITY_MISSING manifest/assets/11/states/0/element"],
  },
  {
    name: "R2 audit: non-W0 nodes in a parallax scene",
    mutate: (c) => {
      sceneWith(c.pkg, "chairfile").camera.projection = "parallax";
    },
    expect: [
      "CAPABILITY_MISSING package/scenes/1/layers/0",
      "CAPABILITY_MISSING package/scenes/1/layers/0/nodes/0/asset",
      "CAPABILITY_MISSING package/scenes/1/layers/0/nodes/1/asset",
      "CAPABILITY_MISSING package/scenes/1/layers/0/nodes/2/asset",
      "CAPABILITY_MISSING package/scenes/1/layers/0/nodes/3/asset",
      "CAPABILITY_MISSING package/scenes/1/layers/3",
      "CAPABILITY_MISSING package/scenes/1/layers/3/nodes/0/asset",
      "CAPABILITY_MISSING package/scenes/1/screen/0/nodes/0/asset",
      "CAPABILITY_MISSING package/scenes/1/screen/0/nodes/1/asset",
      "ROLE_MISSING package/scenes/1/layers",
      "ROLE_MISSING package/scenes/1/layers",
      "ROLE_MISSING package/scenes/1/layers",
      "ROLE_MISSING package/scenes/1/layers",
      "ROLE_MISSING package/scenes/1/layers",
      "VALUE_UNSUPPORTED package/scenes/1/actors/0/rim",
      "VALUE_UNSUPPORTED package/scenes/1/actors/0/shadow",
      "VALUE_UNSUPPORTED package/scenes/1/camera/dolly",
      "VALUE_UNSUPPORTED package/scenes/1/camera/referenceDistance",
      "VALUE_UNSUPPORTED package/scenes/1/layers/1/lit",
      "VALUE_UNSUPPORTED package/scenes/1/layers/2/lit",
    ],
  },
  {
    name: "R3 audit: dissolve from a flat into a parallax scene",
    mutate: (c) => {
      c.pkg.edit[1]!.enter = { kind: "dissolve", duration: 0.45 };
      c.pkg.scenes.find((s) => s.id === c.pkg.edit[1]!.scene)!.camera.projection = "parallax";
    },
    expect: [
      "CAPABILITY_MISSING package/edit/1/enter/kind",
      "CAPABILITY_MISSING package/scenes/1/layers/0",
      "CAPABILITY_MISSING package/scenes/1/layers/0/nodes/0/asset",
      "CAPABILITY_MISSING package/scenes/1/layers/0/nodes/1/asset",
      "CAPABILITY_MISSING package/scenes/1/layers/0/nodes/2/asset",
      "CAPABILITY_MISSING package/scenes/1/layers/0/nodes/3/asset",
      "CAPABILITY_MISSING package/scenes/1/layers/3",
      "CAPABILITY_MISSING package/scenes/1/layers/3/nodes/0/asset",
      "CAPABILITY_MISSING package/scenes/1/screen/0/nodes/0/asset",
      "CAPABILITY_MISSING package/scenes/1/screen/0/nodes/1/asset",
      "ROLE_MISSING package/scenes/1/layers",
      "ROLE_MISSING package/scenes/1/layers",
      "ROLE_MISSING package/scenes/1/layers",
      "ROLE_MISSING package/scenes/1/layers",
      "ROLE_MISSING package/scenes/1/layers",
      "VALUE_UNSUPPORTED package/scenes/1/actors/0/rim",
      "VALUE_UNSUPPORTED package/scenes/1/actors/0/shadow",
      "VALUE_UNSUPPORTED package/scenes/1/camera/dolly",
      "VALUE_UNSUPPORTED package/scenes/1/camera/referenceDistance",
      "VALUE_UNSUPPORTED package/scenes/1/layers/1/lit",
      "VALUE_UNSUPPORTED package/scenes/1/layers/2/lit",
    ],
  },
  {
    name: "R4 audit: whip in a parallax film",
    start: w0,
    mutate: (c) => {
      c.pkg.edit.find((x) => x.enter.kind === "dissolve")!.enter = { kind: "whip", duration: 0.32 };
    },
    expect: ["CAPABILITY_MISSING package/edit/11/enter/kind"],
  },
  {
    name: "R5 audit: a W0 scene drawn flat (its second scene)",
    start: w0,
    mutate: (c) => {
      c.pkg.scenes[1]!.camera.projection = "flat";
    },
    expect: [
      "CAPABILITY_MISSING package/scenes/1/layers/0/nodes/0/asset",
      "CAPABILITY_MISSING package/scenes/1/layers/1/nodes/0/asset",
      "CAPABILITY_MISSING package/scenes/1/layers/2/nodes/0/asset",
      "CAPABILITY_MISSING package/scenes/1/layers/3/nodes/0/asset",
      "CAPABILITY_MISSING package/scenes/1/layers/4/nodes/0/asset",
      "CAPABILITY_MISSING package/scenes/1/layers/7/nodes/0/asset",
      "VALUE_UNSUPPORTED package/scenes/1/actors/0/rim",
      "VALUE_UNSUPPORTED package/scenes/1/actors/0/shadow",
      "VALUE_UNSUPPORTED package/scenes/1/layers/0/blur",
      "VALUE_UNSUPPORTED package/scenes/1/layers/1/blur",
      "VALUE_UNSUPPORTED package/scenes/1/layers/2/blur",
      "VALUE_UNSUPPORTED package/scenes/1/layers/3/blur",
      "VALUE_UNSUPPORTED package/scenes/1/layers/3/lit",
      "VALUE_UNSUPPORTED package/scenes/1/layers/4/lit",
      "VALUE_UNSUPPORTED package/scenes/1/layers/5/lit",
      "VALUE_UNSUPPORTED package/scenes/1/layers/6/lit",
      "VALUE_UNSUPPORTED package/scenes/1/layers/7/blur",
      "VALUE_UNSUPPORTED package/scenes/1/layers/7/lit",
    ],
  },
  {
    name: "R6 audit: W0 builtins in a flat scene (its first scene)",
    start: w0,
    mutate: (c) => {
      c.pkg.scenes[0]!.camera.projection = "flat";
    },
    expect: [
      "CAPABILITY_MISSING package/scenes/0/layers/0/nodes/0/asset",
      "CAPABILITY_MISSING package/scenes/0/layers/1/nodes/0/asset",
      "CAPABILITY_MISSING package/scenes/0/layers/2/nodes/0/asset",
      "CAPABILITY_MISSING package/scenes/0/layers/3/nodes/0/asset",
      "CAPABILITY_MISSING package/scenes/0/layers/4/nodes/0/asset",
      "VALUE_UNSUPPORTED package/scenes/0/actors/0/rim",
      "VALUE_UNSUPPORTED package/scenes/0/actors/0/shadow",
      "VALUE_UNSUPPORTED package/scenes/0/layers/0/blur",
      "VALUE_UNSUPPORTED package/scenes/0/layers/1/blur",
      "VALUE_UNSUPPORTED package/scenes/0/layers/2/blur",
      "VALUE_UNSUPPORTED package/scenes/0/layers/3/lit",
      "VALUE_UNSUPPORTED package/scenes/0/layers/4/blur",
      "VALUE_UNSUPPORTED package/scenes/0/layers/4/lit",
      "VALUE_UNSUPPORTED package/scenes/0/layers/5/blur",
      "VALUE_UNSUPPORTED package/scenes/0/layers/5/lit",
      "VALUE_UNSUPPORTED package/scenes/0/layers/6/blur",
      "VALUE_UNSUPPORTED package/scenes/0/layers/6/lit",
    ],
  },
  {
    name: "R7 audit: a parallax scene without W0's mid layer",
    start: w0,
    mutate: (c) => {
      const s = c.pkg.scenes[0]!;
      const gone = new Set(s.layers.filter((l) => l.id === "mid").flatMap((l) => l.nodes.map((n) => n.id)));
      s.layers = s.layers.filter((l) => l.id !== "mid");
      s.tracks = s.tracks.filter((t) => !(t.target.kind === "node" && gone.has(t.target.id)));
      s.events = s.events.filter((e) => !gone.has(e.node));
    },
    expect: ["ROLE_MISSING package/scenes/0/layers"],
  },
  {
    name: "R8 audit: a channel parameter without its track (set_back param.t)",
    mutate: (c) => {
      const s = sceneWith(c.pkg, "chairfile");
      s.tracks = s.tracks.filter(
        (t) => !(t.target.kind === "node" && t.target.id === "set_back" && t.channel === "param.t"),
      );
    },
    expect: ["TRACK_MISSING package/scenes/1/layers/0/nodes/0"],
  },
  {
    name: "R9 audit: the camera without its height track",
    mutate: (c) => {
      const s = sceneWith(c.pkg, "chairfile");
      s.tracks = s.tracks.filter((t) => !(t.target.kind === "camera" && t.channel === "height"));
    },
    expect: ["TRACK_MISSING package/scenes/1/camera"],
  },
  {
    name: "R10 audit: a pivot the asset does not have",
    mutate: (c) => {
      (nodeIn(sceneWith(c.pkg, "chairfile"), "chairfile") as { pivot: string | null }).pivot = "hinge";
    },
    expect: ["PIVOT_UNDECLARED package/scenes/1/layers/0/nodes/3/pivot"],
  },
  {
    name: "R11 audit: a state the asset does not have",
    mutate: (c) => {
      (nodeIn(sceneWith(c.pkg, "chairfile"), "chairfile") as { state: string }).state = "broken";
    },
    expect: ["STATE_UNDECLARED package/scenes/1/layers/0/nodes/3/state"],
  },
  {
    name: "R12 audit: the edit names a missing scene",
    mutate: (c) => {
      c.pkg.edit[0]!.scene = "nope";
    },
    expect: ["EDIT_SCENE package/edit/0/scene"],
  },
  {
    name: "R13 audit: a captions font that is not a font",
    mutate: (c) => {
      c.pkg.overlays.push({
        kind: "captions",
        id: "cap",
        at: { x: 0.5, y: 0.85 },
        style: { font: "prop_chairfile@1", size: 50, color: "#FFFFFF", align: "center" },
        phrases: [{ in: 0, out: 1, words: [{ text: "hi", t: 0, end: 0.5 }] }],
      } as Pkg["overlays"][number]);
    },
    expect: ["ASSET_KIND package/overlays/0/style/font"],
  },
  {
    name: "R14 audit: a rig whose source is a file",
    mutate: (c) => {
      const r = c.manifest.assets.find((a) => a.kind === "rig")! as { source: unknown };
      r.source = (asset(c.manifest, "prop_chairfile") as { source: unknown }).source;
    },
    expect: ["RIG_UNSUPPORTED manifest/assets/6/source/kind"],
  },
  {
    name: "R15 audit: captions aligned left",
    start: w0,
    mutate: (c) => {
      for (const o of c.pkg.overlays) if (o.kind === "captions") o.style.align = "left";
    },
    expect: ["VALUE_UNSUPPORTED package/overlays/0/style/align"],
  },
  {
    name: "R16 audit: a type node without its lines",
    mutate: (c) => {
      const s = c.pkg.scenes.find((x) => (x.screen ?? []).some((l) => l.id === "type"))!;
      delete (nodeIn(s, "type") as { params?: Record<string, unknown> }).params!["lines"];
    },
    expect: ["PARAM_MISSING package/scenes/1/screen/0/nodes/1/params"],
  },

  // ---- one fault each
  {
    name: "N2b a set drawn in W0's mid layer",
    start: w0,
    mutate: (c) => {
      const b3 = film("b3-every-yes");
      const set = b3.manifest.assets.find((a) => a.id.startsWith("set_"))!;
      c.manifest.assets.push(set);
      const s = c.pkg.scenes[0]!;
      const mid = s.layers.find((l) => l.id === "mid")!;
      const sky = s.layers.flatMap((l) => l.nodes).find((n) => n.id === "sky")!;
      mid.nodes.push({
        ...structuredClone(sky),
        id: "set_in_w0",
        asset: `${set.id}@${set.version}`,
        state: "back",
        params: {},
      } as Node);
      for (const ch of ["t", "light", "door"])
        s.tracks.push({
          ...structuredClone(track(s, "node", sky.id, `param.${ch}`)),
          target: { kind: "node", id: "set_in_w0" },
        });
    },
    expect: ["CAPABILITY_MISSING package/scenes/0/layers/4/nodes/2/asset"],
  },
  {
    name: "N3b dissolve from a flat scene into a W0 scene",
    start: () => mixed("flat-parallax"),
    mutate: () => {},
    expect: ["CAPABILITY_MISSING package/edit/1/enter/kind"],
  },
  {
    name: "N5b dissolve from a W0 scene into a flat scene",
    start: () => mixed("parallax-flat"),
    mutate: () => {},
    expect: ["CAPABILITY_MISSING package/edit/1/enter/kind"],
  },
  {
    name: "N7b two skies in one W0 scene",
    start: w0,
    mutate: (c) => {
      const s = c.pkg.scenes[0]!;
      const sky = s.layers.flatMap((l) => l.nodes).find((n) => n.id === "sky")!;
      s.layers.find((l) => l.id === "sky")!.nodes.push({ ...structuredClone(sky), id: "sky2" });
      for (const t of s.tracks.filter((x) => x.target.kind === "node" && x.target.id === "sky"))
        s.tracks.push({ ...structuredClone(t), target: { kind: "node", id: "sky2" } });
    },
    expect: ["ID_DUPLICATE package/scenes/0/layers/0/nodes/1"],
  },
  {
    name: "X1 an audio clip",
    mutate: (c) => {
      writeFileSync(join(c.root, "assets/voice.wav"), "RIFF");
      const common = structuredClone(asset(c.manifest, "prop_chairfile"));
      c.manifest.assets.push({
        id: "audio_voice",
        version: common.version,
        kind: "audio",
        format: "wav",
        durationSec: 1,
        style: common.style,
        license: common.license,
        provenance: common.provenance,
        approval: common.approval,
        source: { kind: "file", uri: "assets/voice.wav", sha256: sha("RIFF") },
      } as unknown as AssetManifest["assets"][number]);
      c.pkg.audio.push({
        id: "vo",
        asset: "audio_voice@1",
        role: "voice",
        start: 0,
        trim: 0,
        duration: 1,
        gainDb: 0,
        fadeIn: 0,
        fadeOut: 0,
        pan: 0,
      });
    },
    expect: ["CAPABILITY_MISSING manifest/assets/12/kind", "CAPABILITY_MISSING package/audio/0"],
  },
  {
    name: "X2 an event that changes a node's state",
    mutate: (c) => {
      const { s, n } = findNode(c.pkg, c.manifest, (b) => /^prop\..*\.resting$/.test(b));
      s.events.push({
        t: s.tracks[0]!.kind === "samples" ? s.tracks[0]!.start : 0,
        node: n.id,
        state: "held",
        fx: "none",
        duration: 0,
      });
    },
    expect: ["CAPABILITY_MISSING package/scenes/1/events/4/state"],
  },
  {
    name: "X3 a contact",
    mutate: (c) => {
      const { s, n } = findNode(c.pkg, c.manifest, (b) => /^prop\..*\.held$/.test(b));
      const a = s.actors[0]!;
      const t0 = c.pkg.edit.find((x) => x.scene === s.id)!.start;
      s.contacts.push({ node: n.id, actor: a.id, socket: "hand", from: t0, to: t0 + 0.5, offset: [0, 0] });
    },
    expect: ["CAPABILITY_MISSING package/scenes/1/contacts/0"],
  },
  {
    name: "X4 an instant visibility change that lasts",
    mutate: (c) => {
      const s = c.pkg.scenes.find((x) => x.events.length)!;
      s.events[0]!.duration = 0.5;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/1/events/0/duration"],
  },
  {
    name: "X5 a rim on a flat scene's actor",
    mutate: (c) => {
      c.pkg.scenes.find((s) => s.actors.length)!.actors[0]!.rim = true;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/1/actors/0/rim"],
  },
  {
    name: "X7 captions wrapped to a width",
    start: w0,
    mutate: (c) => {
      const o = c.pkg.overlays.find((x) => x.kind === "captions")!;
      if (o.kind === "captions") o.style.maxWidth = 900;
    },
    expect: ["VALUE_UNSUPPORTED package/overlays/0/style/maxWidth"],
  },
  {
    name: "X8 an output 720 wide",
    mutate: (c) => {
      c.pkg.output.width = 720;
    },
    expect: ["VALUE_UNSUPPORTED package/output/width"],
  },
  {
    name: "X9 a captions font from a file",
    start: w0,
    mutate: (c) => {
      writeFileSync(join(c.root, "font.ttf"), "FONT");
      const f = c.manifest.assets.find((a) => a.kind === "font")!;
      (f as { source: unknown }).source = { kind: "file", uri: "font.ttf", sha256: sha("FONT") };
    },
    expect: ["CAPABILITY_MISSING manifest/assets/8/source/kind"],
  },
  {
    name: "X10 a rig height the builtin does not have",
    mutate: (c) => {
      const r = c.manifest.assets.find((a) => a.kind === "rig")!;
      if (r.kind === "rig") r.height += 10;
    },
    expect: ["VALUE_UNSUPPORTED manifest/assets/6/height"],
  },
  {
    name: "X11 an editorial camera off centre",
    mutate: (c) => {
      const { s } = findNode(c.pkg, c.manifest, (b) => b.startsWith("template."));
      const t = track(s, "camera", undefined, "x");
      if (t.kind === "samples") t.values[0] = 541;
      else t.keys[0]!.v = 541;
      rebound(c.pkg, c.manifest);
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/tracks/0/keys/0/v"],
  },
  {
    name: "X12a a W0 wall whose light differs from the sky's",
    start: w0,
    mutate: (c) => {
      const s = c.pkg.scenes[0]!;
      const wall = s.layers.find((l) => l.id === "wall")!.nodes[0]!;
      const t = track(s, "node", wall.id, "param.light");
      if (t.kind === "samples") t.values[0] = (t.values[0] as number) + 1;
      else t.keys[0]!.v = (t.keys[0]!.v as number) + 1;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/tracks/22"],
  },
  {
    name: "X12b W0 furniture in another world than the wall's",
    start: w0,
    mutate: (c) => {
      const mid = c.pkg.scenes[0]!.layers.find((l) => l.id === "mid")!.nodes.find((n) =>
        n.id.includes("mid"),
      )!;
      const p = (mid as { params: Record<string, unknown> }).params;
      const w = p["world"] as { seed: number };
      p["world"] = { ...w, seed: w.seed + 1 };
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/layers/4/nodes/0/params/world"],
  },
  {
    name: "Y1 a blurred layer in a flat scene",
    mutate: (c) => {
      c.pkg.scenes[0]!.layers[0]!.blur = 2;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/layers/0/blur"],
  },
  {
    name: "Y2 W0 city blurred apart from the sky",
    start: w0,
    mutate: (c) => {
      c.pkg.scenes[0]!.layers.find((l) => l.id === "city")!.blur += 1;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/layers/1/blur"],
  },
  {
    name: "Y3a a lit layer in a flat scene",
    mutate: (c) => {
      c.pkg.scenes[0]!.layers[0]!.lit = true;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/layers/0/lit"],
  },
  {
    name: "Y3b W0's sky lit",
    start: w0,
    mutate: (c) => {
      c.pkg.scenes[0]!.layers.find((l) => l.id === "sky")!.lit = true;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/layers/0/lit"],
  },
  {
    name: "Y4 an aperture",
    mutate: (c) => {
      c.pkg.scenes[0]!.camera.aperture = 1;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/camera/aperture"],
  },
  {
    name: "Y5a a W0 dolly the engine does not draw",
    start: w0,
    mutate: (c) => {
      c.pkg.scenes[0]!.camera.dolly = 0.5;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/camera/dolly"],
  },
  {
    name: "Y5b a W0 reference distance the engine does not draw",
    start: w0,
    mutate: (c) => {
      c.pkg.scenes[0]!.camera.referenceDistance = 2000;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/0/camera/referenceDistance"],
  },
  {
    name: "Y6 an actor sharing its layer with a node",
    mutate: (c) => {
      const s = c.pkg.scenes.find(
        (x) => x.actors.length && x.layers.some((l) => l.id === "held" && l.nodes.length),
      )!;
      const held = s.layers.find((l) => l.id === "held")!;
      const al = s.layers.find((l) => l.id === s.actors[0]!.layer)!;
      al.nodes.push(held.nodes.shift()!);
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/1/actors/0/layer"],
  },
  {
    name: "Y7a a set scaled",
    mutate: (c) => {
      (nodeIn(sceneWith(c.pkg, "chairfile"), "set_back") as { scale: number }).scale = 2;
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/1/layers/0/nodes/0/scale"],
  },
  {
    name: "Y7b a set moved by a track",
    mutate: (c) => {
      const s = sceneWith(c.pkg, "chairfile");
      s.tracks.push({
        target: { kind: "node", id: "set_back" },
        channel: "x",
        kind: "keys",
        keys: [{ t: 0, v: 0, ease: "hold" }],
      } as Track);
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/1/tracks/47/channel"],
  },
  {
    name: "Y7c a prop at rest with a hand's rotation",
    mutate: (c) => {
      const { s, n } = findNode(c.pkg, c.manifest, (b) => /^prop\..*\.resting$/.test(b));
      s.tracks.push({
        target: { kind: "node", id: n.id },
        channel: "param.rot",
        kind: "keys",
        keys: [{ t: 0, v: 0, ease: "hold" }],
      } as Track);
    },
    expect: ["VALUE_UNSUPPORTED package/scenes/1/tracks/47/channel"],
  },
  {
    name: "Y8 a W0 prop at rest outside the furniture's layer",
    start: w0,
    mutate: (c) => {
      const s = c.pkg.scenes.find((x) =>
        x.layers.some(
          (l) => l.id === "mid" && l.nodes.some((n) => n.id.startsWith("prop") || n.id.includes("_")),
        ),
      )!;
      const mid = s.layers.find((l) => l.id === "mid")!;
      const i = mid.nodes.findIndex((n) => /^prop\..*\.resting$/.test(builtinName(c.manifest, n)));
      s.layers.find((l) => l.id === "wall")!.nodes.push(mid.nodes.splice(i, 1)[0]!);
    },
    expect: ["CAPABILITY_MISSING package/scenes/0/layers/3/nodes/1/asset"],
  },
  {
    name: "E1 an output at 24 fps",
    mutate: (c) => {
      c.pkg.output.fps = 24;
    },
    expect: [
      "SAMPLE_RATE package/scenes/1/tracks/14/rate",
      "SAMPLE_RATE package/scenes/1/tracks/14/start",
      "SAMPLE_RATE package/scenes/1/tracks/15/rate",
      "SAMPLE_RATE package/scenes/1/tracks/15/start",
      "SAMPLE_RATE package/scenes/1/tracks/16/rate",
      "SAMPLE_RATE package/scenes/1/tracks/16/start",
      "SAMPLE_RATE package/scenes/1/tracks/17/rate",
      "SAMPLE_RATE package/scenes/1/tracks/17/start",
      "SAMPLE_RATE package/scenes/1/tracks/24/rate",
      "SAMPLE_RATE package/scenes/1/tracks/24/start",
      "SAMPLE_RATE package/scenes/1/tracks/25/rate",
      "SAMPLE_RATE package/scenes/1/tracks/25/start",
      "SAMPLE_RATE package/scenes/1/tracks/27/rate",
      "SAMPLE_RATE package/scenes/1/tracks/27/start",
      "SAMPLE_RATE package/scenes/1/tracks/28/rate",
      "SAMPLE_RATE package/scenes/1/tracks/28/start",
      "SAMPLE_RATE package/scenes/1/tracks/30/rate",
      "SAMPLE_RATE package/scenes/1/tracks/30/start",
      "SAMPLE_RATE package/scenes/1/tracks/31/rate",
      "SAMPLE_RATE package/scenes/1/tracks/31/start",
      "SAMPLE_RATE package/scenes/6/tracks/14/rate",
      "SAMPLE_RATE package/scenes/6/tracks/14/start",
      "SAMPLE_RATE package/scenes/6/tracks/15/rate",
      "SAMPLE_RATE package/scenes/6/tracks/15/start",
      "SAMPLE_RATE package/scenes/6/tracks/16/rate",
      "SAMPLE_RATE package/scenes/6/tracks/16/start",
      "SAMPLE_RATE package/scenes/6/tracks/17/rate",
      "SAMPLE_RATE package/scenes/6/tracks/17/start",
      "SAMPLE_RATE package/scenes/6/tracks/24/rate",
      "SAMPLE_RATE package/scenes/6/tracks/24/start",
      "SAMPLE_RATE package/scenes/6/tracks/25/rate",
      "SAMPLE_RATE package/scenes/6/tracks/25/start",
      "SAMPLE_RATE package/scenes/6/tracks/26/rate",
      "SAMPLE_RATE package/scenes/6/tracks/26/start",
      "SAMPLE_RATE package/scenes/6/tracks/27/rate",
      "SAMPLE_RATE package/scenes/6/tracks/27/start",
      "SAMPLE_RATE package/scenes/6/tracks/28/rate",
      "SAMPLE_RATE package/scenes/6/tracks/28/start",
      "SAMPLE_RATE package/scenes/6/tracks/30/rate",
      "SAMPLE_RATE package/scenes/6/tracks/30/start",
      "SAMPLE_RATE package/scenes/6/tracks/31/rate",
      "SAMPLE_RATE package/scenes/6/tracks/31/start",
      "SAMPLE_RATE package/scenes/7/tracks/14/rate",
      "SAMPLE_RATE package/scenes/7/tracks/14/start",
      "SAMPLE_RATE package/scenes/7/tracks/15/rate",
      "SAMPLE_RATE package/scenes/7/tracks/15/start",
      "SAMPLE_RATE package/scenes/7/tracks/16/rate",
      "SAMPLE_RATE package/scenes/7/tracks/16/start",
      "SAMPLE_RATE package/scenes/7/tracks/17/rate",
      "SAMPLE_RATE package/scenes/7/tracks/17/start",
      "SAMPLE_RATE package/scenes/7/tracks/24/rate",
      "SAMPLE_RATE package/scenes/7/tracks/24/start",
      "SAMPLE_RATE package/scenes/7/tracks/25/rate",
      "SAMPLE_RATE package/scenes/7/tracks/25/start",
      "SAMPLE_RATE package/scenes/7/tracks/26/rate",
      "SAMPLE_RATE package/scenes/7/tracks/26/start",
      "SAMPLE_RATE package/scenes/7/tracks/27/rate",
      "SAMPLE_RATE package/scenes/7/tracks/27/start",
      "SAMPLE_RATE package/scenes/7/tracks/28/rate",
      "SAMPLE_RATE package/scenes/7/tracks/28/start",
      "SAMPLE_RATE package/scenes/7/tracks/30/rate",
      "SAMPLE_RATE package/scenes/7/tracks/30/start",
      "VALUE_UNSUPPORTED package/output/fps",
    ],
  },
  {
    name: "E2 a text overlay",
    start: w0,
    mutate: (c) => {
      const cap = c.pkg.overlays.find((o) => o.kind === "captions")!;
      if (cap.kind !== "captions") return;
      c.pkg.overlays.push({
        kind: "text",
        id: "title",
        lines: [{ text: "Hello", color: "#FFFFFF", size: 60 }],
        style: cap.style,
        at: { x: 0.5, y: 0.2 },
        in: 0,
        out: 1,
        appear: "none",
      });
    },
    expect: ["CAPABILITY_MISSING package/overlays/1/kind"],
  },
  {
    name: "E3 a text node",
    start: w0,
    mutate: (c) => {
      const cap = c.pkg.overlays.find((o) => o.kind === "captions")!;
      if (cap.kind !== "captions") return;
      (c.pkg.scenes[0]!.screen ??= []).push({
        id: "label",
        nodes: [
          {
            kind: "text",
            id: "label",
            x: 540,
            y: 300,
            scale: 1,
            rotation: 0,
            opacity: 1,
            flip: false,
            text: "Hi",
            font: cap.style.font,
            size: 60,
            color: "#FFFFFF",
            align: "center",
            lineHeight: 1.2,
          },
        ],
      });
    },
    expect: ["CAPABILITY_MISSING package/scenes/0/screen/0/nodes/0/kind"],
  },
  {
    name: "E4 an ambient light",
    mutate: (c) => {
      c.pkg.scenes[0]!.lights.push({ kind: "ambient", id: "amb", color: "#FFFFFF" });
    },
    expect: ["CAPABILITY_MISSING package/scenes/0/lights/0/kind"],
  },
  {
    name: "E5 a rig of another format",
    mutate: (c) => {
      const r = c.manifest.assets.find((a) => a.kind === "rig")!;
      if (r.kind === "rig") r.format = "erkasa.rig.puppet/1";
    },
    expect: ["CAPABILITY_MISSING manifest/assets/6/format", "RIG_UNSUPPORTED manifest/assets/6/format"],
  },
  {
    name: "E6 a captions font of another family than its builtin",
    start: w0,
    mutate: (c) => {
      const f = c.manifest.assets.find((a) => a.kind === "font")!;
      if (f.kind === "font") f.family = "Arial";
    },
    expect: ["BUILTIN_MISMATCH manifest/assets/8/family"],
  },
  {
    name: "V2a a set scene's bounds one step inside its camera's view (left)",
    mutate: (c) => {
      const s = boundsScene.set(c.pkg, c.manifest);
      tight(c.pkg, c.manifest, s);
      s.bounds.x = nextUp(s.bounds.x);
    },
    expect: ["VALUE_RANGE package/scenes/1/bounds"],
  },
  {
    name: "V2b an editorial scene's bounds one step inside its camera's view (top)",
    mutate: (c) => {
      const s = boundsScene.editorial(c.pkg, c.manifest);
      tight(c.pkg, c.manifest, s);
      s.bounds.y = nextUp(s.bounds.y);
    },
    expect: ["VALUE_RANGE package/scenes/0/bounds"],
  },
  {
    name: "V2c a W0 scene's bounds one step inside its camera's view at the actors' plane (left)",
    start: w0,
    mutate: (c) => {
      const s = boundsScene.parallax(c.pkg);
      tight(c.pkg, c.manifest, s);
      s.bounds.x = nextUp(s.bounds.x);
    },
    expect: ["VALUE_RANGE package/scenes/0/bounds"],
  },
  {
    // F4 (decision B): s08 of W0 as the stager wrote it under the exact formula (before the decision); the engine
    // draws the scale 5-decimal and the centre 3-decimal, so its view reaches 0.0019 past the left side
    name: "V2d a W0 scene's bounds around the exact formula, not the view the engine draws",
    start: w0,
    mutate: (c) => {
      const s = c.pkg.scenes.find((x) => x.id === "s08_sh08")!;
      s.bounds = { x: -250, y: 0, w: 3150, h: 2300 };
    },
    expect: ["VALUE_RANGE package/scenes/7/bounds"],
  },
];

void si;
