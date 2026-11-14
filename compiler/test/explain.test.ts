import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AssetMeta, type AssetMeta as AssetMetaT } from "@erkasa/contracts";
import type { AssetSource } from "@erkasa/engine";
import { describe, expect, it } from "vitest";
import { RECIPE_INITIAL, RECIPE_SETS, compileVideo } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const ASSETS = join(ROOT, "assets");
const manifest = JSON.parse(readFileSync(join(ASSETS, "manifest.json"), "utf8")) as {
  assets: Array<{ assetId: string; path: string; category: string }>;
};
const paths = new Map(manifest.assets.map((a) => [a.assetId, a.path]));
const BG = manifest.assets.find((a) => a.category === "background")?.assetId ?? "";

/** A world prop with three values: a phone whose screen goes 4% -> 3% -> 1%. */
const PHONE = "wld_prop_phone";
const assets: AssetSource = {
  meta(id: string): AssetMetaT {
    if (id === PHONE)
      return AssetMeta.parse({
        schema: "erkasa.asset/1",
        assetId: PHONE,
        version: 1,
        name: "Phone",
        category: "object",
        kind: "prop",
        adapter: "svg",
        style: "world_night_noir",
        files: { svg: "asset.svg" },
        viewBox: [0, 0, 300, 560],
        capabilities: { animations: ["to_value_1", "to_value_2"], recipes: "screen" },
        parts: { v0: "4%", v1: "3%", v2: "1%" },
        themes: ["psychology"],
        tags: ["phone"],
        license: {
          spdx: "LicenseRef-Erkasa-Original",
          source: "test",
          commercial: true,
          attributionRequired: false,
        },
      });
    return AssetMeta.parse(JSON.parse(this.text(id, "asset.json")));
  },
  text(id: string, file: string): string {
    const p = paths.get(id);
    if (!p) throw new Error(`unknown asset ${id}`);
    return readFileSync(join(ASSETS, p, file), "utf8");
  },
};

const plan = (layer: Record<string, unknown>): Record<string, unknown> => ({
  schema: "erkasa.video-plan/1",
  projectId: "explain",
  language: "en",
  format: "9:16",
  fps: 30,
  voiceId: "none",
  scenes: [
    {
      schema: "erkasa.scene-plan/1",
      sceneId: "s01",
      engine: "2d",
      narration: "Four percent, then three.",
      durationPolicy: { mode: "fixed", sec: 8, padAfterSec: 0 },
      background: { assetId: BG },
      shot: { size: "insert", subject: "p" },
      layers: [layer],
    },
  ],
});
const phone = (extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  type: "object",
  id: "p",
  assetId: PHONE,
  place: { x: 0.5, y: 0.45, scale: 1.5 },
  animations: [
    { name: "to_value_1", at: { sec: 2 } },
    { name: "to_value_2", at: { sec: 4 } },
  ],
  ...extra,
});
type Node = { id: string; space: string; tracks: Record<string, Array<{ f: number; v: number }>> };
const nodes = (
  p: Record<string, unknown>,
): { issues: Array<{ level: string; code: string }>; nodes: Node[] } => {
  const r = compileVideo(p, { assets });
  return { issues: r.issues, nodes: (r.timeline?.scenes[0]?.nodes ?? []) as unknown as Node[] };
};

describe("objects that explain", () => {
  it("a screen starts on its first value and swaps to the next ones at their time", () => {
    const { issues, nodes: n } = nodes(plan(phone()));
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
    const t = n.find((x) => x.id === "p")?.tracks ?? {};
    expect(t["part.v0.opacity"]?.[0]).toMatchObject({ f: 0, v: 1 });
    expect(t["part.v1.opacity"]?.[0]).toMatchObject({ f: 0, v: 0 });
    // v1 fades in at 2 s (frame 60); v0 fades out then
    expect(t["part.v1.opacity"]?.find((k) => k.f === 69)?.v).toBe(1);
    expect(t["part.v0.opacity"]?.find((k) => k.f === 69)?.v).toBe(0);
    // v2 is the last value: it shows from 4 s, and v1 leaves
    expect(t["part.v2.opacity"]?.find((k) => k.f === 129)?.v).toBe(1);
    expect(t["part.v1.opacity"]?.find((k) => k.f === 129)?.v).toBe(0);
  });

  it("does not touch parts the prop does not have (a 3-value screen has no v4)", () => {
    const { nodes: n } = nodes(plan(phone()));
    const t = n.find((x) => x.id === "p")?.tracks ?? {};
    expect(Object.keys(t).some((k) => k.startsWith("part.v3") || k.startsWith("part.v4"))).toBe(false);
  });

  it("puts a sign next to an object, in the world, appearing at its time", () => {
    const { issues, nodes: n } = nodes(plan(phone({ label: { text: "BATTERY", at: { sec: 1 } } })));
    expect(issues.filter((i) => i.level === "error")).toEqual([]);
    const sign = n.find((x) => x.id === "p_label");
    expect(sign?.space).toBe("world");
    const obj = n.find((x) => x.id === "p");
    expect(sign?.tracks["y"]?.[0]?.v).toBeLessThan(obj?.tracks["y"]?.[0]?.v ?? 0);
    expect(sign?.tracks["scale"]?.find((k) => k.v === 1)?.f).toBeGreaterThanOrEqual(30);
  });

  it("every world recipe set names tracks of parts the generators draw", () => {
    expect(Object.keys(RECIPE_SETS["screen"] ?? {})).toEqual([
      "to_value_1",
      "to_value_2",
      "to_value_3",
      "to_value_4",
      "to_value_5",
    ]);
    expect(Object.keys(RECIPE_SETS["grid"] ?? {})).toContain("group_4");
    expect(Object.keys(RECIPE_INITIAL["door"] ?? {})).toEqual(["part.lock_open.opacity"]);
  });
});
