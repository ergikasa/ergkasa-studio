import type { Issue } from "@erkasa/compiler";
import type { Script, VideoPlan } from "@erkasa/contracts";

/**
 * Direction review: the quality rules of the product vision, checked on a compiled plan. The compiler
 * says whether a plan CAN be rendered; this says whether it is well directed. Every finding is an
 * error with a hint, fed back to the planner exactly like a compile error, so the model repairs it.
 *
 * The rules are deliberately few and concrete; each one comes from a defect seen in a real video.
 */

type Scene = VideoPlan["scenes"][number];
type Layer = Scene["layers"][number];
type Actor = Extract<Layer, { type: "actor" }>;

/** Actions that do not count as acting: standing, breathing, lip-sync. */
const PASSIVE = new Set(["idle", "talk"]);
/** Compiler warnings that are real defects for a finished video. */
const BLOCKING_WARNINGS = new Set(["OUT_OF_FRAME", "CUT_AT_SCENE_END"]);

const issue = (code: string, path: string, message: string, hint: string): Issue => ({
  level: "error",
  code,
  path,
  message,
  hint,
});

const actorsOf = (s: Scene): Actor[] => s.layers.filter((l): l is Actor => l.type === "actor");
const shotOf = (s: Scene): string => s.shot?.size ?? "wide";
const words = (t: string): number => t.split(/\s+/).filter(Boolean).length;

export interface ReviewInput {
  plan: VideoPlan;
  script: Script;
  /** Scene durations in seconds, from the compile. */
  durations: Record<string, number>;
  /** Compiler issues of the same plan (warnings are promoted when they are real defects). */
  compileIssues: Issue[];
  /** The host chosen by the user; he may appear next to the story's cast. */
  host?: string;
  /** The video has its own world: few places on purpose, so places may repeat (shots must still vary). */
  world?: boolean;
}

