import { availableParallelism } from "node:os";
import { redoRunScene, showStoryboard } from "./producer.js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import {
  Script,
  TaskCommand,
  TaskProgress,
  TaskResult,
  type Theme,
  type VoicePreset,
} from "@erkasa/contracts";
import amqp, { type ConfirmChannel, type ConsumeMessage } from "amqplib";
import { Catalog } from "./catalog.js";
import { MissingConfigError, optional, repoRoot } from "./env.js";
import { AnthropicLlm, LlmError, llmCost, type Llm, type Usage } from "./llm.js";
import { MqNames, rabbitUrl } from "./mq.js";
import {
  RUN_FILES,
  loadPlan,
  loadScript,
  stepPlan,
  stepRender,
  stepScript,
  stepVoice,
  stepWorld,
  type Progress,
} from "./steps.js";
import { ElevenLabsVoice, type Voice } from "./voice.js";
import { loadVoiceCatalog, resolvePreset } from "./voice-catalog.js";

export const WORKER_VERSION = "ai-worker/0.1.0";

type ArtifactPointer = TaskResult["outputs"][number];
type Metrics = Record<string, number>;

/** A failure with a code the Studio shows, and whether another attempt could succeed. */
export class TaskFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export interface WorkerDeps {
  catalog: Catalog;
  /** Run folders: <storage>/<runId>/... (same root as the backend's erkasa.storage.dir). */
  storageDir: string;
  llm: () => Llm;
  voiceFor: (preset: VoicePreset) => Voice;
}

export function defaultDeps(): WorkerDeps {
  const root = repoRoot();
  const configured = optional("ERKASA_STORAGE_DIR", "");
  return {
    catalog: new Catalog(join(root, "assets")),
    // a relative ERKASA_STORAGE_DIR means "relative to backend/", as for Spring; default <repo>/out/runs
    storageDir: configured
      ? isAbsolute(configured)
        ? configured
        : resolve(root, "backend", configured)
      : join(root, "out", "runs"),
    llm: () => new AnthropicLlm(),
    voiceFor: (preset) => new ElevenLabsVoice(preset),
  };
}

const RUN_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

function usageMetrics(usage: Usage[]): Metrics {
  const cost = llmCost(usage);
  return {
    llmCalls: usage.length,
    inputTokens: usage.reduce((n, u) => n + u.inputTokens, 0),
    outputTokens: usage.reduce((n, u) => n + u.outputTokens, 0),
    ...(cost !== undefined ? { costUsd: Math.round(cost * 10000) / 10000 } : {}),
  };
}

const ref = (runId: string, file: string, role: string, mediaType: string): ArtifactPointer => ({
  role,
  ref: `file://${runId}/${file}`,
  mediaType,
});

/**
 * The run's world, when the world step made one: a catalog over the world's assets and the library, the
 * script with its cast as world characters (script.world.json) and the host's id in the world.
 */
export function runWorld(
  dir: string,
  library: Catalog,
  script?: Script,
  host?: string,
): { catalog: Catalog; script: Script; host?: string } {
  const worldDir = join(dir, RUN_FILES.worldDir);
  const base = { catalog: library, script: script as Script, ...(host ? { host } : {}) };
  if (!existsSync(join(worldDir, "manifest.json"))) return base;
  const catalog = new Catalog([worldDir, library.assetsDir]);
  const mapped = join(dir, "script.world.json");
  const worldScript = existsSync(mapped) ? Script.parse(JSON.parse(readFileSync(mapped, "utf8"))) : script;
  let worldHost = host;
  if (host && existsSync(join(dir, RUN_FILES.world))) {
    const spec = JSON.parse(readFileSync(join(dir, RUN_FILES.world), "utf8")) as {
      cast?: Array<{ id: string; from?: string }>;
    };
    worldHost = spec.cast?.find((c) => c.from === host)?.id ?? host;
  }
  return { catalog, script: worldScript as Script, ...(worldHost ? { host: worldHost } : {}) };
}

