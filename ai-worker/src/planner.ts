import { compileVideo, type CompileResult, type Issue, type TimedWord } from "@erkasa/compiler";
import type { Script, VideoPlan } from "@erkasa/contracts";
import type { Catalog } from "./catalog.js";
import type { Llm, LlmMessage, Usage } from "./llm.js";
import { DRAFT_SCHEMA, draftToPlan, type Draft } from "./plan-draft.js";

export const PLANNER_SYSTEM = `You are the art director of a 2D animation studio that makes vertical 9:16 explainer shorts (1080x1920, 30 fps).
You turn a narrated script into a precise visual plan. A compiler checks your plan; anything you reference must exist in the catalog exactly as written.

Direction rules (they decide whether people keep watching):
- Something moves in the first half second of every scene. The picture changes or something new appears every 2-4 seconds.
- Scene 1 (the hook): a character reacting strongly or a striking metaphor, plus the key words as big text (hook_impact, region top-safe) popping in on the hook's strongest word, and a camera punch_in on that word.
- Sync to speech: time entrances, actions and animations to the narration words they illustrate ("word:<word>"). The word must appear in that scene's narration.
- Use one main character through the video for continuity; give them speaks=true in the scenes where they are on screen and the narration is theirs. At most one speaker per scene.
- Abstract ideas -> a metaphor. Numbers -> a chart (counter for one number, compare/bar for two or more, linear_vs_exponential for growth over time). Concrete things -> objects/icons.
- Composition for 9:16: actors stand on the ground (y = -1) with x between 0.2 and 0.8; text in region top-safe; keep the band y 0.62-0.76 clear (captions are drawn there automatically); never put two big elements at the same spot.
- Actors facing left/right can walk or run: set facing, add a walk action with toX. Front-only gestures (wave, think, point_side...) need facing front; side actions (walk, run, point_forward, jump) need left/right.
- Metaphors are drawn over the scene; place them at x 0.5, y about 0.4, scale 0.8-1, and play their named animations on the matching words.
- Text: max 5 words, ALL CAPS reads best for hook_impact. Highlight 1-2 key words.
- Camera: subtle push_in (to 1.04-1.1) in calm scenes, punch_in (to 1.15-1.25) on a key word, static when a chart is drawing.
- Transitions between scenes: mostly cut or a quick whip/slide; fade for a mood change.
- Keep it clean: 2 to 5 layers per scene.

Answer with the full plan for every scene of the script, in order, with the same sceneId values.`;

/** A worked example in the draft format (scene s02b of the habits demo, which renders correctly). */
const EXAMPLE = {
  sceneId: "s02",
  background: "bg_trading_room_01",
  layers: [
    {
      id: "bardhi",
      type: "actor",
      assetId: "char_bardhi_01",
      x: 0.2,
      y: -1,
      scale: 0.9,
      region: "none",
      facing: "front",
      expression: "thinking",
      speaks: true,
      enter: "none",
      enterAt: "start",
      actions: [
        { action: "think", at: "start", durationSec: 0, toX: -1 },
        { action: "point_side", at: "word:grow", durationSec: 0, toX: -1 },
      ],
      animations: [],
      text: "",
      textStyle: "",
      highlight: [],
      chart: "none",
      chartData: [],
      unit: "",
    },
    {
      id: "growth",
      type: "chart",
      assetId: "",
      x: 0.56,
      y: 0.45,
      scale: 0.82,
      region: "none",
      facing: "front",
      expression: "",
      speaks: false,
      enter: "draw_on",
      enterAt: "word:thirty",
      actions: [],
      animations: [],
      text: "",
      textStyle: "",
      highlight: [],
      chart: "linear_vs_exponential",
      chartData: [
        { label: "Saved", value: 72000 },
        { label: "Invested", value: 200000 },
      ],
      unit: "$",
    },
    {
      id: "title",
      type: "text",
      assetId: "",
      x: 0.5,
      y: -1,
      scale: 1,
      region: "top-safe",
      facing: "front",
      expression: "",
      speaks: false,
      enter: "pop",
      enterAt: "word:grow",
      actions: [],
      animations: [],
      text: "TIME is the multiplier",
      textStyle: "hook_impact",
      highlight: ["TIME"],
      chart: "none",
      chartData: [],
      unit: "",
    },
  ],
  camera: [{ move: "push_in", at: "start", to: 1.06 }],
  effects: [],
  transition: "slide",
  transitionDirection: "left",
};

