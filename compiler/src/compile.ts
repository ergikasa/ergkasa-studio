import {
  VideoPlan,
  type AssetMeta,
  type Keyframe,
  type RenderTimeline,
  type ScenePlan,
  type VideoPlan as VideoPlanT,
} from "@erkasa/contracts";
import { ACTIONS_BY_SKELETON, TEXT_STYLES, parseAssetRef, type AssetSource } from "@erkasa/engine";
import { GENERIC_RECIPES, IDLE_MOTIONS, METAPHOR_RECIPES, type Tracks } from "./recipes.js";
import { estimateWords, findWord, type TimedWord } from "./words.js";

/**
 * The compiler turns intent ("Drini walks to the window when he says 'money'") into a frame-exact
 * Render Timeline. It never invents: an unknown asset, action, word or animation is an error with a
 * hint listing what IS available, so the Visual Planner can repair its plan (max 2 attempts) or the
 * scene is flagged for manual review.
 */

export interface Issue {
  level: "error" | "warning";
  code: string;
  path: string;
  message: string;
  hint?: string;
}

export interface SfxCue {
  sceneId: string;
  tag: string;
  atSec: number;
  gainDb: number;
}

export interface CompiledScene {
  sceneId: string;
  from: number;
  duration: number;
  /** Narration timing relative to the video start. */
  words: TimedWord[];
}

export interface CompileResult {
  timeline?: RenderTimeline;
  issues: Issue[];
  sfx: SfxCue[];
  scenes: CompiledScene[];
}

export interface CompileOptions {
  assets: AssetSource;
  /** Real word timings per scene (from the voice provider); otherwise estimated. */
  alignments?: Record<string, TimedWord[]>;
  seed?: number;
}

const FRAME_SIZES: Record<string, [number, number]> = {
  "9:16": [1080, 1920],
  "16:9": [1920, 1080],
  "1:1": [1080, 1080],
};
const PARTICLE_PRESETS = ["dust", "snow", "rain", "sparkle", "bokeh"];
const SIDE_ONLY_MOVES = new Set(["walk", "run"]);
/** Default duration (seconds) of a gesture when the plan gives none. */
const GESTURE_SEC: Record<string, number> = {
  wave: 1.8,
  point_side: 2.2,
  point_side_left: 2.2,
  point_forward: 2.2,
  think: 2.6,
  arms_up: 2.0,
  nod: 1.2,
  shake_head: 1.3,
  jump: 1.1,
  talk: 2.0,
  idle: 1.0,
};
const WALK_SPEED = 300; // world px per second at scale 1
const RUN_SPEED = 720;

type Layer = ScenePlan["layers"][number];
type Anchor = Layer extends never ? never : NonNullable<ScenePlan["sfx"]>[number]["at"];
type TimelineScene = RenderTimeline["scenes"][number];
type TimelineNode = TimelineScene["nodes"][number];

interface SceneContext {
  plan: ScenePlan;
  path: string;
  fps: number;
  width: number;
  height: number;
  words: TimedWord[];
  duration: number;
  world: { width: number; height: number; groundY: number };
  /** `layerId.event` -> scene-local frame where that event ends. */
  events: Map<string, number>;
  issues: Issue[];
}

