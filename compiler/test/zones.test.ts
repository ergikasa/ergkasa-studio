import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AssetMeta, type AssetMeta as AssetMetaT } from "@erkasa/contracts";
import type { AssetSource } from "@erkasa/engine";
import { describe, expect, it } from "vitest";
import { compileVideo } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const ASSETS = join(ROOT, "assets");
const manifest = JSON.parse(readFileSync(join(ASSETS, "manifest.json"), "utf8")) as {
  assets: Array<{ assetId: string; path: string; category: string }>;
};
const paths = new Map(manifest.assets.map((a) => [a.assetId, a.path]));
const firstOf = (cat: string, prefix = ""): string =>
  manifest.assets.find((a) => a.category === cat && a.assetId.startsWith(prefix))?.assetId ?? "";
const BG = firstOf("background");
const CHAR = firstOf("character");
const PROP = firstOf("object", "prop_");

/** The library, with its first background stretched into a wide place with three zones. */
const assets: AssetSource = {
  meta(id: string): AssetMetaT {
    const meta = AssetMeta.parse(JSON.parse(this.text(id, "asset.json")));
    if (id !== BG) return meta;
    return {
      ...meta,
      viewBox: [0, 0, 7680, 1920],
      zones: { gate: { x: 1 / 6 }, yard: { x: 0.5 }, tower: { x: 5 / 6 } },
    };
  },
  text(id: string, file: string): string {
    const p = paths.get(id);
    if (!p) throw new Error(`unknown asset ${id}`);
    return readFileSync(join(ASSETS, p, file), "utf8");
  },
};

const plan = (scene: Record<string, unknown>): Record<string, unknown> => ({
  schema: "erkasa.video-plan/1",
  projectId: "zones",
  language: "en",
  format: "9:16",
  fps: 30,
  voiceId: "none",
  scenes: [
    {
      schema: "erkasa.scene-plan/1",
      sceneId: "s01",
      engine: "2d",
      narration: "Walk with me.",
      durationPolicy: { mode: "fixed", sec: 8, padAfterSec: 0 },
      background: { assetId: BG },
      layers: [],
      ...scene,
    },
  ],
});
const actor = (extra: Record<string, unknown>): Record<string, unknown> => ({
  type: "actor",
  id: "a",
  assetId: CHAR,
  place: { anchor: "ground", x: 0.5, scale: 1 },
  ...extra,
});
type Node = { id: string; tracks: Record<string, Array<{ f: number; v: number | string }>> };
const compile = (p: Record<string, unknown>) => {
  const r = compileVideo(p, { assets });
  const nodes = (r.timeline?.scenes[0]?.nodes ?? []) as unknown as Node[];
  return {
    ...r,
    nodes,
    camera: r.timeline?.scenes[0]?.camera as Record<string, Array<{ f: number; v: number }>> | undefined,
  };
};

describe("wide places: zones and the travelling camera", () => {
  it("starts a scene in the zone named by the shot and places layers in its view", () => {
    const r = compile(plan({ shot: { size: "wide", zone: "tower" }, layers: [actor({})] }));
    expect(r.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(r.camera?.["x"]?.[0]?.v).toBeCloseTo((5 / 6) * 7680, 0);
    expect(r.nodes.find((n) => n.id === "a")?.tracks["x"]?.[0]?.v).toBeCloseTo((5 / 6) * 7680, 0);
  });

  it("puts a layer into another zone and travels the camera there", () => {
    const r = compile(
      plan({
        shot: { size: "wide", zone: "gate" },
        layers: [actor({ place: { anchor: "ground", x: 0.5, scale: 1, zone: "yard" } })],
        camera: [{ move: "travel", zone: "yard", at: { sec: 1 }, durationSec: 3 }],
      }),
    );
    expect(r.issues.filter((i) => i.level === "error")).toEqual([]);
    const x = r.camera?.["x"] ?? [];
    expect(x[0]?.v).toBeCloseTo(1280, 0);
    expect(x[x.length - 1]?.v).toBeCloseTo(3840, 0);
    expect(r.nodes.find((n) => n.id === "a")?.tracks["x"]?.[0]?.v).toBeCloseTo(3840, 0);
  });

  it("travels with a walking actor until it arrives", () => {
    const r = compile(
      plan({
        shot: { size: "wide", zone: "gate" },
        layers: [
          actor({
            place: { anchor: "ground", x: 0.5, scale: 1, zone: "gate" },
            actions: [{ action: "walk", at: { sec: 1 }, to: { x: 0.5, zone: "yard" } }],
          }),
        ],
        camera: [{ move: "travel", target: "a", at: { sec: 1 } }],
      }),
    );
    expect(r.issues.filter((i) => i.level === "error")).toEqual([]);
    const walk = r.nodes.find((n) => n.id === "a")?.tracks["x"] ?? [];
    const cam = r.camera?.["x"] ?? [];
    expect(walk[walk.length - 1]?.v).toBeCloseTo(3840, 0);
    // the camera ends where the actor ends (give or take the last frame): the actor stays in frame
    expect(Math.abs((cam[cam.length - 1]?.v ?? 0) - 3840)).toBeLessThan(20);
  });

  it("reports an unknown zone with the zones the place has", () => {
    const r = compile(plan({ shot: { size: "wide", zone: "moat" }, layers: [actor({})] }));
    const e = r.issues.find((i) => i.code === "ZONE_UNKNOWN");
    expect(e?.hint).toContain("gate, yard, tower");
  });

  it("does not warn about layers in another zone while the camera travels", () => {
    const r = compile(
      plan({
        shot: { size: "wide", zone: "gate" },
        layers: [actor({ place: { anchor: "ground", x: 0.5, scale: 1, zone: "yard" } })],
        camera: [{ move: "travel", zone: "yard", at: { sec: 1 }, durationSec: 3 }],
      }),
    );
    expect(r.issues.filter((i) => i.code === "OUT_OF_FRAME")).toEqual([]);
  });

  it("keeps an object in a zone (insert shot)", () => {
    const r = compile(
      plan({
        shot: { size: "insert", subject: "o", zone: "yard" },
        layers: [
          { type: "object", id: "o", assetId: PROP, place: { x: 0.5, y: 0.4, scale: 1, zone: "yard" } },
        ],
      }),
    );
    expect(r.issues.filter((i) => i.level === "error")).toEqual([]);
    expect(r.camera?.["x"]?.[0]?.v).toBeCloseTo(3840, 0);
  });
});