export interface PlanAttempt {
  attempt: number;
  draft?: unknown;
  plan?: VideoPlan;
  issues: Issue[];
}

export interface PlanResult {
  /** Set when the last attempt compiled without errors. */
  plan?: VideoPlan;
  compiled?: CompileResult;
  attempts: PlanAttempt[];
  usage: Usage[];
}

export interface PlanOptions {
  projectId: string;
  voiceId: string;
  /** Real word timings per scene if the voice already exists (better sync checks). */
  alignments?: Record<string, TimedWord[]>;
  maxAttempts?: number;
  seed?: number;
}

function formatIssues(issues: Issue[]): string {
  return issues
    .map((i) => `- [${i.level}] ${i.code} at ${i.path}: ${i.message}${i.hint ? ` (hint: ${i.hint})` : ""}`)
    .join("\n");
}

export function plannerPrompt(script: Script, catalog: Catalog): string {
  const scriptText = script.scenes.map((s) => `${s.narration} ${s.visualIdea} ${s.emphasis ?? ""}`).join(" ");
  return `# Catalog
${catalog.plannerSection(scriptText)}

# Example of one scene in the answer format
${JSON.stringify(EXAMPLE)}

# Script: "${script.title}" (theme: ${script.theme})
${script.scenes
  .map(
    (s) =>
      `## ${s.sceneId}\nNarration: ${s.narration}\nVisual idea: ${s.visualIdea}${s.emphasis ? `\nEmphasis: ${s.emphasis}` : ""}`,
  )
  .join("\n\n")}`;
}

/**
 * Script -> Video Plan. Each answer is converted and compiled; errors (unknown asset, action not
 * available for the facing, word not in the narration, element off screen...) go back to the model
 * verbatim, and it answers with the full corrected plan. Stops at the first error-free compile.
 */
export async function planVideo(
  llm: Llm,
  script: Script,
  catalog: Catalog,
  opts: PlanOptions,
): Promise<PlanResult> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const messages: LlmMessage[] = [{ role: "user", content: plannerPrompt(script, catalog) }];
  const attempts: PlanAttempt[] = [];
  const usage: Usage[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await llm.json({
      label: `plan#${attempt}`,
      system: PLANNER_SYSTEM,
      messages,
      schema: DRAFT_SCHEMA,
      maxTokens: 48000,
    });
    usage.push(res.usage);
    const converted = draftToPlan(res.value as Draft, script, opts);
    let issues = converted.issues;
    let compiled: CompileResult | undefined;
    if (converted.plan) {
      compiled = compileVideo(converted.plan, {
        assets: catalog.source,
        seed: opts.seed ?? 20261108,
        ...(opts.alignments ? { alignments: opts.alignments } : {}),
      });
      issues = compiled.issues;
    }
    const errors = issues.filter((i) => i.level === "error");
    attempts.push({ attempt, draft: res.value, ...(converted.plan ? { plan: converted.plan } : {}), issues });
    if (converted.plan && compiled?.timeline && errors.length === 0)
      return { plan: converted.plan, compiled, attempts, usage };
    messages.push(
      { role: "assistant", content: res.text },
      {
        role: "user",
        content: `The compiler rejected the plan. Paths use the plan structure (scenes[i].layers[j]; "in" = enter/enterAt, "place" = x/y/scale/region).
${formatIssues(issues)}

Fix every error and answer with the full corrected plan.`,
      },
    );
  }
  return { attempts, usage };
}
