import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Script } from "@erkasa/contracts";
import { describe, expect, it } from "vitest";
import { FilmPlan } from "@erkasa/film";
import { DIRECTOR_SCHEMA, decode, direct, encode, type DirectorLlm } from "../src/director.js";

const must = <T>(v: T | undefined | null): T => {
  if (v === undefined || v === null) throw new Error("missing");
  return v;
};

const root = join(import.meta.dirname, "..", "..");
const load = (name: string) => ({
  script: Script.parse(
    JSON.parse(readFileSync(join(root, "benchmark", "scripts", `${name}.script.json`), "utf8")),
  ),
  plan: FilmPlan.parse(JSON.parse(readFileSync(join(root, "film", "plans", `${name}.film.json`), "utf8"))),
});

/** A model that answers from a list, and records what it was asked. */
function fake(answers: unknown[]): DirectorLlm & { asked: string[] } {
  const asked: string[] = [];
  let i = 0;
  return {
    asked,
    json: async (req) => {
      asked.push(req.messages[req.messages.length - 1]?.content ?? "");
      const value = answers[Math.min(i++, answers.length - 1)];
      return {
        value,
        text: JSON.stringify(value),
        usage: { label: req.label, model: "fake", inputTokens: 1, outputTokens: 1, ms: 0 },
      };
    },
  };
}

/** Every object in a structured-outputs schema must be closed and list all its properties as required. */
function strictObjects(s: unknown, path = "$"): string[] {
  if (!s || typeof s !== "object") return [];
  const o = s as Record<string, unknown>;
  const bad: string[] = [];
  if (o["type"] === "object") {
    const props = Object.keys((o["properties"] as object) ?? {});
    if (o["additionalProperties"] !== false) bad.push(`${path} not closed`);
    const req = (o["required"] as string[]) ?? [];
    for (const p of props) if (!req.includes(p)) bad.push(`${path}.${p} not required`);
  }
  for (const [k, v] of Object.entries(o)) bad.push(...strictObjects(v, `${path}.${k}`));
  return bad;
}

