import { WorldSpec, type Script } from "@erkasa/contracts";
import type { Catalog } from "./catalog.js";
import type { Llm, LlmMessage, StrictSchema, Usage } from "./llm.js";

/**
 * The production designer: reads the script and writes the video's World Spec (place, era, costumes,
 * objects, style). Claude decides what the world is; the World Builder draws it.
 *
 * The model answers in a flat draft (no ids to invent, "" for "none"), which is turned into a World Spec
 * here: ids are given by code (`wld_char_1`, `wld_place_<key>`, `wld_prop_<key>`), every script cast member
 * must be played by exactly one world character, and library ids must exist. Problems go back to the
 * model, like the planner's repair loop.
 */

export const GENERATED_PLACES = {
  castle_rampart: "medieval castle walkway over a kingdom with two army camps (kings, heirs, history, power)",
  office_floor: "glass office tower floor over a city skyline (work, business, careers, money decisions)",
  rooftop_night: "city rooftop at night with string lights (street life, friends, bets, risk, loneliness)",
  interview_office:
    "a STAGED office set seen from the side: door, desk, a chair on each side. People enter, walk, sit, talk across the desk and hand things over (interviews, meetings, a boss and an employee, a doctor, a negotiation). Use it whenever the story has a conversation across a desk.",
} as const;
export const GENERATED_PROPS = {
  coin: "a coin that can flip (animation: flip); material gold/silver/copper, motif crown/star/plain",
  balance_scale: "a balance scale that tilts (animations: tilt_left, tilt_right, level): fairness, weighing",
  board: "an empty sign for a short label set by a text layer; material parchment/whiteboard/neon",
  pedestal: "a display pedestal",
} as const;
const COSTUMES = [
  "king",
  "queen",
  "prince",
  "knight",
  "peasant",
  "chef",
  "official",
  "business_suit",
  "office_casual",
  "street",
  "worker",
  "toga",
] as const;
const STYLES = ["storybook", "clean_editorial", "night_noir", "sunset_warm"] as const;
const TIMES = ["day", "golden", "dusk", "night"] as const;

export interface WorldDraft {
  title: string;
  setting: string;
  style: string;
  places: Array<{ key: string; kind: string; from: string; time: string; sideA: string; sideB: string }>;
  cast: Array<{
    plays: string;
    name: string;
    presentation: string;
    age: string;
    skin: string;
    hair: string;
    hairColor: string;
    beard: string;
    glasses: boolean;
    costume: string;
    main: string;
    accent: string;
  }>;
  props: Array<{
    key: string;
    kind: string;
    from: string;
    material: string;
    motif: string;
    function: string;
    scenes: string;
  }>;
}

const str = (description: string, values?: readonly string[]): Record<string, unknown> =>
  values ? { type: "string", enum: [...values], description } : { type: "string", description };
const obj = (properties: Record<string, unknown>): Record<string, unknown> => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

export const WORLD_SCHEMA: StrictSchema = obj({
  title: str("Short title of the world"),
  setting: str("One sentence: where and when the story happens"),
  style: str("The look of the whole video", STYLES),
  places: {
    type: "array",
    description: "1 to 3 places; the first is the main one",
    items: obj({
      key: str("short lowercase key, e.g. main, kitchen"),
      kind: str("a generated place, or library to use a library background", [
        ...Object.keys(GENERATED_PLACES),
        "library",
      ]),
      from: str('kind library: the library background id; otherwise ""'),
      time: str("time of day (generated places)", TIMES),
      sideA: str('#RRGGBB colour of the first side of the story, or ""'),
      sideB: str('#RRGGBB colour of the second side, or ""'),
    }),
  },
  cast: {
    type: "array",
    description: "exactly one entry per script cast member",
    items: obj({
      plays: str("the script cast member's characterId this character plays"),
      name: str("name in the story"),
      presentation: str("", ["man", "woman"]),
      age: str("", ["young", "adult", "middle", "old"]),
      skin: str("", ["light", "medium", "tan", "brown", "dark"]),
      hair: str("", ["short", "swept", "messy", "long", "bob", "buzz", "bald"]),
      hairColor: str("", ["black", "brown", "auburn", "blond", "grey", "white"]),
      beard: str("", ["none", "full", "moustache"]),
      glasses: { type: "boolean" },
      costume: str("costume preset for the era and role", COSTUMES),
      main: str('#RRGGBB main colour of the costume, or ""'),
      accent: str('#RRGGBB accent colour, or ""'),
    }),
  },
  props: {
    type: "array",
    description:
      "0 to 10 objects; only objects a scene needs to SHOW its idea (no decoration). Each one names its function and scenes.",
    items: obj({
      key: str("short lowercase key, e.g. coin, laptop"),
      kind: str("a generated object, or library", [...Object.keys(GENERATED_PROPS), "library"]),
      from: str('kind library: a library object or metaphor id; otherwise ""'),
      material: str('coin: gold/silver/copper; board: parchment/whiteboard/neon; otherwise ""'),
      motif: str("coin face", ["crown", "star", "plain", "none"]),
      function: str(
        "What this object shows or does in the story, in a sentence (e.g. 'the CV the candidate hands to the boss')",
      ),
      scenes: str("Comma-separated script scene ids that use it, e.g. s02,s03"),
    }),
  },
});

