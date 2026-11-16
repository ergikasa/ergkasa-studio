/**
 * The AI director: asks a language model for a Film Plan, checks it with the same engine that will render it
 * (contract, staging, timing, QA), and sends the model back the exact problems until the plan is clean.
 *
 * The model never writes coordinates or SVG: it names sets, marks, props, people, verbs and templates. Anything
 * it gets wrong is an issue with a code and a shot id, which is what the repair turn quotes.
 */
import type { TimedWord } from "@erkasa/compiler";
import type { Script } from "@erkasa/contracts";
import { FilmPlan, Mood, Template, Verb } from "./contract.js";
import { prepare } from "./film.js";
import type { Issue } from "./perform.js";
import { describeSets } from "./sets.js";

/** The slice of a language model the director needs (structurally the same as the ai-worker's Llm). */
export interface DirectorLlm {
  json(req: {
    label: string;
    system: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    schema: Record<string, unknown>;
    maxTokens?: number;
  }): Promise<{ value: unknown; text: string; usage: DirectorUsage }>;
}
export interface DirectorUsage {
  label: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  ms: number;
}

export interface DirectAttempt {
  attempt: number;
  errors: Issue[];
  warnings: Issue[];
  /** The plan as the model wrote it (already decoded), for the run folder. */
  plan?: unknown;
}

export interface DirectResult {
  /** A plan with no errors, or undefined after the last attempt. */
  plan?: FilmPlan;
  attempts: DirectAttempt[];
  usage: DirectorUsage[];
}

export interface DirectOptions {
  voiceId: string;
  alignments?: Record<string, TimedWord[]>;
  clipDurations?: Record<string, number>;
  maxAttempts?: number;
  /** A finished plan shown to the model as an example of the craft (another script's). */
  example?: { script: Script; plan: FilmPlan };
}

// ------------------------------------------------------------------ the answer's schema

const str = { type: "string" };
const enumOf = (values: readonly string[]) => ({ type: "string", enum: [...values] });
const obj = (properties: Record<string, unknown>, required: string[] = Object.keys(properties)) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});
const nullable = (s: Record<string, unknown>) => ({ anyOf: [s, { type: "null" }] });

/**
 * Structured outputs need closed objects, so template params travel as a JSON string (`paramsJson`) and
 * optional fields as nullable ones; `decode` turns the answer back into a Film Plan.
 */
export const DIRECTOR_SCHEMA: Record<string, unknown> = obj({
  title: str,
  cast: {
    type: "array",
    items: obj({
      id: str,
      name: str,
      build: enumOf(["man", "woman"]),
      coat: nullable(str),
      hair: nullable(str),
      skin: nullable(str),
    }),
  },
  shots: {
    type: "array",
    items: obj({
      id: str,
      scene: str,
      from: str,
      moment: str,
      kind: enumOf(["set", "editorial"]),
      set: nullable(enumOf(["office", "interview", "room", "cage"])),
      light: nullable(enumOf(["day", "golden", "dusk", "night"])),
      lightTo: nullable(obj({ to: enumOf(["day", "golden", "dusk", "night"]), at: str })),
      framing: nullable(enumOf(["wide", "medium", "close", "ots", "insert"])),
      subject: nullable(str),
      camera: enumOf(["static", "push_in", "pull_out", "follow", "drift"]),
      actors: {
        type: "array",
        items: obj({
          id: str,
          at: str,
          pose: enumOf(["seated", "standing"]),
          facing: nullable(enumOf(["left", "right"])),
          mood: enumOf(Mood.options),
          holding: nullable(str),
        }),
      },
      actions: {
        type: "array",
        items: obj({
          who: nullable(str),
          do: enumOf(Verb.options),
          target: nullable(str),
          at: str,
          sec: nullable({ type: "number" }),
        }),
      },
      template: nullable(enumOf(Template.options)),
      paramsJson: str,
      text: nullable(
        obj({
          lines: {
            type: "array",
            items: obj({ t: str, weight: enumOf(["light", "bold"]), accent: { type: "boolean" } }),
          },
          at: str,
          out: nullable(str),
          place: enumOf(["top", "bottom", "center"]),
        }),
      ),
      transition: enumOf(["cut", "fade", "whip"]),
      continuity: nullable(enumOf(["carry", "reset"])),
    }),
  },
});

