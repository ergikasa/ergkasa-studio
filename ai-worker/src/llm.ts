import { optional, required } from "./env.js";

/** A JSON Schema that obeys the structured-outputs subset (additionalProperties false, no min/max). */
export type StrictSchema = Record<string, unknown>;

export interface LlmMessage {
  role: "user" | "assistant";
  content: string;
}

export interface JsonRequest {
  /** Short label for logs and cost reports, e.g. "script" or "plan#2". */
  label: string;
  system: string;
  messages: LlmMessage[];
  schema: StrictSchema;
  maxTokens?: number;
}

export interface Usage {
  label: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  ms: number;
}

export interface JsonResponse {
  /** Parsed JSON, guaranteed to match `schema` by the API (still validated again by the caller). */
  value: unknown;
  /** The raw JSON text, kept so a repair turn can quote the model's previous answer. */
  text: string;
  usage: Usage;
}

/** What the planner and script writer need from a language model. Tests pass a scripted fake. */
export interface Llm {
  json(req: JsonRequest): Promise<JsonResponse>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

const API = "https://api.anthropic.com/v1/messages";
const RETRY_STATUS = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

interface ApiResponse {
  model: string;
  stop_reason: string | null;
  content: Array<{ type: string; text?: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * Claude via the Messages API with structured outputs (`output_config.format`), plain fetch, no SDK.
 * Retries rate limits / overload with exponential backoff. Model: ERKASA_LLM_MODEL (default Sonnet 5.5).
 */
export class AnthropicLlm implements Llm {
  readonly model: string;
  private readonly key: string;

  constructor(opts: { model?: string; apiKey?: string } = {}) {
    this.key = opts.apiKey ?? required("ANTHROPIC_API_KEY", "from https://platform.claude.com/settings/keys");
    this.model = opts.model ?? optional("ERKASA_LLM_MODEL", "claude-sonnet-5-5");
  }

  async json(req: JsonRequest): Promise<JsonResponse> {
    const body = JSON.stringify({
      model: this.model,
      max_tokens: req.maxTokens ?? 32000,
      system: req.system,
      messages: req.messages,
      output_config: { format: { type: "json_schema", schema: req.schema } },
    });
    const started = Date.now();
    for (let attempt = 1; ; attempt++) {
      let res: Response;
      try {
        res = await fetch(API, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": this.key,
            "anthropic-version": "2023-06-01",
          },
          body,
          signal: AbortSignal.timeout(300_000),
        });
      } catch (e) {
        if (attempt < 4) {
          await sleep(2000 * 2 ** attempt);
          continue;
        }
        throw new LlmError(`Claude API unreachable: ${e instanceof Error ? e.message : String(e)}`, true);
      }
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 600);
        if (RETRY_STATUS.has(res.status) && attempt < 5) {
          const after = Number(res.headers.get("retry-after"));
          await sleep(Number.isFinite(after) && after > 0 ? after * 1000 : 2000 * 2 ** attempt);
          continue;
        }
        const hint = res.status === 401 ? " (check ANTHROPIC_API_KEY in .env)" : "";
        throw new LlmError(`Claude API ${res.status}${hint}: ${detail}`, RETRY_STATUS.has(res.status));
      }
      const data = (await res.json()) as ApiResponse;
      const text = data.content.find((b) => b.type === "text")?.text;
      if (data.stop_reason === "max_tokens")
        throw new LlmError(`${req.label}: answer cut off at max_tokens; raise maxTokens`, false);
      if (data.stop_reason === "refusal" || text === undefined)
        throw new LlmError(
          `${req.label}: the model declined or returned no text (stop_reason=${data.stop_reason})`,
          false,
        );
      let value: unknown;
      try {
        value = JSON.parse(text);
      } catch {
        throw new LlmError(`${req.label}: model output is not JSON`, true);
      }
      return {
        value,
        text,
        usage: {
          label: req.label,
          model: data.model,
          inputTokens: data.usage.input_tokens,
          outputTokens: data.usage.output_tokens,
          ms: Date.now() - started,
        },
      };
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** USD per million tokens, input/output (platform.claude.com pricing, Nov 2026). Used for the cost report only. */
const PRICES: Record<string, [number, number]> = {
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-fable-5-1": [10, 50],
};

/** Estimated cost in USD, or undefined for a model without a known price. */
export function llmCost(usage: Usage[]): number | undefined {
  let total = 0;
  for (const u of usage) {
    const p = PRICES[u.model] ?? Object.entries(PRICES).find(([k]) => u.model.startsWith(k))?.[1];
    if (!p) return undefined;
    total += (u.inputTokens * p[0] + u.outputTokens * p[1]) / 1e6;
  }
  return total;
}
