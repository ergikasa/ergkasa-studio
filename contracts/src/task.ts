import { z } from "zod";
import { ArtifactUri, Sha256 } from "./common.js";

/** Every unit of work a worker can do. Adding a worker means adding its task type here. */
export const TaskType = z.enum([
  "director.plan",
  "script.write",
  "storyboard.build",
  "visual.plan",
  "assets.resolve",
  "voice.synthesize",
  "subtitle.build",
  "audio.plan",
  "timeline.compile",
  "render.chunk",
  "render.finalize",
]);
export type TaskType = z.infer<typeof TaskType>;

export const ArtifactPointer = z
  .object({
    role: z.string().regex(/^[a-z_]+$/),
    ref: ArtifactUri,
    sha256: Sha256.optional(),
    mediaType: z.string().optional(),
  })
  .strict();

/** Orchestrator -> worker (RabbitMQ). Carries references, never file contents. */
export const TaskCommand = z
  .object({
    schema: z.literal("erkasa.task/1"),
    messageId: z.string().min(8),
    taskType: TaskType,
    runId: z.string().min(1),
    stepId: z.string().min(1),
    attempt: z.number().int().positive(),
    /** Hash of taskType + inputs + params + worker version. Same key, same result. */
    idempotencyKey: z.string().min(16),
    inputs: z.array(ArtifactPointer),
    params: z.record(z.string(), z.unknown()).default({}),
    deadline: z.iso.datetime(),
    traceId: z.string().optional(),
  })
  .strict();
export type TaskCommand = z.infer<typeof TaskCommand>;

export const TaskError = z
  .object({
    code: z.string().regex(/^[A-Z][A-Z0-9_]+$/),
    message: z.string(),
    retryable: z.boolean(),
  })
  .strict();

/** Worker -> orchestrator. A step is SUCCEEDED only after its outputs are validated. */
export const TaskResult = z
  .object({
    schema: z.literal("erkasa.task-result/1"),
    messageId: z.string().min(8),
    runId: z.string().min(1),
    stepId: z.string().min(1),
    attempt: z.number().int().positive(),
    status: z.enum(["SUCCEEDED", "FAILED"]),
    outputs: z.array(ArtifactPointer).default([]),
    metrics: z.record(z.string(), z.number()).default({}),
    error: TaskError.optional(),
    workerVersion: z.string().min(1),
  })
  .strict()
  .superRefine((r, ctx) => {
    if (r.status === "FAILED" && !r.error)
      ctx.addIssue({ code: "custom", message: "FAILED result needs error", path: ["error"] });
    if (r.status === "SUCCEEDED" && r.outputs.length === 0)
      ctx.addIssue({ code: "custom", message: "SUCCEEDED result needs outputs", path: ["outputs"] });
  });
export type TaskResult = z.infer<typeof TaskResult>;
