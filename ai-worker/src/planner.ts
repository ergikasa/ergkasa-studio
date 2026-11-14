import { compileVideo, type CompileResult, type Issue, type TimedWord } from "@erkasa/compiler";
import type { Script, VideoPlan } from "@erkasa/contracts";
import type { Catalog } from "./catalog.js";
import { reviewDirection } from "./direction.js";
import type { Llm, LlmMessage, Usage } from "./llm.js";
import { DRAFT_SCHEMA, draftToPlan, type Draft } from "./plan-draft.js";

export const PLANNER_SYSTEM = `You are the director of a 2D animation studio that makes vertical 9:16 educational shorts (1080x1920, 30 fps). You turn a narrated story script into a shot-by-shot plan: for each scene the place, the framing, who is in it, what they do and feel, and what appears on screen. A compiler checks the plan; anything you reference must exist in the catalog exactly as written.

Direct first, then lay out. For every scene write its "direction" BEFORE its layers:
- idea: the one thing this scene must make the viewer understand.
- demonstration: how it is SHOWN. Prefer story_moment (people in a concrete situation doing something), comparison (two cases side by side, e.g. two candidates who do the same thing and are judged differently) or metaphor_change (an object that changes and so explains). diagram only for numbers or a process. statement (a title or the host saying it) at most once or twice per film.
- before / after: what is on screen at the start and at the end. They must differ: something visibly happens (someone enters, a gesture, a reaction, an object changes, a chart grows). A scene where nothing changes is an illustration, not a demonstration.
- focus: the layer the eye follows.
Then build the layers that make that change happen, and give every layer a purpose. A layer without a job in the idea does not belong; a scene may have no object at all.

A film is a sequence, not a gallery: when the script tells a situation (an interview, a meeting, a mistake), stage it across consecutive scenes as one continuous event (someone enters -> is watched -> makes a small mistake -> is judged -> later does well -> is still judged by the first impression), each scene moving the event forward, with the same people in the same place seen from a new shot.

Acting: every actor who is in a scene for more than a few seconds does at least two things timed to the words (a gesture, then a reaction; an expression change on the key word). Do not repeat an actor's position, pose and expression from the previous scene: move them, turn them, change what they do.

Think like a director, not a slideshow maker:
- Every scene has one visual purpose. A viewer with the sound off should still understand what is happening.
- Interpret the meaning; do not illustrate the literal words. "Your brain wants relief" is the protagonist reaching for the phone, not a brain icon.
- The protagonist from the script plays every scene they are in, with the same character id. Do not add other characters unless the script needs them.
- Characters act and feel. Give the protagonist an action that shows the moment (use_phone with holding=phone, read with holding=document, check_watch, facepalm, stressed, slump, shrug, think, nod, arms_up, walk/walk_phone toward something, type at a desk; in a conversation or judgement: take_notes, lean_in, nervous, judge, observe, cross_arms) and expressions that follow the script's emotion, changing on the right word (action.expression). Never leave a character just standing and talking.
- Framing (shot): wide = establish the place or show movement; medium = the protagonist from head to knees, the default for acting; close = face and shoulders, for emotion and the hook; insert = a close look at an object, metaphor or chart. Change the framing from one scene to the next; never the same place with the same framing twice in a row. Open the film on a medium or close shot.
- Places: use the background that fits the story world (bedroom at night, living room, office, cafe, street, classroom...). Move the story between places when the script does; do not park every scene in the same room.
- Positions are read inside the framed view: x 0.5 is the middle of what the viewer sees. Actors stand on the ground (y = -1), x 0.3-0.7. Keep the protagonist's face clear of titles and charts. Captions are placed automatically where they do not cover faces.
- Wide places (a background marked WIDE with zones): the story can travel without a cut. Start a scene in a zone with shot.zone; put layers into zones with their zone field (x is then relative to that zone's view); an actor walks to another zone with a walk action whose toZone names it; the camera goes with them using a travel move with target = the walking layer (it keeps them in frame), or to a zone with travel and zone. Objects in a zone the camera has not reached yet are out of frame on purpose. Use zones for a journey, not as decoration; when the story stays in one place, ignore them.
- Objects belong somewhere: in the protagonist's hand (holding), near them at their height, or as the subject of an insert shot. Do not scatter floating icons.
- Concept scenes: use a metaphor or a chart that explains the idea, and keep the protagonist in the scene reacting to it (looking, pointing, shrugging) when possible. A chart only when the narration states numbers or a comparison; its labels are words from the narration.
- Text on screen: at most one title per scene and only in some scenes, max 5 words, ALL CAPS for hook_impact, on the key word. It fades out by itself after a moment.
- Timing: time actions, expressions, entrances and animations to the narration words they belong to ("word:<word>"; the word must be in that scene's narration). Something moves in the first half second of every scene. Finish entrances at least one second before the scene ends.
- Camera: subtle push_in (1.04-1.1) for calm scenes, punch_in (1.15-1.25) on the key word of the hook or the twist, static while a chart draws. Transitions: mostly cut, a quick whip or slide when the place changes, fade for a change of mood.
- Keep it clean: 1 to 4 layers per scene.

Staged sets (when people meet, walk in, sit down, talk across a desk, hand something over):
- Set scene.set and use the set's background. Every actor on a set gets blocking steps instead of x and walk actions: start with "seated" or "standing" at a mark, or "enter" at the door; then "walk_to" a mark, "sit", "stand_up", "give" (to another actor; the giver must be holding something, the receiver gets it in the hand), "exit". A step without "at" follows the previous one; give "at" a narration word to time it.
- Gestures still go in actions (talk, nod, read, type, give): on a set they are played seated when the actor is seated. Facing comes from the marks.
- Frame a set with the shot size; the camera follows a walking subject by itself. Keep consecutive set scenes on different shot sizes.
- Objects can stay with an actor on a set: attachTo "<actorId>:above_head" (a halo, a thought) or ":beside".

People and clothes:
- The same person is always the same character id. If the story puts them in other clothes (casual vs business), change only "outfit"; never swap the character to show a change of clothes.
- A host (narrator in a suit), when the user chose one, presents the idea: put him in the hook, the explanation or the conclusion, facing front and speaking, where his presence helps. He is never the story's protagonist and does not need to be in every scene.

Answer with the full plan for every scene of the script, in order, with the same sceneId values.`;

