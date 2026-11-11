import { join } from "node:path";
import { compileVideo } from "@erkasa/compiler";
import type { Script } from "@erkasa/contracts";
import { describe, expect, it } from "vitest";
import { Catalog } from "../src/catalog.js";
import { repoRoot } from "../src/env.js";
import { DRAFT_SCHEMA, draftToPlan, type Draft } from "../src/plan-draft.js";
import { EXAMPLE_SET, plannerPrompt } from "../src/planner.js";

const catalog = new Catalog(join(repoRoot(), "assets"));
const script = {
  schema: "erkasa.script/1",
  title: "The Halo Effect",
  theme: "psychology",
  scenes: [
    {
      sceneId: "s02",
      narration: "Same Alex, same resume, same answers. Just a suit.",
      visualIdea: "Alex walks in wearing a suit and hands over his resume.",
    },
  ],
} as unknown as Script;

describe("planner on staged sets", () => {
  it("turns a set scene from the model into a plan that compiles: walk in, hand over, sit", () => {
    const res = draftToPlan({ scenes: [EXAMPLE_SET] } as unknown as Draft, script, {
      projectId: "t",
      voiceId: "mark_natural",
    });
    expect(res.issues).toEqual([]);
    const scene = res.plan?.scenes[0];
    expect(scene?.set).toEqual({ id: "interview_office" });
    const alex = scene?.layers.find((l) => l.id === "alex");
    expect(alex?.type === "actor" && alex.outfit).toBe("business");
    expect(alex?.type === "actor" && alex.blocking.map((b) => b.do)).toEqual([
      "enter",
      "walk_to",
      "give",
      "sit",
    ]);
    const compiled = compileVideo(res.plan, { assets: catalog.source, seed: 1 });
    expect(compiled.issues.filter((i) => i.level === "error")).toEqual([]);
  });

  it("tells the model about sets, marks, outfits and the host it may not replace", () => {
    const prompt = plannerPrompt(script, catalog, undefined, "char_host_01");
    expect(prompt).toContain("interview_office");
    expect(prompt).toContain("chair_left");
    expect(prompt).toMatch(/outfits: casual, business/);
    expect(prompt).toContain("Host chosen by the user: char_host_01");
    const scene = (DRAFT_SCHEMA as { properties: { scenes: { items: { required: string[] } } } }).properties
      .scenes.items;
    expect(scene.required).toContain("set");
  });

  it("rejects a malformed attachTo", () => {
    const draft = structuredClone(EXAMPLE_SET) as unknown as Draft["scenes"][number];
    const base = draft.layers[0];
    if (!base) throw new Error("layer");
    draft.layers.push({
      ...base,
      id: "halo",
      type: "object",
      assetId: "prop_halo_01",
      blocking: [],
      actions: [],
      attachTo: "alex-head",
    });
    const res = draftToPlan({ scenes: [draft] } as Draft, script, {
      projectId: "t",
      voiceId: "mark_natural",
    });
    expect(res.issues.map((i) => i.path)).toContain("scenes[0].layers[2].attachTo");
  });
});
