import { join } from "node:path";
import { compileVideo } from "@erkasa/compiler";
import { Script } from "@erkasa/contracts";
import { describe, expect, it } from "vitest";
import { Catalog } from "../src/catalog.js";
import { repoRoot } from "../src/env.js";
import type { JsonRequest, JsonResponse, Llm } from "../src/llm.js";
import { llmCost } from "../src/llm.js";
import { DRAFT_SCHEMA, draftToPlan, parseAnchor, type Draft } from "../src/plan-draft.js";
import { planVideo, plannerPrompt } from "../src/planner.js";
import { toScript } from "../src/script-writer.js";
import { charsToWords, providerSettings, toAlignment, type CharAlignment } from "../src/voice.js";
import { loadVoiceCatalog, narratorLine, resolvePreset } from "../src/voice-catalog.js";

const catalog = new Catalog(join(repoRoot(), "assets"));

const script: Script = Script.parse({
  schema: "erkasa.script/1",
  title: "Saving vs investing",
  topic: "saving vs investing",
  theme: "money",
  language: "en",
  hook: "Saving money will not make you rich.",
  scenes: [
    {
      sceneId: "s01",
      narration: "Saving money will not make you rich. Not on its own.",
      visualIdea: "A man with a jar of coins frowns.",
    },
    {
      sceneId: "s02",
      narration:
        "Invest two hundred dollars a month, and in thirty years it can grow past two hundred thousand.",
      visualIdea: "Linear vs exponential chart.",
    },
  ],
  estimatedSec: 9,
});

/** A layer with every field set to "unused"; tests override what they need. */
function layer(
  over: Partial<Draft["scenes"][number]["layers"][number]>,
): Draft["scenes"][number]["layers"][number] {
  return {
    id: "x",
    type: "object",
    assetId: "",
    x: 0.5,
    y: -1,
    scale: 1,
    region: "none",
    facing: "front",
    expression: "",
    speaks: false,
    holding: "none",
    enter: "none",
    enterAt: "start",
    actions: [],
    animations: [],
    text: "",
    textStyle: "",
    highlight: [],
    chart: "none",
    chartData: [],
    unit: "",
    ...over,
  };
}

function goodDraft(): Draft {
  return {
    scenes: [
      {
        sceneId: "s01",
        background: "bg_home_living_01",
        shot: { size: "medium", subject: "" },
        layers: [
          layer({
            id: "drini",
            type: "actor",
            assetId: "char_drini_01",
            x: 0.35,
            expression: "sad",
            speaks: true,
            actions: [{ action: "shake_head", at: "word:rich", durationSec: 0, toX: -1, expression: "" }],
          }),
          layer({
            id: "title",
            type: "text",
            region: "top-safe",
            enter: "pop",
            enterAt: "word:rich",
            text: "NOT RICH",
            textStyle: "hook_impact",
            highlight: ["RICH"],
          }),
        ],
        camera: [{ move: "punch_in", at: "word:rich", to: 1.15 }],
        effects: [],
        transition: "whip",
        transitionDirection: "left",
      },
      {
        sceneId: "s02",
        background: "bg_trading_room_01",
        shot: { size: "wide", subject: "" },
        layers: [
          layer({
            id: "bardhi",
            type: "actor",
            assetId: "char_bardhi_01",
            x: 0.2,
            scale: 0.9,
            speaks: true,
            actions: [{ action: "point_side", at: "word:grow", durationSec: 0, toX: -1, expression: "" }],
          }),
          layer({
            id: "growth",
            type: "chart",
            x: 0.56,
            y: 0.45,
            scale: 0.82,
            enter: "draw_on",
            enterAt: "word:thirty",
            chart: "linear_vs_exponential",
            chartData: [
              { label: "Saved", value: 72000 },
              { label: "Invested", value: 200000 },
            ],
            unit: "$",
          }),
        ],
        camera: [{ move: "static", at: "start", to: 0 }],
        effects: [],
        transition: "cut",
        transitionDirection: "none",
      },
    ],
  };
}

