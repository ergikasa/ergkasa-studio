/**
 * Stages a studio-v2 film (B1–B5): film plan + script → Render Package + Asset Manifest.
 *
 * Frames are those the engine renders: shot i covers `shotFrames(i)` frames from the end of shot i-1, frame n at
 * local time n / FPS. While shot i+1 fades or whips in, the engine still draws shot i at `dur_i + n / FPS`; those
 * frames are recorded into scene i too, with the times the engine uses, so every frame of the package reads the
 * value that frame showed.
 */
import type { AssetManifest, RenderPackage } from "@erkasa/contracts";
import {
  FPS,
  H,
  K,
  LIGHT,
  LIGHT_BG,
  PALETTE,
  PARAMS,
  SETS,
  TEMPLATES,
  TRANSITION_SEC,
  W,
  anchorTime,
  prepareV2,
  propAt,
  shotFrames,
  type ActorPerf,
  type ComposedShot,
  type FilmPlan,
  type Shot,
  type Timing,
} from "./legacy.js";
import { BONES, ManifestBuilder, RIG_CHANNELS, procedural, rig } from "./manifest.js";
import { SceneRecorder } from "./recorder.js";
import type { Script } from "@erkasa/contracts";

type Scene = RenderPackage["scenes"][number];
type Layer = Scene["layers"][number];
type ScreenLayer = NonNullable<Scene["screen"]>[number];
type AssetNode = Extract<Layer["nodes"][number], { kind: "asset" }>;
type Cut = RenderPackage["edit"][number];

export interface Staged {
  pkg: RenderPackage;
  manifest: AssetManifest;
}

/** One frame of a scene: its absolute index and the local time the engine draws the shot at. */
export interface SceneFrame {
  frame: number;
  t: number;
  /** A frame where the next shot is transitioning in over this one. */
  tail?: boolean;
}

const PLACE = { identity: { scale: 1, rotation: 0, opacity: 1, flip: false } } as const;
export const node = (
  id: string,
  asset: string,
  state: string,
  params?: Record<string, unknown>,
): AssetNode => ({
  kind: "asset",
  id,
  asset,
  x: 0,
  y: 0,
  ...PLACE.identity,
  state,
  pivot: null,
  ...(params ? { params: params as AssetNode["params"] } : {}),
});
const sceneId = (i: number, shot: Shot): string =>
  `s${String(i + 1).padStart(2, "0")}_${shot.id}`.replace(/[^A-Za-z0-9_-]/g, "_");

/**
 * The engine's camera transforms, read back from the frame it draws (the camera code is private to compose.ts).
 *
 * PRECISION: compose.ts writes the transform with fmt(), rounded to 0.01. What is recorded is therefore the camera
 * the frame was drawn with, not the camera compose.ts computed: x and y within 0.005 world px of it, and the scale
 * within 0.005, which in B1–B5 (scale 0.93–3.36) puts the height within 0.54 % (at most 11.1 world px). The
 * rebuilt frames are identical because the engine draws the rounded values too. The unrounded camera is NOT in
 * the package. E1.5 resolves it: the camera code moves into the stager, which records cx, cy, height unrounded,
 * and the renderer applies the same 0.01 formatting when it writes the transform, so golden stays unchanged.
 */
const NUM = "(-?[0-9.e+-]+)";
const STAGED_CAM = new RegExp(
  `^<g transform="translate\\(540 960\\) scale\\(${NUM}\\) translate\\(${NUM} ${NUM}\\)">`,
);
const EDITORIAL_CAM = new RegExp(
  `^<g transform="translate\\(540 ${NUM}\\) scale\\(${NUM}\\) translate\\(-540 -960\\)">`,
);