/** Drops nulls, parses paramsJson. Returns the candidate plan, or an issue when paramsJson is not JSON. */
export function decode(value: unknown, voiceId: string): { plan: unknown; issues: Issue[] } {
  const issues: Issue[] = [];
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>)
          .filter(([, x]) => x !== null)
          .map(([k, x]) => [k, strip(x)]),
      );
    return v;
  };
  const v = strip(value) as { title?: string; cast?: unknown[]; shots?: Array<Record<string, unknown>> };
  const shots = (v.shots ?? []).map((s, i) => {
    const { paramsJson, ...rest } = s;
    let params: unknown = {};
    if (typeof paramsJson === "string" && paramsJson.trim()) {
      try {
        params = JSON.parse(paramsJson);
      } catch {
        issues.push({
          level: "error",
          code: "PARAMS_NOT_JSON",
          path: `shots[${i}] ${String(s["id"] ?? "")}`,
          message: "paramsJson is not valid JSON",
        });
      }
    }
    return { ...rest, params };
  });
  return { plan: { schema: "erkasa.film/1", title: v.title, voiceId, cast: v.cast ?? [], shots }, issues };
}

// ------------------------------------------------------------------ the brief

const TEMPLATE_DOC = `- statement: type only on the show's backdrop; needs \`text\`. params {}
- clock: a wall clock. params {"time":"5:58"}
- scale: a balance tipping. params {"left":"STAY","right":"LEAVE","items":[{"label":"6 years","side":"left","at":"word:years"}],"clearAt":"word:ignore"}
- curves: two growth curves splitting. params {"a":{"label":"better","end":37.8},"b":{"label":"worse","end":0.03}}
- bars: up to 4 bars. params {"unit":"%","bars":[{"label":"guessed","value":40},{"label":"real","value":15}]}
- counter: a number counting. params {"from":1,"to":37.8,"decimals":1,"suffix":"×","label":"one year later"}
- word_shadow: a word and the darker word behind it. params {"word":"YES","shadow":"NO"}
- time_strip: an evening split into activities, one pushes out the rest. params {"label":"Tonight","segments":["series","gym","call"],"keep":0,"pushAt":"word:pushed"}
- receipts: what it looks like vs what it cost. params {"front":{"title":"Said yes","lines":["help Ana"]},"back":{"title":"Said no to","lines":["gym","sleep"]},"revealAt":"word:cost"}
- calendar: days or weeks flipping. params {"from":1,"to":30,"label":"Day"}
- window_dream: the imagined other life, seen over a shoulder. params {}
- cards: two cards side by side. params {"left":{"title":"Plan","lines":["2 weeks"]},"right":{"title":"Reality","lines":["7 weeks"]}}`;

export function directorSystem(): string {
  return `You are the film director of Erkasa, a channel of 35-60 second vertical explainer films about psychology and
everyday decisions. The narration is fixed. You decide what the viewer SEES, shot by shot, so that the picture
carries the story and the narration does not have to explain the picture.

How a good Erkasa film is cut:
- One shot = one moment the viewer must get or feel. Write that moment in \`moment\`.
- Shots last 2.5 to 7 seconds of narration. A sentence can hold two shots; a shot can cross a sentence.
- Mix staged shots (people on a set, acting) and editorial shots (a designed template). Open on the hook image.
- Continuity: a person is picked up in the next shot on the same set exactly where, how and in the mood the last shot left them (a walk goes on, a sit finishes). Place them where they really are, or make them walk there. Only when time has passed or the story jumps (a flash-forward, "weeks later") set \`continuity: "reset"\`; otherwise leave it null.
  Never two statements in a row; at most two statements per film. Vary framing between consecutive staged shots.
- Acting is specific and physical: people look, hesitate, pick things up, sit down, sigh, cross arms. Give each
  staged shot 2-6 actions spread over its duration, anchored to the words they illustrate. Nothing stands still.
- On-screen type is short (2-6 words a line, 1-3 lines), it never repeats the narration word for word, and it
  lands on the word it belongs to. Use \`accent\` for the one word that matters.
- The same person keeps the same id and look in every shot (cast). At most 3 people.

The plan's vocabulary (anything else is an error):
- \`scene\` is a script scene id. \`from\` is where the shot starts: "start" (the scene's first word) or
  "word:<word>" (that word in that scene's narration, lowercase, no punctuation; "word:<word>#2" for the second
  time it occurs). Action and text anchors use the same form, or "sec:<seconds after the shot starts>".
  Every shot must start later than the one before it.
- Sets, with their marks (where people stand or sit), props (things to pick up) and look targets:
${describeSets()}
- An actor is placed at a mark: seated only on a seat mark. \`holding\` names a prop already in the hand.
- Verbs: ${Verb.options.join(", ")}.
  look/glance/point/lean_in/hesitate take a target (a mark, prop, person or look target); walk_to a mark;
  pick_up a prop within reach (walk to it first); put_down a surface mark; give a person within reach; mood a
  mood (${Mood.options.join(", ")}); open needs no who. type/talk/look take \`sec\`.
- Framing: wide, medium, close, ots (over the shoulder), insert (a hand or an object). \`subject\` is who or what
  the camera holds.
- Editorial templates and their params (written as a JSON string in \`paramsJson\`; "{}" when none):
${TEMPLATE_DOC}

Answer with the whole plan. Shot ids are sh01, sh02... Fields you do not use are null.`;
}

