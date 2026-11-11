import {
  RenderTimeline as RenderTimelineSchema,
  VideoPlan,
  type AssetMeta,
  type Keyframe,
  type RenderTimeline,
  type ScenePlan,
  type VideoPlan as VideoPlanT,
} from "@erkasa/contracts";
import {
  ACTIONS_BY_SKELETON,
  TEXT_STYLES,
  parseAssetRef,
  sampleNumber,
  type AssetSource,
} from "@erkasa/engine";
import { GENERIC_RECIPES, IDLE_MOTIONS, METAPHOR_RECIPES, type Tracks } from "./recipes.js";
import { estimateWords, findWord, type TimedWord } from "./words.js";
import { headPoint, stageActors, type StageResult, type StagedActor } from "./blocking.js";
import { SETS, type StageSet } from "./sets.js";
import { FLOOR, SCALE } from "./staging.js";

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
export const PARTICLE_PRESETS = ["dust", "snow", "rain", "sparkle", "bokeh"];
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
  /** The scene's framing (from `shot`): world point at the frame center and zoom. Layers are placed in it. */
  view: { cx: number; cy: number; zoom: number; subject?: string; size?: string };
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
      view: { cx: vb[2] / 2, cy: vb[3] / 2, zoom: 1 },
      events: new Map(),
      issues,
    };
    const nodes: TimelineNode[] = [];
    const set = scene.set ? SETS[scene.set.id] : undefined;
    if (scene.set && !set)
      issues.push({
        level: "error",
        code: "SET_UNKNOWN",
        path: `${path}.set.id`,
        message: `no set '${scene.set.id}'`,
        hint: `sets: ${Object.keys(SETS).join(", ")}`,
      });
    if (set && set.background !== bgMeta.assetId)
      issues.push({
        level: "error",
        code: "SET_BACKGROUND_MISMATCH",
        path: `${path}.background.assetId`,
        message: `set '${set.id}' is built on ${set.background}`,
        hint: `use background ${set.background}`,
      });
    let staged: StageResult | undefined;
    if (set) {
      staged = stageScene(ctx, set, opts.assets);
      nodes.push(...set.furniture(staged.doorOpen), ...staged.nodes);
      ctx.view = stagedView(ctx, staged);
    } else ctx.view = frameShot(ctx, opts.assets);

    scene.layers.forEach((layer, li) => {
      const lpath = `${path}.layers[${li}]`;
      if (layer.type === "actor" && layer.blocking.length) {
        if (!set)
          issues.push({
            level: "error",
            code: "BLOCKING_WITHOUT_SET",
            path: `${lpath}.blocking`,
            message: "blocking needs a staged set (scene.set)",
            hint: `sets: ${Object.keys(SETS).join(", ")}`,
          });
        return; // staged above
      }
      const node = compileLayer(ctx, layer, lpath, opts.assets);
      if (!node) return;
      if (layer.type !== "actor" && layer.type !== "text" && layer.type !== "chart" && layer.attach)
        attachToActor(ctx, node, layer.attach, nodes, staged, lpath);
      nodes.push(node);
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

    let camera = compileCamera(ctx, nodes);
    if (staged) camera = followSubject(ctx, camera, nodes);
    // anything timed near the end (an entrance on the last word, a long gesture, a chart drawing on)
    // may run past the scene: it is cut at the last frame, so the scene never grows by surprise
    const lastFrame = duration;
    for (const node of nodes) {
      const cut = cutAtEnd(node.tracks, lastFrame);
      node.tracks = cut.tracks;
      if (cut.cut)
        issues.push({
          level: "warning",
          code: "CUT_AT_SCENE_END",
          path,
          message: `'${node.id}' is still animating when the scene ends; cut at the last frame`,
          hint: "start it on an earlier word or make it shorter",
        });
    }
    camera = cutAtEnd(camera, lastFrame).tracks;
    checkFraming(ctx, nodes, camera);
    const captionY = chooseCaptionY(ctx, nodes);
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
      captionY,
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
    schema: "erkasa.timeline/1" as const,
    fps: 30,
    width,
    height,
    seed: opts.seed ?? 1,
    scenes,
    audio: { ref: `file://audio/${plan.projectId}/mix.wav` },
    captions: { style: "word_pop", wordsPerChunk: 3, words: compiled.flatMap((s) => s.words) },
  };
  // last line of defence: the compiler never hands the renderer a timeline that breaks the contract
  const checked = RenderTimelineSchema.safeParse(timeline);
  if (!checked.success) {
    for (const i of checked.error.issues)
      issues.push({
        level: "error",
        code: "TIMELINE_INVALID",
        path: i.path.join("."),
        message: `compiler produced an invalid timeline: ${i.message}`,
      });
    return { issues, sfx, scenes: compiled };
  }
  return { timeline, issues, sfx, scenes: compiled };
}