export function compileVideo(planInput: unknown, opts: CompileOptions): CompileResult {
  const issues: Issue[] = [];
  const parsed = VideoPlan.safeParse(planInput);
  if (!parsed.success) {
    for (const i of parsed.error.issues)
      issues.push({ level: "error", code: "SCHEMA", path: i.path.join("."), message: i.message });
    return { issues, sfx: [], scenes: [] };
  }
  const plan: VideoPlanT = parsed.data;
  const [width, height] = FRAME_SIZES[plan.format] ?? [1080, 1920];
  const fps = plan.fps;

  const scenes: TimelineScene[] = [];
  const compiled: CompiledScene[] = [];
  const sfx: SfxCue[] = [];
  let from = 0;

  plan.scenes.forEach((scene, i) => {
    const path = `scenes[${i}]`;
    const prev = plan.scenes[i - 1];
    const transitionFrames = prev ? Math.round(prev.transitionOut.durationSec * fps) : 0;
    if (i > 0) from = Math.max(0, from - transitionFrames);

    const words = opts.alignments?.[scene.sceneId] ?? estimateWords(scene.narration);
    const narrationEnd = words.length ? (words[words.length - 1] as TimedWord).end : 0;
    const durationSec =
      scene.durationPolicy.mode === "fixed"
        ? (scene.durationPolicy.sec ?? 3)
        : narrationEnd + scene.durationPolicy.padAfterSec;
    const duration = Math.max(fps, Math.round(durationSec * fps));

    const bgMeta = asset(opts.assets, scene.background.assetId, `${path}.background.assetId`, issues, [
      "background",
    ]);
    if (!bgMeta) return;
    const vb = bgMeta.viewBox ?? [0, 0, 2560, 1920];
    const ctx: SceneContext = {
      plan: scene,
      path,
      fps,
      width,
      height,
      words,
      duration,
      world: { width: vb[2], height: vb[3], groundY: bgMeta.groundY ?? vb[3] * 0.88 },
      events: new Map(),
      issues,
    };

    const nodes: TimelineNode[] = [];
    scene.layers.forEach((layer, li) => {
      const node = compileLayer(ctx, layer, `${path}.layers[${li}]`, opts.assets);
      if (node) nodes.push(node);
    });
    scene.effects.forEach((e, ei) => {
      if (!PARTICLE_PRESETS.includes(e.preset)) {
        issues.push({
          level: "error",
          code: "EFFECT_UNKNOWN",
          path: `${path}.effects[${ei}].preset`,
          message: `unknown effect '${e.preset}'`,
          hint: `available: ${PARTICLE_PRESETS.join(", ")}`,
        });
        return;
      }
      nodes.push({
        id: `fx_${e.preset}_${ei}`,
        adapter: "particle",
        space: "screen",
        z: 50,
        props: { preset: e.preset, count: Math.round(10 + 50 * e.intensity), area: [0, 0, width, height] },
        tracks: {},
      });
    });

    const camera = compileCamera(ctx, nodes);
    checkFraming(ctx, nodes, camera);
    for (const [si, s] of scene.sfx.entries()) {
      const f = resolveAt(ctx, s.at, `${path}.sfx[${si}].at`);
      if (f !== undefined)
        sfx.push({ sceneId: scene.sceneId, tag: s.tag, atSec: (from + f) / fps, gainDb: s.gainDb });
    }

    const tl: TimelineScene = {
      sceneId: scene.sceneId,
      from,
      duration,
      background: { asset: `${bgMeta.assetId}@${bgMeta.version}` },
      nodes,
      camera,
      transitionIn: prev
        ? {
            type: prev.transitionOut.type,
            frames: transitionFrames,
            ...(prev.transitionOut.direction ? { direction: prev.transitionOut.direction } : {}),
          }
        : { type: "cut", frames: 0 },
    };
    scenes.push(tl);
    compiled.push({
      sceneId: scene.sceneId,
      from,
      duration,
      words: words.map((w) => ({ ...w, start: w.start + from / fps, end: w.end + from / fps })),
    });
    from += duration;
  });

  const errors = issues.filter((i) => i.level === "error");
  if (errors.length || scenes.length === 0) return { issues, sfx, scenes: compiled };

  const timeline: RenderTimeline = {
    schema: "erkasa.timeline/1",
    fps: 30,
    width,
    height,
    seed: opts.seed ?? 1,
    scenes,
    audio: { ref: `file://audio/${plan.projectId}/mix.wav` },
    captions: { style: "word_pop", wordsPerChunk: 3, words: compiled.flatMap((s) => s.words) },
  };
  return { timeline, issues, sfx, scenes: compiled };
}