function scriptBrief(script: Script): string {
  return [
    `Title: ${script.title}`,
    `Promise: ${script.promise}`,
    ...script.scenes.map(
      (s) =>
        `[${s.sceneId}] (${s.beat}${s.emotion ? `, ${s.emotion}` : ""}) "${s.narration}"${s.visualIdea ? `\n   writer's idea: ${s.visualIdea}` : ""}`,
    ),
  ].join("\n");
}

/** What the model is told about its plan when the engine finds problems. */
export function repairBrief(errors: Issue[], warnings: Issue[]): string {
  const line = (i: Issue) => `- ${i.code} at ${i.path}: ${i.message}`;
  return [
    `The engine rejected this plan. Fix every error below and answer with the whole corrected plan.`,
    ...errors.slice(0, 40).map(line),
    ...(warnings.length ? [`Also improve these if you can:`, ...warnings.slice(0, 15).map(line)] : []),
    `Keep every shot that has no error as it is.`,
  ].join("\n");
}

/** Contract errors from zod, as issues with a readable path. */
function contractIssues(
  err: { issues: Array<{ path: PropertyKey[]; message: string }> },
  plan: unknown,
): Issue[] {
  const shots = (plan as { shots?: Array<{ id?: string }> }).shots ?? [];
  return err.issues.map((i) => {
    const [a, b, ...rest] = i.path;
    const where =
      a === "shots" && typeof b === "number"
        ? `${shots[b]?.id ?? `shots[${b}]`}.${rest.join(".")}`
        : i.path.join(".");
    return { level: "error", code: "CONTRACT", path: where, message: i.message };
  });
}

/** Checks a candidate plan with the real engine: contract, staging, timing and the film rules. */
export function review(
  candidate: unknown,
  script: Script,
  opts: Pick<DirectOptions, "alignments" | "clipDurations">,
): { plan?: FilmPlan; errors: Issue[]; warnings: Issue[] } {
  const parsed = FilmPlan.safeParse(candidate);
  if (!parsed.success) return { errors: contractIssues(parsed.error, candidate), warnings: [] };
  let issues: Issue[];
  try {
    issues = prepare({
      plan: parsed.data,
      script,
      ...(opts.alignments ? { alignments: opts.alignments } : {}),
      ...(opts.clipDurations ? { clipDurations: opts.clipDurations } : {}),
    }).issues;
  } catch (e) {
    issues = [
      { level: "error", code: "ENGINE", path: "plan", message: e instanceof Error ? e.message : String(e) },
    ];
  }
  return {
    plan: parsed.data,
    errors: issues.filter((i) => i.level === "error"),
    warnings: issues.filter((i) => i.level === "warning"),
  };
}

/** Writes a plan back in the answer's shape (for the example and for repair turns). */
export function encode(plan: FilmPlan): unknown {
  return {
    title: plan.title,
    cast: plan.cast.map((c) => ({
      id: c.id,
      name: c.name,
      build: c.build,
      coat: c.coat ?? null,
      hair: c.hair ?? null,
      skin: c.skin ?? null,
    })),
    shots: plan.shots.map(({ params, ...s }) => ({
      ...s,
      continuity: s.continuity ?? null,
      paramsJson: JSON.stringify(params ?? {}),
    })),
  };
}

/** Directs a script: up to `maxAttempts` model turns, each one answering the engine's issues. */
export async function direct(script: Script, llm: DirectorLlm, opts: DirectOptions): Promise<DirectResult> {
  const max = opts.maxAttempts ?? 3;
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (opts.example)
    messages.push(
      { role: "user", content: `Direct this script.\n\n${scriptBrief(opts.example.script)}` },
      { role: "assistant", content: JSON.stringify(encode(opts.example.plan)) },
    );
  messages.push({ role: "user", content: `Direct this script.\n\n${scriptBrief(script)}` });
  const attempts: DirectAttempt[] = [];
  const usage: DirectorUsage[] = [];
  for (let n = 1; n <= max; n++) {
    const res = await llm.json({
      label: `film#${n}`,
      system: directorSystem(),
      messages,
      schema: DIRECTOR_SCHEMA,
      maxTokens: 32000,
    });
    usage.push(res.usage);
    const decoded = decode(res.value, opts.voiceId);
    const r = decoded.issues.length
      ? { errors: decoded.issues, warnings: [] }
      : review(decoded.plan, script, opts);
    attempts.push({ attempt: n, errors: r.errors, warnings: r.warnings, plan: decoded.plan });
    if (!r.errors.length && "plan" in r && r.plan) return { plan: r.plan, attempts, usage };
    messages.push(
      { role: "assistant", content: res.text },
      { role: "user", content: repairBrief(r.errors, r.warnings) },
    );
  }
  return { attempts, usage };
}