/**
 * Cuts every track at `end`: numeric tracks get a final keyframe holding the value they have at that
 * frame (the motion stops where it is), discrete tracks drop the switches that would come later.
 * `cut` tells whether anything was cut.
 */
export function cutAtEnd(
  tracks: Record<string, Keyframe[]>,
  end: number,
): { tracks: Record<string, Keyframe[]>; cut: boolean } {
  let cut = false;
  const out: Record<string, Keyframe[]> = {};
  for (const [name, kfs] of Object.entries(tracks)) {
    if (!kfs.some((k) => k.f > end)) {
      out[name] = kfs;
      continue;
    }
    cut = true;
    const kept = kfs.filter((k) => k.f <= end);
    const next = kfs.find((k) => k.f > end) as Keyframe;
    if (typeof next.v === "number") {
      const v = Math.round(sampleNumber(kfs, end, next.v) * 1000) / 1000;
      if (kept[kept.length - 1]?.f !== end)
        kept.push({ f: end, v, ...(next.ease ? { ease: next.ease } : {}) });
      out[name] = kept;
    } else if (kept.length) out[name] = kept;
  }
  return { tracks: out, cut };
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
    return clampFrame(ctx, (w.start + (at.offsetSec ?? 0)) * ctx.fps);
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
/** Normalized frame coordinates -> world pixels, in the scene's framed view (see `shot`). */
function toWorld(ctx: SceneContext, x: number, y: number, view = ctx.view): [number, number] {
  const cover = Math.max(ctx.width / ctx.world.width, ctx.height / ctx.world.height);
  const vw = ctx.width / (cover * view.zoom);
  const vh = ctx.height / (cover * view.zoom);
  return [view.cx - vw / 2 + x * vw, view.cy - vh / 2 + y * vh];
}

/** World pixels -> normalized frame coordinates in the framed view. */
function toFrame(ctx: SceneContext, wx: number, wy: number): [number, number] {
  const cover = Math.max(ctx.width / ctx.world.width, ctx.height / ctx.world.height);
  const vw = ctx.width / (cover * ctx.view.zoom);
  const vh = ctx.height / (cover * ctx.view.zoom);
  return [(wx - (ctx.view.cx - vw / 2)) / vw, (wy - (ctx.view.cy - vh / 2)) / vh];
}

/** Character height in world pixels at a given place scale. */
const CHARACTER_FRAME_RATIO = 0.42;
const actorHeight = (ctx: SceneContext, meta: AssetMeta | undefined, placeScale: number): number =>
  (meta?.sizing?.heightRatio ?? CHARACTER_FRAME_RATIO) * ctx.height * placeScale;

/**
 * The scene's framing. wide = the whole place (zoom 1). medium/close frame the subject actor (head near
 * the top, as a camera operator would); insert frames an object, metaphor or chart. The subject keeps its
 * position on screen (its place.x), the camera moves around it, and the view never leaves the background.
 */
function frameShot(ctx: SceneContext, assets: AssetSource): SceneContext["view"] {
  const wide = { cx: ctx.world.width / 2, cy: ctx.world.height / 2, zoom: 1 };
  const shot = ctx.plan.shot;
  if (!shot || shot.size === "wide") return wide;
  const layers = ctx.plan.layers;
  const subject =
    (shot.subject ? layers.find((l) => l.id === shot.subject) : undefined) ??
    (shot.size === "insert"
      ? layers.find((l) => l.type !== "actor" && l.type !== "text")
      : (layers.find((l) => l.type === "actor" && l.speaks) ?? layers.find((l) => l.type === "actor")));
  if (!subject) {
    ctx.issues.push({
      level: "error",
      code: "SHOT_SUBJECT",
      path: `${ctx.path}.shot`,
      message: shot.subject
        ? `no layer '${shot.subject}' to frame`
        : `a ${shot.size} shot needs a subject layer`,
      hint: `layers: ${layers.map((l) => l.id).join(", ") || "none"}`,
    });
    return wide;
  }
  const cover = Math.max(ctx.width / ctx.world.width, ctx.height / ctx.world.height);
  const fullH = ctx.height / cover;
  let zoom: number;
  let cy: number;
  // the subject keeps its on-screen x; its world x comes from where it stands in the wide view
  const [sx, sy] = toWorld(ctx, subject.place.x, subject.place.y ?? 0.45, wide);
  if (subject.type === "actor" && shot.size !== "insert") {
    let meta: AssetMeta | undefined;
    try {
      meta = assets.meta(parseAssetRef(subject.assetId).id);
    } catch {
      meta = undefined;
    }
    const h = actorHeight(ctx, meta, subject.place.scale);
    const feet = subject.place.anchor === "ground" ? ctx.world.groundY : sy;
    const headTop = feet - h;
    const visible = shot.size === "medium" ? h * 0.82 : h * 0.46;
    zoom = Math.min(3.6, Math.max(1, fullH / visible));
    const vh = fullH / zoom;
    cy = headTop - (shot.size === "medium" ? 0.13 : 0.17) * vh + vh / 2;
  } else {
    // insert: a close look; screen-space charts and texts are already full size, so zoom on the place
    zoom = subject.type === "chart" || subject.type === "text" ? 1.25 : 1.8;
    cy = sy;
  }
  const vw = ctx.width / (cover * zoom);
  const vh = fullH / zoom;
  const cx = sx - (subject.place.x - 0.5) * vw;
  return {
    cx: round(Math.min(ctx.world.width - vw / 2, Math.max(vw / 2, cx))),
    cy: round(Math.min(ctx.world.height - vh / 2, Math.max(vh / 2, cy))),
    zoom: Math.round(zoom * 1000) / 1000,
    subject: subject.id,
    size: shot.size,
  };
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
    // an exit that would only finish after the scene has ended is not needed: the cut removes the layer
    if (which === "out" && s + d > ctx.duration) continue;
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

  const scale = actorHeight(ctx, meta, layer.place.scale) / 880;
  const expressions = new Set((meta.capabilities["expressions"] as string[] | undefined) ?? []);
  const items = new Set((meta.capabilities["items"] as string[] | undefined) ?? []);
  const checkExpression = (e: string | undefined, epath: string): boolean => {
    if (e === undefined || expressions.size === 0 || expressions.has(e)) return true;
    ctx.issues.push({
      level: "error",
      code: "EXPRESSION_UNSUPPORTED",
      path: epath,
      message: `${meta.assetId} has no '${e}' expression`,
      hint: `expressions: ${[...expressions].join(", ")}`,
    });
    return false;
  };
  checkExpression(layer.expression, `${path}.expression`);
  if (layer.holding && !items.has(layer.holding))
    ctx.issues.push({
      level: "error",
      code: "ITEM_UNSUPPORTED",
      path: `${path}.holding`,
      message: `${meta.assetId} cannot hold '${layer.holding}'`,
      hint: `items: ${[...items].join(", ") || "none"}`,
    });
  const exprK: Keyframe[] = [{ f: 0, v: layer.expression }];
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
    if (a.expression && checkExpression(a.expression, `${apath}.expression`))
      exprK.push({ f, v: a.expression });
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
    expression: dedupeKeyframes(exprK),
  };
  entrance(ctx, layer, path, tracks, { x: wx, y, scale });
  return {
    id: layer.id,
    adapter: "character",
    asset: `${meta.assetId}@${meta.version}`,
    z: layer.zIndex ?? 10,
    space: "world",
    props: {
      speaks: layer.speaks,
      ...(layer.holding ? { holding: layer.holding } : {}),
      ...(layer.outfit && checkOutfit(ctx, meta, layer.outfit, `${path}.outfit`)
        ? { outfit: layer.outfit }
        : {}),
    },
    tracks: finalize(tracks),
  };
}

