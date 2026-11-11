import { Script, type Theme } from "@erkasa/contracts";
import type { Llm, LlmMessage, StrictSchema, Usage } from "./llm.js";

/** Narration pace used to size scripts; matches the compiler's word estimate (~165 wpm). */
export const WORDS_PER_SEC = 2.75;

export const THEME_BRIEFS: Record<Exclude<Theme, "everyday">, string> = {
  psychology: "Human Behavior & Psychology: why people act the way they do; biases, habits, social dynamics.",
  money: "Money, Finance & Economics: personal finance, investing, how money and economies really work.",
  growth: "Personal Growth: discipline, habits, focus, self-improvement that actually works.",
  philosophy:
    "Philosophy & Critical Thinking: big ideas made practical, thinking clearly, famous thought experiments.",
  science: "Mind-Blowing Science & Human Nature: surprising facts about the brain, body, universe.",
  decisions:
    "Life Lessons & Decision Making: choices, regret, trade-offs, mental models for better decisions.",
};

export interface ScriptRequest {
  topic: string;
  theme: Exclude<Theme, "everyday">;
  /** Target video length in seconds (30-90). */
  targetSec: number;
  /** Optional note from the editor, e.g. "use a personal example". */
  notes?: string;
}

const BEATS = ["hook", "relate", "tension", "explain", "twist", "turn", "resolve"] as const;

const SCHEMA: StrictSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "protagonist", "scenes"],
  properties: {
    title: { type: "string", description: "Short working title, max 8 words." },
    protagonist: {
      type: "object",
      additionalProperties: false,
      required: ["characterId", "description"],
      properties: {
        characterId: { type: "string", description: "Exact id of one studio character (see Characters)." },
        description: { type: "string", description: "Who they are in this story, one line." },
      },
    },
    scenes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["beat", "narration", "setting", "action", "emotion", "visualIdea", "emphasis"],
        properties: {
          beat: { type: "string", enum: [...BEATS] },
          narration: {
            type: "string",
            description: "What the narrator says in this scene. 1-3 short sentences.",
          },
          setting: { type: "string", description: "Where it happens in the protagonist's world." },
          action: {
            type: "string",
            description: "What the protagonist physically does, or empty for a pure concept scene.",
          },
          emotion: { type: "string", description: "What the protagonist feels, one word." },
          visualIdea: {
            type: "string",
            description: "The picture that carries the meaning. One or two sentences.",
          },
          emphasis: { type: "string", description: "1-3 words to show big on screen, or empty string." },
        },
      },
    },
  },
};

export const SCRIPT_SYSTEM = `You are the story writer of an animation studio. You turn a topic into a short vertical animated film (TikTok, Reels, Shorts; 9:16; English) that teaches one idea through a story.
The film is 2D flat animation with a fixed cast of studio characters who act (use a phone, read, check a watch, walk, type, put their head in their hands, slump, shrug, point, celebrate), visual metaphors, simple infographics and a few bold words on screen. A calm, confident narrator speaks to the viewer as "you"; the protagonist is the viewer's stand-in.

The story comes first:
- Pick ONE protagonist from the studio characters (never char_host_01: he is the studio's host and narrator) and follow them through the whole film. The same person can wear other clothes when the story needs it (outfits); they are still the same character. Give them a concrete, relatable situation (a specific task, a specific moment of the day, a specific temptation), not "a task" in general.
- Shape: hook -> relate (the viewer recognizes themselves) -> tension (it gets worse, the cost shows) -> explain (the real mechanism, accurately) -> twist (the surprising part) -> turn (the protagonist does something different) -> resolve (a meaningful ending that lands). Use the beats in this order; a beat may span two scenes.
- Scene 1 opens with the HOOK: one sentence, max 12 words, that stops the scroll (a surprising claim, a sharp question, or a tension the viewer feels). Never "In this video", never a greeting.
- Show, don't lecture: every scene has the protagonist doing something or a picture that carries the meaning. Prefer concrete examples, analogies and questions to definitions. No generic motivational lines ("believe in yourself", "you got this"), no repeating the same point.
- The explanation must be accurate and not oversimplified. Name a real concept or finding only if it is real and widely accepted (e.g. "present bias", "emotion regulation"); otherwise describe it in plain words. Never invent studies, numbers or quotes. No medical, legal or investment advice beyond general education.
- Spoken style: short sentences, plain words, numbers and symbols written as spoken words ("two minutes", "thirty percent"), because the voice reads the text verbatim.
- Each scene: 1 to 3 sentences, at most 35 words. A new scene starts whenever the picture should change.
- The emotional arc of the protagonist must move (e.g. restless -> guilty -> curious -> determined -> relieved), and the ending must resolve the hook.

visualIdea: what the viewer sees, drawable with the studio vocabulary below. Interpret the meaning, do not just illustrate the words being said. No photos, no real people, no brands, no logos.`;

