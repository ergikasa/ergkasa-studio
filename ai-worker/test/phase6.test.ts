import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { splitRanges } from "@erkasa/engine-worker";
import { beforeAll, describe, expect, it } from "vitest";
import { assetModel } from "../src/asset-maker.js";
import { repoRoot } from "../src/env.js";
import type { JsonRequest, JsonResponse, Llm } from "../src/llm.js";
import { redoRunScene, storyboardOf, showStoryboard, undoRedo } from "../src/producer.js";
import { estimateRender } from "../src/storyboard.js";
import { draftToPlan, type Draft } from "../src/plan-draft.js";
import { writeWorld } from "../src/world-writer.js";
import { Catalog } from "../src/catalog.js";
import { Script, VideoPlan } from "@erkasa/contracts";
import { RUN_FILES, stepWorld, writeJson } from "../src/steps.js";

const FIXTURE = join(repoRoot(), "ai-worker", "demo", "first-impression");

/** A run folder of the first-impression demo: script, its world and the directed plan (no video, no voice). */
async function run(): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), "erkasa-p6-"));
  const script = Script.parse(JSON.parse(readFileSync(join(FIXTURE, "script.json"), "utf8")));
  const worldAnswer = JSON.parse(readFileSync(join(FIXTURE, "world-1.json"), "utf8")).value;
  const w = await stepWorld(
    dir,
    script,
    new Scripted(() => worldAnswer),
    new Catalog(join(repoRoot(), "assets")),
    "first_impression",
  );
  writeJson(join(dir, "script.json"), script);
  writeJson(join(dir, "script.world.json"), w.script);
  const { plan } = draftToPlan(draft(), w.script, { projectId: "first-impression", voiceId: "v" });
  writeJson(join(dir, RUN_FILES.plan), plan);
  return dir;
}

class Scripted implements Llm {
  calls: JsonRequest[] = [];
  constructor(private readonly answer: (req: JsonRequest) => unknown) {}
  async json(req: JsonRequest): Promise<JsonResponse> {
    this.calls.push(req);
    const value = this.answer(req);
    return {
      value,
      text: JSON.stringify(value),
      usage: { label: req.label, model: "claude-sonnet-5-5", inputTokens: 100, outputTokens: 50, ms: 1 },
    };
  }
}

const draft = (): Draft => JSON.parse(readFileSync(join(FIXTURE, "plan-1.json"), "utf8")).value as Draft;

describe("render in parts", () => {
  it("splits frames evenly, preferring scene cuts near the middle", () => {
    expect(splitRanges(300, 2)).toEqual([
      [0, 150],
      [150, 300],
    ]);
    expect(splitRanges(300, 2, [0, 140, 300])).toEqual([
      [0, 140],
      [140, 300],
    ]);
    expect(splitRanges(20, 4)).toEqual([[0, 20]]); // never more parts than whole seconds
    const r = splitRanges(5400, 3, [0, 1700, 3700]);
    expect(r[0]?.[0]).toBe(0);
    expect(r.at(-1)?.[1]).toBe(5400);
    expect(r.every((x, i) => i === 0 || x[0] === r[i - 1]?.[1])).toBe(true);
  });

  it("estimates a three-minute film inside the limit with two workers", () => {
    expect(estimateRender(180, 30, 2)).toBeLessThan(20 * 60);
  });
});

describe("cheap model for bulk drawings", () => {
  it("defaults to the small model and can be switched off", () => {
    delete process.env["ERKASA_ASSET_MODEL"];
    expect(assetModel()).toBe("claude-haiku-5-5");
    process.env["ERKASA_ASSET_MODEL"] = "same";
    expect(assetModel()).toBeUndefined();
    process.env["ERKASA_ASSET_MODEL"] = "claude-sonnet-5-5";
    expect(assetModel()).toBe("claude-sonnet-5-5");
    delete process.env["ERKASA_ASSET_MODEL"];
  });
});

describe("the producer's style choice", () => {
  it("overrides the model's style and tells it the choice", async () => {
    const world = JSON.parse(readFileSync(join(FIXTURE, "world-1.json"), "utf8")).value;
    const script = Script.parse(JSON.parse(readFileSync(join(FIXTURE, "script.json"), "utf8")));
    const llm = new Scripted(() => ({ ...world, style: "storybook" }));
    const res = await writeWorld(llm, script, new Catalog(join(repoRoot(), "assets")), {
      worldId: "w",
      style: "sunset_warm",
    });
    expect(res.spec?.style).toBe("sunset_warm");
    expect(llm.calls[0]?.messages[0]?.content).toMatch(/producer chose the look.*sunset_warm/);
  });
});

describe("storyboard and redo of one scene", () => {
  let dir = "";
  const maybe = it;
  beforeAll(async () => {
    dir = await run();
  });

  maybe("shows every scene as two stills with its length", () => {
    const sb = showStoryboard(dir);
    expect(sb.scenes).toHaveLength(8);
    expect(
      sb.scenes.every((s) => s.frames.length === 2 && existsSync(join(dir, s.frames[0] as string))),
    ).toBe(true);
    expect(sb.totalSec).toBeGreaterThan(30);
    expect(sb.estimate.renderSec).toBeGreaterThan(0);
  });

  maybe("redoes one scene in the producer's words, keeps the others, redraws only its stills", async () => {
    const before = VideoPlan.parse(JSON.parse(readFileSync(join(dir, "video-plan.json"), "utf8")));
    const stillBefore = (id: string): number => statSync(join(dir, "storyboard", `${id}-a.jpg`)).mtimeMs;
    const t4 = stillBefore("s04");
    await new Promise((r) => setTimeout(r, 30));
    const d = draft();
    const llm = new Scripted(() => ({ ...d, scenes: [d.scenes[2]] }));
    const r = await redoRunScene(llm, dir, "s03", { request: "show the scale tipping" });
    expect(llm.calls[0]?.messages[0]?.content).toMatch(/producer asks: "show the scale tipping"/);
    expect(llm.calls[0]?.label).toBe("redo-s03#1");
    const after = VideoPlan.parse(JSON.parse(readFileSync(join(dir, "video-plan.json"), "utf8")));
    expect(after.scenes).toHaveLength(8);
    expect(after.scenes.map((s: { sceneId: string }) => s.sceneId)).toEqual(
      before.scenes.map((s: { sceneId: string }) => s.sceneId),
    );
    expect(after.scenes[3]).toEqual(before.scenes[3]); // the neighbours are untouched
    expect(r.storyboard.scenes).toHaveLength(8);
    expect(stillBefore("s04")).toBe(t4); // only the redone scene was redrawn
    expect(storyboardOf(dir)?.scenes).toHaveLength(8);
  });

  maybe("leaves the plan alone when no version compiles, and can step back", async () => {
    const planFile = join(dir, "video-plan.json");
    const before = readFileSync(planFile, "utf8");
    const llm = new Scripted(() => ({ ...draft(), scenes: [] }));
    const r = await redoRunScene(llm, dir, "s05", { maxAttempts: 1 } as never);
    expect(r.clean).toBe(false);
    expect(r.issues.length).toBeGreaterThan(0);
    expect(readFileSync(planFile, "utf8")).toBe(before);
    expect(undoRedo(dir)).toBe(true); // the earlier successful redo left a previous plan
    expect(readFileSync(planFile, "utf8")).not.toBe("");
  });
});
