import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { JsonRequest, JsonResponse, Llm, Usage } from "./llm.js";

/** File name of a recorded answer: `world#2` -> `world-2.json`. */
const fileOf = (label: string): string => `${label.replace(/[^a-z0-9]+/gi, "-")}.json`;

/** Characters of the request the model reads (system + messages), for size and cost reports. */
export function requestChars(req: JsonRequest): number {
  return req.system.length + req.messages.reduce((n, m) => n + m.content.length, 0);
}

interface Recording {
  label: string;
  value: unknown;
  usage?: Usage;
  promptChars?: number;
}

/**
 * Keeps every answer of the model in the run folder (`llm/<label>.json`) with its token usage, so a run can
 * be inspected, compared and replayed later at no cost.
 */
export class RecordingLlm implements Llm {
  constructor(
    private readonly inner: Llm,
    private readonly dir: string,
  ) {}

  async json(req: JsonRequest): Promise<JsonResponse> {
    const res = await this.inner.json(req);
    mkdirSync(this.dir, { recursive: true });
    const rec: Recording = {
      label: req.label,
      value: res.value,
      usage: res.usage,
      promptChars: requestChars(req),
    };
    writeFileSync(join(this.dir, fileOf(req.label)), `${JSON.stringify(rec, null, 2)}\n`);
    return res;
  }
}

/**
 * Answers from a recorded run (`<dir>/llm/<label>.json`, or `<dir>/<label>.json`) instead of calling the API.
 * The pipeline around it is the real one: prompts are built, answers are checked, worlds are built, plans
 * are compiled and reviewed, the video is rendered. Usage is the recorded one; for an answer recorded
 * without usage it is estimated from the text (4 characters per token) and marked `estimated` in the label.
 */
export class ReplayLlm implements Llm {
  constructor(private readonly dir: string) {}

  async json(req: JsonRequest): Promise<JsonResponse> {
    // a repair turn the recording does not have (plan#3) gets the latest recorded attempt (plan#2, plan#1)
    const m = /^(.*)#(\d+)$/.exec(req.label);
    const labels = m
      ? Array.from({ length: Number(m[2]) }, (_, i) => `${m[1]}#${Number(m[2]) - i}`)
      : [req.label];
    const file = labels
      .flatMap((l) => [join(this.dir, "llm", fileOf(l)), join(this.dir, fileOf(l))])
      .find((f) => existsSync(f));
    if (!file) throw new Error(`replay: no recorded answer for '${req.label}' in ${this.dir}`);
    const rec = JSON.parse(readFileSync(file, "utf8")) as Recording;
    const text = JSON.stringify(rec.value);
    const usage: Usage = rec.usage ?? {
      label: `${req.label} (estimated)`,
      model: "claude-sonnet-5-5",
      inputTokens: Math.round(requestChars(req) / 4),
      outputTokens: Math.round(text.length / 4),
      ms: 0,
    };
    return { value: rec.value, text, usage: { ...usage, label: usage.label } };
  }
}