/** An outfit must be one the character has (capabilities.outfits); the identity never changes. */
function checkOutfit(ctx: SceneContext, meta: AssetMeta, outfit: string, path: string): boolean {
  const o = meta.capabilities["outfits"] as { default?: string; available?: string[] } | undefined;
  const available = o?.available ?? [];
  if (available.includes(outfit)) return true;
  ctx.issues.push({
    level: "error",
    code: "OUTFIT_UNKNOWN",
    path,
    message: `${meta.assetId} has no outfit '${outfit}'`,
    hint: `outfits: ${available.join(", ") || "only its default clothes"}`,
  });
  return false;
}

// --- staged sets ---------------------------------------------------------------------------------
function stageScene(ctx: SceneContext, set: StageSet, assets: AssetSource): StageResult {
  const actors: StagedActor[] = [];
  ctx.plan.layers.forEach((layer, li) => {
    if (layer.type !== "actor" || !layer.blocking.length) return;
    const path = `${ctx.path}.layers[${li}]`;
    const meta = asset(assets, layer.assetId, `${path}.assetId`, ctx.issues, ["character"]);
    if (!meta) return;
    if (!meta.files["rig_side"]) {
      ctx.issues.push({
        level: "error",
        code: "BLOCKING_NO_SIDE_VIEW",
        path,
        message: `${meta.assetId} has no side view to walk and sit`,
      });
      return;
    }
    if (layer.outfit && !checkOutfit(ctx, meta, layer.outfit, `${path}.outfit`)) return;
    actors.push({ layer, path, meta });
  });
  return stageActors(
    {
      fps: ctx.fps,
      duration: ctx.duration,
      path: ctx.path,
      issues: ctx.issues,
      words: ctx.words,
      resolveAt: (at, p) => resolveAt(ctx, at, p),
    },
    set,
    actors,
  );
}

