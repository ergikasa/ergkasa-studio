/**
 * Redo one scene of a finished plan (Phase 6): "do it again" or "do it like this: ..." in the producer's words.
 * The narration, the world, the cast and every other scene stay as they are; the director re-plans only this
 * scene with the neighbours as context, the whole plan is compiled again and only findings about this scene
 * go back to the model (up to 3 attempts).
 */
import { compileVideo, type CompileResult, type Issue, type TimedWord } from "@erkasa/compiler";
import type { Script, VideoPlan } from "@erkasa/contracts";
import type { Catalog } from "./catalog.js";
import { reviewDirection } from "./direction.js";
import type { Llm, LlmMessage, Usage } from "./llm.js";
import { DRAFT_SCHEMA, draftToPlan, type Draft } from "./plan-draft.js";
import { PLANNER_SYSTEM, plannerPrompt } from "./planner.js";

export interface RedoOptions {
  sceneId: string;
  /** What the producer wants, in plain words ("show the coin falling", "less empty"). Empty = just try again. */
  request?: string;
  projectId: string;
  voiceId: string;
  narrator?: string;
  host?: string;
  alignments?: Record<string, TimedWord[]>;
  seed?: number;
  maxAttempts?: number;
}

export interface RedoResult {
  plan: VideoPlan;
  compiled?: CompileResult;
  /** True when the new scene compiles and passes the director's review. */
  clean: boolean;
  issues: Issue[];
  usage: Usage[];
}

/** One line per scene a neighbour: where it happens, who is in it, how it is framed. */
function glance(plan: VideoPlan, i: number): string {
  const s = plan.scenes[i];
  if (!s) return "none";
  const who = s.layers.filter((l) => l.type === "actor").map((l) => (l.type === "actor" ? l.assetId : ""));
  return `${s.sceneId}: ${s.background.assetId}; shot ${s.shot?.size ?? "wide"}; ${who.length ? `people: ${who.join(", ")}` : "no people"}${s.direction ? `; idea: ${s.direction.idea}` : ""}`;
}

export async function redoScene(
  llm: Llm,
  script: Script,
  plan: VideoPlan,
  catalog: Catalog,
  opts: RedoOptions,
): Promise<RedoResult> {
  const idx = plan.scenes.findIndex((s) => s.sceneId === opts.sceneId);
  const sc = script.scenes.find((s) => s.sceneId === opts.sceneId);
  if (idx < 0 || !sc) throw new Error(`no scene ${opts.sceneId} in this plan`);
  const current = plan.scenes[idx];
  const one: Script = { ...script, scenes: [sc] };
  const context = `You are re-directing ONE scene of a film that is already planned. Every other scene stays exactly as it is, so keep this one consistent with them: same world, same people, same look.
Before: ${glance(plan, idx - 1)}
After: ${glance(plan, idx + 1)}
The scene as it is now: ${current?.direction ? `idea "${current.direction.idea}"; ` : ""}${current?.background.assetId}, shot ${current?.shot?.size ?? "wide"}.
${opts.request?.trim() ? `The producer asks: "${opts.request.trim()}". Do that, in a way the narration still fits.` : "The producer is not happy with it: make a clearly different, better version (another framing, another way to show the idea)."}
Answer with a plan for this one scene only.

`;
  const messages: LlmMessage[] = [
    { role: "user", content: context + plannerPrompt(one, catalog, opts.narrator, opts.host) },
  ];
  const usage: Usage[] = [];
  let best: { plan: VideoPlan; compiled: CompileResult; issues: Issue[] } | undefined;
  const mine = (i: Issue): boolean => i.path.startsWith(`scenes[${idx}]`) || i.path === "scenes";

  for (let attempt = 1; attempt <= (opts.maxAttempts ?? 3); attempt++) {
    const res = await llm.json({
      label: `redo-${opts.sceneId}#${attempt}`,
      system: PLANNER_SYSTEM,
      messages,
      schema: DRAFT_SCHEMA,
      maxTokens: 12000,
    });
    usage.push(res.usage);
    const converted = draftToPlan(res.value as Draft, one, opts);
    let issues = converted.issues;
    let compiled: CompileResult | undefined;
    let next: VideoPlan | undefined;
    const scene = converted.plan?.scenes[0];
    if (scene) {
      next = { ...plan, scenes: plan.scenes.map((s, i) => (i === idx ? scene : s)) };
      compiled = compileVideo(next, {
        assets: catalog.source,
        seed: opts.seed ?? 20261108,
        ...(opts.alignments ? { alignments: opts.alignments } : {}),
      });
      issues = compiled.issues.filter(mine);
    }
    const errors = issues.filter((i) => i.level === "error");
    let findings: Issue[] = [];
    if (next && compiled?.timeline && errors.length === 0) {
      const fps = compiled.timeline.fps;
      findings = reviewDirection({
        plan: next,
        script,
        durations: Object.fromEntries(compiled.scenes.map((s) => [s.sceneId, s.duration / fps])),
        compileIssues: compiled.issues,
        ...(opts.host ? { host: opts.host } : {}),
        ...(catalog.world ? { world: true } : {}),
      }).filter(mine);
      if (!best || findings.length < best.issues.length) best = { plan: next, compiled, issues: findings };
      if (findings.length === 0) break;
    }
    messages.push(
      { role: "assistant", content: res.text },
      {
        role: "user",
        content: `${errors.length ? "The compiler rejected this scene." : "The scene compiles, but the director's review found problems."}
${(errors.length ? issues : findings).map((i) => `- [${i.level}] ${i.code} at ${i.path}: ${i.message}${i.hint ? ` (hint: ${i.hint})` : ""}`).join("\n")}

Fix every problem and answer with the corrected plan for this one scene.`,
      },
    );
  }
  if (!best)
    return {
      plan,
      clean: false,
      issues: [
        {
          level: "error",
          code: "REDO_FAILED",
          path: `scenes[${idx}]`,
          message: "no version of the scene compiled; the scene is unchanged",
        },
      ],
      usage,
    };
  return {
    plan: best.plan,
    compiled: best.compiled,
    clean: best.issues.length === 0,
    issues: best.issues,
    usage,
  };
}