export const WORLD_SYSTEM = `You are the production designer of Erkasa, a studio of short animated explainer videos (9:16).
For every video you design ONE world that belongs to its story: the place, the era, what each person wears and the objects the story needs. Every video must look different from the others; inside one video everything must look like one picture.

Rules:
- Read the story first. Choose the era and place the story implies; when the script is set in everyday modern life, design that.
- Prefer a generated place when it fits the story; otherwise pick library backgrounds whose tags fit. One to three places; a main place first. Fewer places, used well, read better than many.
- Costumes say who someone is (era, rank, job). Rivals or two sides get two clearly different colours (sideA/sideB and their costume colours).
- Keep each script cast member's presentation (man/woman) and approximate age from their description.
- Props: only objects a scene needs to SHOW its idea or to make a situation real (the CV in an interview, the coin in a bet). Give each one its function and the scenes that use it. An object that only matches a word of the narration (boxing gloves for "fight for a job") is decoration: leave it out. Fewer, meaningful objects are better than many. Use generated objects when they fit (they animate); otherwise library objects or metaphors from the list, read their description first.
- When people talk across a desk (interview, meeting, a boss and an employee), use the staged set interview_office as a place: the characters can enter, sit, hand things over there.
- Style: storybook = warm picture-book (history, fables, gentle); clean_editorial = neutral modern; night_noir = dark, tense, night; sunset_warm = warm evening, nostalgic.
- Use only ids from the lists. Answer in the JSON format.`;

function libraryPick(catalog: Catalog, text: string): string {
  const bgs = catalog.backgrounds.map((b) => `- ${b.id}: ${b.tags.slice(0, 8).join(", ")}`).join("\n");
  const props = catalog
    .relevantProps(text, 40)
    .filter((p) => p.category === "object" && p.id.startsWith("prop_"))
    .map((p) => `- ${p.id}: ${p.tags.slice(0, 6).join(", ")}${p.about ? ` | ${p.about.slice(0, 140)}` : ""}`)
    .join("\n");
  const mets = catalog.metaphors
    .map((m) => `- ${m.id}: ${m.tags.slice(0, 6).join(", ")}${m.about ? ` | ${m.about.slice(0, 140)}` : ""}`)
    .join("\n");
  return `## Library backgrounds (kind library)\n${bgs}\n\n## Library objects relevant to this script (kind library)\n${props}\n\n## Library metaphors (kind library)\n${mets}`;
}

