import {
  EDITORIAL_BEATS,
  NarrativeShape,
  OpeningType,
  Script,
  ScriptClaim,
  StoryBeat,
  Takeaway,
  type Theme,
} from "@erkasa/contracts";
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

/** What the last videos already used, so this one opens and unfolds differently. Most recent first. */
export interface RecentStyles {
  openings: OpeningType[];
  shapes: NarrativeShape[];
}

export interface ScriptRequest {
  topic: string;
  theme: Exclude<Theme, "everyday">;
  /** Target video length in seconds. */
  targetSec: number;
  /** Optional note from the editor, e.g. "use a personal example". */
  notes?: string;
  recent?: RecentStyles;
}

const OPENINGS = OpeningType.options;
const SHAPES = NarrativeShape.options;

export const SCRIPT_SCHEMA: StrictSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "promise", "opening", "shape", "cast", "scenes", "claims", "takeaway"],
  properties: {
    title: { type: "string", description: "Short working title, max 8 words." },
    promise: {
      type: "string",
      description: "One sentence: what the viewer will understand by the end that they did not before.",
    },
    opening: { type: "string", enum: [...OPENINGS] },
    shape: { type: "string", enum: [...SHAPES] },
    cast: {
      type: "array",
      // no maxItems: the structured-output API rejects it; toScript keeps at most 3
      description: "0-2 studio characters who play the people of the situation for the whole video.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["characterId", "role", "description"],
        properties: {
          characterId: { type: "string", description: "Exact id of a studio character (see Characters)." },
          role: { type: "string", enum: ["protagonist", "supporting"] },
          description: { type: "string", description: "Who they are in this story, one line." },
        },
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
          beat: { type: "string", enum: [...EDITORIAL_BEATS] },
          narration: {
            type: "string",
            description: "What the narrator says in this scene, spoken English. 1-3 short sentences.",
          },
          setting: {
            type: "string",
            description: "Where the scene happens, or empty for an abstract scene.",
          },
          action: {
            type: "string",
            description:
              "Who does what on screen (a cast member's action, an object or metaphor moving), or empty.",
          },
          emotion: {
            type: "string",
            description: "The feeling of the scene or of the person in it, one word.",
          },
          visualIdea: {
            type: "string",
            description: "The picture that makes the idea visible. One or two sentences.",
          },
          emphasis: { type: "string", description: "1-3 words to show big on screen, or empty string." },
        },
      },
    },
    claims: {
      type: "array",
      description:
        "Every study, historical fact, statistic, quote or formal definition the narration states. Empty if none.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["text", "kind", "status", "role", "source"],
        properties: {
          text: { type: "string", description: "The claim as the narration makes it." },
          kind: { type: "string", enum: [...ScriptClaim.shape.kind.options] },
          status: { type: "string", enum: [...ScriptClaim.shape.status.options] },
          role: { type: "string", description: "What this claim proves in the argument." },
          source: {
            type: "string",
            description: "Where an editor can check it (author, year, outlet), or empty.",
          },
        },
      },
    },
    takeaway: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "text"],
      properties: {
        kind: { type: "string", enum: [...Takeaway.shape.kind.options] },
        text: { type: "string", description: "The principle, question or tool, in one sentence." },
      },
    },
  },
};

