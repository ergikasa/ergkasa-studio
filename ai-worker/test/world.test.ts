import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Script } from "@erkasa/contracts";
import { describe, expect, it } from "vitest";
import { Catalog } from "../src/catalog.js";
import { reviewDirection } from "../src/direction.js";
import { repoRoot } from "../src/env.js";
import type { JsonRequest, JsonResponse, Llm } from "../src/llm.js";
import { RecordingLlm, ReplayLlm } from "../src/llm-record.js";
import { plannerPrompt } from "../src/planner.js";
import { stepWorld } from "../src/steps.js";
import { castIntoWorld, draftToWorld, writeWorld, type WorldDraft } from "../src/world-writer.js";

const library = new Catalog(join(repoRoot(), "assets"));
const E2E = join(repoRoot(), "ai-worker", "demo", "world-e2e");
const script = Script.parse(JSON.parse(readFileSync(join(E2E, "script.json"), "utf8")));
const castleDraft = (): WorldDraft =>
  (JSON.parse(readFileSync(join(E2E, "castle", "world-1.json"), "utf8")) as { value: WorldDraft }).value;

class ScriptedLlm implements Llm {
  readonly requests: JsonRequest[] = [];
  constructor(private readonly answers: unknown[]) {}
  async json(req: JsonRequest): Promise<JsonResponse> {
    this.requests.push(req);
    const value = this.answers[Math.min(this.requests.length, this.answers.length) - 1];
    return {
      value,
      text: JSON.stringify(value),
      usage: { label: req.label, model: "claude-sonnet-5-5", inputTokens: 1000, outputTokens: 200, ms: 1 },
    };
  }
}

describe("world writer", () => {
  it("turns a draft into a World Spec with one world character per script cast member", () => {
    const r = draftToWorld(castleDraft(), script, library, "coin");
    expect(r.issues).toEqual([]);
    expect(r.spec?.cast.map((c) => c.id)).toEqual(["wld_char_1", "wld_char_2", "wld_char_3"]);
    expect(r.castMap).toEqual({
      char_arti_01: "wld_char_1",
      char_drini_01: "wld_char_2",
      char_bardhi_01: "wld_char_3",
    });
    expect(r.spec?.places[0]?.id).toBe("wld_place_main");
    expect(castIntoWorld(script, r.castMap).cast?.map((c) => c.characterId)).toEqual([
      "wld_char_1",
      "wld_char_2",
      "wld_char_3",
    ]);
  });

  it("lists what the model must fix: a missing cast member, an unknown cast id, a wrong library id", () => {
    const d = castleDraft();
    d.cast = [{ ...(d.cast[0] as WorldDraft["cast"][number]), plays: "char_era_01" }, ...d.cast.slice(1, 2)];
    d.props.push({
      key: "x",
      kind: "library",
      from: "bg_office_01",
      material: "",
      motif: "none",
      function: "decoration",
      scenes: "s01",
      brief: "",
      size: "none",
    });
    const r = draftToWorld(d, script, library, "coin");
    expect(r.spec).toBeUndefined();
    expect(r.issues.join("\n")).toMatch(/plays 'char_era_01', which is not in the script cast/);
    expect(r.issues.join("\n")).toMatch(/nobody plays char_arti_01/);
    expect(r.issues.join("\n")).toMatch(/'bg_office_01' is not a library object or metaphor/);
  });

  it("adds the host chosen by the user as a library character of the world", () => {
    const r = draftToWorld(castleDraft(), script, library, "coin", "char_host_01");
    expect(r.hostId).toBe("wld_char_host");
    expect(r.spec?.cast.find((c) => c.id === "wld_char_host")?.from).toBe("char_host_01");
  });

  it("sends the problems back and accepts the corrected world", async () => {
    const bad = castleDraft();
    bad.cast = bad.cast.slice(0, 2);
    const llm = new ScriptedLlm([bad, castleDraft()]);
    const r = await writeWorld(llm, script, library, { worldId: "coin" });
    expect(r.attempts).toBe(2);
    expect(r.spec).toBeDefined();
    expect(llm.requests[1]?.messages.at(-1)?.content).toMatch(/nobody plays char_bardhi_01/);
  });
});