export function stagedCamera(body: string): { x: number; y: number; height: number } {
  const m = STAGED_CAM.exec(body);
  if (!m) throw new Error("staged frame without the camera transform");
  return { x: -Number(m[2]), y: -Number(m[3]), height: H / Number(m[1]) };
}
export function editorialCamera(body: string): { x: number; y: number; height: number } {
  const m = EDITORIAL_CAM.exec(body);
  if (!m) throw new Error("editorial frame without the camera transform");
  const z = Number(m[2]);
  const dy = Number(m[1]) - 960;
  // translate(540 960+dy) scale(z) translate(-540 -960) == a camera at (540, 960 - dy/z) seeing H/z
  return { x: 540, y: 960 - dy / z, height: H / z };
}

/** Scene frames of every shot: its own frames, then the frames where the next shot transitions in. */
export function sceneFrames(shots: ComposedShot[]): SceneFrame[][] {
  let g = 0;
  const starts = shots.map((s) => {
    const f = g;
    g += shotFrames(s);
    return f;
  });
  return shots.map((s, i) => {
    const out: SceneFrame[] = [];
    const n = shotFrames(s);
    for (let k = 0; k < n; k++) out.push({ frame: (starts[i] as number) + k, t: k / FPS });
    const next = shots[i + 1];
    if (next) {
      const tr = TRANSITION_SEC[next.shot.transition];
      for (let k = 0; k / FPS < tr; k++)
        out.push({ frame: (starts[i + 1] as number) + k, t: s.dur + k / FPS, tail: true });
    }
    return out;
  });
}

export function stageV2(name: string, plan: FilmPlan, script: Script): Staged {
  const { timing, composed } = prepareV2({ plan, script });
  const errors = composed.issues.filter((x) => x.level === "error");
  if (errors.length) throw new Error(`${name}: plan has errors: ${errors.map((e) => e.code).join(", ")}`);
  const M = new ManifestBuilder();
  const frames = sceneFrames(composed.shots);
  const scenes: Scene[] = [];
  const edit: Cut[] = [];
  composed.shots.forEach((s, i) => {
    const fr = frames[i] as SceneFrame[];
    const own = shotFrames(s);
    const first = fr[0] as SceneFrame;
    const id = sceneId(i, s.shot);
    scenes.push(
      s.shot.kind === "editorial" ? editorialScene(id, s, fr, timing, M) : stagedScene(id, s, fr, timing, M),
    );
    const tr = TRANSITION_SEC[s.shot.transition];
    edit.push({
      scene: id,
      start: first.frame / FPS,
      end: (first.frame + own) / FPS,
      enter: {
        kind:
          i === 0
            ? "cut"
            : s.shot.transition === "fade"
              ? "dissolve"
              : s.shot.transition === "whip"
                ? "whip"
                : "cut",
        duration: i === 0 ? 0 : tr,
      },
    });
  });
  const total = composed.shots.reduce((n, s) => n + shotFrames(s), 0);
  const manifest = M.build(`${name}.assets.1`);
  const pkg: RenderPackage = {
    schema: "erkasa.render/1",
    id: `${name}.v1`,
    producer: { name: "@erkasa/stager", version: "0.1.0" },
    output: { width: W, height: H, fps: FPS, duration: total / FPS },
    assetManifest: { uri: `${name}.assets.json`, sha256: "0".repeat(64) },
    scenes,
    edit,
    overlays: [],
    audio: [],
    // the loudness the v2 engine normalises to (render.ts loudnorm I=-14, TP=-1.5); audio is not staged in E1.2
    mix: { duckMusicDb: 0, loudness: { integratedLufs: -14, truePeakDb: -1.5 } },
  };
  return { pkg, manifest };
}

// ------------------------------------------------------------------------------------------ text (both kinds)

interface TextPlan {
  lines: unknown;
  place: "top" | "center" | "bottom";
  y: number;
  at: number;
  out: number | null;
}

function textPlan(s: ComposedShot, timing: Timing): TextPlan | undefined {
  const text = s.shot.text;
  if (!text) return undefined;
  const at = localAnchor(timing, s, text.at);
  if (at === undefined) return undefined;
  const out = text.out ? localAnchor(timing, s, text.out) : undefined;
  const y = text.place === "bottom" ? 1430 : text.place === "center" ? 860 : 250;
  return { lines: text.lines, place: text.place, y, at, out: out ?? null };
}