export const SCRIPT_SYSTEM = `You are the lead editorial writer of Erkasa, a studio that makes short animated mini-documentaries for TikTok, Reels and YouTube Shorts (9:16, English, 2D animation). Each video explains one meaningful idea about psychology, human behaviour, power, relationships, business, economics, philosophy, history, technology or critical thinking.

# The voice
An intelligent person explaining one idea to one other person, face to face. Not an essay, a letter, a poem, a speech or a sermon. Confident, curious and analytical; never arrogant, theatrical or preachy. The narrator talks to the viewer as "you".

# The structure (every video, in this order)
hook -> problem -> concept -> situation -> analysis -> conclusion. Every part gets at least one scene; the hook may be the first sentence of the problem scene or a short scene of its own. Rough share of the words: problem 15%, concept 20%, situation 30%, analysis 25%, conclusion 10%.
- problem: the behaviour or question people recognise from their own lives. Make clear what we are looking at.
- concept: the principle that explains it, in plain words, with what it means in practice.
- situation: a concrete case with people, decisions and consequences that shows the concept happening.
- analysis: why it happens: the mechanism (psychological, economic, social or strategic) and what is not obvious at first sight.
- conclusion: what the viewer takes away and can use.

# Principles
1. Vary the opening. Choose the opening type that suits this topic: paradox (two things that should not both be true), question (one the viewer cannot answer at once), situation (drop the viewer into a specific moment), contrast (two people or outcomes side by side), fact (a surprising, verifiable fact). Do not use the openings the studio used most recently (listed in the request). The opening must be honest: the video delivers what it promises.
2. Interest before definitions. Never open with a definition or a textbook sentence ("X is defined as", "In psychology, X refers to"). Make the viewer want the explanation first; name the concept only when they are ready for it, and explain it in plain words the moment you name it.
3. Explain to someone who knows nothing about the topic. No assumed knowledge. One idea per sentence. Every technical term is explained on first use with an everyday example.
4. Concrete situations with people, decisions and consequences. Who is there, what they choose, what happens next. The situation must show the concept itself at work, not something nearby. Abstract examples ("a person faces a task") are not allowed.
5. A real or historical case is used only when it does work in the argument: it proves the concept happens at scale, shows a cost, or reveals the mechanism. Write in claims[].role what it proves; if you cannot say, leave the case out. Use only well-documented cases; when you are not sure of a number, say it in words without the number ("several times the first estimate"). A made-up example is presented as one ("Imagine...", "Say you...") and listed as hypothetical.
6. The analysis reveals the mechanism. Say why it happens, with at least one real "because". Show what is not obvious at first sight: the hidden cost, the incentive, the trade-off, the reason it feels right while it is wrong.
7. Depth is not difficult words. Explain hard ideas with simple words and short sentences (at most 22 words). Prefer "people" to "individuals", "use" to "utilize", "so" to "consequently".
8. The conclusion gives the viewer one tool they can use tomorrow: a principle, a question to ask themselves, or a concrete test. Write it in takeaway; the last scene says it. It follows from the argument; never a slogan.
9. No filler. Every sentence adds information or moves the argument. No dramatic, motivational or philosophical lines without an explaining job; no clichés ("believe in yourself", "step out of your comfort zone", "anything is possible", "let that sink in", "here's the thing", "the truth is", "this will change everything"); no repeating a point in other words.
10. Each video has its own narrative identity. Choose the shape that fits the topic and differs from the shapes used most recently:
   - two_paths: two people or two choices side by side; the difference between them explains the concept.
   - case_file: one real, verifiable case taken apart, then brought back to everyday life.
   - myth_vs_mechanism: what people believe, then what actually happens and why.
   - one_moment: one ordinary moment slowed down, decision by decision.
   - thought_experiment: put the viewer in a made-up choice and let them watch their own reasoning.
   - rewind: start from the consequence, go back to the small decision that caused it.
   - everyday_object: an ordinary object (a receipt, a phone, a chair) carries the idea through the video.
   The shape decides how the situation and the analysis are told; the structure stays the same.

# Accuracy
- Never invent studies, experiments, statistics, quotes, people or historical events. Name a finding only if it is real and widely documented; list it in claims with a source an editor can check.
- Separate fact from interpretation in the wording ("historians argue", "one explanation is").
- Human tendencies are tendencies, not laws: "many people", "often", not "everyone", "always". Do not diagnose anyone. No medical, legal or investment advice beyond general education.

# Cast and pictures
- Cast: 0 to 2 studio characters (never char_host_01: he is the studio's host). Use a protagonist when the situation follows a person through decisions; two_paths uses two (protagonist and supporting). A real case can be told without the cast, with generic people, places and objects. The same characters keep the same role for the whole video. The catalog names (Arti, Era, Drini...) are the studio's internal labels, never names in the story: in the narration call people by their role ("the candidate", "your boss", "she") or give them an ordinary story name of your own.
- visualIdea: the picture that explains, drawable with the studio vocabulary below: characters acting, objects with a job, places, metaphors that make the concept clearer, simple charts when the narration compares numbers. Interpret the meaning; never just decorate. No words inside the pictures (titles are added separately), no photos, no real people's likeness, no brands or logos.

# Spoken style
The voice reads the narration verbatim: plain words, numbers and symbols as spoken words ("two thousand", "thirty percent"). Each scene: 1 to 3 sentences, at most 40 words. Start a new scene whenever the picture should change.`;

