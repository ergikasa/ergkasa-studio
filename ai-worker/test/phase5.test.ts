import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compileVideo } from "@erkasa/compiler";
import { Script, type VideoPlan } from "@erkasa/contracts";
import { describe, expect, it } from "vitest";
import { Catalog } from "../src/catalog.js";
import { criticIssues, type CriticResult } from "../src/critic.js";
import { reviewDirection } from "../src/direction.js";
import { repoRoot } from "../src/env.js";
import { apiMessages } from "../src/llm.js";
import { draftToPlan, type Draft } from "../src/plan-draft.js";
import { stepWorld } from "../src/steps.js";
import type { JsonRequest, JsonResponse, Llm } from "../src/llm.js";
import type { WorldDraft } from "../src/world-writer.js";

const DEMO = join(repoRoot(), "ai-worker", "demo", "first-impression");
const read = <T>(f: string): T => JSON.parse(readFileSync(join(DEMO, f), "utf8")) as T;
const library = new Catalog(join(repoRoot(), "assets"));
const script0 = Script.parse(read("script.json"));
const draft = (): Draft => read<{ value: Draft }>("plan-1.json").value;

class One implements Llm {
  constructor(private readonly value: unknown) {}
  async json(req: JsonRequest): Promise<JsonResponse> {
    return {
      value: this.value,
      text: "",
      usage: { label: req.label, model: "m", inputTokens: 1, outputTokens: 1, ms: 1 },
    };
  }
}

async function world(): Promise<{ catalog: Catalog; script: Script }> {
  const dir = mkdtempSync(join(tmpdir(), "erkasa-p5-"));
  const w = await stepWorld(
    dir,
    script0,
    new One(read<{ value: WorldDraft }>("world-1.json").value),
    library,
    "first_impression",
  );
  return { catalog: new Catalog([w.dir as string, library.assetsDir]), script: w.script };
}

function codes(plan: VideoPlan, s: Script, catalog: Catalog): string[] {
  const c = compileVideo(plan, { assets: catalog.source, seed: 1 });
  const durations = Object.fromEntries(c.scenes.map((x) => [x.sceneId, x.duration / 30]));
  return reviewDirection({ plan, script: s, durations, compileIssues: c.issues, world: true }).map(
    (i) => i.code,
  );
}

describe("pacing by tone", () => {
  it("asks a long tense scene to move the camera, and keeps calm scenes calm", async () => {
    const { catalog, script } = await world();
    const sc = script.scenes.map((x) =>
      x.sceneId === "s03"
        ? { ...x, beat: "tension" as const }
        : x.sceneId === "s08"
          ? { ...x, beat: "resolve" as const }
          : x,
    );
    const s = Script.parse({ ...script, scenes: sc });
    const d = draft();
    const s3 = d.scenes[2];
    const s8 = d.scenes[7];
    if (!s3 || !s8) throw new Error("8 scenes");
    s3.camera = [{ move: "static", at: "start", to: 0 }];
    s8.camera = [{ move: "shake", at: "start", to: 0.5 }];
    const { plan } = draftToPlan(d, s, { projectId: "t", voiceId: "v" });
    const found = codes(plan as VideoPlan, s, catalog);
    expect(found).toContain("PACING_JOLT_IN_CALM");
    // PACING_STATIC_TENSION only fires on scenes longer than five seconds
    const c = compileVideo(plan as VideoPlan, { assets: catalog.source, seed: 1 });
    const long = (c.scenes.find((x) => x.sceneId === "s03")?.duration ?? 0) / 30 > 5;
    expect(found.includes("PACING_STATIC_TENSION")).toBe(long);
  });
});

describe("choreography", () => {
  it("brings people who enter at the start in one after another", async () => {
    const { script } = await world();
    const d = draft();
    const sc = d.scenes.find((x) => x.layers.filter((l) => l.type === "actor").length >= 2);
    if (!sc) return; // the demo has a two-person scene; guard keeps the test honest if it changes
    for (const l of sc.layers) if (l.type === "actor") Object.assign(l, { enter: "fade", enterAt: "start" });
    const { plan } = draftToPlan(d, script, { projectId: "t", voiceId: "v" });
    const idx = d.scenes.indexOf(sc);
    const actors = (plan as VideoPlan).scenes[idx]?.layers.filter((l) => l.type === "actor") ?? [];
    const ats = actors.map((l) => JSON.stringify(l.in?.at));
    expect(new Set(ats).size).toBe(ats.length);
  });
});

describe("visual critic", () => {
  it("turns blocking findings into repair issues and leaves minor ones in the report", async () => {
    const { script } = await world();
    const { plan } = draftToPlan(draft(), script, { projectId: "t", voiceId: "v" });
    const res: CriticResult = {
      verdict: "ok",
      sheets: [],
      usage: [],
      findings: [
        { sceneId: "s02", kind: "overlap", severity: "blocking", note: "two people overlap" },
        { sceneId: "s03", kind: "empty_frame", severity: "minor", note: "a bit empty" },
      ],
    };
    const issues = criticIssues(plan as VideoPlan, res);
    expect(issues.map((i) => [i.code, i.path])).toEqual([["VISUAL_OVERLAP", "scenes[1]"]]);
  });

  it("sends pictures with the last user message", () => {
    const req: JsonRequest = {
      label: "critic#1",
      system: "s",
      messages: [{ role: "user", content: "look" }],
      schema: {},
      images: [{ mediaType: "image/jpeg", base64: "AAAA" }],
    };
    const m = apiMessages(req)[0] as { content: Array<{ type: string }> };
    expect(m.content.map((c) => c.type)).toEqual(["image", "text"]);
    expect(apiMessages({ ...req, images: undefined })).toEqual(req.messages);
  });
});