// ------------------------------------------------------------------ assets
function asset(
  source: AssetSource,
  id: string,
  path: string,
  issues: Issue[],
  categories: string[],
): AssetMeta | undefined {
  let meta: AssetMeta;
  try {
    meta = source.meta(parseAssetRef(id).id);
  } catch {
    issues.push({
      level: "error",
      code: "ASSET_NOT_FOUND",
      path,
      message: `asset '${id}' does not exist in the library`,
    });
    return undefined;
  }
  if (!categories.includes(meta.category)) {
    issues.push({
      level: "error",
      code: "ASSET_WRONG_CATEGORY",
      path,
      message: `asset '${id}' is a ${meta.category}, expected ${categories.join(" or ")}`,
    });
    return undefined;
  }
  return meta;
}

// ------------------------------------------------------------------ time
function resolveAt(ctx: SceneContext, at: Anchor | undefined, path: string): number | undefined {
  if (at === undefined || at === "start") return 0;
  if (typeof at === "object" && "sec" in at) return clampFrame(ctx, at.sec * ctx.fps);
  if (typeof at === "object" && "word" in at) {
    const w = findWord(ctx.words, at.word, at.occurrence);
    if (!w) {
      ctx.issues.push({
        level: "error",
        code: "WORD_NOT_IN_NARRATION",
        path,
        message: `'${at.word}' is not in the narration`,
        hint: ctx.plan.narration,
      });
      return undefined;
    }
    return clampFrame(ctx, w.start * ctx.fps);
  }
  if (typeof at === "object" && "after" in at) {
    const end = ctx.events.get(at.after);
    if (end === undefined) {
      ctx.issues.push({
        level: "error",
        code: "EVENT_UNKNOWN",
        path,
        message: `'${at.after}' has not happened yet in this scene`,
        hint: `known events: ${[...ctx.events.keys()].join(", ") || "none"}`,
      });
      return undefined;
    }
    return clampFrame(ctx, end + at.offsetSec * ctx.fps);
  }
  return 0;
}

const clampFrame = (ctx: SceneContext, f: number): number =>
  Math.max(0, Math.min(ctx.duration - 1, Math.round(f)));

// ------------------------------------------------------------------ placement
/** Normalized frame coordinates -> world pixels, for the camera's starting view. */
function toWorld(ctx: SceneContext, x: number, y: number): [number, number] {
  const cover = Math.max(ctx.width / ctx.world.width, ctx.height / ctx.world.height);
  const left = ctx.world.width / 2 - ctx.width / (2 * cover);
  const top = ctx.world.height / 2 - ctx.height / (2 * cover);
  return [left + (x * ctx.width) / cover, top + (y * ctx.height) / cover];
}

const REGION_Y: Record<string, number> = { "top-safe": 0.17, center: 0.42, "bottom-safe": 0.56 };

// ------------------------------------------------------------------ layers
function compileLayer(
  ctx: SceneContext,
  layer: Layer,
  path: string,
  assets: AssetSource,
): TimelineNode | undefined {
  switch (layer.type) {
    case "actor":
      return compileActor(ctx, layer, path, assets);
    case "object":
    case "icon":
    case "metaphor":
      return compileAssetLayer(ctx, layer, path, assets);
    case "text":
      return compileText(ctx, layer, path);
    case "chart":
      return compileChart(ctx, layer, path);
  }
}