/** Runs one task. Returns its outputs and metrics, or throws (TaskFailure for known failures). */
/** How many render processes to use: the task's `workers`, else ERKASA_RENDER_WORKERS, else 2 (1 on a single core). */
function renderWorkers(p: Record<string, unknown>): number {
  const asked =
    typeof p["workers"] === "number" ? p["workers"] : Number(process.env["ERKASA_RENDER_WORKERS"]);
  const n = Number.isFinite(asked) && asked >= 1 ? Math.floor(asked) : Math.min(2, availableParallelism());
  return Math.max(1, Math.min(8, n));
}

export async function executeTask(
  cmd: TaskCommand,
  deps: WorkerDeps,
  progress: Progress,
): Promise<{ outputs: ArtifactPointer[]; metrics: Metrics }> {
  if (!RUN_ID.test(cmd.runId)) throw new TaskFailure("BAD_RUN_ID", `invalid run id '${cmd.runId}'`, false);
  const dir = join(deps.storageDir, cmd.runId);
  const p = cmd.params;
  const str = (k: string): string => (typeof p[k] === "string" ? (p[k] as string) : "");
  const preset = (): VoicePreset => resolvePreset(loadVoiceCatalog(), str("voice") || undefined);

  switch (cmd.taskType) {
    case "script.write": {
      progress(5, "writing the script");
      const res = await stepScript(
        dir,
        {
          topic: str("topic"),
          theme: str("theme") as Exclude<Theme, "everyday">,
          seconds: typeof p["seconds"] === "number" ? p["seconds"] : 45,
          ...(str("notes") ? { notes: str("notes") } : {}),
        },
        deps.llm(),
        deps.catalog,
      );
      return {
        outputs: [ref(cmd.runId, RUN_FILES.script, "script", "application/json")],
        metrics: {
          ...usageMetrics(res.usage),
          scenes: res.script.scenes.length,
          estimatedSec: res.script.estimatedSec,
        },
      };
    }
    case "world.design": {
      progress(5, "designing the world");
      const script = loadScript(dir);
      const res = await stepWorld(
        dir,
        script,
        deps.llm(),
        deps.catalog,
        (str("projectId") || cmd.runId).replace(/[^a-z0-9]+/g, "_").replace(/^[^a-z]+/, "w_"),
        str("host") || undefined,
        str("style") || undefined,
      );
      // no valid world: the video goes on with the library (world-issues.json says why)
      progress(100, res.summary ? `world: ${res.summary}` : "no valid world: using the library");
      return {
        outputs: res.dir
          ? [
              ref(cmd.runId, RUN_FILES.world, "world", "application/json"),
              ref(cmd.runId, `${RUN_FILES.worldDir}/manifest.json`, "world_assets", "application/json"),
            ]
          : [ref(cmd.runId, RUN_FILES.worldIssues, "world_issues", "application/json")],
        metrics: {
          ...usageMetrics(res.usage),
          world: res.dir ? 1 : 0,
          worldAttempts: res.attempts,
          worldBuildSec: Math.round((res.buildSec ?? 0) * 100) / 100,
        },
      };
    }
    case "voice.synthesize": {
      const script = loadScript(dir);
      const track = await stepVoice(dir, script.scenes, deps.voiceFor(preset()), progress);
      return {
        outputs: [ref(cmd.runId, RUN_FILES.voice, "voice", "application/json")],
        metrics: {
          characters: track.characters,
          scenes: track.scenes.length,
          voiceSec: Math.round(track.scenes.reduce((n, s) => n + s.durationSec, 0) * 100) / 100,
        },
      };
    }
    case "visual.plan": {
      progress(5, "planning the visuals");
      // in its own world: the world's catalog, the cast as world characters, the host's world copy
      const w = runWorld(dir, deps.catalog, loadScript(dir), str("host") || undefined);
      const res = await stepPlan(
        dir,
        w.script,
        preset(),
        deps.llm(),
        w.catalog,
        str("projectId") || cmd.runId,
        w.host,
        { critic: p["critic"] === true },
      );
      if (!res.plan) {
        const summary = res.errors
          .slice(0, 5)
          .map((e) => `${e.code} ${e.path}: ${e.message}`)
          .join("; ");
        throw new TaskFailure(
          "PLAN_INVALID",
          `no valid plan after ${res.attempts.length} attempts: ${summary} (see ${RUN_FILES.planAttempts})`,
          true,
        );
      }
      return {
        outputs: [ref(cmd.runId, RUN_FILES.plan, "plan", "application/json")],
        metrics: {
          ...usageMetrics(res.usage),
          planAttempts: res.attempts.length,
          directionIssues: res.directionIssues.length,
        },
      };
    }
    case "storyboard.build": {
      progress(5, "drawing the storyboard");
      const only = Array.isArray(p["only"]) ? (p["only"] as unknown[]).map(String) : undefined;
      const sb = showStoryboard(dir, { ...(only ? { only } : {}), workers: renderWorkers(p) });
      progress(100, `${sb.scenes.length} scenes, render ~${Math.ceil(sb.estimate.renderSec / 60)} min`);
      return {
        outputs: [ref(cmd.runId, "storyboard.json", "storyboard", "application/json")],
        metrics: {
          scenes: sb.scenes.length,
          totalSec: sb.totalSec,
          estimatedRenderSec: sb.estimate.renderSec,
        },
      };
    }
    case "scene.redo": {
      const sceneId = str("sceneId");
      if (!/^[a-z][a-z0-9_-]{0,40}$/i.test(sceneId))
        throw new TaskFailure("BAD_SCENE", `invalid scene id '${sceneId}'`, false);
      progress(5, `redoing ${sceneId}`);
      const r = await redoRunScene(deps.llm(), dir, sceneId, {
        ...(str("request") ? { request: str("request").slice(0, 500) } : {}),
        ...(str("host") ? { host: str("host") } : {}),
        ...(str("voice") ? { voice: str("voice") } : {}),
        workers: renderWorkers(p),
      });
      progress(100, r.clean ? `${sceneId} redone` : `${sceneId}: ${r.issues[0]?.message ?? "unchanged"}`);
      return {
        outputs: [
          ref(cmd.runId, RUN_FILES.plan, "plan", "application/json"),
          ref(cmd.runId, "storyboard.json", "storyboard", "application/json"),
        ],
        metrics: { ...usageMetrics(r.usage), clean: r.clean ? 1 : 0, openPoints: r.issues.length },
      };
    }
    case "render.finalize": {
      progress(0, "compiling");
      const started = Date.now();
      const res = await stepRender(dir, loadPlan(dir), {
        catalog: runWorld(dir, deps.catalog).catalog,
        music: p["music"] !== false,
        workers: renderWorkers(p),
        progress,
      });
      if (!res.video) {
        const errors = res.compiled.issues.filter((i) => i.level === "error");
        throw new TaskFailure(
          "COMPILE_FAILED",
          errors
            .slice(0, 5)
            .map((e) => `${e.code} ${e.path}: ${e.message}`)
            .join("; "),
          false,
        );
      }
      // say how the soundtrack was made: a silent fallback to the placeholder pad must never go unnoticed
      const audio = res.audio;
      if (audio) {
        console.info(`${cmd.runId}: audio ${audio.mode}`);
        for (const n of audio.mode === "designed"
          ? audio.notes.filter((l) => /^(music|mix)/.test(l))
          : audio.notes)
          console.info(`${cmd.runId}:   ${n}`);
      }
      progress(
        100,
        `audio: ${audio?.mode ?? "none"}${audio?.mode === "placeholder" ? ` (${audio.notes[0] ?? ""})` : ""}`,
      );
      return {
        outputs: [
          ref(cmd.runId, RUN_FILES.video, "video", "video/mp4"),
          ref(cmd.runId, RUN_FILES.timeline, "timeline", "application/json"),
        ],
        metrics: {
          designedAudio: audio?.mode === "designed" ? 1 : 0,
          durationSec: Math.round((res.durationSec ?? 0) * 100) / 100,
          renderSec: Math.round((Date.now() - started) / 100) / 10,
          warnings: res.compiled.issues.filter((i) => i.level === "warning").length,
        },
      };
    }
    default:
      throw new TaskFailure("UNSUPPORTED_TASK", `this worker does not handle ${cmd.taskType}`, false);
  }
}