const localAnchor = (timing: Timing, s: ComposedShot, a: string): number | undefined => {
  const abs = anchorTime(timing, a as Shot["from"], s.start, s.shot.scene);
  return abs === undefined ? undefined : abs - s.start;
};

function typeLayer(
  s: ComposedShot,
  timing: Timing,
  M: ManifestBuilder,
  dark: boolean,
  scrim: boolean,
): ScreenLayer | undefined {
  const tp = textPlan(s, timing);
  if (!tp) return undefined;
  const nodes: AssetNode[] = [];
  if (scrim)
    nodes.push(
      node(
        "scrim",
        M.use(
          procedural(
            "overlay_scrim",
            "compose",
            { w: W, h: H },
            [["default", "overlay.scrim"]],
            [{ kind: "static", id: "place" }],
          ),
        ),
        "default",
        {
          place: tp.place,
        },
      ),
    );
  const typeAsset = M.use(
    procedural(
      "type_kinetic",
      "type",
      { w: W, h: H },
      [["default", "type.kinetic"]],
      [
        ...["lines", "y", "at", "out", "dark"].map((id) => ({ kind: "static" as const, id })),
        { kind: "channel", id: "t", range: [0, 3600] },
      ],
    ),
  );
  nodes.push(node("type", typeAsset, "default", { lines: tp.lines, y: tp.y, at: tp.at, out: tp.out, dark }));
  return { id: "type", nodes };
}

// ------------------------------------------------------------------------------------------ editorial

function editorialScene(
  id: string,
  s: ComposedShot,
  fr: SceneFrame[],
  timing: Timing,
  M: ManifestBuilder,
): Scene {
  const tpl = s.shot.template ?? "statement";
  if (!PARAMS[tpl].safeParse(s.shot.params).success) throw new Error(`${id}: template params are invalid`);
  const anchors: Record<string, number | null> = {};
  const at = (a: string): number | undefined => {
    const v = localAnchor(timing, s, a);
    anchors[a] = v ?? null;
    return v;
  };
  const rec = new SceneRecorder(FPS, (fr[0] as SceneFrame).frame);
  const cam = { kind: "camera" } as const;
  const tplNode = { kind: "node", id: "template" } as const;
  const tp = textPlan(s, timing);
  let bg: string | undefined;
  for (const f of fr) {
    rec.frame();
    const d = TEMPLATES[tpl]({ t: f.t, dur: s.dur, params: s.shot.params, at });
    if (bg === undefined) bg = d.bg;
    else if (bg !== d.bg) throw new Error(`${id}: the template changes its background colour over time`);
    const c = editorialCamera(s.draw(f.t).body);
    rec.set(cam, "x", c.x);
    rec.set(cam, "y", c.y);
    rec.set(cam, "height", c.height);
    rec.set(tplNode, "param.t", f.t);
    if (tp) rec.set({ kind: "node", id: "type" }, "param.t", f.t);
  }
  const asset = M.use(
    procedural(
      `tpl_${tpl}`,
      "templates",
      { w: W, h: H },
      [["default", `template.${tpl}`]],
      [
        { kind: "static", id: "params" },
        { kind: "static", id: "anchors" },
        { kind: "static", id: "dur" },
        { kind: "channel", id: "t", range: [0, 3600] },
      ],
    ),
  );
  const screen = typeLayer(s, timing, M, LIGHT_BG.has(tpl), false);
  return {
    id,
    bounds: { x: 0, y: 0, w: W, h: H },
    background: bg ?? PALETTE.night,
    camera: { projection: "flat", referenceDistance: H, dolly: 0, aperture: 0 },
    layers: [
      {
        id: "template",
        depth: 0,
        blur: 0,
        lit: false,
        nodes: [
          node("template", asset, "default", {
            params: s.shot.params,
            anchors: sortKeys(anchors),
            dur: s.dur,
          }),
        ],
      },
    ],
    ...(screen ? { screen: [screen] } : {}),
    actors: [],
    lights: [],
    tracks: rec.tracksOut(),
    contacts: [],
    events: rec.eventsOut(),
  };
}