export interface ScriptResult {
  script: Script;
  usage: Usage[];
  /** Editorial checks the final script still fails (empty when it passed). */
  issues: string[];
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

interface ScriptDraft {
  title: string;
  promise?: string;
  opening?: string;
  shape?: string;
  cast?: Array<{ characterId: string; role?: string; description: string }>;
  /** Older single-protagonist format, still accepted. */
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
  claims?: Array<{ text: string; kind: string; status: string; role: string; source?: string }>;
  takeaway?: { kind: string; text: string };
}

const clip = (v: string | undefined, max: number): string | undefined => {
  const t = v?.trim();
  return t ? t.slice(0, max) : undefined;
};

/** Turns the model's draft into a validated Script: ids, hook and length are derived, not trusted. */
export function toScript(draft: unknown, req: ScriptRequest, characterIds?: readonly string[]): Script {
  const d = draft as ScriptDraft;
  const scenes = d.scenes.map((s, i) => {
    const beat = StoryBeat.safeParse(s.beat);
    const emphasis = clip(s.emphasis, 60);
    const setting = clip(s.setting, 120);
    const action = clip(s.action, 200);
    const emotion = clip(s.emotion, 40);
    return {
      sceneId: `s${String(i + 1).padStart(2, "0")}`,
      narration: s.narration.trim(),
      visualIdea: s.visualIdea.trim(),
      ...(emphasis ? { emphasis } : {}),
      ...(beat.success ? { beat: beat.data } : {}),
      ...(setting ? { setting } : {}),
      ...(action ? { action } : {}),
      ...(emotion ? { emotion } : {}),
    };
  });
  const members = d.cast ?? (d.protagonist ? [{ ...d.protagonist, role: "protagonist" }] : []);
  const seen = new Set<string>();
  const cast = members
    .filter((m) => (!characterIds || characterIds.includes(m.characterId)) && !seen.has(m.characterId))
    .map((m, i) => {
      seen.add(m.characterId);
      // the first one is the protagonist unless the draft says otherwise; there is never more than one
      const role: "protagonist" | "supporting" =
        m.role === "supporting" || i > 0 ? "supporting" : "protagonist";
      return {
        role,
        characterId: m.characterId,
        description: m.description.trim().slice(0, 200) || "a person in the story",
      };
    })
    .slice(0, 3);
  if (cast.length && !cast.some((c) => c.role === "protagonist") && cast[0]) cast[0].role = "protagonist";
  const claims = (d.claims ?? []).flatMap((c) => {
    const source = clip(c.source, 200);
    const parsed = ScriptClaim.safeParse({
      text: c.text.trim().slice(0, 300),
      kind: c.kind,
      status: c.status,
      role: c.role.trim().slice(0, 200) || "supports the argument",
      ...(source ? { source } : {}),
    });
    return parsed.success ? [parsed.data] : [];
  });
  const takeaway = d.takeaway
    ? Takeaway.safeParse({ kind: d.takeaway.kind, text: d.takeaway.text.trim().slice(0, 240) })
    : undefined;
  const opening = OpeningType.safeParse(d.opening);
  const shape = NarrativeShape.safeParse(d.shape);
  const promise = clip(d.promise, 200);
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
    ...(cast.length ? { cast } : {}),
    ...(promise ? { promise } : {}),
    ...(opening.success ? { opening: opening.data } : {}),
    ...(shape.success ? { shape: shape.data } : {}),
    ...(takeaway?.success ? { takeaway: takeaway.data } : {}),
    ...(claims.length ? { claims: claims.slice(0, 10) } : {}),
    scenes,
    estimatedSec: Math.round((words / WORDS_PER_SEC) * 10) / 10,
  });
}

// ---------------------------------------------------------------- editorial checks

