import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RenderTimeline, ScenePlan, Script, TaskResult } from "../src/index.js";
import { renderSchemas } from "../src/json-schema.js";
import { CONTRACTS_DIR } from "./helpers.js";

/** Rules that JSON Schema cannot express; enforced in TypeScript (and later in the Java validator). */
const fixture = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(CONTRACTS_DIR, "fixtures", "valid", name), "utf8")) as Record<string, unknown>;

describe("cross-field rules", () => {
  it("rejects duplicate layer ids in a scene", () => {
    const scene = fixture("scene-plan.hook-scene.json");
    const layers = scene["layers"] as Array<Record<string, unknown>>;
    layers[1] = { ...layers[1], id: "drini" };
    expect(ScenePlan.safeParse(scene).success).toBe(false);
  });

  it("requires the script hook to open scene 1, and unique scene ids", () => {
    const script = fixture("script.habits.json");
    expect(Script.safeParse(script).success).toBe(true);
    expect(Script.safeParse({ ...script, hook: "A different opening." }).success).toBe(false);
    const scenes = script["scenes"] as Array<Record<string, unknown>>;
    expect(
      Script.safeParse({ ...script, scenes: [scenes[0], { ...scenes[1], sceneId: "s01" }] }).success,
    ).toBe(false);
  });

  it("rejects a FAILED task result without an error", () => {
    const res = fixture("task-result.render-failed.json");
    delete res["error"];
    expect(TaskResult.safeParse(res).success).toBe(false);
  });

  it("rejects keyframes past the end of the scene", () => {
    const tl = fixture("timeline.one-scene.json");
    const scene = (tl["scenes"] as Array<Record<string, unknown>>)[0] as Record<string, unknown>;
    scene["duration"] = 50;
    expect(RenderTimeline.safeParse(tl).success).toBe(false);
  });

  it("fills defaults: 9:16 format and fps 30", () => {
    const plan = ScenePlan.parse(fixture("scene-plan.hook-scene.json"));
    expect(plan.layers[0]?.place.scale).toBe(1);
  });
});

describe("exported JSON Schema", () => {
  it("committed json-schema/ files match the Zod contracts (run `pnpm contracts:gen` if this fails)", () => {
    for (const [name, text] of Object.entries(renderSchemas())) {
      const committed = readFileSync(join(CONTRACTS_DIR, "json-schema", `${name}.schema.json`), "utf8");
      expect(committed, `${name}.schema.json is stale`).toBe(text);
    }
  });
});