const STAGED_ZOOM: Record<string, number> = { wide: 1.15, medium: 1.55, close: 2.0, insert: 1.8 };

/** Framing on a set: the subject's head in the upper third, at the zoom of the shot size. */
function stagedView(ctx: SceneContext, staged: StageResult): SceneContext["view"] {
  const size = ctx.plan.shot?.size ?? "medium";
  const zoom = STAGED_ZOOM[size] ?? 1.5;
  const viewH = ctx.height / zoom;
  const subjectId =
    ctx.plan.shot?.subject ??
    ctx.plan.layers.find((l) => l.type === "actor" && l.speaks && l.blocking.length)?.id ??
    staged.nodes[0]?.id;
  if (size === "insert" && staged.handovers[0]) {
    return { cx: 1210, cy: FLOOR - 460 * SCALE, zoom, size, ...(subjectId ? { subject: subjectId } : {}) };
  }
  const node = staged.nodes.find((n) => n.id === subjectId);
  if (!node) return { cx: 1230, cy: FLOOR - viewH * 0.38, zoom: STAGED_ZOOM["wide"] ?? 1.15, size };
  const [hx, hy] = headPoint(node, staged.poses.get(node.id) ?? [], 0);
  // wide: the whole desk; tighter shots centre on the subject
  const cx = size === "wide" ? (hx + 1230) / 2 : hx;
  return { cx, cy: hy + viewH * 0.24, zoom, size, subject: node.id };
}

