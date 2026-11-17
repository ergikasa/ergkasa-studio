import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskCommand } from "@erkasa/contracts";
import { FilmPlan } from "@erkasa/film";
import { encode } from "@erkasa/planner";
import { describe, expect, it } from "vitest";
import { Catalog } from "../src/catalog.js";
import { MissingConfigError, repoRoot } from "../src/env.js";
import { probeDuration } from "../src/steps.js";
import type { JsonRequest, JsonResponse, Llm } from "../src/llm.js";
import { handleCommand, type WorkerDeps } from "../src/worker.js";

/** The worker path of a silent run on the v2 engine, end to end, with a scripted model. */

const scriptDraft = {
  title: "Saving vs investing",
  scenes: [
    {
      narration: "Saving money will not make you rich. Not on its own.",
      visualIdea: "A man at his desk stops and looks at the window.",
      emphasis: "",
    },
    {
      narration: "Invest instead, and let time do the work for you.",
      visualIdea: "Two curves split apart.",
      emphasis: "",
    },
  ],
};

const film = (bad: boolean): FilmPlan =>
  FilmPlan.parse({
    schema: "erkasa.film/1",
    title: "Saving vs investing",
    voiceId: "x",
    cast: [{ id: "ben", name: "Ben", build: "man" }],
    shots: [
      {
        id: "sh01",
        scene: "s01",
        moment: "He saves and saves, and nothing changes.",
        kind: "set",
        set: "office",
        light: "golden",
        framing: "medium",
        subject: "ben",
        actors: [{ id: "ben", at: bad ? "sofa" : "chair", pose: "seated", mood: "tired" }],
        actions: [
          { who: "ben", do: "type", at: "start", sec: 1.5 },
          { who: "ben", do: "glance", target: "window_view", at: "word:rich" },
          { who: "ben", do: "sigh", at: "word:own" },
        ],
        text: {
          lines: [
            { t: "Saving alone", weight: "light" },
            { t: "is not enough.", weight: "bold", accent: true },
          ],
          at: "word:rich",
        },
      },
      {
        id: "sh02",
        scene: "s02",
        moment: "Time makes invested money grow apart from saved money.",
        kind: "editorial",
        template: "curves",
        params: { a: { label: "invested", end: 6 }, b: { label: "saved", end: 1.2 } },
        text: { lines: [{ t: "Let time work.", weight: "bold" }], at: "word:time", place: "top" },
      },
    ],
  });

function deps(dir: string, calls: string[]): WorkerDeps {
  let filmTurn = 0;
  const llm: Llm = {
    async json(req: JsonRequest): Promise<JsonResponse> {
      calls.push(req.label);
      const value = req.label.startsWith("film") ? encode(film(filmTurn++ === 0)) : scriptDraft;
      return {
        value,
        text: JSON.stringify(value),
        usage: { label: req.label, model: "claude-sonnet-5-5", inputTokens: 1000, outputTokens: 200, ms: 1 },
      };
    },
  };
  return {
    catalog: new Catalog(join(repoRoot(), "assets")),
    storageDir: dir,
    llm: () => llm,
    voiceFor: () => {
      throw new MissingConfigError("silent run");
    },
  };
}

const RUN = "20261115-120000-film-a1b2";
const cmd = (taskType: string, stepId: string, params: Record<string, unknown>): TaskCommand =>
  TaskCommand.parse({
    schema: "erkasa.task/1",
    messageId: `msg-${stepId}-0001`,
    taskType,
    runId: RUN,
    stepId,
    attempt: 1,
    idempotencyKey: "0123456789abcdef0123",
    inputs: [],
    params,
    deadline: "2030-01-01T00:00:00Z",
  });

describe("worker on the film engine (silent run)", () => {
  it("writes the script, directs the film (repairing it once) and renders video.mp4", async () => {
    const storage = mkdtempSync(join(tmpdir(), "erkasa-film-"));
    const calls: string[] = [];
    const d = deps(storage, calls);
    const noop = () => undefined;

    const s = await handleCommand(
      cmd("script.write", "script", { topic: "saving vs investing", theme: "money", seconds: 20 }),
      d,
      noop,
    );
    expect(s.status).toBe("SUCCEEDED");

    const p = await handleCommand(
      cmd("visual.plan", "plan", { voice: "", projectId: RUN, engine: "film" }),
      d,
      noop,
    );
    expect(p.error).toBeUndefined();
    expect(p.status).toBe("SUCCEEDED");
    expect(p.metrics["planAttempts"]).toBe(2);
    expect(p.outputs[0]?.ref).toBe(`file://${RUN}/film-plan.json`);
    const attempts = JSON.parse(readFileSync(join(storage, RUN, "film-attempts.json"), "utf8")) as Array<{
      errors: Array<{ code: string }>;
    }>;
    expect(attempts[0]?.errors.map((e) => e.code)).toContain("MARK_UNKNOWN");

    const r = await handleCommand(cmd("render.finalize", "render", { music: true }), d, noop);
    expect(r.error).toBeUndefined();
    expect(r.status).toBe("SUCCEEDED");
    const video = join(storage, RUN, "video.mp4");
    expect(existsSync(video)).toBe(true);
    const dur = probeDuration(video) ?? 0;
    expect(dur).toBeGreaterThan(5);
    expect(Math.abs(dur - Number(r.metrics["durationSec"]))).toBeLessThan(0.6);
    expect(calls.filter((c) => c.startsWith("film"))).toEqual(["film#1", "film#2"]);
  }, 240_000);
});