export interface ScriptResult {
  script: Script;
  usage: Usage[];
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

interface ScriptDraft {
  title: string;
  protagonist?: { characterId: string; description: string };
  scenes: Array<{
    narration: string;
    visualIdea: string;
    emphasis: string;
    beat?: string;
    setting?: string;
    action?: string;
    emotion?: string;
  }>;
}

const clip = (v: string | undefined, max: number): string | undefined => {
  const t = v?.trim();
  return t ? t.slice(0, max) : undefined;
};

/** Turns the model's draft into a validated Script: ids, hook and length are derived, not trusted. */
export function toScript(draft: unknown, req: ScriptRequest, characterIds?: readonly string[]): Script {
  const d = draft as ScriptDraft;
  const scenes = d.scenes.map((s, i) => {
    const beat = BEATS.find((b) => b === s.beat);
    const emphasis = clip(s.emphasis, 60);
    const setting = clip(s.setting, 120);
    const action = clip(s.action, 200);
    const emotion = clip(s.emotion, 40);
    return {
      sceneId: `s${String(i + 1).padStart(2, "0")}`,
      narration: s.narration.trim(),
      visualIdea: s.visualIdea.trim(),
      ...(emphasis ? { emphasis } : {}),
      ...(beat ? { beat } : {}),
      ...(setting ? { setting } : {}),
      ...(action ? { action } : {}),
      ...(emotion ? { emotion } : {}),
    };
  });
  const p = d.protagonist;
  const cast =
    p && (!characterIds || characterIds.includes(p.characterId))
      ? [
          {
            role: "protagonist" as const,
            characterId: p.characterId,
            description: p.description.trim().slice(0, 200) || "the protagonist",
          },
        ]
      : undefined;
  const first = scenes[0]?.narration ?? "";
  const hook = (first.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? first).slice(0, 200);
  const words = scenes.reduce((n, s) => n + wordCount(s.narration), 0);
  return Script.parse({
    schema: "erkasa.script/1",
    title: d.title.trim().slice(0, 100),
    topic: req.topic.slice(0, 300),
    theme: req.theme,
    language: "en",
    hook,
    ...(cast ? { cast } : {}),
    scenes,
    estimatedSec: Math.round((words / WORDS_PER_SEC) * 10) / 10,
  });
}

/**
 * Writes the script. If the length misses the target by more than 30%, asks once more with the
 * measured length, so the video lands near the requested duration.
 */
export async function writeScript(
  llm: Llm,
  req: ScriptRequest,
  visualVocabulary: string,
  characterIds?: readonly string[],
): Promise<ScriptResult> {
  const targetWords = Math.round(req.targetSec * WORDS_PER_SEC);
  const scenesHint = Math.max(3, Math.min(10, Math.round(req.targetSec / 7)));
  const messages: LlmMessage[] = [
    {
      role: "user",
      content: `Theme: ${THEME_BRIEFS[req.theme]}
Topic: ${req.topic}
Target length: about ${req.targetSec} seconds = about ${targetWords} spoken words in total, in about ${scenesHint} scenes.
${req.notes ? `Editor notes: ${req.notes}\n` : ""}
Studio vocabulary (pick the protagonist from Characters by exact id; use the rest for visualIdea):
${visualVocabulary}`,
    },
  ];
  const usage: Usage[] = [];
  let script: Script | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await llm.json({
      label: `script#${attempt}`,
      system: SCRIPT_SYSTEM,
      messages,
      schema: SCHEMA,
      maxTokens: 16000,
    });
    usage.push(res.usage);
    script = toScript(res.value, req, characterIds);
    const words = script.scenes.reduce((n, s) => n + wordCount(s.narration), 0);
    if (Math.abs(words - targetWords) <= targetWords * 0.3 || attempt === 2) break;
    messages.push(
      { role: "assistant", content: res.text },
      {
        role: "user",
        content: `That script has ${words} words; the target is about ${targetWords}. Rewrite it to fit, keeping the same protagonist, hook and idea.`,
      },
    );
  }
  return { script: script as Script, usage };
}
