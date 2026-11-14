import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach } from "vitest";
import { repoRoot } from "../src/env.js";
import type { JsonRequest, JsonResponse, Llm } from "../src/llm.js";
import { drawCustom, gate, makeCustomAssets, renderProblems } from "../src/asset-maker.js";
import { WorldSpec } from "@erkasa/contracts";

const demo = (id: string): { svg: string; notes: string } =>
  (JSON.parse(readFileSync(join(repoRoot(), "ai-worker", "demo", "asset-maker", `${id}.json`), "utf8")) as {
    value: { svg: string; notes: string };
  }).value;

class Scripted implements Llm {
  readonly requests: JsonRequest[] = [];
  constructor(private readonly answers: unknown[]) {}
  async json(req: JsonRequest): Promise<JsonResponse> {
    this.requests.push(req);
    const value = this.answers[Math.min(this.requests.length, this.answers.length) - 1];
    return {
      value,
      text: JSON.stringify(value),
      usage: { label: req.label, model: "claude-sonnet-5-5", inputTokens: 900, outputTokens: 1500, ms: 1 },
    };
  }
}

beforeEach(() => {
  process.env["ERKASA_ASSET_CACHE"] = mkdtempSync(join(tmpdir(), "asset-cache-"));
});

describe("asset gate", () => {
  it("lets the three demo drawings through", () => {
    for (const id of ["mooncake", "radio", "plate"]) {
      const { check, normalized } = gate(demo(id).svg, `wld_prop_${id}`);
      expect(check.problems, id).toEqual([]);
      expect(normalized).toContain(`id="wld_prop_${id}"`);
    }
    expect(renderProblems(gate(demo("radio").svg, "r").normalized ?? "", "table")).toEqual([]);
  });

  it("rejects scripts, external references, text and filters", () => {
    for (const bad of [
      '<script>alert(1)</script>',
      '<image href="https://x/y.png"/>',
      '<text x="1" y="1">hi</text>',
      '<filter id="f"/>',
    ]) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g><rect width="50" height="50" fill="#E3B66B"/>${bad}</g></svg>`;
      expect(gate(svg, "x").check.ok, bad).toBe(false);
    }
  });

  it("flags empty, cut-off and floating drawings", () => {
    const wrap = (inner: string): string =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"><g>${inner}</g></svg>`;
    expect(renderProblems(wrap('<rect x="95" y="95" width="4" height="4" fill="#C2554D"/>'), "table")[0]).toMatch(/empty/);
    expect(renderProblems(wrap('<rect x="-20" y="40" width="240" height="160" fill="#C2554D"/>'), "hand").join()).toMatch(/edge/);
    expect(renderProblems(wrap('<rect x="40" y="20" width="120" height="100" fill="#C2554D"/>'), "floor").join()).toMatch(/bottom/);
  });
});

describe("drawCustom", () => {
  it("sends a rejected drawing back with the problems, then accepts the fixed one", async () => {
    const bad = { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script/></svg>', notes: "x" };
    const llm = new Scripted([bad, demo("radio")]);
    const r = await drawCustom(llm, { id: "wld_prop_radio", brief: "a vintage tabletop radio", size: "table" });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
    expect(llm.requests[1]?.messages[0]?.content).toContain("rejected");
    expect(r.usage).toHaveLength(2);
  });

  it("gives up after three bad drawings and reports why", async () => {
    const bad = { svg: "<svg/>", notes: "x" };
    const r = await drawCustom(new Scripted([bad]), { id: "a", brief: "something odd here", size: "hand" });
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(3);
    expect(r.problems.length).toBeGreaterThan(0);
  });

  it("serves the same brief from the cache for free", async () => {
    const req = { id: "wld_prop_radio", brief: "a vintage tabletop radio", size: "table" as const };
    await drawCustom(new Scripted([demo("radio")]), req);
    const llm = new Scripted([]);
    const again = await drawCustom(llm, { ...req, id: "wld_prop_radio2" });
    expect(again.cached).toBe(true);
    expect(again.svg).toContain('id="wld_prop_radio2"');
    expect(llm.requests).toHaveLength(0);
  });
});

describe("makeCustomAssets", () => {
  const spec = (): WorldSpec =>
    WorldSpec.parse({
      schema: "erkasa.world-spec/1",
      worldId: "night",
      title: "Night",
      setting: "A taxi at night",
      style: "night_noir",
      places: [{ id: "wld_place_main", kind: "rooftop_night" }],
      props: [
        { id: "wld_prop_radio", kind: "custom", brief: "a vintage tabletop radio", size: "table", function: "plays the news", scenes: ["s01"] },
        { id: "wld_prop_odd", kind: "custom", brief: "an impossible object", size: "hand", function: "x", scenes: ["s01"] },
      ],
    });

  it("writes the drawings that pass and leaves out the props that never pass", async () => {
    const dir = mkdtempSync(join(tmpdir(), "custom-"));
    const llm: Llm = {
      async json(req) {
        const value = req.label.startsWith("asset:wld_prop_radio") ? demo("radio") : { svg: "<svg/>", notes: "" };
        return { value, text: "", usage: { label: req.label, model: "m", inputTokens: 1, outputTokens: 1, ms: 1 } };
      },
    };
    const { spec: out, report } = await makeCustomAssets(llm, spec(), dir);
    expect(report).toMatchObject({ requested: 2, passed: 1 });
    expect(out.props.map((p) => p.id)).toEqual(["wld_prop_radio"]);
    expect(existsSync(join(dir, "wld_prop_radio.svg"))).toBe(true);
  });
});