function entrance(
  ctx: SceneContext,
  layer: Layer,
  path: string,
  tracks: Tracks,
  base: { x: number; y: number; scale: number },
): void {
  const add = (name: string, kfs: Keyframe[]): void => {
    tracks[name] = [...(tracks[name] ?? []), ...kfs];
  };
  for (const [which, spec] of [
    ["in", layer.in],
    ["out", layer.out],
  ] as const) {
    if (!spec || spec.effect === "none") continue;
    const s = resolveAt(ctx, spec.at, `${path}.${which}.at`);
    if (s === undefined) continue;
    const d = Math.max(1, Math.round(spec.durationSec * ctx.fps));
    const e = spec.ease;
    const enter = which === "in";
    const [a, b] = enter ? [0, 1] : [1, 0];
    switch (spec.effect) {
      case "fade":
        add("opacity", [
          { f: s, v: a },
          { f: s + d, v: b, ease: e },
        ]);
        break;
      case "pop":
      case "grow":
      case "draw_on":
        if (enter && spec.effect === "pop")
          add("scale", [
            { f: s, v: 0 },
            { f: s + Math.round(d * 0.65), v: base.scale * 1.12, ease: "easeOutCubic" },
            { f: s + d, v: base.scale, ease: "easeInOut" },
          ]);
        else
          add("scale", [
            { f: s, v: enter ? 0 : base.scale },
            { f: s + d, v: enter ? base.scale : 0, ease: e },
          ]);
        break;
      case "slide_left":
      case "slide_right": {
        const off = (spec.effect === "slide_left" ? 1 : -1) * ctx.width * 0.8;
        add(
          "x",
          enter
            ? [
                { f: s, v: base.x + off },
                { f: s + d, v: base.x, ease: e },
              ]
            : [
                { f: s, v: base.x },
                { f: s + d, v: base.x - off, ease: e },
              ],
        );
        break;
      }
      case "slide_up":
        add(
          "y",
          enter
            ? [
                { f: s, v: base.y + ctx.height * 0.4 },
                { f: s + d, v: base.y, ease: e },
              ]
            : [
                { f: s, v: base.y },
                { f: s + d, v: base.y - ctx.height * 0.4, ease: e },
              ],
        );
        break;
    }
    if (enter) ctx.events.set(`${layer.id}.${spec.effect}`, s + d);
  }
}

function finalize(tracks: Tracks): Tracks {
  const out: Tracks = {};
  for (const [k, kfs] of Object.entries(tracks)) {
    const byFrame = new Map<number, Keyframe>();
    for (const kf of [...kfs].sort((p, q) => p.f - q.f)) byFrame.set(kf.f, kf);
    out[k] = [...byFrame.values()];
  }
  return out;
}