describe("voice alignment", () => {
  const text = "Not on its own.";
  const chars = [...text];
  const a: CharAlignment = {
    characters: chars,
    character_start_times_seconds: chars.map((_, i) => i * 0.05),
    character_end_times_seconds: chars.map((_, i) => i * 0.05 + 0.05),
  };

  it("turns character timings into the same word tokens the compiler uses", () => {
    const words = charsToWords(a);
    expect(words.map((w) => w.word)).toEqual(["Not", "on", "its", "own."]);
    expect(words[0]).toEqual({ word: "Not", start: 0, end: 0.15 });
    expect(words[3]?.end).toBeCloseTo(0.75);
  });

  it("builds a valid alignment document", () => {
    const doc = toAlignment("s01", "file://voice/s01.mp3", a, 0.9);
    expect(doc.durationSec).toBe(0.9);
    expect(doc.words).toHaveLength(4);
  });
});

describe("plan draft", () => {
  it("parses the short anchor syntax", () => {
    expect(parseAnchor("start")).toBe("start");
    expect(parseAnchor("sec:1.5")).toEqual({ sec: 1.5 });
    expect(parseAnchor("word:habits#2")).toEqual({ word: "habits", occurrence: 2 });
    expect(parseAnchor("after:drini.walk+0.3")).toEqual({ after: "drini.walk", offsetSec: 0.3 });
    expect(parseAnchor("when he smiles")).toHaveProperty("error");
  });

  it("keeps the schema inside the structured-outputs subset", () => {
    const forbidden = [
      "minimum",
      "maximum",
      "minLength",
      "maxLength",
      "maxItems",
      "pattern",
      "oneOf",
      "anyOf",
    ];
    const walk = (node: unknown, path: string): void => {
      if (!node || typeof node !== "object") return;
      const o = node as Record<string, unknown>;
      for (const k of forbidden) expect(o[k], `${path}.${k}`).toBeUndefined();
      if (o["type"] === "object") {
        expect(o["additionalProperties"], path).toBe(false);
        expect(o["required"], path).toEqual(Object.keys(o["properties"] as object));
      }
      for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
    };
    walk(DRAFT_SCHEMA, "$");
  });

  it("converts a draft into a plan that compiles without warnings", () => {
    const { plan, issues } = draftToPlan(goodDraft(), script, { projectId: "t", voiceId: "v" });
    expect(issues).toEqual([]);
    const res = compileVideo(plan, { assets: catalog.source, seed: 1 });
    expect(res.issues).toEqual([]);
    expect(res.timeline?.scenes).toHaveLength(2);
    // narration always comes from the script, never from the model
    expect(plan?.scenes[1]?.narration).toBe(script.scenes[1]?.narration);
  });

  it("reports structural problems in the compiler's issue format", () => {
    const d = goodDraft();
    d.scenes.pop();
    const first = d.scenes[0];
    if (first) first.camera[0] = { move: "punch_in", at: "when he frowns", to: 1.2 };
    const { plan, issues } = draftToPlan(d, script, { projectId: "t", voiceId: "v" });
    expect(plan).toBeUndefined();
    expect(issues.map((i) => i.path)).toEqual(["scenes", "scenes[0].camera[0].at"]);
  });
});

/** Answers with pre-written drafts in order and records what it was asked. */
class ScriptedLlm implements Llm {
  readonly requests: JsonRequest[] = [];
  constructor(private readonly answers: unknown[]) {}
  async json(req: JsonRequest): Promise<JsonResponse> {
    this.requests.push(req);
    const value = this.answers[this.requests.length - 1];
    return {
      value,
      text: JSON.stringify(value),
      usage: { label: req.label, model: "claude-sonnet-5-5", inputTokens: 1000, outputTokens: 500, ms: 1 },
    };
  }
}

