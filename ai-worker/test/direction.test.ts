import { Script, VideoPlan } from "@erkasa/contracts";
import { describe, expect, it } from "vitest";
import { reviewDirection } from "../src/direction.js";

/** The shape of the first procrastination video: one room, wide shots, people standing, changing cast. */
function firstVersion(): { plan: VideoPlan; script: Script } {
  const narration =
    "You are not lazy. You are avoiding a feeling, and that is why you keep putting things off.";
  const actor = (id: string, assetId: string) => ({
    id,
    type: "actor" as const,
    assetId,
    place: { anchor: "ground" as const, x: 0.3, scale: 1 },
    facing: "front" as const,
    expression: "neutral",
    actions: [],
    speaks: true,
  });
  const scenes = [
    "char_arti_01",
    "char_era_01",
    "char_arti_01",
    "char_drini_01",
    "char_arti_01",
    "char_arti_01",
  ].map((who, i) => ({
    schema: "erkasa.scene-plan/1" as const,
    sceneId: `s0${i + 1}`,
    engine: "2d" as const,
    narration,
    durationPolicy: { mode: "fitNarration" as const, padAfterSec: 0.4 },
    background: { assetId: "bg_home_living_01" },
    layers: [actor("p", who)],
    effects: [],
    camera: [],
    sfx: [],
    transitionOut: { type: "cut" as const, durationSec: 0 },
  }));
  const plan = VideoPlan.parse({
    schema: "erkasa.video-plan/1",
    projectId: "t",
    language: "en",
    format: "9:16",
    fps: 30,
    voiceId: "v",
    scenes,
  });
  const script = Script.parse({
    schema: "erkasa.script/1",
    title: "Procrastination",
    topic: "why we procrastinate",
    theme: "psychology",
    language: "en",
    hook: "You are not lazy.",
    cast: [{ role: "protagonist", characterId: "char_arti_01", description: "a student with a report due" }],
    scenes: scenes.map((s) => ({ sceneId: s.sceneId, narration, visualIdea: "x" })),
    estimatedSec: 30,
  });
  return { plan, script };
}

describe("direction review", () => {
  it("flags every defect of the first procrastination video", () => {
    const { plan, script } = firstVersion();
    const durations = Object.fromEntries(plan.scenes.map((s) => [s.sceneId, 5]));
    const codes = new Set(reviewDirection({ plan, script, durations, compileIssues: [] }).map((i) => i.code));
    expect([...codes].sort()).toEqual(
      [
        "BACKGROUND_OVERUSED",
        "CAST_CHANGE",
        "FLAT_EMOTION",
        "SAME_SHOT_REPEATED",
        "SHOT_VARIETY",
        "STATIC_ACTOR",
        "WEAK_HOOK_SHOT",
      ].sort(),
    );
  });

  it("passes a directed version and promotes out-of-frame warnings", () => {
    const { plan, script } = firstVersion();
    const places = [
      "bg_home_bedroom_night_01",
      "bg_home_living_01",
      "bg_office_01",
      "bg_cafe_01",
      "bg_home_bedroom_night_01",
      "bg_city_street_01",
    ];
    const shots = ["close", "medium", "wide", "insert", "medium", "close"] as const;
    const faces = ["sad", "angry", "thinking", "surprised", "neutral", "happy"];
    plan.scenes.forEach((s, i) => {
      s.background.assetId = places[i] as string;
      s.shot = { size: shots[i] as (typeof shots)[number] };
      const a = s.layers[0];
      if (a?.type === "actor") {
        a.assetId = "char_arti_01";
        a.expression = faces[i] as string;
        a.actions = [{ action: "use_phone", at: "start" }];
      }
    });
    const durations = Object.fromEntries(plan.scenes.map((s) => [s.sceneId, 5]));
    expect(reviewDirection({ plan, script, durations, compileIssues: [] })).toEqual([]);
    const late = reviewDirection({
      plan,
      script,
      durations,
      compileIssues: [{ level: "warning", code: "OUT_OF_FRAME", path: "scenes[2].layers.p", message: "cut" }],
    });
    expect(late.map((i) => [i.level, i.code])).toEqual([["error", "OUT_OF_FRAME"]]);
  });
});

describe("procrastination v2 (the directed reference)", () => {
  it("compiles cleanly and passes the director's review", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { compileVideo } = await import("@erkasa/compiler");
    const { Catalog } = await import("../src/catalog.js");
    const { repoRoot } = await import("../src/env.js");
    const demo = join(repoRoot(), "engine-worker", "demo");
    const plan = VideoPlan.parse(
      JSON.parse(readFileSync(join(demo, "procrastination-v2.video-plan.json"), "utf8")),
    );
    const script = Script.parse(
      JSON.parse(readFileSync(join(demo, "procrastination-v2.script.json"), "utf8")),
    );
    const res = compileVideo(plan, { assets: new Catalog(join(repoRoot(), "assets")).source, seed: 1 });
    expect(res.issues).toEqual([]);
    const durations = Object.fromEntries(res.scenes.map((s) => [s.sceneId, s.duration / 30]));
    expect(reviewDirection({ plan, script, durations, compileIssues: res.issues })).toEqual([]);
  });
});