/** A worked example in the draft format: a medium shot, the protagonist acting with a prop and a feeling. */
const EXAMPLE = {
  sceneId: "s03",
  direction: {
    idea: "Putting the task off feels like relief, so the phone wins.",
    demonstration: "story_moment",
    before: "Arti in bed at night, worried, the task on his mind.",
    after: "Arti scrolling his phone, relieved for a moment.",
    focus: "arti",
  },
  background: "bg_home_bedroom_night_01",
  set: "none",
  shot: { size: "medium", subject: "arti" },
  layers: [
    {
      id: "arti",
      purpose: "the protagonist choosing the phone over the task",
      type: "actor",
      assetId: "char_arti_01",
      x: 0.42,
      y: -1,
      scale: 1,
      region: "none",
      facing: "front",
      expression: "neutral",
      speaks: false,
      holding: "phone",
      outfit: "",
      blocking: [],
      attachTo: "",
      enter: "none",
      enterAt: "start",
      actions: [
        { action: "use_phone", at: "start", durationSec: 0, toX: -1, expression: "happy" },
        { action: "facepalm", at: "word:guilt", durationSec: 0, toX: -1, expression: "sad" },
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
      id: "title",
      purpose: "names the feeling on the key word",
      type: "text",
      assetId: "",
      x: 0.5,
      y: -1,
      scale: 1,
      region: "top-safe",
      facing: "front",
      expression: "",
      speaks: false,
      holding: "none",
      outfit: "",
      blocking: [],
      attachTo: "",
      enter: "pop",
      enterAt: "word:guilt",
      actions: [],
      animations: [],
      text: "GUILT GROWS",
      textStyle: "hook_impact",
      highlight: ["GUILT"],
      chart: "none",
      chartData: [],
      unit: "",
    },
  ],
  camera: [{ move: "push_in", at: "start", to: 1.06 }],
  effects: [],
  transition: "cut",
  transitionDirection: "none",
};

/** A worked example on a staged set: someone walks in, sits and hands over a document. */
const blank = {
  x: 0.5,
  y: -1,
  scale: 1,
  region: "none",
  enter: "none",
  enterAt: "start",
  animations: [],
  text: "",
  textStyle: "",
  highlight: [],
  chart: "none",
  chartData: [],
  unit: "",
  attachTo: "",
};
export const EXAMPLE_SET = {
  sceneId: "s02",
  direction: {
    idea: "The same candidate looks more capable in a suit.",
    demonstration: "story_moment",
    before: "Alex at the door, Maria seated behind the desk.",
    after: "Alex seated, Maria holding his CV and nodding.",
    focus: "alex",
  },
  background: "bg_interview_office_01",
  set: "interview_office",
  shot: { size: "wide", subject: "alex" },
  layers: [
    {
      ...blank,
      id: "alex",
      purpose: "the candidate who walks in and hands over his CV",
      type: "actor",
      assetId: "char_arti_01",
      facing: "right",
      expression: "happy",
      speaks: false,
      holding: "document",
      outfit: "business",
      blocking: [
        { do: "enter", mark: "door", to: "", at: "sec:0.3" },
        { do: "walk_to", mark: "chair_left", to: "", at: "" },
        { do: "give", mark: "", to: "maria", at: "word:resume" },
        { do: "sit", mark: "", to: "", at: "" },
      ],
      actions: [{ action: "talk", at: "word:answers", durationSec: 3, toX: -1, expression: "" }],
    },
    {
      ...blank,
      id: "maria",
      purpose: "the interviewer who judges him",
      type: "actor",
      assetId: "char_era_01",
      facing: "left",
      expression: "neutral",
      speaks: false,
      holding: "none",
      outfit: "",
      blocking: [{ do: "seated", mark: "chair_right", to: "", at: "" }],
      actions: [
        { action: "type", at: "start", durationSec: 2, toX: -1, expression: "" },
        { action: "nod", at: "word:answers", durationSec: 0, toX: -1, expression: "happy" },
      ],
    },
  ],
  camera: [],
  effects: [],
  transition: "cut",
  transitionDirection: "none",
};

export interface PlanAttempt {
  attempt: number;
  draft?: unknown;
  plan?: VideoPlan;
  issues: Issue[];
}

export interface PlanResult {
  /** Set when an attempt compiled without errors (the best-directed one if none passed review). */
  plan?: VideoPlan;
  compiled?: CompileResult;
  attempts: PlanAttempt[];
  usage: Usage[];
  /** Direction findings left on the chosen plan (empty when it passed review). */
  directionIssues: Issue[];
}

export interface PlanOptions {
  projectId: string;
  voiceId: string;
  /** Real word timings per scene if the voice already exists (better sync checks). */
  alignments?: Record<string, TimedWord[]>;
  maxAttempts?: number;
  seed?: number;
  /** Who narrates (from the voice preset), so the speaking character matches. */
  narrator?: string;
  /** The host chosen by the user (a character id). The model decides where he appears, never who he is. */
  host?: string;
}

function formatIssues(issues: Issue[]): string {
  return issues
    .map((i) => `- [${i.level}] ${i.code} at ${i.path}: ${i.message}${i.hint ? ` (hint: ${i.hint})` : ""}`)
    .join("\n");
}

export function plannerPrompt(script: Script, catalog: Catalog, narrator?: string, host?: string): string {
  const scriptText = script.scenes
    .map((s) => `${s.narration} ${s.visualIdea} ${s.action ?? ""} ${s.setting ?? ""} ${s.emphasis ?? ""}`)
    .join(" ");
  const cast = (script.cast ?? []).map((c) => `${c.role}: ${c.characterId} (${c.description})`).join("; ");
  return `# Catalog
${catalog.plannerSection(scriptText)}

# Examples of scenes in the answer format
${JSON.stringify(EXAMPLE)}
${JSON.stringify(EXAMPLE_SET)}

# Script: "${script.title}" (theme: ${script.theme})
${script.promise ? `The viewer should understand: ${script.promise}\n` : ""}${script.takeaway ? `They leave with (${script.takeaway.kind}): ${script.takeaway.text}. The last scene shows it.\n` : ""}${cast ? `Cast: ${cast}` : ""}${narrator ? `\n${narrator}` : ""}${host ? `\nHost chosen by the user: ${host}. Decide in which scenes he appears (hook, explanation, conclusion); he is not part of the story's cast.` : ""}
${script.scenes
  .map((s) =>
    [
      `## ${s.sceneId}${s.beat ? ` (${s.beat})` : ""}`,
      `Narration: ${s.narration}`,
      s.setting ? `Setting: ${s.setting}` : "",
      s.action ? `${script.cast?.length ? "Protagonist does" : "On screen"}: ${s.action}` : "",
      s.emotion ? `${script.cast?.length ? "Protagonist feels" : "Mood"}: ${s.emotion}` : "",
      `Visual idea: ${s.visualIdea}`,
      s.emphasis ? `Emphasis: ${s.emphasis}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  )
  .join("\n\n")}`;
}

/**
 * Script -> Video Plan. Each answer is converted, compiled and reviewed for direction; compile errors
 * and direction findings go back to the model verbatim, and it answers with the full corrected plan.
 * Stops at the first plan that compiles and passes review. If none passes review, the best compiled
 * attempt (fewest findings) is used, so a strict rule never blocks a video that can be rendered.
 */
/** Planner options: the host is chosen by the user, never by the model. */
export async function planVideo(
  llm: Llm,
  script: Script,
  catalog: Catalog,
  opts: PlanOptions,
): Promise<PlanResult> {
  const maxAttempts = opts.maxAttempts ?? 3;
  const messages: LlmMessage[] = [
    { role: "user", content: plannerPrompt(script, catalog, opts.narrator, opts.host) },
  ];
  const attempts: PlanAttempt[] = [];
  const usage: Usage[] = [];
  let best: { plan: VideoPlan; compiled: CompileResult; findings: Issue[] } | undefined;

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
    let findings: Issue[] = [];
    if (converted.plan && compiled?.timeline && errors.length === 0) {
      const fps = compiled.timeline.fps;
      findings = reviewDirection({
        plan: converted.plan,
        script,
        durations: Object.fromEntries(compiled.scenes.map((s) => [s.sceneId, s.duration / fps])),
        compileIssues: compiled.issues,
        ...(opts.host ? { host: opts.host } : {}),
        ...(catalog.world ? { world: true } : {}),
      });
      if (!best || findings.length < best.findings.length)
        best = { plan: converted.plan, compiled, findings };
    }
    attempts.push({
      attempt,
      draft: res.value,
      ...(converted.plan ? { plan: converted.plan } : {}),
      issues: [...issues, ...findings],
    });
    if (best && best.findings.length === 0) break;
    messages.push(
      { role: "assistant", content: res.text },
      {
        role: "user",
        content: `${errors.length ? "The compiler rejected the plan." : "The plan compiles, but the director's review found problems."} Paths use the plan structure (scenes[i].layers[j]; "in" = enter/enterAt, "place" = x/y/scale/region).
${formatIssues(errors.length ? issues : findings)}

Fix every problem and answer with the full corrected plan.`,
      },
    );
  }
  return best
    ? { plan: best.plan, compiled: best.compiled, attempts, usage, directionIssues: best.findings }
    : { attempts, usage, directionIssues: [] };
}