/** Maps any error to the code, message and retry decision reported to the orchestrator. */
export function classify(e: unknown): { code: string; message: string; retryable: boolean } {
  const message = (e instanceof Error ? e.message : String(e)).slice(0, 1500);
  if (e instanceof TaskFailure) return { code: e.code, message, retryable: e.retryable };
  if (e instanceof MissingConfigError) return { code: "MISSING_CONFIG", message, retryable: false };
  if (e instanceof LlmError) return { code: "LLM_ERROR", message, retryable: e.retryable };
  const eleven = /^ElevenLabs (\d{3})/.exec(message);
  if (eleven) {
    const status = Number(eleven[1]);
    return { code: "VOICE_ERROR", message, retryable: status === 429 || status >= 500 };
  }
  if (/ENOENT/.test(message)) return { code: "MISSING_INPUT", message, retryable: false };
  return { code: "WORKER_ERROR", message, retryable: true };
}

/** Handles one command end to end and builds the result message (never throws). */
export async function handleCommand(
  cmd: TaskCommand,
  deps: WorkerDeps,
  progress: Progress,
): Promise<TaskResult> {
  const base = {
    schema: "erkasa.task-result/1" as const,
    messageId: randomUUID(),
    runId: cmd.runId,
    stepId: cmd.stepId,
    attempt: cmd.attempt,
    workerVersion: WORKER_VERSION,
  };
  const started = Date.now();
  try {
    const { outputs, metrics } = await executeTask(cmd, deps, progress);
    return TaskResult.parse({
      ...base,
      status: "SUCCEEDED",
      outputs,
      metrics: { ...metrics, seconds: Math.round((Date.now() - started) / 100) / 10 },
    });
  } catch (e) {
    return TaskResult.parse({
      ...base,
      status: "FAILED",
      outputs: [],
      metrics: { seconds: Math.round((Date.now() - started) / 100) / 10 },
      error: classify(e),
    });
  }
}

