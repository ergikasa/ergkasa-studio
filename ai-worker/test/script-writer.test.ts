import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { JsonRequest, JsonResponse, Llm } from "../src/llm.js";
import { DRAFT_SCHEMA } from "../src/plan-draft.js";
import { SCRIPT_SCHEMA, editorialIssues, toScript, writeScript } from "../src/script-writer.js";
import { recentStyles } from "../src/steps.js";

const req = { topic: "sunk cost", theme: "decisions" as const, targetSec: 30 };

/** A short draft that meets the editorial standard. */
function goodDraft(over: Record<string, unknown> = {}) {
  const scene = (beat: string, narration: string) => ({
    beat,
    narration,
    setting: "",
    action: "",
    emotion: "calm",
    visualIdea: "a picture",
    emphasis: "",
  });
  return {
    title: "Why we finish bad movies",
    promise: "Why money already spent pulls our next decision.",
    opening: "situation",
    shape: "one_moment",
    cast: [{ characterId: "char_drini_01", role: "protagonist", description: "a man at the cinema" }],
    scenes: [
      scene("hook", "Drini paid twelve dollars for a movie he already hates."),
      scene("problem", "Twenty minutes in, he is bored. He stays anyway."),
      scene("concept", "He stays because of the money he cannot get back. Economists call it a sunk cost."),
      scene(
        "situation",
        "Leaving would give him two free hours. Staying gives him two bad ones and the same empty wallet.",
      ),
      scene(
        "analysis",
        "It feels like waste to leave, because leaving makes the loss real. But the money is gone either way.",
      ),
      scene("conclusion", "Next time, ask one question: if I had not paid yet, would I start this now?"),
    ],
    claims: [],
    takeaway: { kind: "question", text: "If I had not paid yet, would I start this now?" },
    ...over,
  };
}

class ScriptedLlm implements Llm {
  readonly requests: JsonRequest[] = [];
  constructor(private readonly answers: unknown[]) {}
  async json(r: JsonRequest): Promise<JsonResponse> {
    this.requests.push(r);
    const value = this.answers[this.requests.length - 1];
    return {
      value,
      text: JSON.stringify(value),
      usage: { label: r.label, model: "claude-sonnet-5-5", inputTokens: 1, outputTokens: 1, ms: 1 },
    };
  }
}

describe("editorial script", () => {
  it("uses only schema keywords the structured-output API accepts", () => {
    // the API rejects array/string/number limits; minItems is accepted only as 0 or 1
    const banned = /"(maxItems|maxLength|minLength|minimum|maximum|pattern|format)":/;
    for (const schema of [SCRIPT_SCHEMA, DRAFT_SCHEMA]) {
      const json = JSON.stringify(schema);
      expect(json).not.toMatch(banned);
      for (const m of json.matchAll(/"minItems":(\d+)/g)) expect(Number(m[1])).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the editorial fields and drops unknown or reserved cast", () => {
    const s = toScript(
      goodDraft({
        cast: [
          { characterId: "char_host_01", role: "protagonist", description: "host" },
          { characterId: "char_drini_01", role: "protagonist", description: "a man" },
          { characterId: "char_nobody", role: "supporting", description: "x" },
        ],
        claims: [
          { text: "Sunk cost", kind: "definition", status: "widely_known", role: "names it", source: "" },
        ],
      }),
      req,
      ["char_drini_01", "char_ana_01"],
    );
    expect(s.cast?.map((c) => [c.characterId, c.role])).toEqual([["char_drini_01", "protagonist"]]);
    expect(s.opening).toBe("situation");
    expect(s.shape).toBe("one_moment");
    expect(s.takeaway?.kind).toBe("question");
    expect(s.claims?.[0]?.source).toBeUndefined();
    expect(s.scenes.map((x) => x.beat)).toEqual([
      "hook",
      "problem",
      "concept",
      "situation",
      "analysis",
      "conclusion",
    ]);
  });

  it("passes a script that follows the standard", () => {
    expect(editorialIssues(toScript(goodDraft(), req))).toEqual([]);
  });

  it("flags definitions first, filler, missing parts, unlisted research and repeats", () => {
    const d = goodDraft();
    const [s0, , , s3] = d.scenes;
    if (!s0 || !s3) throw new Error("draft");
    s0.narration = "The sunk cost fallacy is defined as a bias.";
    s3.narration = "A study found most people stay. Believe in yourself and leave.";
    d.scenes.splice(4, 1);
    const issues = editorialIssues(toScript(d, req), { openings: ["situation"], shapes: ["one_moment"] });
    const text = issues.join("\n");
    expect(text).toContain("opens with a definition");
    expect(text).toContain('"believe in yourself" is filler');
    expect(text).toContain('"analysis" part is missing');
    expect(text).toContain("claims is empty");
    expect(text).toContain("also opened with a situation");
    expect(text).toContain('"one_moment"');
  });

  it("sends the problems back and keeps the rewrite", async () => {
    const bad = goodDraft({ takeaway: undefined });
    const llm = new ScriptedLlm([bad, goodDraft()]);
    const res = await writeScript(llm, req, "", ["char_drini_01"]);
    expect(llm.requests).toHaveLength(2);
    expect(llm.requests[1]?.messages.at(-1)?.content).toContain("takeaway is missing");
    expect(res.issues).toEqual([]);
    expect(res.script.takeaway).toBeDefined();
  });

  it("reads the openings and shapes of the latest other runs, newest first", () => {
    const runs = mkdtempSync(join(tmpdir(), "runs-"));
    const write = (name: string, opening: string, shape: string, t: number) => {
      mkdirSync(join(runs, name));
      const file = join(runs, name, "script.json");
      writeFileSync(file, JSON.stringify(toScript(goodDraft({ opening, shape }), req)));
      utimesSync(file, t, t);
    };
    write("a", "fact", "rewind", 1000);
    write("b", "paradox", "two_paths", 2000);
    write("c", "question", "case_file", 3000);
    expect(recentStyles(runs, join(runs, "c"))).toEqual({
      openings: ["paradox", "fact"],
      shapes: ["two_paths", "rewind"],
    });
  });
});