describe("planner repair loop", () => {
  it("sends compile errors back and stops at the first clean plan", async () => {
    const broken = goodDraft();
    const s1 = broken.scenes[0];
    if (s1) {
      s1.background = "bg_moon_base_01";
      s1.layers[0] = layer({
        ...s1.layers[0],
        actions: [{ action: "walk", at: "start", durationSec: 0, toX: 0.6, expression: "" }],
      });
    }
    const llm = new ScriptedLlm([broken, goodDraft()]);
    const res = await planVideo(llm, script, catalog, { projectId: "t", voiceId: "v" });

    expect(res.plan).toBeDefined();
    expect(res.attempts).toHaveLength(2);
    expect(res.attempts[0]?.issues.some((i) => i.level === "error")).toBe(true);
    const repair = llm.requests[1]?.messages.at(-1)?.content ?? "";
    expect(repair).toContain("bg_moon_base_01");
    expect(llmCost(res.usage)).toBeCloseTo((2 * (1000 * 2 + 500 * 10)) / 1e6);
  });

  it("gives up after the attempt limit and returns every attempt", async () => {
    const broken = goodDraft();
    if (broken.scenes[0]) broken.scenes[0].background = "bg_nowhere_01";
    const res = await planVideo(new ScriptedLlm([broken, broken]), script, catalog, {
      projectId: "t",
      voiceId: "v",
      maxAttempts: 2,
    });
    expect(res.plan).toBeUndefined();
    expect(res.attempts).toHaveLength(2);
  });

  it("puts only real asset ids and the relevant props in the prompt", () => {
    const prompt = plannerPrompt(script, catalog);
    expect(prompt).toContain("char_drini_01");
    expect(prompt).toContain("met_snowball_01");
    expect(prompt).toContain("obj_coin");
    expect(catalog.relevantProps("coins and money jar").map((p) => p.id)).toContain("obj_coin");
  });
});

describe("script writer", () => {
  it("derives ids, hook and length instead of trusting the model", () => {
    const s = toScript(
      {
        title: "  Saving vs investing ",
        scenes: [
          {
            narration: "Saving money will not make you rich. Not on its own.",
            visualIdea: "jar",
            emphasis: "",
          },
          { narration: "Invest instead.", visualIdea: "chart", emphasis: "INVEST" },
        ],
      },
      { topic: "saving", theme: "money", targetSec: 30 },
    );
    expect(s.scenes.map((x) => x.sceneId)).toEqual(["s01", "s02"]);
    expect(s.hook).toBe("Saving money will not make you rich.");
    expect(s.scenes[0]?.emphasis).toBeUndefined();
    expect(s.estimatedSec).toBeGreaterThan(4);
  });
});

describe("voice catalog", () => {
  const voices = loadVoiceCatalog();

  it("offers the three studio narrators with mark_natural as default", () => {
    expect(voices.voices.map((v) => v.id)).toEqual(["mark_natural", "friendly_woman", "american_man"]);
    expect(resolvePreset(voices).id).toBe(process.env["ERKASA_VOICE"] || "mark_natural");
    expect(resolvePreset(voices, "friendly_woman").providerVoiceId).toBe("DODLEQrClDo8wCz460ld");
    expect(() => resolvePreset(voices, "morgan_freeman")).toThrow(/Available: mark_natural/);
  });

  it("sends preset settings in ElevenLabs field names", () => {
    expect(providerSettings(resolvePreset(voices, "mark_natural"))).toEqual({
      stability: 0.45,
      similarity_boost: 0.75,
      style: 0.15,
      use_speaker_boost: true,
      speed: 1,
    });
  });

  it("tells the planner who narrates and which characters match", () => {
    const line = narratorLine(resolvePreset(voices, "friendly_woman"));
    expect(line).toContain("female");
    const prompt = plannerPrompt(script, catalog, line);
    expect(prompt).toContain("Narrator voice: Friendly Woman, middle aged female");
    expect(prompt).toContain("char_era_01: Era (female");
    expect(prompt).toContain("char_drini_01: Drini (male");
  });
});