export function worldPrompt(script: Script, catalog: Catalog): string {
  const text = script.scenes
    .map((s) => `${s.narration} ${s.visualIdea} ${s.setting ?? ""} ${s.action ?? ""}`)
    .join(" ");
  const cast = (script.cast ?? [])
    .map((c) => {
      const ch = catalog.characters.find((x) => x.id === c.characterId);
      return `- ${c.characterId} (${c.role}): ${c.description}${ch ? ` [${ch.gender}, ${ch.tags.slice(0, 5).join(", ")}]` : ""}`;
    })
    .join("\n");
  return `# Generated places
${Object.entries(GENERATED_PLACES)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

# Generated objects
${Object.entries(GENERATED_PROPS)
  .map(([k, v]) => `- ${k}: ${v}`)
  .join("\n")}

# Costume presets: ${COSTUMES.join(", ")}

${libraryPick(catalog, text)}

# Script: "${script.title}" (theme: ${script.theme})
${script.promise ? `The viewer should understand: ${script.promise}\n` : ""}Cast (design one world character for each):
${cast || "- (no cast: design no characters)"}

${script.scenes
  .map((s) =>
    [
      `## ${s.sceneId}`,
      `Narration: ${s.narration}`,
      s.setting ? `Setting: ${s.setting}` : "",
      s.action ? `Action: ${s.action}` : "",
      `Visual idea: ${s.visualIdea}`,
    ]
      .filter(Boolean)
      .join("\n"),
  )
  .join("\n\n")}`;
}

const key = (k: string, fallback: string): string =>
  k
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24) || fallback;
const hex = (v: string): string | undefined => (/^#[0-9A-Fa-f]{6}$/.test(v) ? v.toUpperCase() : undefined);

export interface WorldResult {
  spec?: WorldSpec;
  /** Script cast member (library id) -> world character id. */
  castMap: Record<string, string>;
  /** The host's id in the world, when the user chose one. */
  hostId?: string;
  issues: string[];
  usage: Usage[];
  attempts: number;
}

/** Draft -> World Spec, with every problem the model can fix listed. */
export function draftToWorld(
  draft: WorldDraft,
  script: Script,
  catalog: Catalog,
  worldId: string,
  host?: string,
): { spec?: WorldSpec; castMap: Record<string, string>; hostId?: string; issues: string[] } {
  const issues: string[] = [];
  const castMap: Record<string, string> = {};
  const lib = (id: string, kinds: string[]): boolean => {
    try {
      return kinds.includes(catalog.source.meta(id).category);
    } catch {
      return false;
    }
  };
  const used = new Set<string>();
  const unique = (base: string): string => {
    let id = base;
    for (let i = 2; used.has(id); i++) id = `${base}_${i}`;
    used.add(id);
    return id;
  };

  const places = draft.places.map((p, i) => {
    const id = unique(`wld_place_${i === 0 ? "main" : key(p.key, `p${i + 1}`)}`);
    if (p.kind === "library" && !lib(p.from, ["background"]))
      issues.push(`places[${i}]: '${p.from}' is not a library background`);
    const sides = hex(p.sideA) && hex(p.sideB) ? [hex(p.sideA), hex(p.sideB)] : undefined;
    if (p.kind === "interview_office")
      return { id, kind: "set", set: "interview_office", time: "day", seed: i + 1 };
    return {
      id,
      kind: p.kind,
      ...(p.kind === "library" ? { from: p.from } : {}),
      time: TIMES.includes(p.time as (typeof TIMES)[number]) ? p.time : "day",
      ...(sides ? { sides } : {}),
      seed: i + 1,
    };
  });
  if (!places.length) issues.push("places: give at least one place");

  const scriptCast = (script.cast ?? []).map((c) => c.characterId);
  const cast: Array<Record<string, unknown>> = [];
  draft.cast.forEach((c, i) => {
    if (!scriptCast.includes(c.plays)) {
      issues.push(
        `cast[${i}]: plays '${c.plays}', which is not in the script cast (${scriptCast.join(", ")})`,
      );
      return;
    }
    if (castMap[c.plays]) {
      issues.push(`cast[${i}]: ${c.plays} is already played by another character`);
      return;
    }
    const id = unique(`wld_char_${cast.length + 1}`);
    castMap[c.plays] = id;
    cast.push({
      id,
      name: c.name.slice(0, 40) || `Character ${cast.length + 1}`,
      plays: c.plays,
      body: {
        presentation: c.presentation,
        age: c.age,
        skin: c.skin,
        hair: c.hair,
        hairColor: c.hairColor,
        beard: c.beard,
        glasses: c.glasses,
      },
      costume: {
        preset: c.costume,
        ...(hex(c.main) ? { main: hex(c.main) } : {}),
        ...(hex(c.accent) ? { accent: hex(c.accent) } : {}),
      },
    });
  });
  for (const id of scriptCast)
    if (!castMap[id]) issues.push(`cast: nobody plays ${id}; add one character for it`);
  let hostId: string | undefined;
  if (host) {
    hostId = unique("wld_char_host");
    cast.push({ id: hostId, name: "Host", role: "the narrator chosen by the user", from: host });
  }

  const sceneIds = new Set(script.scenes.map((s) => s.sceneId));
  const props = draft.props.map((p, i) => {
    if (p.kind === "library" && !lib(p.from, ["object", "metaphor"]))
      issues.push(`props[${i}]: '${p.from}' is not a library object or metaphor`);
    const scenes = (p.scenes ?? "")
      .split(/[,\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);
    const fn = (p.function ?? "").trim();
    if (!fn || !scenes.length)
      issues.push(
        `props[${i}] (${p.key}): give its function in the story and the scenes that use it, or leave it out`,
      );
    for (const sc of scenes)
      if (!sceneIds.has(sc)) issues.push(`props[${i}] (${p.key}): scene '${sc}' is not in the script`);
    return {
      ...(fn ? { function: fn.slice(0, 160) } : {}),
      ...(scenes.length ? { scenes: scenes.filter((x) => sceneIds.has(x)) } : {}),
      id: unique(`wld_prop_${key(p.key, `p${i + 1}`)}`),
      kind: p.kind,
      ...(p.kind === "library" ? { from: p.from } : {}),
      ...(p.material ? { material: key(p.material, "gold") } : {}),
      ...(p.motif && p.motif !== "none" ? { motif: p.motif } : {}),
    };
  });

  const parsed = WorldSpec.safeParse({
    schema: "erkasa.world-spec/1",
    worldId,
    title: draft.title.slice(0, 80) || script.title.slice(0, 80),
    setting: draft.setting.slice(0, 300) || script.title,
    style: draft.style,
    places,
    cast: cast.length ? cast : undefined,
    props,
  });
  if (!parsed.success) for (const i of parsed.error.issues) issues.push(`${i.path.join(".")}: ${i.message}`);
  return {
    ...(parsed.success && !issues.length ? { spec: parsed.data } : {}),
    castMap,
    ...(hostId ? { hostId } : {}),
    issues,
  };
}

/** Script -> World Spec, with up to `maxAttempts` repair turns. */
export async function writeWorld(
  llm: Llm,
  script: Script,
  catalog: Catalog,
  opts: { worldId: string; host?: string; maxAttempts?: number },
): Promise<WorldResult> {
  const messages: LlmMessage[] = [{ role: "user", content: worldPrompt(script, catalog) }];
  const usage: Usage[] = [];
  const max = opts.maxAttempts ?? 3;
  let last: ReturnType<typeof draftToWorld> = { castMap: {}, issues: [] };
  for (let attempt = 1; attempt <= max; attempt++) {
    const res = await llm.json({
      label: `world#${attempt}`,
      system: WORLD_SYSTEM,
      messages,
      schema: WORLD_SCHEMA,
      maxTokens: 8000,
    });
    usage.push(res.usage);
    last = draftToWorld(res.value as WorldDraft, script, catalog, opts.worldId, opts.host);
    if (last.spec) return { ...last, usage, attempts: attempt };
    messages.push(
      { role: "assistant", content: res.text },
      {
        role: "user",
        content: `The world has problems:\n${last.issues.map((i) => `- ${i}`).join("\n")}\n\nFix them and answer with the full world.`,
      },
    );
  }
  return { ...last, usage, attempts: max };
}

/** The script with its cast replaced by the world's characters (the planner and the review use these ids). */
export function castIntoWorld(script: Script, castMap: Record<string, string>): Script {
  if (!script.cast) return script;
  return {
    ...script,
    cast: script.cast.map((c) => ({ ...c, characterId: castMap[c.characterId] ?? c.characterId })),
  };
}