/** Lines that sound like something and explain nothing (principle 9). Lower case, matched as phrases. */
const FILLER = [
  "believe in yourself",
  "comfort zone",
  "anything is possible",
  "everything is possible",
  "you got this",
  "in this video",
  "today we",
  "let that sink in",
  "here's the thing",
  "the truth is",
  "will surprise you",
  "change everything",
  "changes everything",
  "nothing will ever be the same",
  "in a world where",
  "game changer",
  "game-changer",
  "unlock your",
  "level up",
  "mindset shift",
  "buckle up",
  "stay tuned",
  "like and subscribe",
  "life-changing",
  "the secret to",
];

/** Textbook openings (principle 2). */
const DEFINITION_OPENING =
  /\b(is defined as|refers to|is known as|is (?:a|an|the) (?:term|concept|cognitive bias|psychological (?:term|phenomenon|effect))|in psychology,|according to the dictionary)\b/i;

/** Words that make an idea sound deep without making it clearer (principle 7). */
const HEAVY_WORDS = [
  "utilize",
  "utilise",
  "paradigm",
  "furthermore",
  "moreover",
  "consequently",
  "thereby",
  "notwithstanding",
  "aforementioned",
  "dichotomy",
  "juxtaposition",
  "ontological",
  "epistemic",
  "myriad",
  "plethora",
  "individuals",
  "phenomenological",
];

/** Narration that leans on evidence and must list it in claims (principle 5 and accuracy). */
const EVIDENCE =
  /\b(study|studies|researchers?|scientists?|experiments?|surveys?|percent|according to|historians?|in (?:eighteen|nineteen|two thousand)\b)/i;

const sentences = (text: string): string[] => text.split(/(?<=[.!?])\s+/).filter((s) => s.trim());

/**
 * Checks a script against the editorial standard. Deterministic and cheap: it catches what can be counted
 * (structure, opening, clichés, definitions first, sentence length, heavy words, unlisted evidence, a missing
 * takeaway, a repeated opening or shape). The rest is the writer's job, guided by the system prompt.
 */
export function editorialIssues(script: Script, recent?: RecentStyles): string[] {
  const out: string[] = [];
  const beats = script.scenes.map((s) => s.beat);
  // structure: the five parts, in order (the hook is optional as its own scene)
  for (const b of EDITORIAL_BEATS.slice(1))
    if (!beats.includes(b))
      out.push(
        `the "${b}" part is missing; every video has problem, concept, situation, analysis and conclusion`,
      );
  const order = beats.map((b) => EDITORIAL_BEATS.indexOf(b as (typeof EDITORIAL_BEATS)[number]));
  if (order.some((o, i) => i > 0 && o < (order[i - 1] ?? 0)))
    out.push(
      `the parts are out of order (${beats.join(" -> ")}); keep hook -> problem -> concept -> situation -> analysis -> conclusion`,
    );
  if (script.scenes.at(-1)?.beat !== "conclusion") out.push("the last scene must be the conclusion");

  // opening and narrative identity
  const first = script.scenes[0]?.narration ?? "";
  const firstSentence = sentences(first)[0] ?? first;
  if (DEFINITION_OPENING.test(firstSentence) || DEFINITION_OPENING.test(sentences(first)[1] ?? ""))
    out.push(
      "the video opens with a definition; open with the problem and name the concept later, in plain words",
    );
  if (script.opening === "question" && !firstSentence.trim().endsWith("?"))
    out.push('the opening type is "question" but the first sentence is not a question');
  if (script.opening && script.opening !== "question" && firstSentence.trim().endsWith("?"))
    out.push(
      `the opening type is "${script.opening}" but the first sentence is a question; open the way you chose`,
    );
  if (wordCount(firstSentence) > 18)
    out.push(
      `the first sentence has ${wordCount(firstSentence)} words; the opening line must land in under 18`,
    );
  if (recent?.openings[0] && script.opening === recent.openings[0])
    out.push(`the last video also opened with a ${script.opening}; choose another opening type`);
  if (script.shape && recent?.shapes.slice(0, 2).includes(script.shape))
    out.push(
      `the narrative shape "${script.shape}" was used in one of the last two videos; choose another shape`,
    );

  // language
  const all = script.scenes.map((s) => s.narration).join(" ");
  const lower = all.toLowerCase();
  for (const f of FILLER)
    if (lower.includes(f)) out.push(`"${f}" is filler; replace it with a sentence that explains something`);
  script.scenes.forEach((s) => {
    for (const sentence of sentences(s.narration))
      if (wordCount(sentence) > 24)
        out.push(
          `${s.sceneId}: a ${wordCount(sentence)}-word sentence is hard to follow by ear; split it (max 22 words)`,
        );
  });
  const heavy = HEAVY_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, "i").test(all));
  if (heavy.length) out.push(`plain words instead of: ${heavy.join(", ")}`);

  // evidence and takeaway
  if (EVIDENCE.test(all) && !script.claims?.length)
    out.push(
      "the narration cites research, history or numbers but claims is empty; list each claim with what it proves and a source",
    );
  if (!script.takeaway) out.push("takeaway is missing: give the viewer one principle, question or tool");
  return out;
}