export interface WorkerOptions {
  log?: (line: string) => void;
  mq?: MqNames;
  /** Which queues to consume (default both). Each gets its own channel, so a render never blocks AI steps. */
  queues?: Array<"ai" | "render">;
}

export interface RunningWorker {
  /** Resolves when the connection closes (for any reason). */
  closed: Promise<void>;
  stop(): Promise<void>;
}

/** Connects, declares the topology and consumes tasks, one at a time per queue. */
export async function startWorker(deps: WorkerDeps, opts: WorkerOptions = {}): Promise<RunningWorker> {
  const log = opts.log ?? ((l: string) => console.info(l));
  const mq = opts.mq ?? new MqNames();
  const conn = await amqp.connect(rabbitUrl());
  const closed = new Promise<void>((r) => conn.once("close", () => r()));
  conn.on("error", (e: Error) => log(`rabbitmq connection error: ${e.message}`));

  const consume = async (queue: string): Promise<void> => {
    const ch: ConfirmChannel = await conn.createConfirmChannel();
    await mq.declare(ch);
    await ch.prefetch(1);
    await ch.consume(queue, (msg) => {
      if (msg) void onMessage(ch, msg);
    });
  };

  const publish = async (
    ch: ConfirmChannel,
    key: string,
    body: unknown,
    persistent: boolean,
  ): Promise<void> => {
    ch.publish(mq.eventsExchange, key, Buffer.from(JSON.stringify(body)), {
      contentType: "application/json",
      contentEncoding: "utf-8",
      persistent,
    });
    await ch.waitForConfirms();
  };

  const onMessage = async (ch: ConfirmChannel, msg: ConsumeMessage): Promise<void> => {
    let raw: unknown;
    try {
      raw = JSON.parse(msg.content.toString("utf8"));
    } catch {
      log("dropping a task that is not JSON");
      ch.ack(msg);
      return;
    }
    const parsed = TaskCommand.safeParse(raw);
    if (!parsed.success) {
      log(`dropping an invalid task command: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
      ch.ack(msg);
      return;
    }
    const cmd = parsed.data;
    const tag = `${cmd.runId}/${cmd.stepId}#${cmd.attempt}`;
    if (Date.parse(cmd.deadline) < Date.now()) {
      log(`${tag}: deadline passed before it started, skipping (the orchestrator retries it)`);
      ch.ack(msg);
      return;
    }
    log(`${tag}: ${cmd.taskType} started`);
    let lastSent = 0;
    const progress: Progress = (pct, message) => {
      const now = Date.now();
      if (now - lastSent < 1000 && pct < 100) return;
      lastSent = now;
      const body = TaskProgress.parse({
        schema: "erkasa.task-progress/1",
        runId: cmd.runId,
        stepId: cmd.stepId,
        attempt: cmd.attempt,
        pct: Math.max(0, Math.min(100, pct)),
        message: message.slice(0, 200),
      });
      publish(ch, MqNames.PROGRESS_KEY, body, false).catch(() => undefined);
    };
    const result = await handleCommand(cmd, deps, progress);
    try {
      await publish(ch, MqNames.RESULT_KEY, result, true);
      ch.ack(msg);
      log(
        result.status === "SUCCEEDED"
          ? `${tag}: done in ${result.metrics["seconds"] ?? "?"} s`
          : `${tag}: FAILED ${result.error?.code}: ${result.error?.message}`,
      );
    } catch (e) {
      // result not confirmed: leave the task unacked so RabbitMQ redelivers it when the channel closes
      log(`${tag}: could not publish the result (${e instanceof Error ? e.message : String(e)})`);
    }
  };

  const queues = opts.queues ?? ["ai", "render"];
  for (const q of queues) await consume(q === "ai" ? mq.aiQueue : mq.renderQueue);
  log(
    `worker ${WORKER_VERSION} listening on ${queues.map((q) => (q === "ai" ? mq.aiQueue : mq.renderQueue)).join(", ")}`,
  );
  log(`run folders: ${deps.storageDir}`);
  log(
    `connected to ${rabbitUrl().replace(/:[^:@/]+@/, ":***@")} (the backend must use the same RabbitMQ: port 5673 by default)`,
  );
  return {
    closed,
    stop: async () => {
      await conn.close().catch(() => undefined);
    },
  };
}

/** Keeps the worker running: reconnects every 5 s while RabbitMQ is unreachable. */
export async function runWorkerForever(opts: WorkerOptions = {}): Promise<never> {
  const log = opts.log ?? ((l: string) => console.info(l));
  const deps = defaultDeps();
  let warned = false;
  for (;;) {
    try {
      const w = await startWorker(deps, opts);
      warned = false;
      const stop = () => void w.stop().then(() => process.exit(0));
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
      await w.closed;
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
      log("rabbitmq connection closed; reconnecting");
    } catch (e) {
      if (!warned)
        log(
          `cannot reach RabbitMQ at ${rabbitUrl().replace(/:[^:@/]+@/, ":***@")} (${e instanceof Error ? e.message : String(e)}); retrying every 5 s. Is docker compose up?`,
        );
      warned = true;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}