const sortKeys = <T>(o: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

// ------------------------------------------------------------------------------------------ staged

function stagedScene(
  id: string,
  s: ComposedShot,
  fr: SceneFrame[],
  timing: Timing,
  M: ManifestBuilder,
): Scene {
  const perf = s.perf;
  if (!perf) throw new Error(`${id}: staged shot without a performance`);
  const set = SETS[s.shot.set ?? "office"];
  const shot = s.shot;
  const rec = new SceneRecorder(FPS, (fr[0] as SceneFrame).frame);
  const cam = { kind: "camera" } as const;

  // the light: as compose.ts keys it (a level, and a change of light at an anchor)
  const lightKeys: Array<[number, number]> = [[0, LIGHT[shot.light ?? "golden"]]];
  if (shot.lightTo) {
    const t1 = localAnchor(timing, s, shot.lightTo.at);
    if (t1 === undefined) throw new Error(`${id}: lightTo anchor does not resolve`);
    lightKeys.push([t1, LIGHT[shot.light ?? "golden"]], [t1 + 2.2, LIGHT[shot.lightTo.to]]);
  }
  const lightAt = (t: number): number =>
    K(
      t,
      lightKeys.map(([a, b]) => [a, b, "io"] as const),
    );

  const actors = [...perf.actors.values()];
  const props = [...perf.props.entries()];
  const tp = textPlan(s, timing);
  const ots = shot.framing === "ots";
  let order: string | undefined;
  for (const f of fr) {
    const t = f.t;
    rec.frame();
    const c = stagedCamera(s.draw(t).body);
    rec.set(cam, "x", c.x);
    rec.set(cam, "y", c.y);
    rec.set(cam, "height", c.height);
    const light = lightAt(t);
    for (const n of ["set_back", "set_front"]) {
      const target = { kind: "node", id: n } as const;
      rec.set(target, "param.light", light);
      rec.set(target, "param.t", s.start + t);
      rec.set(target, "param.door", perf.door.at(t));
    }
    const o = [...actors]
      .sort((a, b) => a.x.at(t) - b.x.at(t))
      .map((a) => a.id)
      .join(",");
    if (order === undefined) order = o;
    else if (o !== order)
      throw new Error(
        `${id}: people change drawing order at ${t.toFixed(2)} s (${order} → ${o}); E1.2 keeps one order per scene`,
      );
    for (const a of actors) recordActor(rec, a, t);
    for (const [pid, pr] of props) {
      let holder: string | null = null;
      for (const e of pr.events) if (e.t <= t) holder = e.holder;
      const p = propAt(pr, t, perf.actors);
      const rest = { kind: "node", id: `${pid}_rest` } as const;
      const held = { kind: "node", id: `${pid}_held` } as const;
      rec.set(rest, "x", p[0]);
      rec.set(rest, "y", p[1]);
      const facing = holder ? (perf.actors.get(holder)?.facingAt(t) ?? 1) : 1;
      rec.set(held, "x", p[0]);
      rec.set(held, "y", p[1] - 4);
      rec.set(held, "param.facing", facing);
      rec.set(held, "param.rot", pr.kind === "paper" ? -12 * facing : 0);
      rec.show(`${pid}_rest`, !holder);
      rec.show(`${pid}_held`, !!holder);
    }
    if (ots) rec.set({ kind: "node", id: "ots" }, "param.t", t);
    if (tp) rec.set({ kind: "node", id: "type" }, "param.t", t);
  }

  const setAsset = M.use(
    procedural(
      `set_${set.id}`,
      "sets",
      { w: set.w, h: set.h },
      [
        ["back", `set.${set.id}.back`],
        ["front", `set.${set.id}.front`],
      ],
      [
        { kind: "channel", id: "light", range: [0, 3] },
        { kind: "channel", id: "t", range: [0, 3600] },
        { kind: "channel", id: "door", range: [0, 1] },
      ],
    ),
  );
  const propAsset = (kind: string): string =>
    M.use(
      procedural(
        `prop_${kind}`,
        "props",
        { w: 120, h: 120 },
        [
          ["resting", `prop.${kind}.resting`],
          ["held", `prop.${kind}.held`],
        ],
        [
          { kind: "channel", id: "facing", range: [-1, 1] },
          { kind: "channel", id: "rot", range: [-360, 360] },
        ],
      ),
    );
  const restNodes = props.map(([pid, pr]) => node(`${pid}_rest`, propAsset(pr.kind), "resting"));
  const heldNodes = props.map(([pid, pr]) => node(`${pid}_held`, propAsset(pr.kind), "held"));
  const frontRest = set.id === "interview";
  const layer = (lid: string, nodes: AssetNode[]): Layer => ({
    id: lid,
    depth: 0,
    blur: 0,
    lit: false,
    nodes,
  });
  const ordered = (order ?? "").split(",").filter(Boolean);
  const layers: Layer[] = [
    layer("back", [node("set_back", setAsset, "back"), ...(frontRest ? [] : restNodes)]),
    ...ordered.map((a) => layer(`actor_${a}`, [])),
    layer("held", heldNodes),
    layer("front", [node("set_front", setAsset, "front"), ...(frontRest ? restNodes : [])]),
  ];

  const screen: ScreenLayer[] = [];
  if (ots) {
    const subjectId = shot.subject ?? shot.actors[0]?.id;
    const facing = (subjectId && perf.actors.get(subjectId)?.facingAt(0)) || 1;
    const otsAsset = M.use(
      procedural(
        "overlay_ots",
        "compose",
        { w: W, h: H },
        [["default", "overlay.ots"]],
        [
          { kind: "static", id: "facing" },
          { kind: "static", id: "dur" },
          { kind: "channel", id: "t", range: [0, 3600] },
        ],
      ),
    );
    screen.push({ id: "ots", nodes: [node("ots", otsAsset, "default", { facing, dur: s.dur })] });
  }
  const type = typeLayer(s, timing, M, false, true);
  if (type) screen.push(type);

  return {
    id,
    bounds: { x: 0, y: 0, w: set.w, h: set.h },
    background: PALETTE.night,
    camera: { projection: "flat", referenceDistance: H, dolly: 0, aperture: 0 },
    layers,
    ...(screen.length ? { screen } : {}),
    actors: ordered.map((aid) => {
      const a = perf.actors.get(aid) as ActorPerf;
      return {
        id: aid,
        rig: M.use(rig(a.look.build)),
        layer: `actor_${aid}`,
        appearance: {
          coat: a.look.coat,
          coatDark: a.look.coatDark,
          pants: a.look.pants,
          skin: a.look.skin,
          skinShade: a.look.skinShade,
          hair: a.look.hair,
        },
        shadow: false,
        rim: false,
      };
    }),
    lights: [],
    tracks: rec.tracksOut(),
    contacts: [],
    events: rec.eventsOut(),
  };
}

/** Every input drawPerson takes, as the actor's channels. */
export function recordActor(rec: SceneRecorder, a: ActorPerf, t: number): void {
  const target = { kind: "actor", id: a.id } as const;
  const pose = a.pose(t);
  const pl = a.placed(t);
  rec.set(target, "root.x", pl.x);
  rec.set(target, "root.y", pl.y);
  rec.set(target, "root.scale", pl.scale);
  rec.set(target, "facing", pl.facing);
  rec.set(target, "turn", pl.turn);
  for (const b of BONES) rec.set(target, `bone.${b}`, pose[b]);
  for (const c of RIG_CHANNELS)
    rec.set(target, `channel.${c}`, c === "glow" ? a.glow.at(t) : pose[c as keyof typeof pose]);
}
