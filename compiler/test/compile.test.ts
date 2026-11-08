import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AssetMeta, RenderTimeline, type AssetMeta as AssetMetaT } from "@erkasa/contracts";
import { Engine, SvgTemplate, type AssetSource } from "@erkasa/engine";
import { describe, expect, it } from "vitest";
import { METAPHOR_RECIPES, compileVideo, cutAtEnd, estimateWords, findWord } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const ASSETS = join(ROOT, "assets");

class RepoAssets implements AssetSource {
  private readonly paths: Map<string, string>;
  constructor() {
    const m = JSON.parse(readFileSync(join(ASSETS, "manifest.json"), "utf8")) as {
      assets: Array<{ assetId: string; path: string }>;
    };
    this.paths = new Map(m.assets.map((a) => [a.assetId, a.path]));
  }
  meta(id: string): AssetMetaT {
    return AssetMeta.parse(JSON.parse(this.text(id, "asset.json")));
  }
  text(id: string, file: string): string {
    const p = this.paths.get(id);
    if (!p) throw new Error(`unknown asset ${id}`);
    return readFileSync(join(ASSETS, p, file), "utf8");
  }
}

const assets = new RepoAssets();
const demoPlan = (): Record<string, unknown> =>
  JSON.parse(readFileSync(join(ROOT, "engine-worker", "demo", "habits.video-plan.json"), "utf8")) as Record<
    string,
    unknown
  >;
type Scene = { layers: Array<Record<string, unknown>>; narration: string };
const scenesOf = (plan: Record<string, unknown>): Scene[] => plan["scenes"] as Scene[];

describe("word timing", () => {
  it("estimates increasing, non-overlapping word times", () => {
    const w = estimateWords("Small choices fall like dominoes. One after another.");
    expect(w).toHaveLength(8);
    for (let i = 1; i < w.length; i++) expect((w[i]?.start ?? 0) >= (w[i - 1]?.end ?? 0)).toBe(true);
  });
  it("finds words ignoring case and punctuation, with occurrences", () => {
    const w = estimateWords("The level of your goals. The level of your habits.");
    expect(findWord(w, "LEVEL", 2)?.start).toBeGreaterThan(findWord(w, "level", 1)?.start ?? 99);
    expect(findWord(w, "habits")).toBeDefined();
    expect(findWord(w, "money")).toBeUndefined();
  });
});

