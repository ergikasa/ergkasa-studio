import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileVideo } from "@erkasa/compiler";
import { Script, type VideoPlan } from "@erkasa/contracts";
import { describe, expect, it } from "vitest";
import { Catalog } from "../src/catalog.js";
import { reviewDirection } from "../src/direction.js";
import { repoRoot } from "../src/env.js";
import type { JsonRequest, JsonResponse, Llm } from "../src/llm.js";
import { draftToPlan, type Draft } from "../src/plan-draft.js";
import { plannerPrompt } from "../src/planner.js";
import { stepWorld } from "../src/steps.js";
import { draftToWorld, type WorldDraft } from "../src/world-writer.js";

const DEMO = join(repoRoot(), "ai-worker", "demo", "first-impression");
const read = <T>(f: string): T => JSON.parse(readFileSync(join(DEMO, f), "utf8")) as T;
const library = new Catalog(join(repoRoot(), "assets"));
const script = Script.parse(read("script.json"));
const worldDraft = (): WorldDraft => read<{ value: WorldDraft }>("world-1.json").value;
const draft = (): Draft => read<{ value: Draft }>("plan-1.json").value;

class OneAnswer implements Llm {
  constructor(private readonly value: unknown) {}
  async json(req: JsonRequest): Promise<JsonResponse> {
    return {
      value: this.value,
      text: JSON.stringify(this.value),
      usage: { label: req.label, model: "claude-sonnet-5-5", inputTokens: 1, outputTokens: 1, ms: 1 },
    };
  }
}

async function world(): Promise<{ catalog: Catalog; script: Script }> {
  const dir = mkdtempSync(join(tmpdir(), "erkasa-fi-"));
  const w = await stepWorld(dir, script, new OneAnswer(worldDraft()), library, "first_impression");
  return { catalog: new Catalog([w.dir as string, library.assetsDir]), script: w.script };
}

function review(plan: VideoPlan, s: Script, catalog: Catalog) {
  const c = compileVideo(plan, { assets: catalog.source, seed: 1 });
  expect(c.issues.filter((i) => i.level === "error")).toEqual([]);
  const durations = Object.fromEntries(c.scenes.map((x) => [x.sceneId, x.duration / 30]));
  return reviewDirection({ plan, script: s, durations, compileIssues: c.issues, world: true }).map(
    (i) => i.code,
  );
}

describe("staged sets inside a world", () => {
  it("builds the interview set into the world and shows it to the planner", async () => {
    const { catalog, script: s } = await world();
    expect(catalog.worldSets()).toEqual({ interview_office: "wld_place_interview" });
    const prompt = plannerPrompt(s, catalog);
    expect(prompt).toMatch(/interview_office \(background wld_place_interview\)/);
    expect(catalog.props.map((p) => p.id)).toEqual(["wld_prop_scale"]); // set furniture is placed by the set
    expect(prompt).toMatch(/job in this story: weighs the same work/);
  });

  it("asks for a function and scenes for every object", () => {
    const d = worldDraft();
    d.props.push({
      key: "gloves",
      kind: "library",
      from: "prop_desk_side_01",
      material: "",
      motif: "none",
      function: "",
      scenes: "",
      brief: "",
      size: "none",
    });
    const r = draftToWorld(d, script, library, "fi");
    expect(r.issues.join("\n")).toMatch(
      /gloves\): give its function in the story and the scenes that use it/,
    );
  });
});

describe("directed review", () => {
  it("passes the directed first-impression plan: staged, acted, every object with a job", async () => {
    const { catalog, script: s } = await world();
    const { plan } = draftToPlan(draft(), s, { projectId: "t", voiceId: "v" });
    expect(plan?.scenes.every((x) => x.direction)).toBe(true);
    expect(review(plan as VideoPlan, s, catalog)).toEqual([]);
  });

  it("finds an illustration, a decorative object, a one-note actor and a repeated picture", async () => {
    const { catalog, script: s } = await world();
    const d = draft();
    const s6 = d.scenes[5];
    const s7 = d.scenes[6];
    const s8 = d.scenes[7];
    if (!s6 || !s7 || !s8) throw new Error("demo plan has 8 scenes");
    // s06: the scale loses its job; s07: Nora only presents; s08: nothing changes and it repeats s07's picture
    s6.layers = s6.layers.map((l) => (l.id === "scale" ? { ...l, purpose: "" } : l));
    s7.layers = s7.layers.map((l) =>
      l.id === "nora" ? { ...l, actions: (l.actions ?? []).slice(0, 1) } : l,
    );
    s8.shot = { ...s7.shot };
    s8.layers = s7.layers.map((l) => ({ ...l, actions: [] }));
    s8.camera = [{ move: "static", at: "start", to: 0 }];
    const { plan } = draftToPlan(d, s, { projectId: "t", voiceId: "v" });
    const codes = review(plan as VideoPlan, s, catalog);
    expect(codes).toContain("PURPOSELESS_LAYER");
    expect(codes).toContain("ONE_NOTE_ACTOR");
    expect(codes).toContain("NO_VISIBLE_CHANGE");
    expect(codes).toContain("REPEATED_PICTURE");
  });

  it("limits scenes that only state the idea", async () => {
    const { catalog, script: s } = await world();
    const d = draft();
    for (const sc of d.scenes.slice(0, 4)) if (sc.direction) sc.direction.demonstration = "statement";
    const { plan } = draftToPlan(d, s, { projectId: "t", voiceId: "v" });
    expect(review(plan as VideoPlan, s, catalog)).toContain("TOO_MANY_STATEMENTS");
  });

  it("leaves plans without direction to the old rules", () => {
    const plan = JSON.parse(
      readFileSync(join(repoRoot(), "engine-worker", "demo", "procrastination-v2.video-plan.json"), "utf8"),
    ) as VideoPlan;
    expect(plan.scenes.some((x) => x.direction)).toBe(false);
  });
});