// --- actors -----------------------------------------------------------------------------------
function compileActor(
  ctx: SceneContext,
  layer: Extract<Layer, { type: "actor" }>,
  path: string,
  assets: AssetSource,
): TimelineNode | undefined {
  const meta = asset(assets, layer.assetId, `${path}.assetId`, ctx.issues, ["character"]);
  if (!meta) return undefined;
  const caps = meta.capabilities["actions"] as { front?: string[]; side?: string[] } | undefined;
  const front = new Set((caps?.front ?? []).filter((a) => ACTIONS_BY_SKELETON["erkasa_biped_front_v1"]?.[a]));
  const side = new Set((caps?.side ?? []).filter((a) => ACTIONS_BY_SKELETON["erkasa_biped_side_v1"]?.[a]));
  const hasSide = Boolean(meta.files["rig_side"]);

  const scale = (meta.sizing?.heightRatio ?? 0.42) * (ctx.height / 880) * layer.place.scale;
  const [wx, wyFree] = toWorld(ctx, layer.place.x, layer.place.y ?? 0.88);
  const y = layer.place.anchor === "ground" ? ctx.world.groundY : wyFree;
  const startFacing = layer.facing;

  // per-frame plan: [clip, facing]; actions override the base behaviour
  const n = ctx.duration;
  const firstWord = ctx.words[0]?.start ?? 0;
  const lastWord = ctx.words[ctx.words.length - 1]?.end ?? 0;
  const baseClip = (f: number): string => {
    const t = f / ctx.fps;
    return layer.speaks && t >= firstWord - 0.15 && t <= lastWord + 0.1 ? "talk" : "idle";
  };
  const clip: string[] = Array.from({ length: n }, (_, f) => baseClip(f));
  const facing: string[] = Array.from({ length: n }, () => startFacing);
  const xTrack: Keyframe[] = [{ f: 0, v: round(wx) }];
  let x = wx;
  let restFacing = startFacing;

  const timed = layer.actions
    .map((a, i) => ({ a, i, f: resolveAt(ctx, a.at, `${path}.actions[${i}].at`) }))
    .filter((t): t is { a: (typeof layer.actions)[number]; i: number; f: number } => t.f !== undefined)
    .sort((p, q) => p.f - q.f);

  timed.forEach(({ a, i, f }, k) => {
    const apath = `${path}.actions[${i}]`;
    const next = timed[k + 1]?.f ?? n;
    if (!front.has(a.action) && !side.has(a.action)) {
      ctx.issues.push({
        level: "error",
        code: "ACTION_UNSUPPORTED",
        path: `${apath}.action`,
        message: `${meta.assetId} cannot '${a.action}'`,
        hint: `supports: ${[...new Set([...front, ...side])].join(", ")}`,
      });
      return;
    }
    if (SIDE_ONLY_MOVES.has(a.action) && a.to) {
      if (!hasSide) return;
      const [tx] = toWorld(ctx, a.to.x, 0);
      const dir = tx >= x ? "right" : "left";
      const speed = (a.action === "run" ? RUN_SPEED : WALK_SPEED) * scale;
      const travel = Math.max(1, Math.round((Math.abs(tx - x) / speed) * ctx.fps));
      const end = Math.min(n, f + travel);
      for (let t = f; t < end; t++) {
        clip[t] = a.action;
        facing[t] = dir;
      }
      xTrack.push({ f, v: round(x) }, { f: end, v: round(tx) });
      x = tx;
      ctx.events.set(`${layer.id}.${a.action}`, end);
      for (let t = end; t < n; t++) facing[t] = restFacing === "front" ? "front" : dir;
      if (restFacing !== "front") restFacing = dir;
      return;
    }
    // gestures: pick a view that has the action, preferring the current one
    const cur = facing[f] ?? startFacing;
    const curIsFront = cur === "front";
    let view: string = cur;
    if (curIsFront && !front.has(a.action)) view = hasSide ? "right" : "front";
    if (!curIsFront && !side.has(a.action)) view = "front";
    const dur =
      a.durationSec !== undefined
        ? Math.round(a.durationSec * ctx.fps)
        : Math.min(next - f, Math.round((GESTURE_SEC[a.action] ?? 2) * ctx.fps));
    const end = Math.min(n, f + Math.max(1, dur));
    for (let t = f; t < end; t++) {
      clip[t] = a.action;
      facing[t] = view;
    }
    ctx.events.set(`${layer.id}.${a.action}`, end);
  });

  // compress per-frame plan into keyframes; blend within a view, cut on a turn
  const clipK: Keyframe[] = [];
  const faceK: Keyframe[] = [];
  for (let f = 0; f < n; f++) {
    const c = clip[f] as string;
    const fc = facing[f] as string;
    const pc = f > 0 ? clip[f - 1] : undefined;
    const pf = f > 0 ? facing[f - 1] : undefined;
    if (f === 0 || c !== pc || fc !== pf) {
      clipK.push(fc === pf && f > 0 ? { f, v: c, blend: 8 } : { f, v: c });
    }
    if (f === 0 || fc !== pf) faceK.push({ f, v: fc });
  }

  const tracks: Tracks = {
    x: xTrack,
    y: [{ f: 0, v: round(y) }],
    scale: [{ f: 0, v: round(scale) }],
    clip: clipK,
    facing: faceK,
    expression: [{ f: 0, v: layer.expression }],
  };
  entrance(ctx, layer, path, tracks, { x: wx, y, scale });
  return {
    id: layer.id,
    adapter: "character",
    asset: `${meta.assetId}@${meta.version}`,
    z: layer.zIndex ?? 10,
    space: "world",
    props: { speaks: layer.speaks },
    tracks: finalize(tracks),
  };
}

// --- objects, icons, metaphors ------------------------------------------------------------------
const DEFAULT_SIZE: Record<string, number> = { object: 0.3, icon: 0.16, metaphor: 0.85 };