export function reviewDirection({
  plan,
  script,
  durations,
  compileIssues,
  host,
  world,
}: ReviewInput): Issue[] {
  const out: Issue[] = [];
  const scenes = plan.scenes;
  const n = scenes.length;

  // 1. one cast for the whole film; the protagonist carries it
  const cast = new Set((script.cast ?? []).map((c) => c.characterId));
  if (cast.size && host) cast.add(host); // the host presents; he is allowed next to the cast
  const protagonist = script.cast?.find((c) => c.role === "protagonist")?.characterId;
  if (cast.size) {
    scenes.forEach((s, i) =>
      actorsOf(s).forEach((a) => {
        const id = a.assetId.split("@")[0] ?? a.assetId;
        if (!cast.has(id))
          out.push(
            issue(
              "CAST_CHANGE",
              `scenes[${i}].layers.${a.id}`,
              `${id} is not in the story's cast; a different character would read as a different person`,
              `use ${[...cast].join(" or ")}`,
            ),
          );
      }),
    );
  }
  if (protagonist) {
    // an editorial script (problem -> concept -> situation -> analysis -> conclusion) also explains with a
    // real case, a metaphor or a chart; the protagonist carries the situation, not every scene
    const editorial = script.shape !== undefined || script.scenes.some((s) => s.beat === "situation");
    const need = Math.ceil(editorial ? n / 3 : n / 2);
    const present = scenes.filter((s) => actorsOf(s).some((a) => a.assetId.startsWith(protagonist))).length;
    if (present < need)
      out.push(
        issue(
          "PROTAGONIST_MISSING",
          "scenes",
          `the protagonist appears in ${present} of ${n} scenes`,
          `keep ${protagonist} on screen in at least ${need} scenes; concept scenes can show them reacting to the metaphor or chart`,
        ),
      );
  }

  // 2. variety of places and framing
  const maxUses = Math.max(2, Math.ceil(n / 3));
  const uses = new Map<string, number[]>();
  scenes.forEach((s, i) => uses.set(s.background.assetId, [...(uses.get(s.background.assetId) ?? []), i]));
  // a staged set is where the story happens (an interview): it may hold more scenes, still with varied shots
  const staged = new Set(scenes.filter((s) => s.set).map((s) => s.background.assetId));
  for (const [bg, idx] of uses)
    if (!world && idx.length > (staged.has(bg) ? Math.max(maxUses, Math.ceil(n * 0.6)) : maxUses))
      out.push(
        issue(
          "BACKGROUND_OVERUSED",
          `scenes[${idx[maxUses]}].background`,
          `${bg} is used in ${idx.length} of ${n} scenes`,
          `use it at most ${maxUses} times; move the story to another place, or show an object/metaphor scene instead`,
        ),
      );
  scenes.forEach((s, i) => {
    const prev = scenes[i - 1];
    if (prev && prev.background.assetId === s.background.assetId && shotOf(prev) === shotOf(s))
      out.push(
        issue(
          "SAME_SHOT_REPEATED",
          `scenes[${i}].shot`,
          `same place and same ${shotOf(s)} shot as the previous scene: it reads as one long static shot`,
          "change the shot size (wide -> medium -> close) or the place",
        ),
      );
  });
  if (n >= 5) {
    const sizes = new Set(scenes.map(shotOf));
    if (sizes.size < 3)
      out.push(
        issue(
          "SHOT_VARIETY",
          "scenes",
          `only ${[...sizes].join(" and ")} shots`,
          "use at least three of wide, medium, close and insert across the film",
        ),
      );
  }
  const first = scenes[0];
  if (first && shotOf(first) === "wide")
    out.push(
      issue(
        "WEAK_HOOK_SHOT",
        "scenes[0].shot",
        "the hook opens on a wide shot: the face and the emotion are too small on a phone",
        "open on a medium or close shot of the protagonist, or an insert on the key object",
      ),
    );

  // 3. characters act, and feel
  scenes.forEach((s, i) => {
    const dur = durations[s.sceneId] ?? 0;
    if (dur < 3) return;
    for (const a of actorsOf(s)) {
      const acting =
        a.actions.some((x) => !PASSIVE.has(x.action) || x.expression) ||
        a.blocking.some((b) => b.do !== "seated" && b.do !== "standing");
      if (!acting)
        out.push(
          issue(
            "STATIC_ACTOR",
            `scenes[${i}].layers.${a.id}.actions`,
            `${a.id} only stands and talks for ${dur.toFixed(1)} s`,
            "give them something to do that shows the moment: use_phone, read, check_watch, facepalm, stressed, slump, shrug, think, walk, type, or an expression change on a word",
          ),
        );
    }
  });
  if (protagonist && n >= 4) {
    const faces = new Set<string>();
    for (const s of scenes)
      for (const a of actorsOf(s))
        if (a.assetId.startsWith(protagonist)) {
          faces.add(a.expression);
          for (const x of a.actions) if (x.expression) faces.add(x.expression);
        }
    if (faces.size < 3)
      out.push(
        issue(
          "FLAT_EMOTION",
          "scenes",
          `the protagonist shows only ${[...faces].join(", ") || "one"} expression(s)`,
          "follow the script's emotions: change the expression with the story (e.g. sad -> thinking -> surprised -> happy)",
        ),
      );
  }

  // 4. words on screen support the moment, they do not compete with the captions
  let titles = 0;
  scenes.forEach((s, i) => {
    const texts = s.layers.filter((l) => l.type === "text");
    titles += texts.length;
    if (texts.length > 1)
      out.push(
        issue(
          "TOO_MUCH_TEXT",
          `scenes[${i}].layers`,
          `${texts.length} text overlays in one scene`,
          "keep one, or none",
        ),
      );
    for (const t of texts)
      if (t.type === "text" && words(t.content) > 5)
        out.push(
          issue(
            "TEXT_TOO_LONG",
            `scenes[${i}].layers.${t.id}.content`,
            `"${t.content}" is ${words(t.content)} words`,
            "max 5 words: the captions already carry the sentence",
          ),
        );
  });
  if (titles > Math.ceil(n / 2) + 1)
    out.push(
      issue(
        "TOO_MUCH_TEXT",
        "scenes",
        `${titles} text overlays in ${n} scenes`,
        `use at most ${Math.ceil(n / 2) + 1}, only for the words that matter most`,
      ),
    );

  // 5. finished frames: nothing cut by the edge, nothing still animating when the scene ends
  for (const w of compileIssues)
    if (w.level === "warning" && BLOCKING_WARNINGS.has(w.code)) out.push({ ...w, level: "error" });

  return out;
}