describe("world step and world catalog", () => {
  it("builds the world, and the planner then sees only the world's cast, places and objects", async () => {
    const dir = mkdtempSync(join(tmpdir(), "erkasa-world-"));
    const res = await stepWorld(dir, script, new ScriptedLlm([castleDraft()]), library, "coin");
    expect(res.dir && existsSync(join(res.dir, "manifest.json"))).toBe(true);
    const cat = new Catalog([res.dir as string, library.assetsDir]);
    expect(cat.world).toEqual({ id: "coin", style: "storybook" });
    expect(cat.characters.map((c) => c.id).sort()).toEqual(["wld_char_1", "wld_char_2", "wld_char_3"]);
    expect(cat.characters.find((c) => c.id === "wld_char_1")?.plays).toBe("char_arti_01");
    expect(cat.backgrounds.map((b) => b.id)).toEqual(["wld_place_main"]);
    expect(cat.props.map((p) => p.id).sort()).toEqual(["wld_prop_board", "wld_prop_coin", "wld_prop_scale"]);
    expect(cat.overlays.length).toBeGreaterThan(0); // screen textures still come from the library
    const prompt = plannerPrompt(res.script, cat);
    expect(prompt).toMatch(/This video has its own world/);
    expect(prompt).not.toMatch(/char_arti_01:/);
    expect(prompt).not.toMatch(/bg_office/);
  });

  it("copies and regrades library assets the generators cannot draw yet", async () => {
    const d = castleDraft();
    d.places.push({
      key: "kitchen",
      kind: "library",
      from: "bg_home_kitchen_01",
      time: "day",
      sideA: "",
      sideB: "",
      parts: "",
    });
    d.props.push({
      key: "hourglass",
      kind: "library",
      from: "met_hourglass_01",
      material: "",
      motif: "none",
      function: "time running out for the second heir",
      scenes: "s04",
      brief: "",
      size: "none",
    });
    const dir = mkdtempSync(join(tmpdir(), "erkasa-world-"));
    const res = await stepWorld(dir, script, new ScriptedLlm([d]), library, "coin");
    const cat = new Catalog([res.dir as string, library.assetsDir]);
    expect(cat.backgrounds.map((b) => b.id)).toContain("wld_place_kitchen");
    const met = cat.source.meta("wld_prop_hourglass");
    expect(met.capabilities["recipes"]).toBe("met_hourglass_01");
    const original = readFileSync(
      join(library.assetsDir, "metaphors", "met_hourglass_01", "asset.svg"),
      "utf8",
    );
    const copy = cat.source.text("wld_prop_hourglass", "asset.svg");
    expect(copy).not.toBe(original); // graded with the world's style kit
  });

  it("goes on with the library when the model never gives a valid world", async () => {
    const bad = castleDraft();
    bad.cast = [];
    const dir = mkdtempSync(join(tmpdir(), "erkasa-world-"));
    const res = await stepWorld(dir, script, new ScriptedLlm([bad]), library, "coin");
    expect(res.dir).toBeUndefined();
    expect(res.script).toBe(script);
    expect(existsSync(join(dir, "world-issues.json"))).toBe(true);
  });

  it("keeps the library catalog as it was", () => {
    expect(library.world).toBeUndefined();
    expect(library.characters.some((c) => c.id === "char_arti_01")).toBe(true);
    expect(library.roots).toEqual([library.assetsDir]);
  });
});

describe("direction review in a world", () => {
  it("lets a world return to its few places", () => {
    const plan = JSON.parse(
      readFileSync(join(repoRoot(), "engine-worker", "demo", "world-poc", "coin.video-plan.json"), "utf8"),
    );
    const durations = Object.fromEntries(plan.scenes.map((s: { sceneId: string }) => [s.sceneId, 6]));
    const codes = (world: boolean) =>
      reviewDirection({ plan, script, durations, compileIssues: [], world }).map((i) => i.code);
    expect(codes(false)).toContain("BACKGROUND_OVERUSED");
    expect(codes(true)).not.toContain("BACKGROUND_OVERUSED");
  });
});

describe("recording and replay", () => {
  it("records every answer and replays it, falling back to the latest recorded repair turn", async () => {
    const dir = mkdtempSync(join(tmpdir(), "erkasa-rec-"));
    const rec = new RecordingLlm(new ScriptedLlm([{ a: 1 }]), join(dir, "llm"));
    await rec.json({ label: "plan#1", system: "s", messages: [{ role: "user", content: "u" }], schema: {} });
    const replay = new ReplayLlm(dir);
    const again = await replay.json({ label: "plan#3", system: "s", messages: [], schema: {} });
    expect(again.value).toEqual({ a: 1 });
    expect(again.usage.inputTokens).toBe(1000);
    mkdirSync(join(dir, "bare"));
    writeFileSync(join(dir, "bare", "world-1.json"), JSON.stringify({ label: "world#1", value: { b: 2 } }));
    const est = await new ReplayLlm(join(dir, "bare")).json({
      label: "world#1",
      system: "x".repeat(400),
      messages: [],
      schema: {},
    });
    expect(est.usage.label).toMatch(/estimated/);
    expect(est.usage.inputTokens).toBe(100);
  });
});