function compileAssetLayer(
  ctx: SceneContext,
  layer: Extract<Layer, { type: "object" | "icon" | "metaphor" }>,
  path: string,
  assets: AssetSource,
): TimelineNode | undefined {
  const meta = asset(assets, layer.assetId, `${path}.assetId`, ctx.issues, [layer.type]);
  if (!meta) return undefined;
  const cover = Math.max(ctx.width / ctx.world.width, ctx.height / ctx.world.height);
  const [x, y] = toWorld(
    ctx,
    layer.place.x,
    layer.place.y ?? REGION_Y[layer.place.region ?? "center"] ?? 0.42,
  );
  const size = ((DEFAULT_SIZE[layer.type] ?? 0.3) * ctx.width * layer.place.scale) / cover;
  const tracks: Tracks = {
    x: [{ f: 0, v: round(x) }],
    y: [{ f: 0, v: round(y) }],
    size: [{ f: 0, v: round(size) }],
  };
  const props: Record<string, unknown> = {};
  if (layer.type === "metaphor") props["backdrop"] = false;

  entrance(ctx, layer, path, tracks, { x, y, scale: 1 });
  const metaphor = METAPHOR_RECIPES[meta.assetId] ?? {};
  layer.animations.forEach((anim, ai) => {
    const apath = `${path}.animations[${ai}]`;
    const s = resolveAt(ctx, anim.at, `${apath}.at`);
    if (s === undefined) return;
    if ((IDLE_MOTIONS as readonly string[]).includes(anim.name)) {
      props["idle"] = anim.name;
      return;
    }
    const recipe = metaphor[anim.name] ?? GENERIC_RECIPES[anim.name];
    if (!recipe) {
      ctx.issues.push({
        level: "error",
        code: "ANIMATION_UNSUPPORTED",
        path: `${apath}.name`,
        message: `${meta.assetId} has no animation '${anim.name}'`,
        hint: `available: ${[...Object.keys(metaphor), ...Object.keys(GENERIC_RECIPES), ...IDLE_MOTIONS].join(", ")}`,
      });
      return;
    }
    const { tracks: rt, duration } = recipe(s, ctx.duration - 1, ctx.fps);
    for (const [name, kfs] of Object.entries(rt)) {
      if (name === "bounce")
        tracks["y"] = [...(tracks["y"] ?? []), ...kfs.map((k) => ({ ...k, v: round(y + Number(k.v)) }))];
      else if (name === "wiggle") tracks["rotation"] = [...(tracks["rotation"] ?? []), ...kfs];
      else if (name === "pulse") tracks["scale"] = [...(tracks["scale"] ?? []), ...kfs];
      else tracks[name] = [...(tracks[name] ?? []), ...kfs];
    }
    ctx.events.set(`${layer.id}.${anim.name}`, s + duration);
  });
  if (layer.type === "icon") props["color"] = "#2A1E18";
  return {
    id: layer.id,
    adapter: "svg",
    asset: `${meta.assetId}@${meta.version}`,
    z: layer.zIndex ?? (layer.type === "metaphor" ? 5 : 12),
    space: "world",
    props,
    tracks: finalize(tracks),
  };
}

// --- charts ----------------------------------------------------------------------------------
function compileChart(
  ctx: SceneContext,
  layer: Extract<Layer, { type: "chart" }>,
  path: string,
): TimelineNode | undefined {
  if (layer.chart === "linear_vs_exponential" && layer.data.length > 2) {
    ctx.issues.push({
      level: "warning",
      code: "CHART_DATA_IGNORED",
      path: `${path}.data`,
      message: "linear_vs_exponential uses only the first two labels",
    });
  }
  const x = layer.place.x * ctx.width;
  const y = (layer.place.y ?? REGION_Y[layer.place.region ?? "center"] ?? 0.42) * ctx.height;
  const size = ctx.width * 0.84 * layer.place.scale;
  const tracks: Tracks = {
    x: [{ f: 0, v: round(x) }],
    y: [{ f: 0, v: round(y) }],
    size: [{ f: 0, v: round(size) }],
  };
  // `draw_on` (or no entrance) = the chart builds itself; any other entrance plays first, then the chart builds
  const spec = layer.in ?? {
    effect: "draw_on" as const,
    at: "start" as const,
    durationSec: 1.4,
    ease: "easeInOut" as const,
  };
  const s = resolveAt(ctx, spec.at, `${path}.in.at`) ?? 0;
  if (spec.effect === "draw_on" || spec.effect === "none") {
    const d = Math.round(Math.max(1, spec.durationSec) * ctx.fps);
    tracks["progress"] = [
      { f: 0, v: 0 },
      { f: s, v: 0 },
      { f: s + d, v: 1, ease: "linear" },
    ];
    tracks["opacity"] = [
      { f: s, v: 0 },
      { f: s + 6, v: 1 },
    ];
    ctx.events.set(`${layer.id}.draw_on`, s + d);
  } else {
    entrance(ctx, layer, path, tracks, { x, y, scale: 1 });
    const d = Math.round(spec.durationSec * ctx.fps);
    tracks["progress"] = [
      { f: 0, v: 0 },
      { f: s + d, v: 0 },
      { f: s + d + 42, v: 1, ease: "linear" },
    ];
  }
  return {
    id: layer.id,
    adapter: "motion_graphics",
    z: layer.zIndex ?? 30,
    space: "screen",
    props: { chart: layer.chart, data: layer.data, ...(layer.unit ? { unit: layer.unit } : {}) },
    tracks: finalize(tracks),
  };
}

