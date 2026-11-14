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
const BLOCKING_WARNINGS = new Set(["OUT_OF_FRAME", "CUT_AT_SCENE_END", "ACTORS_OVERLAP"]);

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

  // 0. signs in the world are for key concepts: not a second set of captions
  const labels = scenes.reduce(
    (c, sc) => c + sc.layers.filter((l) => "label" in l && l.label !== undefined).length,
    0,
  );
  if (labels > 6)
    out.push(
      issue(
        "LABELS_MANY",
        "scenes",
        `${labels} signs in the world; they are for key concepts only (at most 6)`,
        "remove the signs that repeat the narration or name the obvious",
      ),
    );

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
  if (n >= 6) {
    const moves = scenes.map((s) => s.camera.find((m) => m.move !== "static")?.move ?? "static");
    const count = new Map<string, number>();
    for (const m of moves) count.set(m, (count.get(m) ?? 0) + 1);
    const [top, topN] = [...count.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["static", 0];
    if (top !== "static" && topN > n * 0.6)
      out.push(
        issue(
          "CAMERA_MONOTONE",
          "scenes",
          `${topN} of ${n} scenes use the same camera move (${top}): the film feels mechanical`,
          "vary it: pull_out to reveal, punch_in on the key word, follow a walking actor, a held static beat, a pan along a wide place",
        ),
      );
    // one person always centred and the same size: the frame never changes
    const alone = scenes.filter((s) => actorsOf(s).length === 1);
    const centred = alone.filter((s) => {
      const a = s.layers.find((l) => l.type === "actor");
      return a !== undefined && Math.abs((a.place.x ?? 0.5) - 0.5) < 0.12;
    });
    if (alone.length >= 5 && centred.length > alone.length * 0.6)
      out.push(
        issue(
          "LAYOUT_MONOTONE",
          "scenes",
          `the main person stands in the middle of the frame in ${centred.length} of ${alone.length} single-person scenes`,
          "use the sides: person at 0.25 with the object at 0.7, then swap; a close shot with the person off-centre; let the object take the middle",
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

  // 5. directed scenes (plans whose scenes carry a direction): demonstrate, do not illustrate
  if (scenes.some((s) => s.direction)) out.push(...reviewDirected(scenes, script, durations, host));

  // 6. finished frames: nothing cut by the edge, nothing still animating when the scene ends
  for (const w of compileIssues)
    if (w.level === "warning" && BLOCKING_WARNINGS.has(w.code)) out.push({ ...w, level: "error" });

  return out;
}

const norm = (t: string): string =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, "")
    .trim();

/** What an actor does in a scene that a viewer reads as acting: gestures, face changes, moves. */
function beats(a: Actor): number {
  return (
    a.actions.filter((x) => !PASSIVE.has(x.action)).length +
    a.actions.filter((x) => x.expression).length +
    a.blocking.filter((b) => b.do !== "seated" && b.do !== "standing").length
  );
}

/** Things that happen in a scene after it opens (moves, gestures, objects changing, things appearing). */
function events(s: Scene): number {
  let n = s.camera.filter((c) => c.move !== "static").length;
  for (const l of s.layers) {
    if (l.in && l.in.at !== "start") n++;
    if (l.type === "actor") n += beats(l);
    if (l.type === "object" || l.type === "icon" || l.type === "metaphor") n += l.animations.length;
    if (l.type === "chart") n++;
  }
  return n;
}

/** Same place, same framing, the same people where they were: the viewer sees the same picture again. */
function samePicture(a: Scene, b: Scene): boolean {
  if (a.background.assetId !== b.background.assetId || shotOf(a) !== shotOf(b)) return false;
  if ((a.shot?.subject ?? "") !== (b.shot?.subject ?? "")) return false; // the camera is on someone else
  const aa = actorsOf(a);
  const bb = actorsOf(b);
  if (!aa.length || aa.length !== bb.length) return !aa.length && !bb.length && !a.set && !b.set;
  return aa.every((x) => {
    const y = bb.find((z) => z.assetId === x.assetId);
    if (!y) return false;
    if (a.set || b.set) {
      const start = (q: Actor) => q.blocking[0]?.mark ?? "";
      return start(x) === start(y) && q(x) === q(y);
    }
    return Math.abs(x.place.x - y.place.x) < 0.08 && x.facing === y.facing;
  });
  function q(z: Actor): string {
    return z.blocking.map((b) => b.do).join(",");
  }
}

function reviewDirected(
  scenes: Scene[],
  script: Script,
  durations: Record<string, number>,
  host?: string,
): Issue[] {
  const out: Issue[] = [];
  const n = scenes.length;
  scenes.forEach((s, i) => {
    const d = s.direction;
    if (!d) {
      out.push(
        issue(
          "DIRECTION_MISSING",
          `scenes[${i}].direction`,
          "this scene has no direction",
          "write its idea, how it is demonstrated, and what the viewer sees before and after",
        ),
      );
      return;
    }
    // pacing by tone: tense scenes that run long must move the camera; calm ones must not jolt
    const beat = script.scenes.find((x) => x.sceneId === s.sceneId)?.beat;
    const sceneSec = durations[s.sceneId] ?? 0;
    const moves = s.camera.map((m) => m.move);
    if (
      (beat === "tension" || beat === "twist" || beat === "problem") &&
      sceneSec > 5 &&
      !moves.some((m) => m !== "static")
    )
      out.push(
        issue(
          "PACING_STATIC_TENSION",
          `scenes[${i}].camera`,
          `a ${beat} scene of ${sceneSec.toFixed(1)} s with a static camera feels flat`,
          "add a push_in or a follow so the tension builds",
        ),
      );
    if (
      (beat === "resolve" || beat === "conclusion" || beat === "relate") &&
      moves.some((m) => m === "shake" || m === "punch_in")
    )
      out.push(
        issue(
          "PACING_JOLT_IN_CALM",
          `scenes[${i}].camera`,
          `a ${beat} scene must be calm but the camera ${moves.includes("shake") ? "shakes" : "punches in"}`,
          "use static, a slow push_in or a pull_out here",
        ),
      );
    if (norm(d.before) === norm(d.after) || events(s) === 0)
      out.push(
        issue(
          "NO_VISIBLE_CHANGE",
          `scenes[${i}]`,
          events(s) === 0
            ? "nothing happens after the scene opens: it is an illustration, not a demonstration"
            : "before and after are the same",
          "make something visibly change on the key words: someone enters or reacts, an object changes, a comparison flips, a chart grows",
        ),
      );
    for (const l of s.layers)
      if ((l.type === "object" || l.type === "icon" || l.type === "metaphor") && !l.purpose?.trim())
        out.push(
          issue(
            "PURPOSELESS_LAYER",
            `scenes[${i}].layers.${l.id}`,
            `${l.assetId} has no job in the scene`,
            "say what it shows for the idea, or remove it: an object that only matches a word is decoration",
          ),
        );
    const dur = durations[s.sceneId] ?? 0;
    if (dur >= 3.5)
      for (const a of actorsOf(s)) {
        if (host && a.assetId.startsWith(host)) continue;
        if (beats(a) < 2)
          out.push(
            issue(
              "ONE_NOTE_ACTOR",
              `scenes[${i}].layers.${a.id}`,
              `${a.id} does only one thing in ${dur.toFixed(1)} s`,
              "give them a gesture and a reaction timed to the words (and an expression change on the key word)",
            ),
          );
      }
    for (const back of [1, 2]) {
      const prev = scenes[i - back];
      if (prev && samePicture(prev, s)) {
        out.push(
          issue(
            "REPEATED_PICTURE",
            `scenes[${i}]`,
            `same place, framing and positions as scene ${i - back + 1}`,
            "move the event forward with a new picture: another shot size, another moment of the action, people elsewhere or turned, or an insert on the key object",
          ),
        );
        break;
      }
    }
  });
  const statements = scenes.filter((s) => s.direction?.demonstration === "statement").length;
  const maxStatements = Math.max(1, Math.floor(n / 5));
  if (statements > maxStatements)
    out.push(
      issue(
        "TOO_MANY_STATEMENTS",
        "scenes",
        `${statements} scenes only state the idea (title or host)`,
        `at most ${maxStatements}: show it instead, with a situation, a comparison or a changing metaphor`,
      ),
    );
  const shown = scenes.filter((s) =>
    ["story_moment", "comparison"].includes(s.direction?.demonstration ?? ""),
  ).length;
  if (script.cast?.length && shown < Math.ceil(n / 3))
    out.push(
      issue(
        "TOLD_NOT_SHOWN",
        "scenes",
        `only ${shown} of ${n} scenes show people in a situation or a comparison`,
        "stage the script's situation across consecutive scenes as one event (enter, watch, mistake, judgement...)",
      ),
    );
  return out;
}