/** Repeats are worse when they are recent: the opening and shape the studio should avoid now. */
export function recentHint(recent?: RecentStyles): string {
  if (!recent || (!recent.openings.length && !recent.shapes.length)) return "";
  const avoidOpen = recent.openings.slice(0, 1);
  const avoidShape = recent.shapes.slice(0, 2);
  return [
    avoidOpen.length
      ? `Recent videos opened with: ${recent.openings.slice(0, 4).join(", ")}. Do not use: ${avoidOpen.join(", ")}.`
      : "",
    avoidShape.length
      ? `Recent narrative shapes: ${recent.shapes.slice(0, 4).join(", ")}. Do not use: ${[...new Set(avoidShape)].join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Writes the script. After each draft the editorial checks and the length are measured; if either fails,
 * the writer gets the exact problems and rewrites (at most twice). The draft with the fewest problems wins.
 */
export async function writeScript(
  llm: Llm,
  req: ScriptRequest,
  visualVocabulary: string,
  characterIds?: readonly string[],
): Promise<ScriptResult> {
  const targetWords = Math.round(req.targetSec * WORDS_PER_SEC);
  const scenesHint = Math.max(5, Math.min(12, Math.round(req.targetSec / 8)));
  const hint = recentHint(req.recent);
  const messages: LlmMessage[] = [
    {
      role: "user",
      content: `Theme: ${THEME_BRIEFS[req.theme]}
Topic: ${req.topic}
Target length: about ${req.targetSec} seconds = about ${targetWords} spoken words in total, in about ${scenesHint} scenes.
${hint ? `${hint}\n` : ""}${req.notes ? `Editor notes: ${req.notes}\n` : ""}
First find the real question behind the topic and the one idea the viewer should leave with. Then write.

Studio vocabulary (cast by exact id from Characters; the rest for visualIdea):
${visualVocabulary}`,
    },
  ];
  const usage: Usage[] = [];
  let best: { script: Script; issues: string[] } | undefined;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await llm.json({
      label: `script#${attempt}`,
      system: SCRIPT_SYSTEM,
      messages,
      schema: SCRIPT_SCHEMA,
      maxTokens: 16000,
    });
    usage.push(res.usage);
    const script = toScript(res.value, req, characterIds);
    const words = script.scenes.reduce((n, s) => n + wordCount(s.narration), 0);
    const issues = editorialIssues(script, req.recent);
    if (Math.abs(words - targetWords) > targetWords * 0.25)
      issues.push(`the script has ${words} words; the target is about ${targetWords}`);
    if (!best || issues.length < best.issues.length) best = { script, issues };
    if (!issues.length || attempt === 3) break;
    messages.push(
      { role: "assistant", content: res.text },
      {
        role: "user",
        content: `The editor found these problems:\n${issues.map((i) => `- ${i}`).join("\n")}\nRewrite the script to fix them. Keep what works: the idea, the situation and the takeaway, unless a problem is about them.`,
      },
    );
  }
  const b = best as { script: Script; issues: string[] };
  return { script: b.script, usage, issues: b.issues };
}