// --- text ----------------------------------------------------------------------------------------
function compileText(
  ctx: SceneContext,
  layer: Extract<Layer, { type: "text" }>,
  path: string,
): TimelineNode | undefined {
  if (!TEXT_STYLES[layer.style]) {
    ctx.issues.push({
      level: "error",
      code: "TEXT_STYLE_UNKNOWN",
      path: `${path}.style`,
      message: `unknown text style '${layer.style}'`,
      hint: `available: ${Object.keys(TEXT_STYLES)
        .filter((s) => !s.startsWith("caption"))
        .join(", ")}`,
    });
    return undefined;
  }
  const x = layer.place.x * ctx.width;
  const y = (layer.place.y ?? REGION_Y[layer.place.region ?? "top-safe"] ?? 0.17) * ctx.height;
  const tracks: Tracks = { x: [{ f: 0, v: round(x) }], y: [{ f: 0, v: round(y) }] };
  const withIn = layer.in
    ? layer
    : {
        ...layer,
        in: { effect: "pop" as const, at: "start" as const, durationSec: 0.4, ease: "easeOutCubic" as const },
      };
  entrance(ctx, withIn, path, tracks, { x, y, scale: layer.place.scale });
  return {
    id: layer.id,
    adapter: "text",
    z: layer.zIndex ?? 40,
    space: "screen",
    props: {
      content: layer.content,
      style: layer.style,
      highlight: layer.highlight,
      maxWidth: Math.round(ctx.width * 0.9),
    },
    tracks: finalize(tracks),
  };
}

// --- camera --------------------------------------------------------------------------------------
function compileCamera(ctx: SceneContext, nodes: TimelineNode[]): Tracks {
  const cx = ctx.world.width / 2;
  const cy = ctx.world.height / 2;
  const t: Tracks = { x: [{ f: 0, v: cx }], y: [{ f: 0, v: cy }], zoom: [{ f: 0, v: 1 }] };
  let zoom = 1;
  let x = cx;
  const last = ctx.duration - 1;
  ctx.plan.camera.forEach((m, i) => {
    const s = resolveAt(ctx, m.at, `${ctx.path}.camera[${i}].at`);
    if (s === undefined) return;
    const d = m.durationSec !== undefined ? Math.round(m.durationSec * ctx.fps) : last - s;
    const e = Math.min(last, s + Math.max(1, d));
    const push = (name: string, kfs: Keyframe[]): void => {
      t[name] = [...(t[name] ?? []), ...kfs];
    };
    switch (m.move) {
      case "push_in":
      case "pull_out": {
        const to = m.to ?? (m.move === "push_in" ? 1.12 : 0.95);
        push("zoom", [
          { f: s, v: zoom },
          { f: e, v: to, ease: m.ease },
        ]);
        zoom = to;
        break;
      }
      case "punch_in": {
        const to = m.to ?? zoom + 0.12;
        push("zoom", [
          { f: s, v: zoom },
          { f: s + 6, v: to, ease: "easeOutCubic" },
          { f: s + 22, v: zoom + (to - zoom) * 0.5, ease: "easeInOutCubic" },
        ]);
        push("shake", [
          { f: s, v: 0 },
          { f: s + 2, v: 8 },
          { f: s + 14, v: 0, ease: "easeOutCubic" },
        ]);
        zoom = zoom + (to - zoom) * 0.5;
        break;
      }
      case "pan_left":
      case "pan_right": {
        const to = x + (m.move === "pan_right" ? 1 : -1) * (m.to ?? 1) * 320;
        push("x", [
          { f: s, v: x },
          { f: e, v: round(to), ease: m.ease },
        ]);
        x = to;
        break;
      }
      case "shake":
        push("shake", [
          { f: s, v: 0 },
          { f: s + 2, v: m.to ?? 10 },
          { f: Math.min(last, s + Math.round(0.45 * ctx.fps)), v: 0, ease: "easeOutCubic" },
        ]);
        break;
      case "follow": {
        const target = nodes.find((nd) => nd.id === m.target);
        if (!target) {
          ctx.issues.push({
            level: "error",
            code: "CAMERA_TARGET_UNKNOWN",
            path: `${ctx.path}.camera[${i}].target`,
            message: `no layer '${m.target ?? ""}' to follow`,
          });
          return;
        }
        for (const k of target.tracks["x"] ?? [])
          if (k.f >= s && k.f <= e)
            push("x", [{ f: k.f, v: round(cx + (Number(k.v) - cx) * 0.7), ease: "easeInOutCubic" }]);
        break;
      }
      case "static":
        break;
    }
  });
  return finalize(t);
}

