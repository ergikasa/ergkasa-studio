/**
 * E1.5 end-to-end fixture: a short v2 film made by the worker, offline and deterministic, with a scripted model
 * (the script and the film plan) and the synthetic voice. `makeRun` runs the worker tasks up to the voiced, planned
 * run (no render), and copies it so each pipeline renders the very same inputs.
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TaskCommand } from "@erkasa/contracts";
import { FilmPlan } from "@erkasa/film";
import { encode } from "@erkasa/planner";
import { Catalog } from "../src/catalog.js";
import { repoRoot } from "../src/env.js";
import type { JsonRequest, JsonResponse, Llm } from "../src/llm.js";
import { handleCommand, type WorkerDeps } from "../src/worker.js";
import { SyntheticVoice } from "./synthetic-voice.js";

export const RUN = "20261118-120000-e2e-a1b2";

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

/** Two shots: a staged set (an actor, a dissolve in) and an editorial template, with kinetic type. */
export const FILM = FilmPlan.parse({
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
      actors: [{ id: "ben", at: "chair", pose: "seated", mood: "tired" }],
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
      transition: "fade",
      params: { a: { label: "invested", end: 6 }, b: { label: "saved", end: 1.2 } },
      text: { lines: [{ t: "Let time work.", weight: "bold" }], at: "word:time", place: "top" },
    },
  ],
});

export function deps(storage: string): WorkerDeps {
  const llm: Llm = {
    async json(req: JsonRequest): Promise<JsonResponse> {
      const value = req.label.startsWith("film") ? encode(FILM) : scriptDraft;
      return {
        value,
        text: JSON.stringify(value),
        usage: { label: req.label, model: "scripted", inputTokens: 1, outputTokens: 1, ms: 1 },
      };
    },
  };
  return {
    catalog: new Catalog(join(repoRoot(), "assets")),
    storageDir: storage,
    llm: () => llm,
    voiceFor: (preset) => new SyntheticVoice(preset),
  };
}

export const cmd = (
  taskType: string,
  stepId: string,
  params: Record<string, unknown>,
  attempt = 1,
): TaskCommand =>
  TaskCommand.parse({
    schema: "erkasa.task/1",
    messageId: `msg-${stepId}-${String(attempt).padStart(4, "0")}`,
    taskType,
    runId: RUN,
    stepId,
    attempt,
    idempotencyKey: "0123456789abcdef0123",
    inputs: [],
    params,
    deadline: "2030-01-01T00:00:00Z",
  });

/** A storage folder holding the run planned (script.write, voice.synthesize unless `voice: false`, visual.plan). */
export async function makeRun(opts: { voice?: boolean } = {}): Promise<string> {
  const storage = mkdtempSync(join(tmpdir(), "erkasa-e2e-"));
  const d = deps(storage);
  const noop = (): void => undefined;
  const steps: Array<readonly [string, string, Record<string, unknown>]> = [
    ["script.write", "script", { topic: "saving vs investing", theme: "money", seconds: 20 }],
    ...(opts.voice === false ? [] : [["voice.synthesize", "voice", { voice: "" }] as const]),
    ["visual.plan", "plan", { voice: "", projectId: RUN, engine: "film" }],
  ];
  for (const [type, step, params] of steps) {
    const r = await handleCommand(cmd(type, step, params), d, noop);
    if (r.status !== "SUCCEEDED") throw new Error(`${type}: ${JSON.stringify(r.error)}`);
  }
  return storage;
}

/** A copy of a storage folder (each pipeline renders its own copy of the same run). */
export function copyRun(storage: string): string {
  const to = mkdtempSync(join(tmpdir(), "erkasa-e2e-copy-"));
  cpSync(join(storage, RUN), join(to, RUN), { recursive: true });
  return to;
}

export const ffmpeg = (): string => process.env["ERKASA_FFMPEG"] ?? "ffmpeg";
export const ffprobeBin = (): string => process.env["ERKASA_FFPROBE"] ?? "ffprobe";

/** ffprobe's JSON for a file: format and streams. */
export function probe(file: string): {
  format: { duration: string };
  streams: Array<Record<string, string | number | undefined>>;
} {
  const r = spawnSync(
    ffprobeBin(),
    ["-v", "error", "-show_format", "-show_streams", "-count_frames", "-of", "json", file],
    { encoding: "utf8", maxBuffer: 64 << 20 },
  );
  if (r.status !== 0) throw new Error(r.stderr);
  return JSON.parse(r.stdout) as ReturnType<typeof probe>;
}

/** The decoded video frames (raw yuv420p), as one hash per frame (ffmpeg framemd5). */
export function frameHashes(file: string): string[] {
  const r = spawnSync(ffmpeg(), ["-v", "error", "-i", file, "-map", "0:v", "-f", "framemd5", "-"], {
    encoding: "utf8",
    maxBuffer: 64 << 20,
  });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(",").map((x) => x.trim())[5] as string);
}

/** The decoded audio as raw PCM (32-bit float, the stream's own rate and channels), or undefined if none. */
export function pcm(file: string): Buffer | undefined {
  const r = spawnSync(ffmpeg(), ["-v", "error", "-i", file, "-map", "0:a", "-f", "f32le", "-"], {
    maxBuffer: 1 << 30,
  });
  if (r.status !== 0) return undefined;
  return r.stdout;
}
