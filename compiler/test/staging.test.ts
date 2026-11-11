import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AssetMeta, type AssetMeta as AssetMetaT, type Keyframe } from "@erkasa/contracts";
import { Engine, SEAT, type AssetSource } from "@erkasa/engine";
import { describe, expect, it } from "vitest";
import { SETS, compileVideo, staging, standX } from "../src/index.js";

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

const plan = (): Record<string, unknown> =>
  JSON.parse(
    readFileSync(join(ROOT, "engine-worker", "demo", "poc", "halo-claude.video-plan.json"), "utf8"),
  ) as Record<string, unknown>;
type SceneJ = { layers: Array<Record<string, unknown>>; set?: unknown; background: { assetId: string } };
const scenes = (p: Record<string, unknown>): SceneJ[] => p["scenes"] as SceneJ[];

const at = (k: Keyframe[] | undefined, f: number): Keyframe["v"] | undefined => {
  let v: Keyframe["v"] | undefined;
  for (const x of k ?? []) if (x.f <= f) v = x.v;
  return v;
};

describe("staging geometry", () => {
  it("walks at the speed of the steps and sits with the feet where they stood", () => {
    const w = staging.walkKeys(10, 560, 1040);
    const last = w.keys[w.keys.length - 1];
    expect(last?.v).toBe(1040);
    const speed = (480 - staging.walkSpeed() * 0.125) / ((w.arrive - 10 - 7.5) / 30);
    expect(Math.abs(speed - staging.walkSpeed())).toBeLessThan(15);
    expect(staging.feetForSeat(880, "right")).toBeCloseTo(880 + SEAT.back * staging.SCALE, 5);
    expect(staging.feetForSeat(1540, "left")).toBeCloseTo(1540 - SEAT.back * staging.SCALE, 5);
  });

  it("stages a hand-over where both hands meet above the desk", () => {
    const set = SETS["interview_office"];
    if (!set) throw new Error("no set");
    const left = set.marks["chair_left"];
    const right = set.marks["chair_right"];
    if (!left || !right) throw new Error("marks");
    const a = staging.handPoint(standX(left), "right", "give");
    const b = staging.handPoint(standX(right), "left", "give");
    expect(Math.abs(a[0] - b[0])).toBeLessThan(30);
    expect(Math.abs(a[1] - b[1])).toBeLessThan(15);
    expect(a[1]).toBeLessThan(staging.FLOOR - 348); // above the desk top
  });
});

describe("blocking on a staged set", () => {
  const compiled = compileVideo(plan(), { assets, seed: 1 });

  it("compiles the Claude-style Halo plan without errors and the engine renders it", () => {
    const errors = compiled.issues.filter((i) => i.level === "error");
    expect(errors).toEqual([]);
    expect(compiled.timeline).toBeDefined();
    const engine = new Engine(compiled.timeline, { assets });
    const s = compiled.timeline?.scenes[3];
    if (!s) throw new Error("scene");
    expect(engine.renderFrame(s.from + 60)).toContain('data-node="alex"');
  });

  it("walks Alex in, hands the CV over, and seats both", () => {
    const s = compiled.timeline?.scenes.find((x) => x.sceneId === "s04");
    const alex = s?.nodes.find((n) => n.id === "alex");
    const maria = s?.nodes.find((n) => n.id === "maria");
    const door = s?.nodes.find((n) => n.id === "set_door");
    if (!s || !alex || !maria || !door) throw new Error("nodes");
    expect(alex.props["outfit"]).toBe("business");
    const xs = alex.tracks["x"] ?? [];
    expect(xs[0]?.v).toBe(560);
    expect(Number(xs[xs.length - 1]?.v)).toBeCloseTo(staging.feetForSeat(880, "right"), 3);
    // the item changes hands at the same frame
    const alexDrop = (alex.tracks["item"] ?? []).find((k) => k.v === "neutral" && k.f > 0)?.f;
    const mariaGet = (maria.tracks["item"] ?? []).find((k) => k.v === "document")?.f;
    expect(alexDrop).toBeDefined();
    expect(mariaGet).toBe(alexDrop);
    // Maria stands up to take it and sits down again; Alex ends seated
    const mClips = (maria.tracks["clip"] ?? []).map((k) => k.v);
    expect(mClips).toEqual(expect.arrayContaining(["stand_up", "give", "sit"]));
    expect(at(alex.tracks["clip"], s.duration - 1)).toMatch(/^seated/);
    // the door opens when he comes in
    expect((door.tracks["part.leaf.scaleX"] ?? []).some((k) => Number(k.v) < 0.5)).toBe(true);
  });

  it("keeps a halo above the seated actor's head", () => {
    const s = compiled.timeline?.scenes.find((x) => x.sceneId === "s05");
    const halo = s?.nodes.find((n) => n.id === "halo");
    if (!halo) throw new Error("halo");
    const y = Number(halo.tracks["y"]?.[0]?.v);
    expect(y).toBeLessThan(staging.FLOOR - 600);
    expect(y).toBeGreaterThan(staging.FLOOR - 820);
  });

  it("explains blocking mistakes with codes the planner can act on", () => {
    const p = plan();
    const ss = scenes(p);
    const s2 = ss[1];
    const s3 = ss[2];
    if (!s2 || !s3) throw new Error("scenes");
    (s2.layers[0] as Record<string, unknown>)["outfit"] = "pyjamas";
    (s2.layers[1] as Record<string, unknown>)["blocking"] = [{ do: "seated", mark: "sofa" }];
    delete s3.set;
    const res = compileVideo(p, { assets, seed: 1 });
    const codes = new Set(res.issues.filter((i) => i.level === "error").map((i) => i.code));
    expect(codes).toEqual(new Set(["OUTFIT_UNKNOWN", "BLOCKING_MARK_UNKNOWN", "BLOCKING_WITHOUT_SET"]));
  });
});