/** On a set, the camera keeps a walking subject in frame (unless the plan already moves it). */
function followSubject(ctx: SceneContext, camera: Tracks, nodes: TimelineNode[]): Tracks {
  if (ctx.plan.camera.some((m) => m.move === "follow" || m.move === "pan_left" || m.move === "pan_right"))
    return camera;
  const subject = nodes.find((n) => n.id === ctx.view.subject);
  const xs = subject?.tracks["x"];
  if (!subject || !xs || xs.length < 2 || ctx.view.size === "insert") return camera;
  const x0 = Number(xs[0]?.v ?? ctx.view.cx);
  const keys = xs.map((k) => ({
    f: k.f,
    v: round(ctx.view.cx + (Number(k.v) - x0) * 0.85),
    ease: "easeInOut" as const,
  }));
  return { ...camera, x: dedupeKeyframes([{ f: 0, v: ctx.view.cx }, ...keys]) };
}

/** Props that stay with an actor (a halo above the head). */
function attachToActor(
  ctx: SceneContext,
  node: TimelineNode,
  attach: { to: string; at: "above_head" | "beside" },
  nodes: TimelineNode[],
  staged: StageResult | undefined,
  path: string,
): void {
  const target = nodes.find((n) => n.id === attach.to && n.adapter === "character");
  if (!target || !staged) {
    ctx.issues.push({
      level: "error",
      code: "ATTACH_TARGET_UNKNOWN",
      path: `${path}.attach.to`,
      message: `no staged actor '${attach.to}' to attach to`,
    });
    return;
  }
  const appear = (node.tracks["scale"] ?? node.tracks["opacity"] ?? [])[0]?.f ?? 0;
  const [hx, hy] = headPoint(target, staged.poses.get(target.id) ?? [], appear);
  const [x, y] = attach.at === "above_head" ? [hx, hy - 42] : [hx + 180, hy + 80];
  node.tracks = { ...node.tracks, x: [{ f: 0, v: round(x) }], y: [{ f: 0, v: round(y) }] };
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
  // sizes are what the viewer sees (a fraction of the frame width), whatever the shot's zoom; the subject
  // of an insert shot is what the camera came to show, so it is drawn bigger, but always inside the frame
  const insertSubject = ctx.view.size === "insert" && ctx.view.subject === layer.id;
  const onScreen = (DEFAULT_SIZE[layer.type] ?? 0.3) * layer.place.scale * (insertSubject ? 1.8 : 1);
  const size = (Math.min(insertSubject ? 0.86 : 2, onScreen) * ctx.width) / (cover * ctx.view.zoom);
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
  // moves start from the scene's framing; zoom targets are relative to it (push_in 1.1 = 10% closer)
  const { cx, cy, zoom: base } = ctx.view;
  const t: Tracks = { x: [{ f: 0, v: cx }], y: [{ f: 0, v: cy }], zoom: [{ f: 0, v: base }] };
  let zoom = base;
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
        const to = base * (m.to ?? (m.move === "push_in" ? 1.12 : 0.95));
        push("zoom", [
          { f: s, v: zoom },
          { f: e, v: to, ease: m.ease },
        ]);
        zoom = to;
        break;
      }
      case "punch_in": {
        const to = m.to !== undefined ? base * m.to : zoom + 0.12 * base;
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
        const to = x + ((m.move === "pan_right" ? 1 : -1) * (m.to ?? 1) * 320) / base;
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

type Box = { x0: number; y0: number; x1: number; y1: number; weight: number };

/** Caption band candidates (fraction of height), in order of preference. All sit inside TikTok's safe area. */
const CAPTION_BANDS = [0.7, 0.62, 0.77, 0.52, 0.33];
const CAPTION_HALF_H = 0.05;
const CAPTION_HALF_W = 0.42;

/**
 * Picks the caption band that covers the least of what matters: faces first, then titles and charts,
 * then objects. Measured in the scene's framing at the moment the most layers are on screen.
 */
function chooseCaptionY(ctx: SceneContext, nodes: TimelineNode[]): number {
  const f = Math.round(ctx.duration * 0.6);
  const boxes: Box[] = [];
  for (const n of nodes) {
    const x = sample(n.tracks["x"], f, 0);
    const y = sample(n.tracks["y"], f, 0);
    if (n.adapter === "character") {
      const h = 880 * sample(n.tracks["scale"], f, 1);
      const [fx0, fy0] = toFrame(ctx, x - h * 0.13, y - h);
      const [fx1, fy1] = toFrame(ctx, x + h * 0.13, y - h * 0.78);
      boxes.push({ x0: fx0, y0: fy0, x1: fx1, y1: fy1, weight: 4 });
    } else if (n.space === "world" && n.adapter === "svg") {
      const half = sample(n.tracks["size"], f, 0) / 2;
      const [fx0, fy0] = toFrame(ctx, x - half, y - half);
      const [fx1, fy1] = toFrame(ctx, x + half, y + half);
      boxes.push({ x0: fx0, y0: fy0, x1: fx1, y1: fy1, weight: 1 });
    } else if (n.space === "screen" && (n.adapter === "text" || n.adapter === "motion_graphics")) {
      const halfW =
        n.adapter === "text" ? 0.4 : sample(n.tracks["size"], f, ctx.width * 0.8) / (2 * ctx.width);
      const halfH = n.adapter === "text" ? 0.06 : halfW * 0.75 * (ctx.width / ctx.height);
      const cx = x / ctx.width;
      const cy = y / ctx.height;
      boxes.push({ x0: cx - halfW, y0: cy - halfH, x1: cx + halfW, y1: cy + halfH, weight: 3 });
    }
  }
  let best = CAPTION_BANDS[0] as number;
  let bestScore = Infinity;
  for (const band of CAPTION_BANDS) {
    let score = 0;
    for (const b of boxes) {
      const w = Math.max(0, Math.min(b.x1, 0.5 + CAPTION_HALF_W) - Math.max(b.x0, 0.5 - CAPTION_HALF_W));
      const h = Math.max(0, Math.min(b.y1, band + CAPTION_HALF_H) - Math.max(b.y0, band - CAPTION_HALF_H));
      score += w * h * b.weight;
    }
    if (score < bestScore - 1e-6) {
      best = band;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Compositional check: warns when a world element sits outside the visible frame at the start, at
 * the end, or at any of its own keyframes. Warnings do not block rendering; the planner sees them.
 */
function checkFraming(ctx: SceneContext, nodes: TimelineNode[], camera: Tracks): void {
  const cover = Math.max(ctx.width / ctx.world.width, ctx.height / ctx.world.height);
  const camAt = (f: number): { x: number; zoom: number } => ({
    x: sample(camera["x"], f, ctx.view.cx),
    zoom: sample(camera["zoom"], f, ctx.view.zoom),
  });
  for (const node of nodes) {
    if (node.space !== "world") continue;
    // on a set, furniture runs past the frame by design, and the camera frames one actor at a time
    if (
      ctx.plan.set &&
      (node.id.startsWith("set_") || (node.adapter === "character" && node.id !== ctx.view.subject))
    )
      continue;
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

/** Sorted by frame; for two keyframes on the same frame the later one wins. */
function dedupeKeyframes(kfs: Keyframe[]): Keyframe[] {
  const byFrame = new Map<number, Keyframe>();
  for (const k of kfs) byFrame.set(k.f, k);
  return [...byFrame.values()].sort((a, b) => a.f - b.f);
}