/**
 * Compositional check: warns when a world element sits outside the visible frame at the start, at
 * the end, or at any of its own keyframes. Warnings do not block rendering; the planner sees them.
 */
function checkFraming(ctx: SceneContext, nodes: TimelineNode[], camera: Tracks): void {
  const cover = Math.max(ctx.width / ctx.world.width, ctx.height / ctx.world.height);
  const camAt = (f: number): { x: number; zoom: number } => ({
    x: sample(camera["x"], f, ctx.world.width / 2),
    zoom: sample(camera["zoom"], f, 1),
  });
  for (const node of nodes) {
    if (node.space !== "world") continue;
    const frames = new Set<number>([0, ctx.duration - 1]);
    for (const k of node.tracks["x"] ?? []) frames.add(Math.min(ctx.duration - 1, k.f));
    for (const f of [...frames].sort((a, b) => a - b)) {
      // a walk-in from off-screen is intentional: only judge from the moment the node has arrived
      const xs = node.tracks["x"] ?? [];
      const lastMove = xs.length ? (xs[xs.length - 1] as Keyframe).f : 0;
      if (f < lastMove) continue;
      const cam = camAt(f);
      const sx = ctx.width / 2 + (sample(node.tracks["x"], f, 0) - cam.x) * cover * cam.zoom;
      // half of the visible width: svg assets know their size; characters are ~130 px wide at scale 1
      const half =
        (node.adapter === "svg"
          ? sample(node.tracks["size"], f, 0) / 2
          : 65 * sample(node.tracks["scale"], f, 1)) *
        cover *
        cam.zoom;
      if (
        sx - half < -ctx.width * 0.02 ||
        sx + half > ctx.width * 1.02 ||
        sx < ctx.width * 0.06 ||
        sx > ctx.width * 0.94
      ) {
        ctx.issues.push({
          level: "warning",
          code: "OUT_OF_FRAME",
          path: `${ctx.path}.layers.${node.id}`,
          message: `'${node.id}' is ${sx < 0 || sx > ctx.width ? "outside" : "cut by the edge of"} the frame at ${(f / ctx.fps).toFixed(1)} s (x=${Math.round((sx / ctx.width) * 100)}% of width)`,
          hint: "move it toward the center or reduce the camera pan/zoom",
        });
        break;
      }
    }
  }
}

function sample(kfs: Keyframe[] | undefined, f: number, fallback: number): number {
  if (!kfs?.length) return fallback;
  let prev = kfs[0] as Keyframe;
  if (f <= prev.f) return Number(prev.v);
  for (const k of kfs) {
    if (k.f >= f) {
      const t = k.f === prev.f ? 1 : (f - prev.f) / (k.f - prev.f);
      return Number(prev.v) + (Number(k.v) - Number(prev.v)) * t;
    }
    prev = k;
  }
  return Number(prev.v);
}

const round = (n: number): number => Math.round(n * 100) / 100;