describe("director", () => {
  it("has a schema the structured-outputs API accepts", () => {
    expect(strictObjects(DIRECTOR_SCHEMA)).toEqual([]);
  });

  it("round-trips every hand plan through the answer's shape", () => {
    for (const b of [
      "b1-why-we-stay",
      "b2-same-answers",
      "b3-every-yes",
      "b4-one-percent",
      "b5-planning-fallacy",
    ]) {
      const { plan } = load(b);
      const back = FilmPlan.parse(decode(JSON.parse(JSON.stringify(encode(plan))), plan.voiceId).plan);
      expect(back).toEqual(plan);
    }
  });

  it("round-trips intents and sequences (W2: how, then, read, turn_to, react; intensity is the engine's default)", () => {
    const plan = FilmPlan.parse(
      JSON.parse(readFileSync(join(root, "film", "acceptance", "w2-acting.film.json"), "utf8")),
    );
    const back = FilmPlan.parse(decode(JSON.parse(JSON.stringify(encode(plan))), plan.voiceId).plan);
    const noIntensity = (p: FilmPlan): FilmPlan => ({
      ...p,
      cast: p.cast.map((c) => ({
        ...c,
        ...(c.outfits
          ? {
              outfits: c.outfits.map((o) => ({
                ...o,
                occasion: o.occasion ?? "work",
                weather: o.weather ?? "mild",
              })),
            }
          : {}),
      })),
      shots: p.shots.map((s) => ({
        ...s,
        actions: s.actions.map((a) => {
          const { intensity, ...rest } = a;
          void intensity;
          return rest;
        }),
      })),
    });
    expect(back).toEqual(noIntensity(plan));
    const talk = back.shots.find((s) => s.id === "sh05")?.actions.find((a) => a.do === "talk");
    expect(talk?.how).toBe("worry");
    expect(back.shots[0]?.actions.filter((a) => a.at === "then").length).toBe(1);
  });

  it("round-trips identity and wardrobe (W1: B2 with one Alex in two outfits)", () => {
    const plan = FilmPlan.parse(
      JSON.parse(readFileSync(join(root, "film", "plans", "b2-same-answers.w1.film.json"), "utf8")),
    );
    const back = FilmPlan.parse(decode(JSON.parse(JSON.stringify(encode(plan))), plan.voiceId).plan);
    // the answer's shape always carries an occasion and a weather; the defaults are what the engine assumes
    const norm = (p: FilmPlan): FilmPlan => ({
      ...p,
      cast: p.cast.map((c) => ({
        ...c,
        ...(c.outfits
          ? {
              outfits: c.outfits.map((o) => ({
                ...o,
                occasion: o.occasion ?? "work",
                weather: o.weather ?? "mild",
              })),
            }
          : {}),
      })),
    });
    expect(back).toEqual(norm(plan));
    expect(back.shots.find((s) => s.id === "sh06")?.actors.find((a) => a.id === "alex")?.outfit).toBe(
      "interview_suit",
    );
  });

  it("accepts a clean plan on the first answer", async () => {
    const { script, plan } = load("b1-why-we-stay");
    const llm = fake([encode(plan)]);
    const res = await direct(script, llm, { voiceId: plan.voiceId });
    expect(res.plan?.shots.length).toBe(plan.shots.length);
    expect(res.attempts).toHaveLength(1);
  });

  it("sends the engine's issues back and takes the repaired plan", async () => {
    const { script, plan } = load("b1-why-we-stay");
    const broken = JSON.parse(JSON.stringify(encode(plan))) as { shots: Array<Record<string, unknown>> };
    const staged = broken.shots.find((s) => s["kind"] === "set") as {
      actors: Array<{ at: string }>;
      id: string;
    };
    must(staged.actors[0]).at = "sofa";
    must(broken.shots[1])["from"] = "word:helicopter";
    const llm = fake([broken, encode(plan)]);
    const res = await direct(script, llm, { voiceId: plan.voiceId });
    expect(res.attempts).toHaveLength(2);
    expect(must(res.attempts[0]).errors.map((e) => e.code)).toEqual(
      expect.arrayContaining(["MARK_UNKNOWN", "SHOT_START"]),
    );
    expect(llm.asked[1]).toContain("MARK_UNKNOWN");
    expect(llm.asked[1]).toContain(staged.id);
    expect(res.plan).toBeDefined();
  });

  it("reports contract errors with shot ids and gives up after the last attempt", async () => {
    const { script, plan } = load("b3-every-yes");
    const broken = JSON.parse(JSON.stringify(encode(plan))) as { shots: Array<Record<string, unknown>> };
    must(broken.shots[0])["template"] = null;
    must(broken.shots[0])["kind"] = "editorial";
    must(broken.shots[0])["paramsJson"] = "{not json";
    const res = await direct(script, fake([broken]), { voiceId: plan.voiceId, maxAttempts: 2 });
    expect(res.plan).toBeUndefined();
    expect(res.attempts).toHaveLength(2);
    expect(must(must(res.attempts[0]).errors[0]).code).toBe("PARAMS_NOT_JSON");
  });

  it("catches a valid-looking plan the engine cannot film (a template with wrong params)", async () => {
    const { script, plan } = load("b4-one-percent");
    const broken = JSON.parse(JSON.stringify(encode(plan))) as { shots: Array<Record<string, unknown>> };
    const ed = must(broken.shots.find((s) => s["template"] === "counter"));
    ed["paramsJson"] = JSON.stringify({ from: "one" });
    const res = await direct(script, fake([broken]), { voiceId: plan.voiceId, maxAttempts: 1 });
    expect(must(res.attempts[0]).errors.map((e) => e.code)).toContain("TEMPLATE_PARAMS");
  });
});
