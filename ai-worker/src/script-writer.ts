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

const SCHEMA: StrictSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "scenes"],
  properties: {
    title: { type: "string", description: "Short working title, max 8 words." },
    scenes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["narration", "visualIdea", "emphasis"],
        properties: {
          narration: {
            type: "string",
            description: "What the narrator says in this scene. 1-3 short sentences.",
          },
          visualIdea: { type: "string", description: "What the viewer sees. One or two sentences." },
          emphasis: { type: "string", description: "1-3 words to show big on screen, or empty string." },
        },
      },
    },
  },
};

export const SCRIPT_SYSTEM = `You write scripts for short vertical animated videos (TikTok, Reels, Shorts), 9:16, English only.
The video is 2D flat animation: characters who act (talk, point, think, walk, wave), visual metaphors, simple charts, icons and big bold text. The narrator is a calm, confident voice speaking directly to the viewer.

Rules for the narration:
- Scene 1 opens with the HOOK: one sentence, max 12 words, that stops the scroll (a surprising claim, a sharp question, or a tension the viewer feels). Never "In this video", never a greeting.
- One idea per video. Build it: hook -> why it matters -> the insight with one concrete example or number -> a twist or practical takeaway -> a closing line that lands (no "follow for more", no "like and subscribe").
- Spoken style: short sentences, second person ("you"), plain words. Write numbers and symbols as spoken words ("two hundred dollars", "thirty percent") because the voice reads the text verbatim.
- Only claims that are true and widely accepted. If you cite a study or number, it must be real; otherwise speak generally. No medical, legal or investment advice beyond general education.
- Each scene: 1 to 3 sentences, at most 35 words. A new scene starts whenever the picture should change.

Rules for visualIdea: describe something drawable with the studio's vocabulary (character action and expression, a metaphor, a chart comparing numbers, an icon or object, big text). No photos, no real people, no brands, no logos.`;

export interface ScriptResult {
  script: Script;
  usage: Usage[];
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/** Turns the model's draft into a validated Script: ids, hook and length are derived, not trusted. */
export function toScript(draft: unknown, req: ScriptRequest): Script {
  const d = draft as {
    title: string;
    scenes: Array<{ narration: string; visualIdea: string; emphasis: string }>;
  };
  const scenes = d.scenes.map((s, i) => ({
    sceneId: `s${String(i + 1).padStart(2, "0")}`,
    narration: s.narration.trim(),
    visualIdea: s.visualIdea.trim(),
    ...(s.emphasis.trim() ? { emphasis: s.emphasis.trim().slice(0, 60) } : {}),
  }));
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
Visual vocabulary available in the studio (use it for visualIdea):
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
    script = toScript(res.value, req);
    const words = script.scenes.reduce((n, s) => n + wordCount(s.narration), 0);
    if (Math.abs(words - targetWords) <= targetWords * 0.3 || attempt === 2) break;
    messages.push(
      { role: "assistant", content: res.text },
      {
        role: "user",
        content: `That script has ${words} words; the target is about ${targetWords}. Rewrite it to fit, keeping the same hook and idea.`,
      },
    );
  }
  return { script: script as Script, usage };
}