describe("compiler", () => {
  it("compiles the demo plan into a valid Render Timeline", () => {
    const res = compileVideo(demoPlan(), { assets });
    expect(res.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(RenderTimeline.safeParse(res.timeline).success).toBe(true);
    expect(res.timeline?.width).toBe(1080);
    expect(res.timeline?.height).toBe(1920);
  });

  it("overlaps scenes by the transition length", () => {
    const tl = compileVideo(demoPlan(), { assets }).timeline;
    const [a, b] = tl?.scenes ?? [];
    expect(b?.transitionIn.type).toBe("whip");
    expect(b?.from).toBe((a?.from ?? 0) + (a?.duration ?? 0) - (b?.transitionIn.frames ?? 0));
  });

  it("turns a walking actor sideways in the walk direction, then back to the camera", () => {
    const tl = compileVideo(demoPlan(), { assets }).timeline;
    const drini = tl?.scenes[0]?.nodes.find((n) => n.id === "drini");
    const facing = (drini?.tracks["facing"] ?? []).map((k) => k.v);
    expect(facing[0]).toBe("right");
    expect(facing).toContain("front");
    expect((drini?.tracks["clip"] ?? [])[0]?.v).toBe("walk");
  });

  it("rejects an action the character cannot do, with a hint", () => {
    const plan = demoPlan();
    (scenesOf(plan)[0]?.layers[0]?.["actions"] as Array<Record<string, unknown>>).push({
      action: "backflip",
      at: "start",
    });
    const res = compileVideo(plan, { assets });
    const err = res.issues.find((i) => i.code === "ACTION_UNSUPPORTED");
    expect(err?.hint).toMatch(/walk/);
    expect(res.timeline).toBeUndefined();
  });

  it("rejects a word that is not in the narration", () => {
    const plan = demoPlan();
    (scenesOf(plan)[1]?.layers[1]?.["animations"] as Array<Record<string, unknown>>)[0] = {
      name: "fall",
      at: { word: "avalanche" },
    };
    expect(compileVideo(plan, { assets }).issues.some((i) => i.code === "WORD_NOT_IN_NARRATION")).toBe(true);
  });

  it("rejects unknown assets and unknown metaphor animations", () => {
    const plan = demoPlan();
    const layers = scenesOf(plan)[1]?.layers ?? [];
    (layers[1]?.["animations"] as Array<Record<string, unknown>>)[0] = { name: "explode", at: "start" };
    layers.push({ type: "object", id: "ghost", assetId: "obj_unicorn_9000", place: { x: 0.5 } });
    const codes = compileVideo(plan, { assets }).issues.map((i) => i.code);
    expect(codes).toContain("ANIMATION_UNSUPPORTED");
    expect(codes).toContain("ASSET_NOT_FOUND");
  });

  it("warns when an element leaves the frame", () => {
    const plan = demoPlan();
    const s2 = (plan["scenes"] as Array<{ camera: Array<Record<string, unknown>> }>)[1];
    if (s2) s2.camera = [{ move: "pan_right", at: "start", to: 3 }];
    expect(compileVideo(plan, { assets }).issues.some((i) => i.code === "OUT_OF_FRAME")).toBe(true);
  });

  it("produces a timeline the engine can render", () => {
    const tl = compileVideo(demoPlan(), { assets }).timeline;
    const engine = new Engine(tl, { assets });
    expect(engine.renderFrame(Math.floor(engine.totalFrames / 2))).toContain("<svg");
  });
});

describe("metaphor recipes", () => {
  it("every recipe drives parts that exist in its SVG", () => {
    for (const [assetId, recipes] of Object.entries(METAPHOR_RECIPES)) {
      const t = SvgTemplate.compile(assets.text(assetId, "asset.svg"), assetId);
      for (const [name, recipe] of Object.entries(recipes)) {
        for (const track of Object.keys(recipe(10, 200, 30).tracks)) {
          const part = /^part\.([^.]+)\./.exec(track)?.[1];
          if (part) expect(t.parts.has(part), `${assetId}.${name} -> ${part}`).toBe(true);
        }
      }
    }
  });

  it("asset.json lists exactly the animations the compiler implements", () => {
    for (const [assetId, recipes] of Object.entries(METAPHOR_RECIPES)) {
      const caps = assets.meta(assetId).capabilities["animations"] as string[];
      for (const name of Object.keys(recipes)) expect(caps, assetId).toContain(name);
    }
  });
});

describe("scene end", () => {
  it("cuts a chart that starts drawing on the last word instead of producing an invalid timeline", () => {
    const plan = demoPlan();
    const scene = scenesOf(plan)[2] as Scene; // s02b: "... grow past two hundred thousand."
    const chart = scene.layers.find((l) => l["type"] === "chart") as Record<string, unknown>;
    chart["in"] = { effect: "draw_on", at: { word: "thousand." }, durationSec: 1.6 };
    (scene as unknown as Record<string, unknown>)["durationPolicy"] = {
      mode: "fitNarration",
      padAfterSec: 0.2,
    };

    const res = compileVideo(plan, { assets, seed: 1 });
    expect(res.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(res.issues.map((i) => i.code)).toContain("CUT_AT_SCENE_END");
    expect(RenderTimeline.safeParse(res.timeline).success).toBe(true);
    const s = res.timeline?.scenes[2];
    for (const node of s?.nodes ?? [])
      for (const kfs of Object.values(node.tracks))
        for (const k of kfs) expect(k.f).toBeLessThanOrEqual(s?.duration ?? 0);
    // and it renders
    const engine = new Engine(res.timeline, { assets });
    expect(engine.renderFrame((s?.from ?? 0) + (s?.duration ?? 1) - 1)).toContain("<svg");
  });

  it("holds a numeric track at the value it has on the last frame", () => {
    const tracks = {
      progress: [
        { f: 10, v: 0 },
        { f: 30, v: 1 },
      ],
      clip: [
        { f: 0, v: "idle" },
        { f: 25, v: "wave" },
      ],
    };
    expect(cutAtEnd(tracks, 20)).toBe(true);
    expect(tracks.progress).toEqual([
      { f: 10, v: 0 },
      { f: 20, v: 0.5 },
    ]);
    expect(tracks.clip).toEqual([{ f: 0, v: "idle" }]);
    expect(cutAtEnd(tracks, 20)).toBe(false);
  });
});
