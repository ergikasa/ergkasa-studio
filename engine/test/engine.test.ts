import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AssetMeta, type AssetMeta as AssetMetaT } from "@erkasa/contracts";
import { describe, expect, it } from "vitest";
import { chunkWords } from "../src/adapters/captions.js";
import { prepareCharacter } from "../src/adapters/character.js";
import {
  Engine,
  OPACITY_GUARD,
  SvgTemplate,
  easeFn,
  safeOpacity,
  sampleDiscrete,
  sampleNumber,
  type AssetSource,
} from "../src/index.js";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const ASSETS = join(ROOT, "assets");

/** Test-only asset source reading the real library. */
class RepoAssets implements AssetSource {
  private readonly paths: Map<string, string>;
  constructor() {
    const manifest = JSON.parse(readFileSync(join(ASSETS, "manifest.json"), "utf8")) as {
      assets: Array<{ assetId: string; path: string }>;
    };
    this.paths = new Map(manifest.assets.map((a) => [a.assetId, a.path]));
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

describe("easing and tracks", () => {
  it("easings start at 0 and end at 1", () => {
    for (const e of [
      "linear",
      "easeInOutCubic",
      "easeOutBack",
      { cubicBezier: [0.4, 0, 0.2, 1] as [number, number, number, number] },
    ]) {
      const f = easeFn(e as Parameters<typeof easeFn>[0]);
      expect(f(0)).toBeCloseTo(0, 5);
      expect(f(1)).toBeCloseTo(1, 5);
    }
  });

  it("interpolates numbers with the easing of the ending keyframe and holds outside", () => {
    const kfs = [
      { f: 10, v: 0 },
      { f: 20, v: 100 },
    ];
    expect(sampleNumber(kfs, 0, -1)).toBe(0);
    expect(sampleNumber(kfs, 15, -1)).toBe(50);
    expect(sampleNumber(kfs, 99, -1)).toBe(100);
    expect(
      sampleNumber(
        [
          { f: 0, v: 5 },
          { f: 10, v: 9, ease: "hold" },
        ],
        9,
        0,
      ),
    ).toBe(5);
  });

  it("discrete tracks report the previous value while blending", () => {
    const s = sampleDiscrete(
      [
        { f: 0, v: "idle" },
        { f: 10, v: "wave", blend: 10 },
      ],
      15,
      "idle",
    );
    expect(s.value).toBe("wave");
    expect(s.previous?.value).toBe("idle");
    expect(s.blend).toBeCloseTo(0.5);
  });
});

describe("svg templates", () => {
  const assets = new RepoAssets();

  it("every character exposes all rig bones and face slots", () => {
    for (const id of ["char_drini_01", "char_era_01", "char_arti_01", "char_bardhi_01"]) {
      const meta = assets.meta(id);
      expect(() =>
        prepareCharacter(meta, assets.text(id, "asset.svg"), assets.text(id, "rig.json")),
      ).not.toThrow();
    }
  });

  it("shows exactly one state per face slot", () => {
    const t = SvgTemplate.compile(assets.text("char_drini_01", "asset.svg"));
    const out = t.render({ states: { mouth: "talk_a", eyes: "blink", brows: "angry" } });
    const visible = [...out.matchAll(/<g data-state="([a-z_]+)"(?! display)/g)].map((m) => m[1]);
    // face slots + the hand item slot, which is empty ("neutral") unless the character holds something
    expect(visible.sort()).toEqual(["angry", "blink", "neutral", "talk_a"]);
    const holding = t.render({ states: { item: "phone" } });
    expect(holding).toMatch(/<g data-state="phone">/);
    expect(holding).toMatch(/<g data-state="document" display="none">/);
  });

  it("rotates a part around its pivot", () => {
    const t = SvgTemplate.compile(assets.text("met_dominoes_01", "asset.svg"));
    expect(t.render({ parts: { domino_1: { rotation: 45 } } })).toMatch(
      /id="domino_1"[^>]*transform="rotate\(45 /,
    );
  });

  it("never leaves an unguarded opacity group (resvg empty-layer abort)", () => {
    const out = safeOpacity('<g opacity="0.5"><circle r="2" opacity="0.4"/></g>');
    expect(out).toContain(OPACITY_GUARD);
    expect(out).toContain('fill-opacity="0.4"');
    expect(out).not.toMatch(/<circle[^>]*\sopacity=/);
  });
});

describe("captions", () => {
  it("never joins words across a sentence end", () => {
    const words = ["One", "two.", "Three", "four", "five", "six"].map((w, i) => ({
      word: w,
      start: i * 0.3,
      end: i * 0.3 + 0.25,
    }));
    expect(chunkWords(words, 3).map((c) => c.words.map((w) => w.word).join(" "))).toEqual([
      "One two.",
      "Three four five",
      "six",
    ]);
  });
});

describe("engine", () => {
  const timeline = JSON.parse(
    readFileSync(join(ROOT, "engine-worker", "demo", "phase-b-demo.timeline.json"), "utf8"),
  ) as unknown;
  const engine = new Engine(timeline, { assets: new RepoAssets() });

  it("reads the demo timeline", () => {
    expect(engine.width).toBe(1080);
    expect(engine.height).toBe(1920);
    expect(engine.totalFrames).toBe(438);
  });

  it("is deterministic: the same frame renders to the same SVG", () => {
    for (const f of [0, 75, 234, 400]) expect(engine.renderFrame(f)).toBe(engine.renderFrame(f));
  });

  it("frames are independent of render order", () => {
    const fresh = new Engine(timeline, { assets: new RepoAssets() });
    const a = fresh.renderFrame(300);
    fresh.renderFrame(10);
    expect(fresh.renderFrame(300)).toBe(a);
  });

  it("draws both scenes during the whip transition", () => {
    const svg = engine.renderFrame(234);
    expect(svg).toContain('data-node="drini"');
    expect(svg).toContain('data-node="era"');
  });

  it("rejects an unknown action instead of inventing one", () => {
    const bad = structuredClone(timeline) as {
      scenes: Array<{ nodes: Array<{ id: string; tracks: Record<string, unknown> }> }>;
    };
    const drini = bad.scenes[0]?.nodes.find((n) => n.id === "drini");
    if (drini) drini.tracks["clip"] = [{ f: 0, v: "moonwalk" }];
    expect(() => new Engine(bad, { assets: new RepoAssets() }).renderFrame(5)).toThrow(
      /unknown action 'moonwalk'/,
    );
  });
});

describe("charts", () => {
  it("renders every chart kind while building and when finished", async () => {
    const { renderChart, CHART_KINDS } = await import("../src/adapters/charts.js");
    const data = [
      { label: "A", value: 120 },
      { label: "B", value: 340 },
      { label: "C", value: 220 },
    ];
    for (const chart of CHART_KINDS) {
      for (const p of [0.5, 1]) {
        const svg = renderChart("c", { progress: [{ f: 0, v: p }] }, { chart, data, unit: "$" }, 0);
        expect(svg, `${chart} @ ${p}`).toContain('data-node="c"');
      }
    }
    expect(() => renderChart("c", {}, { chart: "radar", data }, 0)).toThrow(/unknown chart/);
  });

  it("counts numbers up with the unit in front of currencies", async () => {
    const { formatValue } = await import("../src/adapters/charts.js");
    expect(formatValue(761225, "$")).toBe("$761,225");
    expect(formatValue(48, "k")).toBe("48k");
    expect(formatValue(2.5, "%")).toBe("2.5%");
  });
});
