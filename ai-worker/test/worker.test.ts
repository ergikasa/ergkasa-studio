import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskCommand, TaskResult } from "@erkasa/contracts";
import { describe, expect, it } from "vitest";
import { Catalog } from "../src/catalog.js";
import { MissingConfigError, repoRoot } from "../src/env.js";
import { LlmError, type JsonRequest, type JsonResponse, type Llm } from "../src/llm.js";
import { MqNames } from "../src/mq.js";
import { classify, handleCommand, TaskFailure, type WorkerDeps } from "../src/worker.js";

const catalog = new Catalog(join(repoRoot(), "assets"));

const scriptDraft = {
  title: "Saving vs investing",
  scenes: [
    {
      narration: "Saving money will not make you rich. Not on its own.",
      visualIdea: "A man frowns.",
      emphasis: "",
    },
    { narration: "Invest instead, and let time do the work for you.", visualIdea: "A chart.", emphasis: "" },
  ],
};

const llm: Llm = {
  async json(req: JsonRequest): Promise<JsonResponse> {
    return {
      value: scriptDraft,
      text: JSON.stringify(scriptDraft),
      usage: { label: req.label, model: "claude-sonnet-5-5", inputTokens: 1000, outputTokens: 200, ms: 1 },
    };
  },
};

function deps(): WorkerDeps {
  return {
    catalog,
    storageDir: mkdtempSync(join(tmpdir(), "erkasa-worker-")),
    llm: () => llm,
    voiceFor: () => {
      throw new MissingConfigError("ELEVENLABS_API_KEY is not set.");
    },
  };
}

function command(over: Partial<TaskCommand>): TaskCommand {
  return TaskCommand.parse({
    schema: "erkasa.task/1",
    messageId: "msg-00000001",
    taskType: "script.write",
    runId: "20261108-120000-test-a1b2",
    stepId: "script",
    attempt: 1,
    idempotencyKey: "0123456789abcdef0123",
    inputs: [],
    params: { topic: "saving vs investing", theme: "money", seconds: 20 },
    deadline: "2030-01-01T00:00:00Z",
    ...over,
  });
}

describe("worker", () => {
  it("runs script.write and reports the artifact and the cost", async () => {
    const progress: number[] = [];
    const r = await handleCommand(command({}), deps(), (pct) => progress.push(pct));
    expect(TaskResult.safeParse(r).success).toBe(true);
    expect(r.status).toBe("SUCCEEDED");
    expect(r.outputs).toEqual([
      { role: "script", ref: "file://20261108-120000-test-a1b2/script.json", mediaType: "application/json" },
    ]);
    expect(r.metrics["scenes"]).toBe(2);
    expect(r.metrics["costUsd"]).toBeGreaterThan(0);
    expect(progress).toContain(5);
  });

  it("reports failures with a code and a retry decision instead of throwing", async () => {
    const noScript = await handleCommand(
      command({ taskType: "voice.synthesize", stepId: "voice", params: { voice: "mark_natural" } }),
      deps(),
      () => undefined,
    );
    expect(noScript.status).toBe("FAILED");
    expect(noScript.error).toMatchObject({ code: "MISSING_INPUT", retryable: false });

    const badRun = await handleCommand(command({ runId: "../../etc" }), deps(), () => undefined);
    expect(badRun.error?.code).toBe("BAD_RUN_ID");
  });

  it("classifies provider errors", () => {
    expect(classify(new MissingConfigError("x"))).toMatchObject({ code: "MISSING_CONFIG", retryable: false });
    expect(classify(new LlmError("Claude API 529", true))).toMatchObject({
      code: "LLM_ERROR",
      retryable: true,
    });
    expect(classify(new Error("ElevenLabs 401 (check key)"))).toMatchObject({
      code: "VOICE_ERROR",
      retryable: false,
    });
    expect(classify(new Error("ElevenLabs 503: busy"))).toMatchObject({
      code: "VOICE_ERROR",
      retryable: true,
    });
    expect(classify(new TaskFailure("PLAN_INVALID", "x", true))).toMatchObject({
      code: "PLAN_INVALID",
      retryable: true,
    });
    expect(classify(new Error("boom"))).toMatchObject({ code: "WORKER_ERROR", retryable: true });
  });

  it("uses the same queue names as the backend", () => {
    const mq = new MqNames("erkasa");
    expect([
      mq.tasksExchange,
      mq.eventsExchange,
      mq.aiQueue,
      mq.renderQueue,
      mq.resultsQueue,
      mq.progressQueue,
    ]).toEqual([
      "erkasa.tasks",
      "erkasa.events",
      "erkasa.tasks.ai",
      "erkasa.tasks.render",
      "erkasa.results",
      "erkasa.progress",
    ]);
  });
});
