/**
 * E1.6 subphase 2 with a real RabbitMQ: two workers consume the same queue; a cancel message on the control
 * fanout stops exactly the attempt it names, the other worker finishes its own attempt, and a cancel for an
 * attempt nobody runs changes nothing. Needs RabbitMQ: CI runs it with a broker and ERKASA_REQUIRE_RABBIT=1
 * (then a missing broker fails the test instead of skipping it).
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskCommand, TaskResult } from "@erkasa/contracts";
import amqp, { type Channel, type ChannelModel } from "amqplib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JsonRequest, JsonResponse, Llm } from "../src/llm.js";
import { MqNames, rabbitUrl } from "../src/mq.js";
import { startWorker, type RunningWorker, type WorkerDeps } from "../src/worker.js";
import { RUN, deps as fixtureDeps } from "./e2e-fixture.js";

async function reachable(): Promise<boolean> {
  try {
    const c = await amqp.connect(rabbitUrl());
    await c.close();
    return true;
  } catch {
    return false;
  }
}

const required = process.env["ERKASA_REQUIRE_RABBIT"] === "1";
const available = await reachable();
if (required && !available)
  throw new Error(`ERKASA_REQUIRE_RABBIT=1 but RabbitMQ is not reachable at ${rabbitUrl()}`);

describe.skipIf(!available)("two workers on RabbitMQ", () => {
  const mq = new MqNames(`erkasa-wtest-${randomUUID().slice(0, 8)}`);
  const storage = mkdtempSync(join(tmpdir(), "erkasa-mq-"));
  let conn: ChannelModel;
  let ch: Channel;
  const workers: RunningWorker[] = [];
  const results: TaskResult[] = [];
  const logs: string[] = [];
  /** The first script.write call hangs until cancelled; later calls answer at once. */
  let calls = 0;

  beforeAll(async () => {
    conn = await amqp.connect(rabbitUrl());
    ch = await conn.createChannel();
    await mq.declare(ch);
    await ch.consume(
      mq.resultsQueue,
      (m) => {
        if (m) results.push(TaskResult.parse(JSON.parse(m.content.toString("utf8"))));
      },
      { noAck: true },
    );
    const base = fixtureDeps(storage);
    const llm: Llm = {
      json: async (req: JsonRequest): Promise<JsonResponse> => {
        calls++;
        if (calls === 1) return new Promise<JsonResponse>(() => undefined);
        return base.llm().json(req);
      },
    };
    const d: WorkerDeps = { ...base, llm: () => llm };
    for (const name of ["A", "B"])
      workers.push(await startWorker(d, { mq, queues: ["ai"], log: (l) => logs.push(`${name}: ${l}`) }));
  });

  afterAll(async () => {
    for (const w of workers) await w.stop();
    for (const q of [mq.aiQueue, mq.renderQueue, mq.resultsQueue, mq.progressQueue])
      await ch.deleteQueue(q).catch(() => undefined);
    for (const x of [mq.tasksExchange, mq.eventsExchange, mq.controlExchange])
      await ch.deleteExchange(x).catch(() => undefined);
    await conn.close();
  });

  const command = (fence: number, attempt: number): TaskCommand =>
    TaskCommand.parse({
      schema: "erkasa.task/1",
      messageId: randomUUID(),
      taskType: "script.write",
      runId: RUN,
      stepId: "script",
      attempt,
      fence,
      idempotencyKey: "0123456789abcdef0123",
      inputs: [],
      params: { topic: "saving vs investing", theme: "money", seconds: 20 },
      deadline: new Date(Date.now() + 120_000).toISOString(),
    });

  const send = (exchange: string, key: string, body: unknown): void => {
    ch.publish(exchange, key, Buffer.from(JSON.stringify(body)), { contentType: "application/json" });
  };

  const waitFor = async (pred: () => boolean, what: string): Promise<void> => {
    const until = Date.now() + 30_000;
    while (Date.now() < until) {
      if (pred()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error(`timed out waiting for ${what}; logs:\n${logs.join("\n")}`);
  };

  it("a cancel stops only the attempt it names; the other worker finishes; an unknown fence is ignored", async () => {
    send(mq.tasksExchange, "script.write", command(901, 1)); // hangs in one worker
    await waitFor(() => calls >= 1, "the first attempt to start");
    send(mq.tasksExchange, "script.write", command(902, 2)); // taken by the other, free worker
    await waitFor(() => results.some((r) => r.fence === 902), "attempt 902");

    // a cancel for an attempt nobody runs: no effect
    send(mq.controlExchange, "", {
      schema: "erkasa.task-cancel/1",
      messageId: randomUUID(),
      runId: RUN,
      stepId: "script",
      attempt: 1,
      fence: 999,
      reason: "CANCELLED",
    });
    await new Promise((r) => setTimeout(r, 500));
    expect(results.some((r) => r.fence === 901)).toBe(false);

    send(mq.controlExchange, "", {
      schema: "erkasa.task-cancel/1",
      messageId: randomUUID(),
      runId: RUN,
      stepId: "script",
      attempt: 1,
      fence: 901,
      reason: "TIMEOUT",
    });
    await waitFor(() => results.some((r) => r.fence === 901), "the cancelled attempt's result");

    const cancelled = results.find((r) => r.fence === 901);
    const done = results.find((r) => r.fence === 902);
    expect(cancelled).toMatchObject({ status: "FAILED", error: { code: "CANCELLED", retryable: false } });
    expect(done?.status).toBe("SUCCEEDED");
    expect(done?.outputs[0]?.ref).toBe(`file://${RUN}/attempts/script-902/script.json`);
    // nothing public: both attempts stayed in their folders
    expect(existsSync(join(storage, RUN, "script.json"))).toBe(false);
    expect(existsSync(join(storage, RUN, "attempts/script-901"))).toBe(true);
    expect(existsSync(join(storage, RUN, "attempts/script-902/script.json"))).toBe(true);
    expect(logs.some((l) => l.includes("fence 901") && l.includes("stop requested (TIMEOUT)"))).toBe(true);
  }, 60_000);
});
